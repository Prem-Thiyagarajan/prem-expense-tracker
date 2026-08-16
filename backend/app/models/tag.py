# File: app/models/tag.py
from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from app.db.base_class import Base

# The three aggregate surfaces a tag's transactions can be hidden from. Any
# tag can opt into any subset of these via Settings > Tags -- there's no
# hardcoded "Exclude from Analytics" tag name anymore, see
# app/crud/tag_crud.get_excluded_transaction_ids.
EXCLUDABLE_SURFACES = ("dashboard", "analytics", "budgets")

class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)

    #! CHANGE: Name is no longer globally unique
    name = Column(String, nullable=False, index=True)

    # Which aggregate surfaces this tag's transactions are hidden from, e.g.
    # ["dashboard", "analytics"] -- empty means the tag has no special
    # exclusion behaviour anywhere, just a normal label.
    excluded_pages = Column(ARRAY(String), nullable=False, server_default="{}")

    #! CHANGE: Add user_id column and relationship
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="tags")

    transactions = relationship("TransactionTag", back_populates="tag", cascade="all, delete-orphan")

    # Add a constraint to ensure the tag name is unique per user
    __table_args__ = (UniqueConstraint('user_id', 'name', name='_user_id_name_uc'),)