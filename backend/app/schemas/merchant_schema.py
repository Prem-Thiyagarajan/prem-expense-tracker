# File: app/schemas/merchant_schema.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

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
    merchant"). Beyond the raw handle string (often not enough on its own to
    guess a category from), carries enough transaction context -- several
    distinct raw narrations, the amount range, and the date range -- for a
    user to recognise what this cluster actually is."""
    handle: Optional[str] = None
    sample_description: str
    # Up to 3 distinct raw description strings from the cluster, in full --
    # `sample_description` alone is often one truncated/formatted narration;
    # seeing a few side by side (and untruncated in the UI) surfaces
    # embedded entity names a single sample can hide.
    sample_descriptions: List[str] = []
    transaction_ids: List[int]
    count: int
    total_amount: float
    min_amount: float
    max_amount: float
    first_seen: Optional[date] = None
    last_seen: Optional[date] = None

class RescanResultOut(BaseModel):
    auto_applied: int
    suggested: int