# File: scripts/dedupe_transactions.py
"""One-off cleanup for rows duplicated by the pre-fix upload bug (unique_key
was NULL for every Paytm row and position-based for generic-bank rows, so the
DB's (user_id, unique_key) constraint never caught a re-upload).

Two rows count as the same imported transaction if they agree on every column
that describes what actually happened: user, account, date, amount, type and
description. That's a heuristic, not a certainty -- two genuinely identical
transactions on the same day (two equal metro fares, no reference) look the
same and would be flagged too. Review the dry-run output before --apply.

Usage (from backend/, with the venv active):
    python scripts/dedupe_transactions.py            # dry run, prints what would be deleted
    python scripts/dedupe_transactions.py --apply     # actually deletes

Keeps the lowest id in each duplicate group.
"""
import os
import sys
import argparse
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402


def find_duplicate_groups(db):
    rows = db.execute(text("""
        SELECT id, user_id, account_id, txn_date, amount, type, description
        FROM transactions
        ORDER BY id
    """)).fetchall()

    groups = defaultdict(list)
    for r in rows:
        key = (r.user_id, r.account_id, r.txn_date, r.amount, r.type, r.description)
        groups[key].append(r.id)

    return {key: ids for key, ids in groups.items() if len(ids) > 1}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually delete the extra rows.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        groups = find_duplicate_groups(db)
        if not groups:
            print("No duplicate transactions found.")
            return

        to_delete = []
        for key, ids in groups.items():
            keep, *extra = ids
            to_delete.extend(extra)

        print(f"Found {len(groups)} duplicate groups, {len(to_delete)} extra rows to remove.")
        if not args.apply:
            print("Dry run -- pass --apply to delete. Sample ids:", to_delete[:20])
            return

        # transaction_tags' FK is declared ondelete=CASCADE on the model but the
        # live constraint predates that (no migration ever applied it), so it
        # doesn't actually cascade -- delete the tag links first.
        db.execute(
            text("DELETE FROM transaction_tags WHERE transaction_id = ANY(:ids)"),
            {"ids": to_delete},
        )
        result = db.execute(
            text("DELETE FROM transactions WHERE id = ANY(:ids)"),
            {"ids": to_delete},
        )
        db.commit()
        print(f"Deleted {result.rowcount} transactions.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
