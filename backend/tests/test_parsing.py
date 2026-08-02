# File: tests/test_parsing.py
# Standalone parser self-check. Run: python tests/test_parsing.py  (from backend/)
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd  # noqa: E402

from app.services import parsing  # noqa: E402
from app.services.parsing import _detect  # noqa: E402
from app.services.parsing.parsers import (  # noqa: E402
    _reconstruct_pdf_grid, promote_header, parse_generic,
)
from app.services.parsing.configs import BANK_CONFIGS  # noqa: E402
from app.services.parsing.keys import KeyBuilder  # noqa: E402

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
    assert debit["unique_key"].startswith("v2-7-")
    assert credit["type"] == "credit" and credit["amount"] == 50000.0


def test_amount_is_native_float_not_numpy():
    # numpy.float64 breaks psycopg2 parameter binding (renders as literal
    # "np.float64(...)" in the SQL). Every amount must be plain Python float.
    for txn in parsing.parse_statement("hdfc_july.csv", HDFC_CSV, ACCOUNTS):
        assert type(txn["amount"]) is float, type(txn["amount"])
    for txn in parsing.parse_statement("paytm_july.csv", PAYTM_CSV, ACCOUNTS):
        assert type(txn["amount"]) is float, type(txn["amount"])


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


def test_icici_real_layout_inr_dotted_dates_comma_amounts():
    # Mirrors the actual ICICI statement: "Transaction Date" (not "Value Date"),
    # "(INR)" with no inner space, dotted dates, and comma thousands separators.
    icici = (
        'S No.,Transaction Date,Cheque Number,Transaction Remarks,'
        'Withdrawal Amount (INR),Deposit Amount (INR),Balance (INR)\n'
        '1,01.07.2026,,UPI/ZOMATO/123456789012/Pay,"1,250.00",,"48,750.00"\n'
        '2,02.07.2026,,NEFT SALARY,,"50,000.00","98,750.00"\n'
    ).encode()
    txns = parsing.parse_statement("icici_stmt.csv", icici, {"ICICI Bank": 5})
    assert len(txns) == 2, txns
    debit, credit = txns
    assert debit["type"] == "debit" and debit["amount"] == 1250.0
    assert debit["account_id"] == 5 and debit["source"] == "ICICI"
    assert debit["upi_ref"] == "123456789012"
    assert credit["type"] == "credit" and credit["amount"] == 50000.0


def test_alias_matching_is_whitespace_and_suffix_tolerant():
    from app.services.parsing.parsers import _find_col
    for header in (
        "Withdrawal Amount (INR)", "Withdrawal Amount (INR )", "Withdrawal\nAmount (INR)",
        "Withdrawal Amount(INR)",  # real ICICI export: no space before "("
    ):
        assert _find_col(("Withdrawal Amount",), [header]) == header, header
    # must not confuse withdrawal with deposit
    cols = ["Withdrawal Amount(INR)", "Deposit Amount(INR)"]
    assert _find_col(("Deposit Amount",), cols) == "Deposit Amount(INR)"


def test_icici_real_export_glued_parens():
    # Exact header text from the user's real OpTransactionHistory export/PDF:
    # no space before "(INR)".
    icici = (
        'S No.,Value Date,Transaction Date,Cheque Number,Transaction Remarks,'
        'Withdrawal Amount(INR),Deposit Amount(INR),Balance(INR)\n'
        '1,01/07/2025,01/07/2025,,UPI/ZOMATO/123456789012,250.00,,48750.00\n'
    ).encode()
    txns = parsing.parse_statement("OpTransactionHistory22-07-2026.csv", icici, {"ICICI Bank": 9})
    assert len(txns) == 1, txns
    assert txns[0]["type"] == "debit" and txns[0]["amount"] == 250.0
    assert txns[0]["account_id"] == 9


def test_unrecognized_layout_raises_with_columns_found():
    junk = ("Foo,Bar,Baz\n1,2,3\n").encode()
    try:
        parsing.parse_statement("mystery.csv", junk, {"ICICI Bank": 1})
        assert False, "expected ValueError naming the columns found"
    except ValueError as e:
        assert "Foo" in str(e) and "rows x" in str(e), e


