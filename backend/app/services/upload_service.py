# File: app/services/upload_service.py
# Statement parsing now lives in app/services/parsing/. This module keeps the
# categorization rules and the DB insertion step (process_and_insert_transactions).
import json
import re
import logging
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session
from thefuzz import process as fuzzy_process

from app.models.transaction import Transaction
from app.models.category import Category
from app.crud import alert_crud
from app.services import merchant_matching_service

logger = logging.getLogger(__name__)

# --- DATA MAPPING RULES ---
# The old MERCHANT_CATEGORY_RULES hardcoded dict (keyword -> merchant name +
# category) has been replaced by dynamic matching against the `merchants`
# table -- see merchant_matching_service.py. Its ~40 entries were migrated
# into per-user Merchant rows as one-time seed data by
# alembic/versions/0003_seed_merchants_from_rules.py, so existing users'
# upload behaviour doesn't regress; the DB is now the single source of truth.
TRANSFER_KEYWORDS = {
    'v revathi', 't prem', 'satish p', 'mohan kumar a', 'putte gowda', 'naveen b', 'madhu c s', 'perumal p',
    'saroja', 'c vamsi krishna', 'vivek kumar', 'pavan k', 'kiran kumar k', 'manjunath', 'sagar', 'm anand',
    'semeema', 'sumith sigtia', 'thiyagarajan.su', 'yatha jain', 'kapil.loginhdi', 'amogh.dr7',
    'jerry10102002', 'shebak das', 'mrs janaki srinivasan',
}
CATEGORY_ALIASES = {"miscellaneous": ["misc", "miscelleaneous"], "entertainment": ["ent"], "transportation": ["transport"]}


def get_category_by_fuzzy_matching(remark: str, user_categories: dict) -> int | None:
    remark = remark.lower().strip()
    choices = {}
    for cat_id, cat_name in user_categories.items():
        cat_name_lower = cat_name.lower()
        choices[cat_name_lower] = cat_id
        if cat_name_lower in CATEGORY_ALIASES:
            for alias in CATEGORY_ALIASES[cat_name_lower]:
                choices[alias] = cat_id
    best_match = fuzzy_process.extractOne(remark, choices.keys())
    if best_match and best_match[1] >= 85:  # 85% confidence threshold
        return choices[best_match[0]]
    return None


# ponytail: single INSERT statement can grow unwieldy well past this; chunk
# large statements rather than tune for an untested upper bound.
_batch_size = 1000


def process_and_insert_transactions(db: Session, transactions: list, user_id: int) -> int:
    """Insert the transactions that aren't already stored for this user.

    Skipping is driven by `unique_key` (built in parsing.keys from transaction
    content, so re-importing a statement produces the keys already on file).
    The preloaded set makes that a cheap in-memory check, but it is only an
    optimisation -- the (user_id, unique_key) unique constraint is what actually
    guarantees no duplicates. Rows are inserted with one bulk
    INSERT ... ON CONFLICT DO NOTHING (chunked) rather than one round-trip per
    row: with the DB on a different host from the app server, a per-row
    savepoint+flush turned a few-hundred-row statement into minutes of network
    latency. The bulk statement keeps the DB constraint as the real backstop
    while paying that latency once (or once per chunk) instead of once per row.
    """
    existing_unique_keys = {res[0] for res in db.query(Transaction.unique_key).filter(Transaction.user_id == user_id).all()}

    # Fingerprints of existing merchants, for the same handle/fuzzy matching
    # POST /merchants/rescan uses -- see merchant_matching_service.py.
    fingerprints = merchant_matching_service.build_fingerprints(db, user_id=user_id)
    user_categories_db = db.query(Category).filter(Category.user_id == user_id).all()
    user_categories_map = {cat.id: cat.name for cat in user_categories_db}

    rows_to_insert = []
    newly_found_categories = set()
    # Medium-confidence merchant suggestions can't get a new_merchant alert
    # until the row actually has a DB id, which only exists after insert --
    # queued here by unique_key, resolved once the INSERT...RETURNING comes
    # back below.
    pending_merchant_suggestions: dict[str, merchant_matching_service.MatchResult] = {}

    for txn_data in sorted(transactions, key=lambda x: x['txn_date']):
        if (txn_data.get('unique_key') and txn_data['unique_key'] in existing_unique_keys):
            continue

        detected_merchant_id, detected_category_id = None, None
        desc = txn_data['description']

        # Smart categorization from user remarks like /food/
        remark_match = re.search(r'/([^/]+)/', desc, re.IGNORECASE)
        if remark_match:
            user_remark = remark_match.group(1)
            matched_id = get_category_by_fuzzy_matching(user_remark, user_categories_map)
            if matched_id:
                detected_category_id = matched_id
            else:
                newly_found_categories.add(user_remark.strip().title())

        # Fallback: transfer keywords, then merchant matching
        if not detected_category_id:
            desc_lower = desc.lower()
            if any(keyword in desc_lower for keyword in TRANSFER_KEYWORDS):
                transfer_cat_id = next((_id for _id, name in user_categories_map.items() if name.lower() == 'transfers'), None)
                if transfer_cat_id:
                    detected_category_id = transfer_cat_id
            else:
                match = merchant_matching_service.match_description(desc, fingerprints)
                if match and match.confidence == merchant_matching_service.HIGH_CONFIDENCE:
                    detected_merchant_id = match.merchant_id
                    if match.category_id:
                        detected_category_id = match.category_id
                elif match and txn_data.get('unique_key'):
                    # Medium confidence: leave the transaction unmapped, queue
                    # a suggestion alert instead of auto-applying it.
                    pending_merchant_suggestions[txn_data['unique_key']] = match

        # Default to Miscellaneous if nothing matched
        if not detected_category_id:
            misc_cat_id = next((_id for _id, name in user_categories_map.items() if name.lower() == 'miscellaneous'), None)
            if misc_cat_id:
                detected_category_id = misc_cat_id

        raw_data_json_str = txn_data.pop('raw_data', '{}')
        rows_to_insert.append({
            **txn_data, "user_id": user_id, "category_id": detected_category_id,
            "merchant_id": detected_merchant_id, "raw_data": json.loads(raw_data_json_str),
        })
        # A duplicate within this same file (two rows landing on the same key)
        # must also be skipped against each other, not just against the DB.
        if txn_data.get('unique_key'):
            existing_unique_keys.add(txn_data['unique_key'])

    inserted_count = 0
    for i in range(0, len(rows_to_insert), _batch_size):
        batch = rows_to_insert[i:i + _batch_size]
        stmt = pg_insert(Transaction).values(batch).on_conflict_do_nothing(
            index_elements=["user_id", "unique_key"]
        ).returning(Transaction.id, Transaction.unique_key, Transaction.description)
        result = db.execute(stmt)
        inserted_rows = result.fetchall()
        inserted_count += len(inserted_rows)

        for txn_id, unique_key, description in inserted_rows:
            match = pending_merchant_suggestions.get(unique_key)
            if match:
                alert_crud.create_new_merchant_alert(
                    db, user_id=user_id, transaction_id=txn_id, description=description,
                    suggested_merchant_id=match.merchant_id, suggested_merchant_name=match.merchant_name,
                    suggested_category_id=match.category_id, match_reason=match.reason,
                    similarity=match.similarity,
                )

    for cat_name in newly_found_categories:
        alert_crud.create_new_category_alert(db, user_id=user_id, category_name=cat_name)

    if inserted_count > 0 or newly_found_categories:
        db.commit()

    logger.info("Committed %d new transactions and found %d new categories for user %d.",
                inserted_count, len(newly_found_categories), user_id)
    return inserted_count
