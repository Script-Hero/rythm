"""
Authentication utilities for Strategy Service.
TODO: This is a placeholder implementation that returns hardcoded user data.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

# Add this to shared models path if needed
from shared.models.user_models import User

security = HTTPBearer()


async def get_current_user(token: str = Depends(security)) -> User:
    """Get current user from JWT token.
    
    TODO: This is a placeholder implementation that needs to be replaced.
    Real implementation should:
    1. Validate the JWT token using settings.JWT_SECRET_KEY
    2. Decode the token to get user_id  
    3. Query the database to get actual user data
    4. Handle token expiration and validation errors
    5. Raise appropriate HTTP exceptions for auth failures
    """
    # TODO: Replace this hardcoded user with actual JWT validation
    return User(
        id="00000000-0000-0000-0000-000000000000",  # TODO: Get from JWT token
        username="placeholder_user",  # TODO: Get from database
        email="placeholder@example.com",  # TODO: Get from database  
        created_at="2024-01-01T00:00:00Z",  # TODO: Get from database
        updated_at="2024-01-01T00:00:00Z"   # TODO: Get from database
    )