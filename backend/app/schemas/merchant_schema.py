# File: app/schemas/merchant_schema.py
from pydantic import BaseModel
from typing import List, Optional

class MerchantBase(BaseModel):
    name: str
    category_id: Optional[int] = None

class MerchantCreate(MerchantBase):
    pass

class MerchantUpdate(MerchantBase):
    pass

class MerchantOut(MerchantBase):
    id: int
    user_id: int #! CHANGE: Add user_id to the output schema

    class Config:
        from_attributes = True

class UnmappedCountOut(BaseModel):
    count: int

class MerchantClusterOut(BaseModel):
    """One group of currently-unmapped transactions sharing a UPI handle --
    the cold-start bulk-naming banner ("N strings look like the same
    merchant")."""
    handle: Optional[str] = None
    sample_description: str
    transaction_ids: List[int]
    count: int

class RescanResultOut(BaseModel):
    auto_applied: int
    suggested: int