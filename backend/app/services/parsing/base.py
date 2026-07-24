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

    Each *_col is a tuple of aliases: the header names a bank has used across
    export formats (CSV / Excel / PDF) or minor renames. A field matches a real
    column when the alias's word-tokens are a subset of the column's tokens
    (see parsers._find_col), so spacing, newlines and trailing bits like "(INR)"
    don't matter -- and a new variant is just one more string in the tuple.
    """
    key: str                          # detection hint (also matched in filename)
    source: str                       # label stored on each transaction
    account_name: str                 # key into the user's account_map -> account_id
    date_col: tuple                   # aliases, most-specific first
    desc_col: tuple
    debit_col: tuple
    credit_col: tuple
    ref_col: Optional[tuple] = None
    unique_id_col: Optional[tuple] = None
    signature_columns: tuple = ()     # distinctive header names used to detect this bank
