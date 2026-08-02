# File: app/services/parsing/keys.py
"""Deterministic idempotency keys for imported transactions.

Re-importing a statement must be a no-op. That guarantee rests on one property:
the same real-world transaction must always produce the same key string, no
matter which file it arrives in or where it sits in that file. So a key is built
*only* from the transaction's own content -- never from a row's position, a
statement's serial number, or the time of the upload.

The previous scheme keyed on the bank's row serial ("S No") and cheque-number
columns. Both are properties of the *export*, not the transaction: a re-export
covering a different date range renumbers every row, so every transaction looked
new. Blank cheque numbers were worse -- they stringified to "-" or "nan", giving
unrelated transactions the same key and silently dropping real ones.

Anything reconstructing keys for rows already in the database must reuse these
helpers, or old rows and newly parsed ones will disagree and duplicate.
"""
import hashlib
import re
from collections import defaultdict

# Bumped when the key formula changes, so old and new keys can never collide.
KEY_VERSION = "v2"

_WHITESPACE_RE = re.compile(r"\s+")
_REF_RE = re.compile(r"\d{6,}")
_UPI_IN_DESCRIPTION_RE = re.compile(r"(\d{12})")


def normalize_ref(value) -> str | None:
    """A usable bank reference, or None if the cell was effectively blank.

    Statements spell "no reference" many ways -- an empty cell, "-", "NA", or a
    pandas NaN that stringifies to "nan". None of those identify a transaction,
    and treating one as if it did is what made unrelated rows collide before.
    Numeric columns also arrive as floats ("501049617261.0"), so the trailing
    ".0" is trimmed before validating.
    """
    if value is None:
        return None
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text if _REF_RE.fullmatch(text) else None


def extract_upi_ref(description: str) -> str | None:
    """The 12-digit UPI reference embedded in a bank narration, if any."""
    text = str(description or "")
    if "UPI" not in text:
        return None
    match = _UPI_IN_DESCRIPTION_RE.search(text)
    return match.group(1) if match else None


def _identity(upi_ref, description) -> str:
    """The strongest available identifier for one transaction.

    Prefers the bank's own reference (a UPI ref is globally unique and travels
    with the transaction across exports). Falls back to a hash of the normalised
    description, which is stable for the same row in any export of the same
    statement.
    """
    ref = normalize_ref(upi_ref)
    if ref:
        return f"U{ref}"
    normalized = _WHITESPACE_RE.sub(" ", str(description or "").strip().lower())
    return "D" + hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:12]


def base_key(account_id, txn_date, amount, txn_type, upi_ref, description) -> str:
    """The content fingerprint of a transaction, before occurrence numbering."""
    return (
        f"{KEY_VERSION}-{account_id}-{txn_date:%Y%m%d}-{float(amount):.2f}"
        f"-{txn_type}-{_identity(upi_ref, description)}"
    )


class KeyBuilder:
    """Assigns unique keys across one parse of one FILE (every grid in it --
    a PDF's pages, an Excel workbook's sheets -- must share one instance).

    Genuinely repeated transactions exist -- two identical metro fares on the
    same day, neither carrying a reference -- and they must both survive. They
    share a fingerprint, so the second and later ones get an occurrence suffix.

    That numbering is stable rather than arbitrary: a statement lists rows in a
    fixed order, so re-parsing the same file assigns the same suffixes and every
    row dedupes. A longer export containing an extra repeat produces the known
    keys plus one new suffix, so only the genuinely new row is inserted.

    Scoping this to less than the whole file (e.g. one instance per PDF page)
    would reset the occurrence count at each page boundary and collide two
    genuinely different repeats that happen to land on different pages.
    """

    def __init__(self):
        self._seen: dict[str, int] = defaultdict(int)

    def build(self, *, account_id, txn_date, amount, txn_type, upi_ref, description) -> str:
        base = base_key(account_id, txn_date, amount, txn_type, upi_ref, description)
        occurrence = self._seen[base]
        self._seen[base] = occurrence + 1
        return base if occurrence == 0 else f"{base}#{occurrence}"
