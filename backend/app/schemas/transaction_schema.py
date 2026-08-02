# File: app/schemas/transaction_schema.py
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, Dict, Any, List
import uuid
from .tag_schema import TagOut

def default_unique_key():
    return f"MANUAL-{uuid.uuid4()}"

class TransactionBase(BaseModel):
    txn_date: datetime
    description: str
    amount: float
    type: str
    source: str
    account_id: int
    category_id: Optional[int] = None
    merchant_id: Optional[int] = None
    upi_ref: Optional[str] = None
    unique_key: Optional[str] = Field(default_factory=default_unique_key)
    raw_data: Optional[Dict[str, Any]] = None
    tag_ids: Optional[List[int]] = []

    @field_validator("unique_key")
    @classmethod
    def _no_explicit_null(cls, v):
        # unique_key is NOT NULL in the DB; an explicit null in the request body
        # would otherwise bypass default_factory (which only fires when the field
        # is omitted entirely) and hit the constraint at insert time.
        return v or default_unique_key()

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    txn_date: Optional[datetime] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    source: Optional[str] = None
    account_id: Optional[int] = None
    category_id: Optional[int] = None
    merchant_id: Optional[int] = None
    upi_ref: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None
    tag_ids: Optional[List[int]] = None

# ✅ THIS IS THE FIX
# The TransactionOut schema defines the response for a *single* transaction.
# Thanks to our proxy, we can now simply declare that `tags` will be a List of `TagOut` objects.
# Pydantic will automatically use the `transaction.tags` proxy to build this list.
class TransactionOut(TransactionBase):
    id: int
    user_id: int
    created_at: Optional[datetime] = None
    tags: List[TagOut] = []

    class Config:
        from_attributes = True