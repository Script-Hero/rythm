"""
Shared authentication client for microservices.
All services use this to validate tokens with the auth service.
"""

import asyncio
import httpx
from typing import Optional
from functools import lru_cache
import structlog

from .models.user_models import UserResponse

logger = structlog.get_logger()


class AuthClient:
    """Client for communicating with the authentication service."""
    
    def __init__(self, auth_service_url: str = "http://auth-service:8007"):
        self.auth_service_url = auth_service_url
        self.client = httpx.AsyncClient()
        self._cache = {}
        self._cache_ttl = 300  # 5 minutes
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
    
    async def validate_token(self, token: str) -> Optional[UserResponse]:
        """Validate token with auth service and return user."""
        try:
            # Check cache first (simple in-memory cache)
            if token in self._cache:
                cache_entry = self._cache[token]
                if cache_entry['expires'] > asyncio.get_event_loop().time():
                    if cache_entry['user']:
                        return UserResponse(**cache_entry['user'])
                    return None
            
            # Call auth service
            response = await self.client.post(
                f"{self.auth_service_url}/validate",
                json={"token": token},
                timeout=5.0
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Cache the result
                cache_entry = {
                    'user': data.get('user'),
                    'expires': asyncio.get_event_loop().time() + self._cache_ttl
                }
                self._cache[token] = cache_entry
                
                if data.get('valid') and data.get('user'):
                    return UserResponse(**data['user'])
            
            return None
            
        except Exception as e:
            logger.error("Token validation failed", error=str(e))
            return None
    
    async def health_check(self) -> bool:
        """Check if auth service is healthy."""
        try:
            response = await self.client.get(
                f"{self.auth_service_url}/health",
                timeout=5.0
            )
            return response.status_code == 200
        except Exception:
            return False


# Global auth client instance
_auth_client: Optional[AuthClient] = None


def get_auth_client() -> AuthClient:
    """Get the global auth client instance."""
    global _auth_client
    if _auth_client is None:
        _auth_client = AuthClient()
    return _auth_client


async def close_auth_client():
    """Close the global auth client."""
    global _auth_client
    if _auth_client:
        await _auth_client.close()
        _auth_client = None