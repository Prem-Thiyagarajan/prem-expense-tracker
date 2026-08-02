# File: app/services/parsing/configs.py
"""Bank layout registry. To support a new separate-debit/credit-column bank,
add one BankConfig entry here -- nothing else changes. Each column is a tuple of
aliases (see BankConfig); to handle a renamed column, add its new name to the
relevant tuple. Aliases match by word-tokens, so "Withdrawal Amount" already
covers "Withdrawal Amount (INR)", "Withdrawal Amount (INR )" and a PDF's
line-wrapped "Withdrawal\nAmount (INR)".

Note there is deliberately no reference/serial column here. Statement serial
numbers ("S No") and cheque-number cells were once used to build each row's
idempotency key, which broke re-imports: a re-export covering different dates
renumbers every row, and blank cheque cells collapsed unrelated rows onto one
key. Keys are now derived from transaction content alone -- see parsing.keys.
"""
from .base import BankConfig

BANK_CONFIGS = {
    "hdfc": BankConfig(
        key="hdfc", source="HDFC", account_name="HDFC Bank",
        date_col=("Date", "Value Date", "Txn Date"),
        desc_col=("Narration", "Description", "Transaction Remarks"),
        debit_col=("Withdrawal Amt", "Withdrawal Amount", "Debit"),
        credit_col=("Deposit Amt", "Deposit Amount", "Credit"),
        signature_columns=("Narration", "Withdrawal Amt"),
    ),
    "icici": BankConfig(
        key="icici", source="ICICI", account_name="ICICI Bank",
        # PDF/e-statement uses "Transaction Date"; the OpTransactionHistory export
        # also carries "Value Date" -- both are listed so either layout parses.
        date_col=("Transaction Date", "Value Date", "Txn Date", "Date"),
        desc_col=("Transaction Remarks", "Remarks", "Narration"),
        debit_col=("Withdrawal Amount", "Withdrawal Amt", "Debit"),
        credit_col=("Deposit Amount", "Deposit Amt", "Credit"),
        signature_columns=("Transaction Remarks", "Withdrawal Amount"),
    ),
    # ponytail: SBI column names are the common CSV-export layout but UNVERIFIED
    # against a real SBI statement -- adjust these to a real export before relying on it.
    "sbi": BankConfig(
        key="sbi", source="SBI", account_name="SBI Bank",
        date_col=("Txn Date", "Transaction Date", "Date"),
        desc_col=("Description", "Narration", "Transaction Remarks"),
        debit_col=("Debit", "Withdrawal", "Withdrawal Amt"),
        credit_col=("Credit", "Deposit", "Deposit Amt"),
        signature_columns=("Description", "Debit", "Credit"),
    ),
}
