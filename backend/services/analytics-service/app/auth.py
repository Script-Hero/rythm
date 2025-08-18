"""
Authentication dependency for Analytics Service.
"""

import os
import sys
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Add shared modules to path
sys.path.append('/app/shared')

from auth_dependency import get_current_user as get_user_from_auth
import structlog

logger = structlog.get_logger()

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UUID:
    """
    Get current user from JWT token.
    
    Args:
        credentials: HTTP Bearer token credentials
        
    Returns:
        User ID as UUID
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        # Use shared auth function to get user response
        user_response = await get_user_from_auth(credentials)
        
        if not user_response:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        return user_response.id
    
    except ValueError as e:
        # UUID conversion error
        logger.error("Invalid user ID format", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    
    except Exception as e:
        # Unexpected error
        logger.error("Authentication error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[UUID]:
    """
    Get current user from JWT token (optional).
    Returns None if no token provided or invalid.
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
    except Exception:
        return None