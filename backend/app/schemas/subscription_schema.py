# File: app/schemas/subscription_schema.py
from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class SubscriptionInterval(str, Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class SubscriptionBase(BaseModel):
    name: str
    description: Optional[str] = None
    amount: float
    interval: SubscriptionInterval


class SubscriptionCreate(SubscriptionBase):
    # "This month's payment date" from the UI — becomes `first_due_date`,
    # the anchor every future cycle is computed from.
    first_due_date: date
    # "Last month's payment date", optional — seeds `last_paid_date` so the
    # first cycle Bill Radar tracks is the *next* one, not the one already paid.
    last_paid_date: Optional[date] = None


class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    interval: Optional[SubscriptionInterval] = None
    is_active: Optional[bool] = None
    # Editable after creation too — e.g. correcting a mistyped first date.
    # Changing these directly shifts every future computed due date.
    first_due_date: Optional[date] = None
    last_paid_date: Optional[date] = None


class SubscriptionOut(SubscriptionBase):
    id: int
    user_id: int
    first_due_date: date
    last_paid_date: Optional[date] = None
    is_active: bool

    # Computed by subscription_service at read time — not stored columns.
    upcoming_due_date: date
    overdue_due_date: Optional[date] = None

    class Config:
        from_attributes = True


class SubscriptionMarkPaid(BaseModel):
    # Which cycle is being confirmed. Optional — defaults to whichever cycle
    # the service currently considers due (overdue if there is one, else
    # upcoming) when omitted.
    paid_for_date: Optional[date] = None
