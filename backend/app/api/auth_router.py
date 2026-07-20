# File: app/api/auth_router.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from app.db.session import get_db
from app.schemas.user_schema import UserCreate, UserOut
from app.schemas.auth_schema import (
    Token, LoginRequest, ChangePasswordRequest,
    SecurityQuestionSet, RecoveryStartRequest, RecoveryQuestionOut, RecoveryResetRequest,
)
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
        data={"sub": user.email, "ver": user.token_version},
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

    access_token = create_access_token(data={"sub": user.email, "ver": user.token_version}, expires_delta=expires)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/change-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(deps.get_current_active_user)
):
    """Change the password after verifying the old one. Bumps token_version to
    revoke every other existing session, and returns a fresh token so THIS
    session stays logged in."""
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = get_password_hash(payload.new_password)
    current_user.token_version = (current_user.token_version or 0) + 1
    db.commit()
    new_token = create_access_token(
        data={"sub": current_user.email, "ver": current_user.token_version},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"message": "Password updated successfully", "access_token": new_token}


@router.post("/security-question", status_code=status.HTTP_200_OK)
def set_security_question(
    payload: SecurityQuestionSet,
    db: Session = Depends(get_db),
    current_user=Depends(deps.get_current_active_user),
):
    """Set/update the recovery security question. Requires the current password
    so a stolen session token alone can't seed a recovery answer."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if not payload.question.strip() or not payload.answer.strip():
        raise HTTPException(status_code=400, detail="Question and answer are required.")
    user_crud.set_security_question(db, current_user, payload.question, payload.answer)
    return {"message": "Security question saved."}


@router.post("/recovery/question", response_model=RecoveryQuestionOut)
@limiter.limit("5/hour")
def get_recovery_question(request: Request, payload: RecoveryStartRequest, db: Session = Depends(get_db)):
    """Return the security question for an account that has one configured."""
    question = user_crud.get_recovery_question(db, identifier=payload.identifier)
    if not question:
        raise HTTPException(status_code=404, detail="No security question is set for this account.")
    return {"question": question}


@router.post("/recovery/reset", status_code=status.HTTP_200_OK)
@limiter.limit("5/hour")
def recovery_reset(request: Request, payload: RecoveryResetRequest, db: Session = Depends(get_db)):
    """Reset the password if the security answer is correct."""
    ok = user_crud.reset_password_with_answer(
        db, identifier=payload.identifier, answer=payload.answer, new_password=payload.new_password
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Incorrect answer to the security question.")
    return {"message": "Password reset successfully. You can now log in with your new password."}
