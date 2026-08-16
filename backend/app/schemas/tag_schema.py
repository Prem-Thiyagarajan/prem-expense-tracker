# File: app/schemas/tag_schema.py
from pydantic import BaseModel, field_validator
from typing import List

from app.models.tag import EXCLUDABLE_SURFACES

class TagBase(BaseModel):
    name: str
    # Which of dashboard/analytics/budgets this tag's transactions are hidden
    # from. Defaults to [] (a plain label with no exclusion behaviour).
    excluded_pages: List[str] = []

    @field_validator("excluded_pages")
    @classmethod
    def _validate_surfaces(cls, value: List[str]) -> List[str]:
        unknown = set(value) - set(EXCLUDABLE_SURFACES)
        if unknown:
            raise ValueError(f"Unknown page(s) for excluded_pages: {sorted(unknown)}. Valid: {list(EXCLUDABLE_SURFACES)}")
        return value

class TagCreate(TagBase):
    pass

class TagUpdate(TagBase):
    pass

class TagOut(TagBase):
    id: int
    user_id: int #! CHANGE: Add user_id to the output schema

    class Config:
        from_attributes = True
