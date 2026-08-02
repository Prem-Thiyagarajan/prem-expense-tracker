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
from app.models.merchant import Merchant
from app.crud import alert_crud

logger = logging.getLogger(__name__)

# --- DATA MAPPING RULES ---
TRANSFER_KEYWORDS = {
    'v revathi', 't prem', 'satish p', 'mohan kumar a', 'putte gowda', 'naveen b', 'madhu c s', 'perumal p',
    'saroja', 'c vamsi krishna', 'vivek kumar', 'pavan k', 'kiran kumar k', 'manjunath', 'sagar', 'm anand',
    'semeema', 'sumith sigtia', 'thiyagarajan.su', 'yatha jain', 'kapil.loginhdi', 'amogh.dr7',
    'jerry10102002', 'shebak das', 'mrs janaki srinivasan',
}
MERCHANT_CATEGORY_RULES = {
    'zomato': ('Zomato', 'Food'), 'swiggy': ('Swiggy', 'Food'), 'udupi sannid': ('M S Sri Udupi Sannidhi', 'Food'),
    'eazypay.jzrwpsu': ('M S Sri Udupi Sannidhi', 'Food'), 'burma burm': ('Burma Burma', 'Food'),
    'little italy': ('Little Italy', 'Food'), 'wave cafe': ('Wave Cafe', 'Food'),
    'sarkaar hospitality': ('Sarkaar Hospitality', 'Food'), 'gopizza': ('GOPIZZA', 'Food'),
    'california burrito': ('California Burrito', 'Food'), 'bharatpe': ('BharatPe Merchant', 'Food'),
    'zepto': ('Zepto', 'Groceries'), 'bbinstant': ('BigBasket', 'Groceries'), 'bigbasket': ('BigBasket', 'Groceries'),
    'luludaily': ('Lulu Hypermarket', 'Groceries'), 'thavakkal bazaar': ('Thavakkal Bazaar', 'Groceries'),
    'bangalore metro rail': ('Namma Metro', 'Travel'), 'bmrc': ('Namma Metro', 'Travel'),
    'metro rail': ('Namma Metro', 'Travel'), 'uber': ('Uber', 'Travel'), 'redbus': ('Redbus', 'Travel'),
    'paytm travel': ('Paytm Travel', 'Travel'), 'irctc': ('IRCTC', 'Travel'), 'auto service': ('Auto Service', 'Travel'),
    'amazon': ('Amazon', 'Shopping'), 'amzn': ('Amazon', 'Shopping'), 'myntra': ('Myntra', 'Shopping'),
    'snitch': ('SNITCH', 'Shopping'), 'jockey': ('Jockey', 'Shopping'), 'lifestyle': ('Lifestyle', 'Shopping'),
    'findr management': ('Findr Management Solutions', 'Shopping'), 'stanzaliving': ('Stanza Living', 'Services'),
    'dtwelve spaces': ('Stanza Living', 'Services'), 'pg rent': ('PG Rent', 'Rent'), 'spotify': ('Spotify', 'Bills'),
    'microsoft': ('Microsoft', 'Bills'), 'alistetechnologies': ('Aliste Technologies', 'Services'),
    'airtel': ('Airtel', 'Bills'), 'healthandglow': ('Health & Glow', 'Health & Wellness'),
    'mass pharma': ('Pharmacy', 'Health & Wellness'), 'trustchemist': ('Pharmacy', 'Health & Wellness'),
    'hairtel': ('Hairtel Salon', 'Personal Care'), 'bookmyshow': ('BookMyShow', 'Entertainment'),
    'nova gamin': ('Nova Gaming', 'Entertainment'), 'financewithsharan': ('FinanceWithSharan', 'Education'),
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

    merchants_map = {m.name: m.id for m in db.query(Merchant).filter(Merchant.user_id == user_id).all()}
    user_categories_db = db.query(Category).filter(Category.user_id == user_id).all()
    user_categories_map = {cat.id: cat.name for cat in user_categories_db}

    rows_to_insert = []
    newly_found_categories = set()

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

        # Fallback: transfer keywords, then merchant rules
        if not detected_category_id:
            desc_lower = desc.lower()
            if any(keyword in desc_lower for keyword in TRANSFER_KEYWORDS):
                transfer_cat_id = next((_id for _id, name in user_categories_map.items() if name.lower() == 'transfers'), None)
                if transfer_cat_id:
                    detected_category_id = transfer_cat_id
            else:
                for keyword, (merchant_name, category_name) in MERCHANT_CATEGORY_RULES.items():
                    if keyword in desc_lower:
                        detected_merchant_id = merchants_map.get(merchant_name)
                        cat_id = next((_id for _id, name in user_categories_map.items() if name.lower() == category_name.lower()), None)
                        if cat_id:
                            detected_category_id = cat_id
                        if detected_merchant_id or detected_category_id:
                            break

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
        )
        result = db.execute(stmt)
        inserted_count += result.rowcount

    for cat_name in newly_found_categories:
        alert_crud.create_new_category_alert(db, user_id=user_id, category_name=cat_name)

    if inserted_count > 0 or newly_found_categories:
        db.commit()

    logger.info("Committed %d new transactions and found %d new categories for user %d.",
                inserted_count, len(newly_found_categories), user_id)
    return inserted_count
