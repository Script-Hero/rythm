"""Authentication models."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from uuid import UUID


class UserCreate(BaseModel):
    """User creation model."""
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    """User login model."""
    username: str
    password: str


class UserResponse(BaseModel):
    """User response model."""
    id: UUID
    username: str
    email: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    """Token response model."""
    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse


class TokenValidation(BaseModel):
    """Token validation request."""
    token: str


class TokenValidationResponse(BaseModel):
    """Token validation response."""
    valid: bool
    user: Optional[UserResponse] = None
    error: Optional[str] = None


class DevAuthRequest(BaseModel):
    """Development authentication request."""
    dev_mode: bool = True