def test_preamble_above_header_is_found():
    # Mimics ICICI's OpTransactionHistory export: metadata rows above the real
    # header, and a filename with no "icici" hint. Must still parse (the bug fix).
    icici = (
        "Detailed Statement,,,,\n"
        "Account Number: 000111,,,,\n"
        ",,,,\n"
        "S No.,Value Date,Transaction Remarks,Withdrawal Amount (INR ),Deposit Amount (INR )\n"
        "1,01/07/2025,UPI/ZOMATO/123456789012,250.00,\n"
        "2,02/07/2025,SALARY,,50000.00\n"
    ).encode()
    txns = parsing.parse_statement("OpTransactionHistory22-07-2026.csv", icici, {"ICICI Bank": 3})
    assert len(txns) == 2, txns
    assert txns[0]["type"] == "debit" and txns[0]["amount"] == 250.0
    assert txns[0]["account_id"] == 3 and txns[0]["source"] == "ICICI"
    assert txns[1]["type"] == "credit" and txns[1]["amount"] == 50000.0


def test_pdf_word_reconstruction_borderless_icici():
    # Synthetic pdfplumber word output modelled on the REAL ICICI PDF:
    #  - a preamble line above the header (must be excluded),
    #  - a header wrapped across two visual lines with glued "WithdrawalAmount",
    #  - each transaction spanning several lines (payee, wrapped remarks with a long
    #    ref number inside it, then a separate amount+balance line),
    #  - only ONE of withdrawal/deposit filled per row (debit vs credit decided by
    #    x-position), and a footer that must end the last block.
    def w(text, x0, top):
        return {"text": text, "x0": float(x0), "x1": float(x0 + len(text) * 5), "top": float(top)}

    words = []
    # preamble (has no anchor keyword + matches noise -> must NOT be treated as header)
    words += [w(t, x, 80) for t, x in [("Statement", 40), ("of", 130), ("Transactions", 160)]]
    # header line 1 (wrapped)
    words += [w(t, x, 100) for t, x in [
        ("S", 38), ("Transaction", 82), ("Cheque", 190), ("Transaction", 332),
        ("WithdrawalAmount", 505), ("Deposit", 632), ("Balance", 742)]]
    # header line 2 (wrapped continuation)
    words += [w(t, x, 112) for t, x in [
        ("No.", 45), ("Date", 100), ("Number", 225), ("Remarks", 342),
        ("(INR)", 560), ("Amount", 640), ("(INR)", 668), ("(INR)", 760)]]
    # txn 1 (debit): payee line, remarks wrap w/ 12-digit ref, then amount+balance
    words += [w(t, x, 140) for t, x in [("1", 40), ("01.06.2026", 100), ("DHEEKSHITH", 350)]]
    words += [w("UPI/DHEEKSHITH/651828946095/YES", 340, 152), w("BANK", 470, 152)]
    words += [w("20.00", 535, 176), w("2509.00", 765, 176)]
    # txn 2 (credit): amount lands in the DEPOSIT column by x-position
    words += [w(t, x, 200) for t, x in [("2", 40), ("02.06.2026", 100), ("REVATHI", 350)]]
    words += [w("UPI/REVATHI/207446900182/INDIAN", 340, 212)]
    words += [w("1000.00", 645, 236), w("1252.53", 765, 236)]
    # footer (must terminate txn 2's block, not pollute its amounts)
    words += [w(t, x, 260) for t, x in [("Never", 40), ("share", 90), ("your", 140), ("OTP", 180)]]

    grid = _reconstruct_pdf_grid(words)
    assert grid is not None, "reconstruction returned nothing"
    df = pd.DataFrame(grid)

    detected = _detect("statement.pdf", df)
    assert detected is not None, grid
    fmt, header_idx = detected
    assert fmt == "icici", (detected, grid[0])
    txns = parse_generic(promote_header(df, header_idx), BANK_CONFIGS["icici"], account_id=8, keys=KeyBuilder())
    assert len(txns) == 2, grid
    debit, credit = txns
    assert debit["type"] == "debit" and debit["amount"] == 20.0, grid
    assert debit["upi_ref"] == "651828946095" and debit["account_id"] == 8
    assert credit["type"] == "credit" and credit["amount"] == 1000.0, grid


def test_paytm():
    txns = parsing.parse_statement("paytm_july.csv", PAYTM_CSV, ACCOUNTS)
    assert len(txns) == 1, txns
    t = txns[0]
    assert t["type"] == "debit" and t["amount"] == 250.0
    assert t["account_id"] == 7 and t["source"] == "HDFC Bank"


def test_paytm_amount_with_thousands_comma_is_not_dropped():
    # Paytm writes amounts >= 1,000 as "1,270.00". pd.to_numeric can't parse
    # the comma and returns NaN, which used to be read as "no amount" and
    # silently dropped the row -- the real cause of the missing-transactions bug.
    paytm = (
        "Date,Time,Transaction Details,Your Account,Amount,UPI Ref No.,Remarks\n"
        '01/07/2025,10:30:00,Transferred to Self,HDFC Bank XX1234,"36,201",123456789012,\n'
    ).encode()
    txns = parsing.parse_statement("paytm_july.csv", paytm, ACCOUNTS)
    assert len(txns) == 1, txns
    assert txns[0]["amount"] == 36201.0


