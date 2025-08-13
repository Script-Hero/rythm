"""Authentication router for API Gateway."""

import os
import sys
from datetime import timedelta
from typing import Any, Dict

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer

# Add shared models to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../..'))

from shared.models.user_models import UserCreate, UserResponse, UserLogin, Token
from ..auth import (
    authenticate_user, 
    create_access_token, 
    create_refresh_token,
    get_password_hash,
    get_current_user
)
from ..config import settings
from ..services import DatabaseService

logger = structlog.get_logger()
router = APIRouter()
security = HTTPBearer()


@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate) -> UserResponse:
    """Register a new user."""
    pool = await DatabaseService.get_connection()
    
    try:
        async with pool.acquire() as conn:
            # Check if user already exists
            existing = await conn.fetchrow(
                "SELECT id FROM users WHERE email = $1 OR username = $2",
                user.email, user.username
            )
            
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User with this email or username already exists"
                )
            
            # Hash password and create user
            hashed_password = get_password_hash(user.password)
            
            result = await conn.fetchrow(
                """
                INSERT INTO users (email, username, hashed_password, is_active, is_verified)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, email, username, is_active, is_verified, created_at, updated_at
                """,
                user.email, user.username, hashed_password, user.is_active, user.is_verified
            )
            
            logger.info("User registered", user_id=str(result['id']), username=user.username)
            
            return UserResponse(**dict(result))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Registration failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/login", response_model=Token)
async def login(form_data: UserLogin) -> Token:
    """Authenticate user and return access token."""
    user = await authenticate_user(form_data.username, form_data.password)
    
    if not user:
        logger.warning("Login failed", username=form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create tokens
    access_token_expires = timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username}, 
        expires_delta=access_token_expires
    )
    
    logger.info("User logged in", user_id=str(user.id), username=user.username)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRE_MINUTES * 60  # seconds
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_token: str) -> Token:
    """Refresh access token using refresh token."""
    # TODO: Implement refresh token logic
    # For now, redirect to login
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please login again"
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user = Depends(get_current_user)) -> UserResponse:
    """Get current user information."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    )


@router.post("/logout")
async def logout(current_user = Depends(get_current_user)) -> Dict[str, Any]:
    """Logout user (client should discard token)."""
    logger.info("User logged out", user_id=str(current_user.id))
    
    return {
        "success": True,
        "message": "Logged out successfully"
    }


@router.get("/status")
async def auth_status() -> Dict[str, Any]:
    """Authentication service status."""
    return {
        "service": "authentication",
        "status": "healthy",
        "jwt_expire_minutes": settings.JWT_EXPIRE_MINUTES,
        "features": {
            "registration": True,
            "jwt_tokens": True,
            "password_hashing": True
        }
    }