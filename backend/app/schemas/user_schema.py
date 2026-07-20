# File: app/schemas/user_schema.py
from pydantic import BaseModel, EmailStr, validator
from app.core.validators import validate_password_strength

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

    @validator('password')
    def password_complexity(cls, v):
        return validate_password_strength(v)

class UserOut(UserBase):
    id: int
    class Config:
        from_attributes = True