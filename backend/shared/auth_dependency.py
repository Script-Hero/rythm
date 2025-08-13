"""
Shared authentication dependency for FastAPI services.
All microservices can use this for consistent authentication.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

from .models.user_models import UserResponse
from .auth_client import get_auth_client

# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserResponse:
    """
    FastAPI dependency to get current authenticated user.
    
    Usage in any service:
    ```python
    from shared.auth_dependency import get_current_user
    from shared.models.user_models import User
    
    @app.get("/protected-endpoint")
    async def protected_route(current_user: User = Depends(get_current_user)):
        return {"message": f"Hello {current_user.username}"}
    ```
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    auth_client = get_auth_client()
    user = await auth_client.validate_token(credentials.credentials)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[UserResponse]:
    """
    Optional authentication dependency.
    Returns user if authenticated, None if not.
    """
    if not credentials:
        return None
    
    auth_client = get_auth_client()
    return await auth_client.validate_token(credentials.credentials)