# File: app/services/parsing/parsers.py
"""File readers + the per-format parsers. Behavior of parse_generic / parse_paytm
is ported unchanged from the original upload_service; only the plumbing around
them (config-driven, multi-sheet, logged) is new."""
import io
import re
import logging
from datetime import datetime

import pandas as pd

from .base import BankConfig, ParsedTxn

logger = logging.getLogger(__name__)

# ponytail: per-sheet row cap guards the pandas-in-memory path; raise if a real
# statement legitimately exceeds it.
MAX_ROWS_PER_SHEET = 20000


def _clean_col(c: str) -> str:
    return c.strip().replace('.', '')


def read_frames(filename: str, raw: bytes) -> list[pd.DataFrame]:
    """CSV -> one frame; Excel -> one frame per sheet (covers single & multi-sheet).

    Raises ValueError for an unsupported extension (caller maps it to a 400).
    """
    name = filename.lower()
    if name.endswith('.csv'):
        return [pd.read_csv(io.BytesIO(raw))]
    if name.endswith(('.xlsx', '.xls')):
        sheets = pd.read_excel(io.BytesIO(raw), sheet_name=None)  # dict{name: df}
        return list(sheets.values())
    raise ValueError(f"Unsupported file type: {filename}")


def parse_generic(df: pd.DataFrame, config: BankConfig, account_id: int) -> list[ParsedTxn]:
    """Parse a separate-debit/credit-column statement per a BankConfig."""
    df = df.copy()
    df.columns = [_clean_col(c) for c in df.columns]
    date_col = _clean_col(config.date_col)
    desc_col = _clean_col(config.desc_col)
    debit_col = _clean_col(config.debit_col)
    credit_col = _clean_col(config.credit_col)
    ref_col = _clean_col(config.ref_col) if config.ref_col else None
    uid_col = _clean_col(config.unique_id_col) if config.unique_id_col else None

    transactions: list[ParsedTxn] = []
    for index, row in df.iterrows():
        if pd.isna(row.get(date_col)):
            continue
        try:
            withdrawal = pd.to_numeric(row.get(debit_col), errors='coerce')
            deposit = pd.to_numeric(row.get(credit_col), errors='coerce')
            withdrawal = withdrawal if pd.notna(withdrawal) else 0.0
            deposit = deposit if pd.notna(deposit) else 0.0
            if withdrawal > 0:
                amount, txn_type = withdrawal, 'debit'
            elif deposit > 0:
                amount, txn_type = deposit, 'credit'
            else:
                continue

            txn_date = pd.to_datetime(row[date_col], dayfirst=True)
            description = str(row[desc_col])
            upi_match = re.search(r'(\d{12})', description)
            upi_ref = upi_match.group(1) if ('UPI' in description and upi_match) else None
            uid_part = (
                str(row[uid_col]) if uid_col and pd.notna(row.get(uid_col))
                else (str(row.get(ref_col, '')) if ref_col else f"{description[:10]}-{index}")
            )
            unique_key = f"{config.source}-{uid_part}-{txn_date.strftime('%Y%m%d')}-{amount:.2f}"

            transactions.append(ParsedTxn(
                txn_date=txn_date, description=description, amount=amount, type=txn_type,
                account_id=account_id, source=config.source, upi_ref=upi_ref,
                unique_key=unique_key, raw_data=row.to_json(date_format='iso'),
            ))
        except Exception:
            logger.warning("Skipping unparseable row in %s statement", config.source, exc_info=True)
    return transactions


def parse_paytm(df: pd.DataFrame, account_map: dict) -> list[ParsedTxn]:
    """Parse a Paytm wallet statement (single signed Amount column, per-row account)."""
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]

    transactions: list[ParsedTxn] = []
    for _, row in df.iterrows():
        if pd.isna(row.get('Date')) or "This is not included" in str(row.get('Remarks', '')):
            continue
        try:
            account_str = str(row['Your Account'])
            matched_account = next((acc_id for name, acc_id in account_map.items() if name in account_str), None)
            if not matched_account:
                continue

            source_provider = next((name for name, acc_id in account_map.items() if acc_id == matched_account), "Unknown")
            amount_val = pd.to_numeric(row.get('Amount'), errors='coerce')
            if pd.isna(amount_val) or amount_val == 0:
                continue
            amount, txn_type = abs(amount_val), ('credit' if amount_val > 0 else 'debit')
            txn_date = datetime.strptime(f"{row['Date']} {row['Time']}", '%d/%m/%Y %H:%M:%S')
            description = str(row['Transaction Details'])
            upi_ref = str(int(row['UPI Ref No.'])) if pd.notna(row['UPI Ref No.']) else None

            transactions.append(ParsedTxn(
                txn_date=txn_date, description=description, amount=amount, type=txn_type,
                account_id=matched_account, source=source_provider, upi_ref=upi_ref,
                unique_key=None, raw_data=row.to_json(date_format='iso'),
            ))
        except Exception:
            logger.warning("Skipping unparseable Paytm row", exc_info=True)
    return transactions
