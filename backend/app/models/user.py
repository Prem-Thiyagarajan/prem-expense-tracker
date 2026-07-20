# File: app/models/user.py
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Account-lockout tracking (see crud/user_crud.py)
    failed_login_count = Column(Integer, nullable=False, server_default="0")
    locked_until = Column(DateTime, nullable=True)

    # Self-service password recovery (answer is bcrypt-hashed, never plaintext)
    security_question = Column(Text, nullable=True)
    security_answer_hash = Column(String(255), nullable=True)

    @property
    def has_security_question(self) -> bool:
        return bool(self.security_answer_hash)

    #! CHANGE: Add relationships to other models
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="user", cascade="all, delete-orphan")