# File: app/services/merchant_matching_service.py
"""Local-only merchant identification: UPI-handle exact match, falling back to
fuzzy text similarity. No LLM calls anywhere in this module -- see
WEB_REDESIGN_BRIEF.md Part 2's security-constraint note for why: raw
transaction `description` strings are financial PII (UPI handles often embed
phone numbers; strings also carry bank names + reference numbers), and a
merchant rescan sweeps the entire unmapped backlog automatically and
unreviewed -- a materially bigger and more routine exposure than the
Assistant's user-initiated, rate-limited, ≤25-row queries. UPI/bank strings
are structured enough that local matching is both safer and, since it's
deterministic, at least as accurate here.

Used identically at statement-upload time (upload_service.py, matching
against transactions not yet inserted) and by the manual `/merchants/rescan`
endpoint (matching against transactions already in the DB) -- both paths
build a MerchantFingerprint per existing merchant and call `match_description`
against it.
"""
import re
from dataclasses import dataclass, field
from typing import Optional

from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from app.models.merchant import Merchant
from app.models.transaction import Transaction

# The `name@bank` VPA token embedded in a UPI narration. Distinct from
# app.services.parsing.keys.extract_upi_ref, which pulls the 12-digit bank
# reference number used for de-dup keys -- that's a different field with a
# different purpose (uniquely identifies one transaction; this identifies a
# recurring counterparty across many transactions).
#
# Validated against real production narrations, both formats banks use:
#   UPI/payzomato@hdfcb/NA/HDFC BANK LTD/384053816925/PTM40a8dd7d9d514a83bf868eb95f
#   UPI-SAGAR-9110272360@AXL-KKBK0000958-516557005288-SENT USING PAYTM U
#   UPI/cf.zeptonowltd@/NA/ICICI Bank LTD                    (empty bank suffix)
#   UPI/8197541439-2@yb/Sent from Paytm/Karnataka Grami/...  (truncated suffix)
# Only whitespace breaks a match, not hyphens/dots -- so a preceding
# multi-word name field (e.g. "M S SRI UDUPI SANNID-EAZYPAY....@ICICI") stops
# matching at the last space and the trailing no-space word rides along with
# the handle ("sannid-eazypay....@icici"). That's still fine for this
# algorithm's purpose: what matters is the SAME string extracted consistently
# from repeat transactions of the same merchant, not an exact VPA per se.
_VPA_RE = re.compile(r"([A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9]*)")

HIGH_CONFIDENCE = "high"
MEDIUM_CONFIDENCE = "medium"

# rapidfuzz.fuzz.ratio (0-100). Calibrated against real production
# description pairs rather than guessed: same-merchant/same-format pairs
# scored 70-95, different-merchant pairs scored 19-40 -- 65 sits well clear
# of the noise floor with margin. token_sort/partial ratio were tried too;
# plain `ratio` gave the cleanest separation on structured, non-reordered
# strings like these.
FUZZY_THRESHOLD = 65


@dataclass
class MerchantFingerprint:
    """What's known about one existing merchant, built from transactions
    already linked to it -- the corpus both match tiers compare against."""
    merchant_id: int
    name: str
    category_id: Optional[int]
    handles: set[str] = field(default_factory=set)
    descriptions: list[str] = field(default_factory=list)


@dataclass
class MatchResult:
    merchant_id: int
    merchant_name: str
    category_id: Optional[int]
    confidence: str  # HIGH_CONFIDENCE | MEDIUM_CONFIDENCE
    reason: str
    similarity: Optional[float] = None  # only set for medium-confidence (fuzzy) matches


def extract_vpa_handle(description: str) -> Optional[str]:
    """The lowercased `name@bank` VPA handle in a narration, or None."""
    if not description or "@" not in description:
        return None
    match = _VPA_RE.search(description)
    if not match:
        return None
    handle = match.group(1).strip().lower()
    return handle or None


def build_fingerprints(db: Session, user_id: int) -> dict[int, MerchantFingerprint]:
    """One fingerprint per merchant the user already has, from every
    transaction currently linked to it. Call once per matching pass (upload
    or rescan), not per transaction -- this is the expensive part."""
    fingerprints: dict[int, MerchantFingerprint] = {}
    merchants = db.query(Merchant).filter(Merchant.user_id == user_id).all()
    for merchant in merchants:
        fingerprints[merchant.id] = MerchantFingerprint(
            merchant_id=merchant.id, name=merchant.name, category_id=merchant.category_id
        )

    if not fingerprints:
        return fingerprints

    linked = (
        db.query(Transaction.merchant_id, Transaction.description)
        .filter(
            Transaction.user_id == user_id,
            Transaction.merchant_id.in_(fingerprints.keys()),
        )
        .all()
    )
    for merchant_id, description in linked:
        fp = fingerprints.get(merchant_id)
        if not fp or not description:
            continue
        handle = extract_vpa_handle(description)
        if handle:
            fp.handles.add(handle)
        fp.descriptions.append(description)

    return fingerprints


def match_description(
    description: str, fingerprints: dict[int, MerchantFingerprint]
) -> Optional[MatchResult]:
    """Match one raw description against every known merchant fingerprint.

    Exact VPA-handle match -> high confidence, auto-apply. Otherwise the best
    fuzzy match across all merchants' known description strings, if it clears
    FUZZY_THRESHOLD -> medium confidence, needs a human accept/dismiss.
    """
    if not fingerprints:
        return None

    handle = extract_vpa_handle(description)
    if handle:
        for fp in fingerprints.values():
            if handle in fp.handles:
                return MatchResult(
                    merchant_id=fp.merchant_id,
                    merchant_name=fp.name,
                    category_id=fp.category_id,
                    confidence=HIGH_CONFIDENCE,
                    reason=f"Exact handle match ({handle})",
                )

    best_fp: Optional[MerchantFingerprint] = None
    best_score = 0.0
    for fp in fingerprints.values():
        for known in fp.descriptions:
            score = fuzz.ratio(description, known)
            if score > best_score:
                best_score = score
                best_fp = fp

    if best_fp and best_score >= FUZZY_THRESHOLD:
        return MatchResult(
            merchant_id=best_fp.merchant_id,
            merchant_name=best_fp.name,
            category_id=best_fp.category_id,
            confidence=MEDIUM_CONFIDENCE,
            reason=f"{best_score:.0f}% similar to {best_fp.name}",
            similarity=round(best_score, 1),
        )

    return None


def cluster_unmapped_descriptions(
    descriptions: list[tuple[int, str]],
) -> list[list[int]]:
    """Group currently-unmapped transactions (no merchant_id at all yet) by
    shared VPA handle, for the cold-start bulk-naming banner. `descriptions`
    is a list of (transaction_id, description). Returns groups of transaction
    ids, largest first, dropping singletons (nothing to bulk-name there).

    Distinct from `match_description` above: that matches against merchants
    that already exist, this clusters transactions that don't have ANY
    merchant yet, purely by shared handle -- exact only, no fuzzy step,
    since a false-positive cluster merge is harder for a user to unpick than
    a missed one.
    """
    groups: dict[str, list[int]] = {}
    for txn_id, description in descriptions:
        handle = extract_vpa_handle(description)
        if not handle:
            continue
        groups.setdefault(handle, []).append(txn_id)

    clusters = [ids for ids in groups.values() if len(ids) > 1]
    clusters.sort(key=len, reverse=True)
    return clusters
