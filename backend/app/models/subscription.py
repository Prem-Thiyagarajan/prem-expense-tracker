# File: app/models/subscription.py
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class Subscription(Base):
    """
    A recurring bill the user has explicitly declared (Netflix, rent, etc.) —
    the mobile app's "Bill Radar" reads these to predict upcoming and overdue
    payments, rather than guessing purely from transaction history.
    """

    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    # 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
    interval = Column(String, nullable=False)

    # The anchor every future due date is computed from (see
    # app/services/subscription_service.py). Set once at creation from the
    # "this month's payment date" the user enters — never re-typed after.
    first_due_date = Column(Date, nullable=False)

    # The due date of the most recently confirmed-paid cycle. Null until the
    # first cycle is confirmed (via "mark as paid" or an auto-matched
    # transaction on the mobile app). Comparing this to today (stepped
    # forward by `interval`) is how overdue detection works.
    last_paid_date = Column(Date, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)  # false = cancelled

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="subscriptions")
