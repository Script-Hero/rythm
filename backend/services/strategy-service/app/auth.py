"""
Authentication utilities for Strategy Service.
PLACEHOLDER - Basic auth stub.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

# Add this to shared models path if needed
from shared.models.user_models import User

security = HTTPBearer()


async def get_current_user(token: str = Depends(security)) -> User:
    """Get current user from JWT token - PLACEHOLDER."""
    # This is a placeholder implementation
    # In real implementation, this would validate the JWT token
    # and return the actual user from the database
    
    return User(
        id="00000000-0000-0000-0000-000000000000",
        username="placeholder_user",
        email="placeholder@example.com",
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z"
    )