def test_paytm_builds_a_key():
    # Paytm rows used to get unique_key=None -- Postgres never collides NULLs,
    # so the (user_id, unique_key) constraint did nothing for re-uploads.
    txns = parsing.parse_statement("paytm_july.csv", PAYTM_CSV, ACCOUNTS)
    assert txns[0]["unique_key"], "Paytm row must not get a null/empty key"


def test_reparsing_a_statement_yields_identical_keys():
    # The whole point of a content-based key: re-uploading the same file must
    # produce the exact same keys, so the DB constraint treats it as a no-op.
    keys1 = [t["unique_key"] for t in parsing.parse_statement("hdfc_july.csv", HDFC_CSV, ACCOUNTS)]
    keys2 = [t["unique_key"] for t in parsing.parse_statement("hdfc_july.csv", HDFC_CSV, ACCOUNTS)]
    assert keys1 == keys2 and len(keys1) == 2


def test_keys_ignore_row_position():
    # A re-export with a different row order/date range must still key the
    # same transaction identically -- position must play no part in the key.
    reordered = (
        HDFC_COLS +
        "02/07/2025,SALARY CREDIT,REF2,,50000.00\n"
        "01/07/2025,UPI-ZOMATO-123456789012-PAYMENT,REF1,250.00,\n"
    ).encode()
    original_keys = {t["unique_key"] for t in parsing.parse_statement("hdfc_july.csv", HDFC_CSV, ACCOUNTS)}
    reordered_keys = {t["unique_key"] for t in parsing.parse_statement("hdfc_july.csv", reordered, ACCOUNTS)}
    assert original_keys == reordered_keys


def test_repeated_identical_transactions_both_survive():
    # Two genuinely separate transactions -- same day, same amount, no
    # reference -- must both survive with distinct keys, not collapse into one.
    icici = (
        'S No.,Transaction Date,Cheque Number,Transaction Remarks,'
        'Withdrawal Amount (INR),Deposit Amount (INR),Balance (INR)\n'
        '1,01.07.2026,,METRO CARD RECHARGE,"20.00",,"980.00"\n'
        '2,01.07.2026,,METRO CARD RECHARGE,"20.00",,"960.00"\n'
    ).encode()
    txns = parsing.parse_statement("icici_stmt.csv", icici, {"ICICI Bank": 5})
    assert len(txns) == 2, txns
    keys = {t["unique_key"] for t in txns}
    assert len(keys) == 2, "repeated transactions must not collapse onto one key"


def test_blank_reference_does_not_merge_unrelated_rows():
    # Blank cheque/ref cells used to stringify to "-"/"nan" and become the key
    # itself, colliding unrelated rows. Different descriptions -> different keys.
    icici = (
        'S No.,Transaction Date,Cheque Number,Transaction Remarks,'
        'Withdrawal Amount (INR),Deposit Amount (INR),Balance (INR)\n'
        '1,01.07.2026,,ATM WITHDRAWAL,"500.00",,"500.00"\n'
        '2,02.07.2026,,CASH DEPOSIT,,"500.00","1000.00"\n'
    ).encode()
    txns = parsing.parse_statement("icici_stmt.csv", icici, {"ICICI Bank": 5})
    assert len(txns) == 2, txns
    assert txns[0]["unique_key"] != txns[1]["unique_key"]


def test_keybuilder_shared_across_grids_of_one_file():
    # Regression test for the cross-page collision bug: a PDF/Excel file yields
    # one grid per page/sheet. If each grid got its own KeyBuilder, occurrence
    # numbering would reset per grid and two genuine repeats landing on
    # different grids would get the SAME key and one would be dropped as a
    # "duplicate" at insert time. One KeyBuilder must be shared per file.
    keys = KeyBuilder()
    row = dict(account_id=1, txn_date=pd.Timestamp("2026-07-01"), amount=20.0,
               txn_type="debit", upi_ref=None, description="METRO CARD RECHARGE")
    key_from_grid_1 = keys.build(**row)
    key_from_grid_2 = keys.build(**row)  # same builder, simulating the next grid
    assert key_from_grid_1 != key_from_grid_2, "second occurrence must get a distinct suffix"

    # The bug: a FRESH builder per grid re-collides them.
    fresh_builder_key = KeyBuilder().build(**row)
    assert fresh_builder_key == key_from_grid_1, "sanity: fresh builder reproduces occurrence 0"


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")
    print("parsing self-check OK")
