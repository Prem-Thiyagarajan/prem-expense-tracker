# File: app/services/transaction_service.py
from datetime import timedelta
from sqlalchemy.orm import Session, selectinload
from app.models.transaction import Transaction

def get_filtered_transactions(db: Session, filters: dict, user_id: int):
    page = filters.get("page", 1)
    limit = filters.get("limit", 10)
    start_date = filters.get("start_date")
    end_date = filters.get("end_date")
    category_id = filters.get("category_id")
    account_id = filters.get("account_id")
    search_term = filters.get("search_term")
    transaction_type = filters.get("type")
    
    sort_by = filters.get("sort_by", "txn_date")
    order = filters.get("order", "desc")

    # selectinload (a separate follow-up query), not joinedload: joining the
    # to-many tags_association multiplies each transaction row per tag in the
    # SQL result set, which inflates query.count() for any transaction with
    # 2+ tags. selectinload keeps the base query row-per-transaction.
    query = db.query(Transaction).options(selectinload(Transaction.tags_association)).filter(Transaction.user_id == user_id)

    # Apply all other filters
    if start_date:
        query = query.filter(Transaction.txn_date >= start_date)
    if end_date:
        # txn_date is a DateTime column; comparing it to a bare date with <=
        # implicitly compares against midnight of that day, excluding every
        # transaction on end_date itself that has a non-zero time-of-day.
        query = query.filter(Transaction.txn_date < end_date + timedelta(days=1))
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if transaction_type:
        query = query.filter(Transaction.type == transaction_type)
    if search_term:
        query = query.filter(Transaction.description.ilike(f"%{search_term}%"))

    # Sorting logic
    sort_field = getattr(Transaction, sort_by, None)
    if sort_field:
        query = query.order_by(sort_field.desc() if order.lower() == "desc" else sort_field.asc())
    else:
        query = query.order_by(Transaction.txn_date.desc())

    total_count = query.count()
    transactions = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "transactions": transactions
    }