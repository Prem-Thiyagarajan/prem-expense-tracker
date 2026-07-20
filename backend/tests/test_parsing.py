# File: tests/test_parsing.py
# Standalone parser self-check. Run: python tests/test_parsing.py  (from backend/)
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import parsing  # noqa: E402

HDFC_COLS = "Date,Narration,Chq/RefNo,Withdrawal Amt,Deposit Amt\n"
HDFC_ROWS = (
    "01/07/2025,UPI-ZOMATO-123456789012-PAYMENT,REF1,250.00,\n"
    "02/07/2025,SALARY CREDIT,REF2,,50000.00\n"
)
HDFC_CSV = (HDFC_COLS + HDFC_ROWS).encode()

PAYTM_CSV = (
    "Date,Time,Transaction Details,Your Account,Amount,UPI Ref No.,Remarks\n"
    "01/07/2025,10:30:00,Paid to Zomato,HDFC Bank XX1234,-250,123456789012,\n"
).encode()

ACCOUNTS = {"HDFC Bank": 7}


def test_hdfc_by_filename():
    txns = parsing.parse_statement("hdfc_july.csv", HDFC_CSV, ACCOUNTS)
    assert len(txns) == 2, txns
    debit, credit = txns
    assert debit["type"] == "debit" and debit["amount"] == 250.0
    assert debit["account_id"] == 7 and debit["source"] == "HDFC"
    assert debit["upi_ref"] == "123456789012"
    assert debit["unique_key"].startswith("HDFC-REF1-")
    assert credit["type"] == "credit" and credit["amount"] == 50000.0


def test_detection_by_header_when_filename_is_generic():
    # filename gives no hint; header signature must still identify HDFC
    txns = parsing.parse_statement("export_2025.csv", HDFC_CSV, ACCOUNTS)
    assert len(txns) == 2, txns


def test_unconfigured_account_is_skipped():
    txns = parsing.parse_statement("hdfc_july.csv", HDFC_CSV, {"ICICI Bank": 1})
    assert txns == []


def test_unsupported_extension_raises():
    try:
        parsing.parse_statement("statement.txt", b"whatever", ACCOUNTS)
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_row_cap_raises():
    original = parsing.MAX_ROWS_PER_SHEET
    parsing.MAX_ROWS_PER_SHEET = 1
    try:
        parsing.parse_statement("hdfc.csv", HDFC_CSV, ACCOUNTS)
        assert False, "expected ValueError for oversized sheet"
    except ValueError:
        pass
    finally:
        parsing.MAX_ROWS_PER_SHEET = original


def test_paytm():
    txns = parsing.parse_statement("paytm_july.csv", PAYTM_CSV, ACCOUNTS)
    assert len(txns) == 1, txns
    t = txns[0]
    assert t["type"] == "debit" and t["amount"] == 250.0
    assert t["account_id"] == 7 and t["source"] == "HDFC Bank"


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")
    print("parsing self-check OK")
