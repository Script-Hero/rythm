"""Authentication utilities for WebSocket connections."""

import jwt
from datetime import datetime
from typing import Optional
from dataclasses import dataclass

import structlog

from .config import settings

logger = structlog.get_logger()


@dataclass
class User:
    """User model for authentication."""
    id: str
    username: str
    email: str


async def get_current_user_from_websocket(token: Optional[str]) -> Optional[User]:
    """
    Authenticate user from WebSocket token.
    Used during WebSocket handshake for user authentication.
    """
    if not token:
        logger.warning("No token provided for WebSocket authentication")
        return None
    
    try:
        # Decode JWT token
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Extract user info from token
        user_id = payload.get("sub")
        username = payload.get("username")
        email = payload.get("email")
        
        if not user_id:
            logger.warning("Invalid token: missing user_id")
            return None
        
        # Check token expiration
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp) < datetime.utcnow():
            logger.warning("Token has expired", user_id=user_id)
            return None
        
        # Create user object
        user = User(
            id=user_id,
            username=username or "unknown",
            email=email or "unknown@example.com"
        )
        
        logger.debug("WebSocket authentication successful", user_id=user_id)
        return user
        
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid JWT token", error=str(e))
        return None
    except Exception as e:
        logger.error("Authentication error", error=str(e))
        return None


def create_websocket_token(user_id: str, username: str, email: str, expires_in_hours: int = 24) -> str:
    """
    Create a JWT token for WebSocket authentication.
    Used by other services to generate tokens for users.
    """
    payload = {
        "sub": user_id,
        "username": username,
        "email": email,
        "exp": datetime.utcnow().timestamp() + (expires_in_hours * 3600),
        "iat": datetime.utcnow().timestamp()
    }
    
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token


async def verify_service_token(token: str) -> bool:
    """
    Verify token from other services for REST API calls.
    Used to authenticate inter-service communication.
    """
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Check if it's a service token
        service = payload.get("service")
        if not service:
            return False
        
        # Check expiration
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp) < datetime.utcnow():
            return False
        
        return True
        
    except jwt.InvalidTokenError:
        return False
    except Exception:
        return False