# File: app/crud/user_crud.py
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.user import User
from app.schemas.user_schema import UserCreate
from app.core.security import get_password_hash, verify_password, DUMMY_PASSWORD_HASH

MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 15

def get_user_by_identifier(db: Session, identifier: str):
    """Finds a user by their username OR their email."""
    return db.query(User).filter(
        or_(User.username == identifier, User.email == identifier)
    ).first()

def _is_locked(user: User) -> bool:
    return bool(user.locked_until and user.locked_until > datetime.utcnow())

def authenticate_user(db: Session, identifier: str, password: str) -> User:
    """Verify credentials with per-account lockout. Raises 401/429; returns the user on success."""
    user = get_user_by_identifier(db, identifier=identifier)

    if user and _is_locked(user):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked due to too many failed logins. Try again later.",
        )

    if not user or not user.hashed_password or not verify_password(password, user.hashed_password):
        if user:
            user.failed_login_count = (user.failed_login_count or 0) + 1
            if user.failed_login_count >= MAX_FAILED_LOGINS:
                user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
                user.failed_login_count = 0
            db.commit()
        else:
            # Equalize timing so "no such user" isn't measurably faster than "wrong password".
            verify_password(password, DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.failed_login_count or user.locked_until:
        user.failed_login_count = 0
        user.locked_until = None
        db.commit()
    return user

#! THIS IS THE FIX: Add the missing function that our authenticator needs.
def get_user_by_email(db: Session, email: str) -> User | None:
    """Finds a user specifically by their email."""
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate):
    # We have removed the data seeding as you requested.
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_password(db: Session, user_id: int, new_hashed_password: str):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.hashed_password = new_hashed_password
        db.commit()
    return user

def delete_user(db: Session, user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        db.delete(user)
        db.commit()
    return user