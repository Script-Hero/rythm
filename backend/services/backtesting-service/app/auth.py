"""Authentication utilities for Backtesting Service."""

import httpx
from typing import Optional
from dataclasses import dataclass

import structlog
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import settings

logger = structlog.get_logger()
security = HTTPBearer()


@dataclass
class User:
    """User model for authentication."""
    id: str
    username: str
    email: str


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """
    Get current authenticated user by validating token with auth service.
    """
    token = credentials.credentials
    logger.info("Auth request received", token_length=len(token) if token else 0, auth_service_url=settings.AUTH_SERVICE_URL)
    
    try:
        # Validate token with auth service
        auth_url = f"{settings.AUTH_SERVICE_URL}/validate"
        logger.info("Calling auth service", url=auth_url)
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                auth_url,
                json={"token": token}
            )
            
            logger.info("Auth service response", status=response.status_code, response_text=response.text[:200])
            
            if response.status_code != 200:
                logger.warning("Auth service validation failed", status=response.status_code, response=response.text)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            
            validation_data = response.json()
            
            if not validation_data.get("valid"):
                logger.warning("Token validation failed", error=validation_data.get("error"))
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=validation_data.get("error", "Invalid token"),
                    headers={"WWW-Authenticate": "Bearer"}
                )
            
            user_data = validation_data.get("user")
            if not user_data:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token data",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            
            # Create user object
            user = User(
                id=str(user_data["id"]),
                username=user_data.get("username", "unknown"),
                email=user_data.get("email", "unknown@example.com")
            )
            
            logger.info("Authentication successful", user_id=user.id, username=user.username)
            return user
        
    except httpx.RequestError as e:
        logger.error("Auth service connection failed", error=str(e), auth_url=auth_url)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Authentication error", error=str(e), error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"}
        )