# File: app/crud/alert_crud.py
from sqlalchemy.orm import Session, joinedload
from app.schemas.alert_schema import AlertCreate
from fastapi import HTTPException
from datetime import datetime

# ✅ THIS IS THE FIX: Import Alert and Goal from their correct, separate model files.
from app.models.alert import Alert
from app.models.goal import Goal


def create_alert(db: Session, alert_in: dict, user_id: int):
    # This function is now specifically for BUDGET alerts
    goal = db.query(Goal).filter(Goal.id == alert_in["goal_id"], Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found for the current user.")
    
    # Prevent creating duplicate unacknowledged budget alerts
    existing_alert = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.goal_id == alert_in["goal_id"],
        Alert.threshold_percentage == alert_in["threshold_percentage"],
        Alert.is_acknowledged == False
    ).first()
    if existing_alert:
        return None

    alert = Alert(**alert_in, user_id=user_id, triggered_at=datetime.utcnow(), type='budget')
    db.add(alert)
    return alert

def create_new_category_alert(db: Session, user_id: int, category_name: str):
    """Creates an alert for a newly discovered category name."""
    # Prevent creating duplicate unacknowledged new_category alerts
    existing_alert = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.type == 'new_category',
        Alert.context['category_name'].as_string() == category_name,
        Alert.is_acknowledged == False
    ).first()
    if existing_alert:
        return None

    alert = Alert(user_id=user_id, type='new_category', context={"category_name": category_name}, triggered_at=datetime.utcnow())
    db.add(alert)
    return alert

def create_new_merchant_alert(
    db: Session,
    user_id: int,
    transaction_id: int,
    description: str,
    suggested_merchant_id: int,
    suggested_merchant_name: str,
    suggested_category_id: int | None,
    match_reason: str,
    similarity: float | None,
):
    """Creates a suggestion alert for a medium-confidence (fuzzy) merchant
    match -- the transaction is left unmapped until the user accepts or
    dismisses this from the notification dropdown. High-confidence (exact
    handle) matches never reach this function; they auto-apply instead, see
    app/services/merchant_matching_service.py.
    """
    # One unacknowledged suggestion per transaction -- a rescan re-running
    # over an already-suggested (still-unmapped) transaction shouldn't pile
    # up duplicate alerts for it.
    existing_alert = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.type == 'new_merchant',
        Alert.context['transaction_id'].as_integer() == transaction_id,
        Alert.is_acknowledged == False
    ).first()
    if existing_alert:
        return None

    alert = Alert(
        user_id=user_id,
        type='new_merchant',
        context={
            "transaction_id": transaction_id,
            "description_snippet": description[:120],
            "suggested_merchant_id": suggested_merchant_id,
            "suggested_merchant_name": suggested_merchant_name,
            "suggested_category_id": suggested_category_id,
            "match_reason": match_reason,
            "similarity": similarity,
        },
        triggered_at=datetime.utcnow(),
    )
    db.add(alert)
    return alert

def get_unread_alerts(db: Session, user_id: int):
    return db.query(Alert).options(joinedload(Alert.goal).joinedload(Goal.category)).filter(
        Alert.user_id == user_id,
        Alert.is_acknowledged == False
    ).order_by(Alert.triggered_at.desc()).all()

def acknowledge_alert(db: Session, alert_id: int, user_id: int):
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == user_id).first()
    if alert:
        alert.is_acknowledged = True
        db.commit()
        db.refresh(alert)
    return alert

def acknowledge_all_alerts(db: Session, user_id: int) -> int:
    """Marks every unread alert as read in one call -- backs the
    notification dropdown's "Mark all as read" button."""
    count = db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.is_acknowledged == False
    ).update({"is_acknowledged": True}, synchronize_session=False)
    db.commit()
    return count