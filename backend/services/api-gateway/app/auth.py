"""Authentication utilities for API Gateway."""

import os
import sys
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from jose import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext

# Add shared models to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from shared.models.user_models import User, TokenData
from .config import settings
from .services import DatabaseService

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT token scheme
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> TokenData:
    """Verify and decode JWT token."""
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        user_id: str = payload.get("sub")
        username: str = payload.get("username")
        token_type: str = payload.get("type", "access")
        
        if user_id is None or token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token_data = TokenData(user_id=UUID(user_id), username=username)
        return token_data
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current authenticated user."""
    token_data = verify_token(credentials.credentials)
    
    # Get user from database
    pool = await DatabaseService.get_connection()
    try:
        async with pool.acquire() as conn:
            result = await conn.fetchrow(
                "SELECT * FROM users WHERE id = $1 AND is_active = true",
                token_data.user_id
            )
            
            if result is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or inactive",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            result_dict = dict(result)
            # Convert UUID to string for Pydantic model
            if 'id' in result_dict:
                result_dict['id'] = str(result_dict['id'])
            return User(**result_dict)
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during authentication"
        )


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user (additional check)."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def authenticate_user(username: str, password: str) -> Optional[User]:
    """Authenticate user with username/password."""
    pool = await DatabaseService.get_connection()
    
    try:
        async with pool.acquire() as conn:
            result = await conn.fetchrow(
                "SELECT * FROM users WHERE username = $1 AND is_active = true",
                username
            )
            
            if result is None:
                return None
            
            result_dict = dict(result)
            # Convert UUID to string for Pydantic model
            if 'id' in result_dict:
                result_dict['id'] = str(result_dict['id'])
            user = User(**result_dict)
            
            if not verify_password(password, user.hashed_password):
                return None
                
            return user
            
    except Exception:
        return None