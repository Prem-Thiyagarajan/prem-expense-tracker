"""Content-based unique_key + txn_date index

Revision ID: 0001
Revises:
Create Date: 2026-08-01

Re-keys every existing transaction to the v2 content-based format (see
app/services/parsing/keys.py), then makes unique_key NOT NULL and adds the
(user_id, txn_date) index that month-page queries need.

Refuses to run while exact-duplicate rows still exist (same user, account,
date, amount, type, description) -- run scripts/dedupe_transactions.py --apply
first, or two duplicate rows would both get the same new key and collide on
the (user_id, unique_key) constraint added here.
"""
from collections import defaultdict
import hashlib
import re

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

_WHITESPACE_RE = re.compile(r"\s+")
_REF_RE = re.compile(r"\d{6,}")


def _normalize_ref(value):
    if value is None:
        return None
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text if _REF_RE.fullmatch(text) else None


def _identity(upi_ref, description):
    ref = _normalize_ref(upi_ref)
    if ref:
        return f"U{ref}"
    normalized = _WHITESPACE_RE.sub(" ", str(description or "").strip().lower())
    return "D" + hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:12]


def _base_key(account_id, txn_date, amount, txn_type, upi_ref, description):
    return (
        f"v2-{account_id}-{txn_date:%Y%m%d}-{float(amount):.2f}"
        f"-{txn_type}-{_identity(upi_ref, description)}"
    )


def upgrade() -> None:
    conn = op.get_bind()

    dupes = conn.execute(sa.text("""
        SELECT user_id, account_id, txn_date, amount, type, description, COUNT(*) AS n
        FROM transactions
        GROUP BY user_id, account_id, txn_date, amount, type, description
        HAVING COUNT(*) > 1
    """)).fetchall()
    if dupes:
        raise RuntimeError(
            f"{len(dupes)} duplicate transaction group(s) still exist. "
            "Run `python scripts/dedupe_transactions.py --apply` first."
        )

    rows = conn.execute(sa.text("""
        SELECT id, user_id, account_id, txn_date, amount, type, upi_ref, description
        FROM transactions
        ORDER BY user_id, id
    """)).fetchall()

    seen = defaultdict(int)
    for row in rows:
        base = _base_key(row.account_id, row.txn_date, row.amount, row.type, row.upi_ref, row.description)
        seen_key = (row.user_id, base)
        occurrence = seen[seen_key]
        seen[seen_key] = occurrence + 1
        new_key = base if occurrence == 0 else f"{base}#{occurrence}"
        conn.execute(
            sa.text("UPDATE transactions SET unique_key = :key WHERE id = :id"),
            {"key": new_key, "id": row.id},
        )

    op.alter_column("transactions", "unique_key", nullable=False)
    op.create_index("ix_transactions_user_id_txn_date", "transactions", ["user_id", "txn_date"])


def downgrade() -> None:
    op.drop_index("ix_transactions_user_id_txn_date", table_name="transactions")
    op.alter_column("transactions", "unique_key", nullable=True)
