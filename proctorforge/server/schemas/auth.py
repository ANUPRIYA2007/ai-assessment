"""
ProctorForge AI - Pydantic Schemas for Auth
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "student"
    # Student-specific fields
    gender: Optional[str] = None
    class_name: Optional[str] = None
    year: Optional[str] = None
    section: Optional[str] = None
    register_number: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    status: str
    created_at: datetime
    gender: Optional[str] = None
    class_name: Optional[str] = None
    year: Optional[str] = None
    section: Optional[str] = None
    register_number: Optional[str] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: str
    role: str
    exp: Optional[int] = None
