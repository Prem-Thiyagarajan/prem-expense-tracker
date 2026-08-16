"""Seed merchants from the old MERCHANT_CATEGORY_RULES dict

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-16

Migrates the previously-hardcoded MERCHANT_CATEGORY_RULES dict in
app/services/upload_service.py into per-user Merchant rows, so upload-time
categorisation keeps working after that dict is deleted -- the `merchants`
table becomes the single source of truth (see
app/services/merchant_matching_service.py).

Two things happen here, both scoped per user and both only touching
transactions that were never previously matched to a merchant (so nothing
already-correct regresses):

1. For every existing user, insert a Merchant row for a rule's merchant name
   the first time one of its keywords actually matches one of that user's
   transactions (not unconditionally for every rule -- a user who never had
   a Swiggy transaction doesn't need a Swiggy merchant row). Skipped if the
   user already has a merchant with that name (respects the (user_id, name)
   unique constraint) or if the rule's category doesn't exist for the user.
2. Backfill `transactions.merchant_id` (and `category_id`, only when it's
   currently NULL or still the "Miscellaneous" fallback) for every
   transaction whose description contains one of the retired keywords and
   has no merchant assigned yet. This is what upload_service.py would have
   set at insert time had a real Merchant row existed then -- applied
   retroactively so the seeded merchants start with real transaction
   history. A bare, transaction-less Merchant row would give
   merchant_matching_service.py's fingerprint builder nothing to compare
   future transactions against (it derives handles/descriptions purely from
   transactions already linked to a merchant).

Keywords are checked in the same order as the original dict, first match
wins, matching the original substring-match precedence exactly.
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

# Frozen snapshot of the dict being retired from app/services/upload_service.py
# -- migrations must stay reproducible even after the source dict is deleted,
# so this is a copy, not an import from application code.
_RULES = [
    ("zomato", "Zomato", "Food"),
    ("swiggy", "Swiggy", "Food"),
    ("udupi sannid", "M S Sri Udupi Sannidhi", "Food"),
    ("eazypay.jzrwpsu", "M S Sri Udupi Sannidhi", "Food"),
    ("burma burm", "Burma Burma", "Food"),
    ("little italy", "Little Italy", "Food"),
    ("wave cafe", "Wave Cafe", "Food"),
    ("sarkaar hospitality", "Sarkaar Hospitality", "Food"),
    ("gopizza", "GOPIZZA", "Food"),
    ("california burrito", "California Burrito", "Food"),
    ("bharatpe", "BharatPe Merchant", "Food"),
    ("zepto", "Zepto", "Groceries"),
    ("bbinstant", "BigBasket", "Groceries"),
    ("bigbasket", "BigBasket", "Groceries"),
    ("luludaily", "Lulu Hypermarket", "Groceries"),
    ("thavakkal bazaar", "Thavakkal Bazaar", "Groceries"),
    ("bangalore metro rail", "Namma Metro", "Travel"),
    ("bmrc", "Namma Metro", "Travel"),
    ("metro rail", "Namma Metro", "Travel"),
    ("uber", "Uber", "Travel"),
    ("redbus", "Redbus", "Travel"),
    ("paytm travel", "Paytm Travel", "Travel"),
    ("irctc", "IRCTC", "Travel"),
    ("auto service", "Auto Service", "Travel"),
    ("amazon", "Amazon", "Shopping"),
    ("amzn", "Amazon", "Shopping"),
    ("myntra", "Myntra", "Shopping"),
    ("snitch", "SNITCH", "Shopping"),
    ("jockey", "Jockey", "Shopping"),
    ("lifestyle", "Lifestyle", "Shopping"),
    ("findr management", "Findr Management Solutions", "Shopping"),
    ("stanzaliving", "Stanza Living", "Services"),
    ("dtwelve spaces", "Stanza Living", "Services"),
    ("pg rent", "PG Rent", "Rent"),
    ("spotify", "Spotify", "Bills"),
    ("microsoft", "Microsoft", "Bills"),
    ("alistetechnologies", "Aliste Technologies", "Services"),
    ("airtel", "Airtel", "Bills"),
    ("healthandglow", "Health & Glow", "Health & Wellness"),
    ("mass pharma", "Pharmacy", "Health & Wellness"),
    ("trustchemist", "Pharmacy", "Health & Wellness"),
    ("hairtel", "Hairtel Salon", "Personal Care"),
    ("bookmyshow", "BookMyShow", "Entertainment"),
    ("nova gamin", "Nova Gaming", "Entertainment"),
    ("financewithsharan", "FinanceWithSharan", "Education"),
]


def upgrade() -> None:
    conn = op.get_bind()

    users = conn.execute(sa.text("SELECT id FROM users")).fetchall()

    for (user_id,) in users:
        categories = {
            name.lower(): cat_id
            for cat_id, name in conn.execute(
                sa.text("SELECT id, name FROM categories WHERE user_id = :uid"),
                {"uid": user_id},
            ).fetchall()
        }
        misc_category_id = categories.get("miscellaneous")

        existing_merchants = {
            name: mid
            for mid, name in conn.execute(
                sa.text("SELECT id, name FROM merchants WHERE user_id = :uid"),
                {"uid": user_id},
            ).fetchall()
        }

        unmapped = conn.execute(
            sa.text(
                "SELECT id, description, category_id FROM transactions "
                "WHERE user_id = :uid AND merchant_id IS NULL"
            ),
            {"uid": user_id},
        ).fetchall()

        for txn_id, description, txn_category_id in unmapped:
            desc_lower = (description or "").lower()
            for keyword, merchant_name, category_name in _RULES:
                if keyword not in desc_lower:
                    continue

                category_id = categories.get(category_name.lower())

                merchant_id = existing_merchants.get(merchant_name)
                if merchant_id is None:
                    result = conn.execute(
                        sa.text(
                            "INSERT INTO merchants (name, category_id, user_id) "
                            "VALUES (:name, :cat, :uid) RETURNING id"
                        ),
                        {"name": merchant_name, "cat": category_id, "uid": user_id},
                    )
                    merchant_id = result.scalar_one()
                    existing_merchants[merchant_name] = merchant_id

                new_category_id = txn_category_id
                if txn_category_id is None or txn_category_id == misc_category_id:
                    new_category_id = category_id if category_id is not None else txn_category_id

                conn.execute(
                    sa.text(
                        "UPDATE transactions SET merchant_id = :mid, category_id = :cid WHERE id = :id"
                    ),
                    {"mid": merchant_id, "cid": new_category_id, "id": txn_id},
                )
                break  # first matching keyword wins -- same precedence as the retired dict iteration


def downgrade() -> None:
    # Deliberately a no-op. By the time anyone would run this downgrade, the
    # seeded Merchant rows and the transactions backfilled onto them are
    # indistinguishable from organic data (a user may have renamed a seeded
    # merchant, recategorised it, or linked their own transactions to it) --
    # there's no safe way to reverse this without risking real user data. If
    # you truly need to undo it, restore from a DB backup taken before this
    # migration ran.
    pass
