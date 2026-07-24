# File: app/core/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.crud import user_crud
from app.core.security import SECRET_KEY, ALGORITHM

# This is the central definition of our security scheme.
# It tells FastAPI where to look for the token.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login/password")

#! NEW: The main dependency to get the current user
def get_current_active_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """
    Dependency to get the current user from a token.
    Raises HTTPException 401 if the user is not authenticated.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = user_crud.get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    # Reject tokens issued before the user's version was bumped (revocation).
    if payload.get("ver") != user.token_version:
        raise credentials_exception
    return user