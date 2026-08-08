# File: app/crud/subscription_crud.py
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.subscription import Subscription
from app.schemas.subscription_schema import SubscriptionCreate, SubscriptionUpdate
from app.services.subscription_service import compute_status


def _attach_status(sub: Subscription, today: date) -> Subscription:
    """Computes and attaches the transient upcoming/overdue fields SubscriptionOut expects."""
    upcoming, overdue = compute_status(sub.first_due_date, sub.interval, sub.last_paid_date, today)
    sub.upcoming_due_date = upcoming
    sub.overdue_due_date = overdue
    return sub


def create_subscription(db: Session, sub_in: SubscriptionCreate, user_id: int) -> Subscription:
    sub = Subscription(
        user_id=user_id,
        name=sub_in.name,
        description=sub_in.description,
        amount=sub_in.amount,
        interval=sub_in.interval.value,
        first_due_date=sub_in.first_due_date,
        last_paid_date=sub_in.last_paid_date,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return _attach_status(sub, date.today())


def get_all_subscriptions(db: Session, user_id: int, include_inactive: bool = False):
    q = db.query(Subscription).filter(Subscription.user_id == user_id)
    if not include_inactive:
        q = q.filter(Subscription.is_active.is_(True))
    today = date.today()
    return [_attach_status(s, today) for s in q.order_by(Subscription.name).all()]


def get_subscription_by_id(db: Session, sub_id: int, user_id: int) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.id == sub_id, Subscription.user_id == user_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    return _attach_status(sub, date.today())


def update_subscription(db: Session, sub_id: int, sub_in: SubscriptionUpdate, user_id: int) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.id == sub_id, Subscription.user_id == user_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")

    data = sub_in.model_dump(exclude_unset=True)
    if "interval" in data and data["interval"] is not None:
        data["interval"] = sub_in.interval.value
    for field, value in data.items():
        setattr(sub, field, value)

    db.commit()
    db.refresh(sub)
    return _attach_status(sub, date.today())


def delete_subscription(db: Session, sub_id: int, user_id: int) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.id == sub_id, Subscription.user_id == user_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    db.delete(sub)
    db.commit()
    return sub


def mark_paid(db: Session, sub_id: int, user_id: int, paid_for_date: Optional[date]) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.id == sub_id, Subscription.user_id == user_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found.")

    today = date.today()
    if paid_for_date is None:
        upcoming, overdue = compute_status(sub.first_due_date, sub.interval, sub.last_paid_date, today)
        paid_for_date = overdue or upcoming

    # Never move last_paid_date backwards — confirming an old cycle out of
    # order shouldn't un-confirm a later one that's already been paid.
    if sub.last_paid_date is None or paid_for_date > sub.last_paid_date:
        sub.last_paid_date = paid_for_date

    db.commit()
    db.refresh(sub)
    return _attach_status(sub, today)
