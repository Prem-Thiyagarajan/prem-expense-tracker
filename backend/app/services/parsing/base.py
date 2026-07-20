# File: app/services/parsing/base.py
"""Shared contract for all bank-statement parsers.

Every parser turns one sheet/file into a list of ParsedTxn dicts. The insert
layer (upload_service.process_and_insert_transactions) consumes that shape
unchanged, so parsers stay fully decoupled from persistence.
"""
from dataclasses import dataclass
from typing import Optional, TypedDict


class ParsedTxn(TypedDict):
    txn_date: object          # pandas.Timestamp / datetime
    description: str
    amount: float
    type: str                 # 'debit' | 'credit'
    account_id: int
    source: str
    upi_ref: Optional[str]
    unique_key: Optional[str]
    raw_data: str             # JSON string of the original row


@dataclass(frozen=True)
class BankConfig:
    """Declarative definition of a bank's statement layout.

    Adding a new bank that uses separate debit/credit columns = adding one
    entry to BANK_CONFIGS. No new code.
    """
    key: str                          # detection hint (also matched in filename)
    source: str                       # label stored on each transaction
    account_name: str                 # key into the user's account_map -> account_id
    date_col: str
    desc_col: str
    debit_col: str
    credit_col: str
    ref_col: Optional[str] = None
    unique_id_col: Optional[str] = None
    signature_columns: tuple = ()     # header-based detection fallback
