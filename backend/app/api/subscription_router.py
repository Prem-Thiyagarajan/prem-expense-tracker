# File: app/api/subscription_router.py
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core import deps
from app.crud import subscription_crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.subscription_schema import (
    SubscriptionCreate,
    SubscriptionMarkPaid,
    SubscriptionOut,
    SubscriptionUpdate,
)

router = APIRouter()


@router.get("/", response_model=List[SubscriptionOut])
def list_subscriptions(
    include_inactive: bool = Query(False, description="Include cancelled subscriptions"),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    return subscription_crud.get_all_subscriptions(db, user_id=current_user.id, include_inactive=include_inactive)


@router.post("/", response_model=SubscriptionOut)
def create_subscription(
    sub_in: SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    return subscription_crud.create_subscription(db, sub_in=sub_in, user_id=current_user.id)


@router.get("/{subscription_id}", response_model=SubscriptionOut)
def get_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    return subscription_crud.get_subscription_by_id(db, sub_id=subscription_id, user_id=current_user.id)


@router.put("/{subscription_id}", response_model=SubscriptionOut)
def update_subscription(
    subscription_id: int,
    sub_in: SubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    return subscription_crud.update_subscription(db, sub_id=subscription_id, sub_in=sub_in, user_id=current_user.id)


@router.delete("/{subscription_id}", response_model=SubscriptionOut)
def delete_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    return subscription_crud.delete_subscription(db, sub_id=subscription_id, user_id=current_user.id)


@router.put("/{subscription_id}/pay", response_model=SubscriptionOut)
def mark_subscription_paid(
    subscription_id: int,
    body: SubscriptionMarkPaid = SubscriptionMarkPaid(),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Confirms a cycle paid — either the one specified, or whichever cycle is currently due."""
    return subscription_crud.mark_paid(
        db, sub_id=subscription_id, user_id=current_user.id, paid_for_date=body.paid_for_date
    )
