# File: tests/test_merchant_matching.py
# Standalone self-check, no DB. Run: python tests/test_merchant_matching.py  (from backend/)
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.merchant_matching_service import (  # noqa: E402
    MerchantFingerprint,
    HIGH_CONFIDENCE,
    MEDIUM_CONFIDENCE,
    extract_vpa_handle,
    build_fingerprints,
    match_description,
    cluster_unmapped_descriptions,
)


# --- Real production narration samples (both bank formats), used throughout ---
SLASH_ZOMATO_1 = "UPI/payzomato@hdfcb/NA/HDFC BANK LTD/384053816925/PTM40a8dd7d9d514a83bf868eb95f"
SLASH_ZOMATO_2 = "UPI/payzomato@hdfcb/NA/HDFC BANK LTD/283939200460/PTMe16387c39bb147ac8f98f92d9c"
DASH_SANNIDHI_1 = "UPI-M S SRI UDUPI SANNID-EAZYPAY.JZRWPSU0LCNRBPI@ICICI-ICIC0DC0099-516881594654-SENT USING PAYTM U"
DASH_SANNIDHI_2 = "UPI-M S SRI UDUPI SANNID-EAZYPAY.JZRWPSU0LCNRBPI@ICICI-ICIC0DC0099-516773889667-SENT USING PAYTM U"
SLASH_SWIGGY = "UPI/swiggy@yespay/Pay for merchan/YesBank_Yespay/503107793107/YJPf93a6286cb9b4f"
DASH_TRANSFER = "UPI-SAGAR-9110272360@AXL-KKBK0000958-516557005288-SENT USING PAYTM U"
NO_HANDLE = "METRO CARD RECHARGE"
EMPTY_SUFFIX = "UPI/cf.zeptonowltd@/NA/ICICI Bank LTD"


def test_extract_vpa_handle_slash_format():
    assert extract_vpa_handle(SLASH_ZOMATO_1) == "payzomato@hdfcb"


def test_extract_vpa_handle_dash_format_stops_at_the_last_space():
    # "M S SRI UDUPI SANNID" is space-delimited up to "SANNID", then a
    # no-space hyphen into "EAZYPAY...." -- matching starts right after the
    # last space, so the trailing name word rides along with the handle.
    # What matters for matching is that this is reproduced identically for
    # every repeat transaction of the same merchant (see the fuzzy-match
    # test below), not that it's the bank's literal VPA.
    assert extract_vpa_handle(DASH_SANNIDHI_1) == "sannid-eazypay.jzrwpsu0lcnrbpi@icici"


def test_extract_vpa_handle_is_case_insensitive_on_output():
    assert extract_vpa_handle("UPI/Q812037834@YBL/Sent using Payt") == "q812037834@ybl"


def test_extract_vpa_handle_handles_empty_bank_suffix():
    assert extract_vpa_handle(EMPTY_SUFFIX) == "cf.zeptonowltd@"


def test_extract_vpa_handle_returns_none_without_at_sign():
    assert extract_vpa_handle(NO_HANDLE) is None
    assert extract_vpa_handle("") is None
    assert extract_vpa_handle(None) is None  # type: ignore[arg-type]


def test_match_high_confidence_on_exact_handle_repeat():
    fingerprints = {
        1: MerchantFingerprint(merchant_id=1, name="Zomato", category_id=7, handles={"payzomato@hdfcb"}, descriptions=[SLASH_ZOMATO_1]),
    }
    result = match_description(SLASH_ZOMATO_2, fingerprints)
    assert result is not None
    assert result.confidence == HIGH_CONFIDENCE
    assert result.merchant_id == 1
    assert result.merchant_name == "Zomato"
    assert result.category_id == 7


def test_match_medium_confidence_on_fuzzy_similarity_without_handle_repeat():
    # Fingerprint deliberately built with an empty handle set (rather than via
    # build_fingerprints(), which would populate it) to exercise the fuzzy
    # fallback path in isolation, independent of whether these two real
    # samples happen to also share an exact handle.
    fingerprints = {
        1: MerchantFingerprint(merchant_id=1, name="M S Sri Udupi Sannidhi", category_id=3, handles=set(), descriptions=[DASH_SANNIDHI_1]),
    }
    result = match_description(DASH_SANNIDHI_2, fingerprints)
    assert result is not None
    assert result.confidence == MEDIUM_CONFIDENCE
    assert result.merchant_id == 1
    assert result.similarity is not None and result.similarity >= 65


def test_match_returns_none_for_a_different_merchant():
    fingerprints = {
        1: MerchantFingerprint(merchant_id=1, name="Zomato", category_id=7, handles={"payzomato@hdfcb"}, descriptions=[SLASH_ZOMATO_1]),
    }
    assert match_description(SLASH_SWIGGY, fingerprints) is None


def test_match_returns_none_with_no_fingerprints():
    assert match_description(SLASH_ZOMATO_1, {}) is None


def test_cluster_unmapped_descriptions_groups_by_shared_handle():
    rows = [
        (1, SLASH_ZOMATO_1),
        (2, SLASH_ZOMATO_2),
        (3, SLASH_SWIGGY),
        (4, NO_HANDLE),  # no handle -- excluded entirely
        (5, DASH_TRANSFER),  # singleton handle -- not a cluster
    ]
    clusters = cluster_unmapped_descriptions(rows)
    assert clusters == [[1, 2]]


def test_cluster_unmapped_descriptions_empty_input():
    assert cluster_unmapped_descriptions([]) == []


class _FakeQuery:
    """Minimal stand-in for the two-step db.query(...).filter(...).all() /
    db.query(...).filter(...).all() chain build_fingerprints() runs, without
    pulling in a real Session/DB for a pure-logic unit test."""
    def __init__(self, rows):
        self._rows = rows

    def filter(self, *_args, **_kwargs):
        return self

    def all(self):
        return self._rows


class _FakeMerchant:
    def __init__(self, id, name, category_id):
        self.id = id
        self.name = name
        self.category_id = category_id


class _FakeDb:
    def __init__(self, merchants, linked_rows):
        self._merchants = merchants
        self._linked_rows = linked_rows

    def query(self, *entities):
        # app.models.merchant.Merchant -> the merchant list query.
        # Transaction.merchant_id, Transaction.description -> the linked-txn query.
        if len(entities) == 1:
            return _FakeQuery(self._merchants)
        return _FakeQuery(self._linked_rows)


def test_build_fingerprints_collects_handles_and_descriptions_per_merchant():
    db = _FakeDb(
        merchants=[_FakeMerchant(id=1, name="Zomato", category_id=7)],
        linked_rows=[(1, SLASH_ZOMATO_1), (1, SLASH_ZOMATO_2)],
    )
    fingerprints = build_fingerprints(db, user_id=1)  # type: ignore[arg-type]
    assert set(fingerprints.keys()) == {1}
    fp = fingerprints[1]
    assert fp.name == "Zomato"
    assert fp.handles == {"payzomato@hdfcb"}
    assert fp.descriptions == [SLASH_ZOMATO_1, SLASH_ZOMATO_2]


def test_build_fingerprints_empty_when_user_has_no_merchants():
    db = _FakeDb(merchants=[], linked_rows=[])
    assert build_fingerprints(db, user_id=1) == {}  # type: ignore[arg-type]


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")
    print("merchant matching self-check OK")
