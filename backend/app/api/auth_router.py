# File: app/api/auth_router.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from app.db.session import get_db
from app.schemas.user_schema import UserCreate, UserOut
from app.schemas.auth_schema import Token, LoginRequest, ChangePasswordRequest
from app.crud import user_crud
from app.core.security import (
    verify_password, create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES, REMEMBER_ME_EXPIRE_DAYS, get_password_hash
)
from app.core import deps
from app.core.limiter import limiter

router = APIRouter(tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
def register_user(request: Request, user_in: UserCreate, db: Session = Depends(get_db)):
    # Uniform message for both collisions so registration can't be used to
    # enumerate which usernames/emails already exist.
    existing = user_crud.get_user_by_identifier(db, identifier=user_in.username) \
        or db.query(user_crud.User).filter(user_crud.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username or email already registered")
    return user_crud.create_user(db, user=user_in)


@router.post("/login/password", response_model=Token)
@limiter.limit("5/minute")
def login_for_access_token(request: Request, db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    """Legacy form-based login kept for Swagger UI compatibility."""
    user = user_crud.authenticate_user(db, identifier=form_data.username, password=form_data.password)
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login_json(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    """JSON login endpoint supporting Remember Me (30-day token) vs session (60-min token)."""
    user = user_crud.authenticate_user(db, identifier=payload.identifier, password=payload.password)
    if payload.remember_me:
        expires = timedelta(days=REMEMBER_ME_EXPIRE_DAYS)
    else:
        expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    access_token = create_access_token(data={"sub": user.email}, expires_delta=expires)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/change-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(deps.get_current_active_user)
):
    """Allows a logged-in user to change their password by providing the old one."""
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user_crud.update_password(db, user_id=current_user.id, new_hashed_password=get_password_hash(payload.new_password))
    return {"message": "Password updated successfully"}
