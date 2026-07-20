# File: app/services/parsing/configs.py
"""Bank layout registry. To support a new separate-debit/credit-column bank,
add one BankConfig entry here — nothing else changes."""
from .base import BankConfig

BANK_CONFIGS = {
    "hdfc": BankConfig(
        key="hdfc", source="HDFC", account_name="HDFC Bank",
        date_col="Date", desc_col="Narration",
        debit_col="Withdrawal Amt", credit_col="Deposit Amt", ref_col="Chq/RefNo",
        signature_columns=("Narration", "Withdrawal Amt", "Deposit Amt"),
    ),
    "icici": BankConfig(
        key="icici", source="ICICI", account_name="ICICI Bank",
        date_col="Value Date", desc_col="Transaction Remarks",
        debit_col="Withdrawal Amount (INR )", credit_col="Deposit Amount (INR )",
        ref_col="Cheque Number", unique_id_col="S No.",
        signature_columns=("Transaction Remarks", "Withdrawal Amount (INR )"),
    ),
    # ponytail: SBI column names are the common CSV-export layout but UNVERIFIED
    # against a real SBI statement — adjust these to a real export before relying on it.
    "sbi": BankConfig(
        key="sbi", source="SBI", account_name="SBI Bank",
        date_col="Txn Date", desc_col="Description",
        debit_col="Debit", credit_col="Credit", ref_col="Ref No./Cheque No.",
        signature_columns=("Txn Date", "Debit", "Credit"),
    ),
}
