# File: app/schemas/auth_schema.py
from pydantic import BaseModel, validator
from app.core.validators import validate_password_strength

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None

class LoginRequest(BaseModel):
    identifier: str
    password: str
    remember_me: bool = False

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @validator('new_password')
    def new_password_complexity(cls, v):
        return validate_password_strength(v)

class SecurityQuestionSet(BaseModel):
    current_password: str
    question: str
    answer: str

class RecoveryStartRequest(BaseModel):
    identifier: str

class RecoveryQuestionOut(BaseModel):
    question: str

class RecoveryResetRequest(BaseModel):
    identifier: str
    answer: str
    new_password: str

    @validator('new_password')
    def new_password_complexity(cls, v):
        return validate_password_strength(v)