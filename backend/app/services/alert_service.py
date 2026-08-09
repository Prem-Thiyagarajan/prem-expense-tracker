# File: app/services/alert_service.py
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Transaction, Goal, Alert, Category, Tag, TransactionTag
from app.crud import alert_crud
from datetime import date
from decimal import Decimal

# Define the thresholds at which we want to create alerts
BUDGET_THRESHOLDS = [Decimal("100.0"), Decimal("90.0"), Decimal("75.0")]

def get_total_spend_for_category_in_month(db: Session, user_id: int, category_id: int, month: str) -> Decimal:
    """Calculates the total debit spend for a specific category and month, excluding certain transactions."""
    
    # Find the tag used for excluding transactions from analytics
    exclude_tag = db.query(Tag).filter(Tag.name == "Exclude from Analytics", Tag.user_id == user_id).first()
    transactions_to_exclude = []
    if exclude_tag:
        transactions_to_exclude = [
            t.transaction_id for t in db.query(TransactionTag.transaction_id)
            .filter(TransactionTag.tag_id == exclude_tag.id, TransactionTag.user_id == user_id)
            .all()
        ]

    # Calculate the sum
    total_spend = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id,
        Transaction.category_id == category_id,
        Transaction.type == 'debit',
        func.to_char(Transaction.txn_date, 'YYYY-MM') == month,
        Transaction.id.notin_(transactions_to_exclude)
    ).scalar()

    return Decimal(total_spend or 0)

def check_and_create_budget_alerts(db: Session, user_id: int, transaction: Transaction):
    """
    Checks if a new transaction has triggered any budget alerts and creates them if necessary.
    """
    if not transaction.category_id:
        return

    month_str = transaction.txn_date.strftime('%Y-%m')

    # Find the budget goal for this category and month
    goal = db.query(Goal).filter(
        Goal.user_id == user_id,
        Goal.category_id == transaction.category_id,
        Goal.month == month_str
    ).first()

    if not goal or goal.limit_amount <= 0:
        return

    # Get the new total spend for this category
    total_spend = get_total_spend_for_category_in_month(db, user_id, transaction.category_id, month_str)
    
    # Calculate the percentage of the budget spent
    spent_percentage = (total_spend / Decimal(goal.limit_amount)) * 100

    # BUDGET_THRESHOLDS is ordered highest-to-lowest, so the first one
    # `spent_percentage` satisfies is the current tier — always stop there,
    # whether we need to create a fresh alert or one's already pending.
    # Deliberately NOT breaking here used to let a still-true 100% fall
    # through to (re-)fire a stale 90%/75% underneath it once the 100% alert
    # had been dismissed — the existence check below used to ignore
    # acknowledgment entirely, so a dismissed alert permanently blocked that
    # threshold from ever re-firing instead of just suppressing duplicates.
    for threshold in BUDGET_THRESHOLDS:
        if spent_percentage >= threshold:
            alert_exists = db.query(Alert).filter(
                Alert.user_id == user_id,
                Alert.goal_id == goal.id,
                Alert.threshold_percentage == threshold,
                Alert.is_acknowledged == False
            ).first()

            if not alert_exists:
                alert_crud.create_alert(db, user_id=user_id, alert_in={
                    "goal_id": goal.id,
                    "threshold_percentage": threshold,
                    "is_acknowledged": False
                })
            break