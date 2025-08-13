"""Authentication service business logic."""

import asyncpg
import redis.asyncio as aioredis
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4
from jose import jwt, JWTError
from passlib.context import CryptContext
import structlog

from .config import settings
from .models import UserResponse

logger = structlog.get_logger()


class DatabaseService:
    """Database service for user management."""
    
    _pool: Optional[asyncpg.Pool] = None
    
    @classmethod
    async def initialize(cls):
        """Initialize database connection pool."""
        cls._pool = await asyncpg.create_pool(
            settings.DATABASE_URL,
            min_size=2,
            max_size=10
        )
        logger.info("Database connection pool initialized")
    
    @classmethod
    async def close(cls):
        """Close database connection pool."""
        if cls._pool:
            await cls._pool.close()
            cls._pool = None
            logger.info("Database connection pool closed")
    
    @classmethod
    async def get_user_by_id(cls, user_id: UUID) -> Optional[UserResponse]:
        """Get user by ID."""
        if not cls._pool:
            raise RuntimeError("Database not initialized")
        
        async with cls._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, username, email, is_active, created_at, updated_at
                FROM users WHERE id = $1
                """,
                user_id
            )
            
            if row:
                return UserResponse(
                    id=row['id'],
                    username=row['username'],
                    email=row['email'],
                    is_active=row['is_active'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at']
                )
            return None
    
    @classmethod
    async def get_user_by_username(cls, username: str) -> Optional[dict]:
        """Get user by username with password hash."""
        if not cls._pool:
            raise RuntimeError("Database not initialized")
        
        async with cls._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, username, email, hashed_password, is_active, created_at, updated_at
                FROM users WHERE username = $1
                """,
                username
            )
            return dict(row) if row else None
    
    @classmethod
    async def create_user(cls, username: str, email: str, password_hash: str) -> UserResponse:
        """Create a new user."""
        if not cls._pool:
            raise RuntimeError("Database not initialized")
        
        user_id = uuid4()
        now = datetime.utcnow()
        
        async with cls._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO users (id, username, email, hashed_password, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                user_id, username, email, password_hash, True, now, now
            )
        
        return UserResponse(
            id=user_id,
            username=username,
            email=email,
            is_active=True,
            created_at=now,
            updated_at=now
        )


class RedisService:
    """Redis service for token management."""
    
    _client: Optional[aioredis.Redis] = None
    
    @classmethod
    async def initialize(cls):
        """Initialize Redis connection."""
        cls._client = aioredis.from_url(settings.REDIS_URL)
        await cls._client.ping()
        logger.info("Redis connection initialized")
    
    @classmethod
    async def close(cls):
        """Close Redis connection."""
        if cls._client:
            await cls._client.close()
            cls._client = None
            logger.info("Redis connection closed")
    
    @classmethod
    async def blacklist_token(cls, token: str, expires_in: int):
        """Blacklist a token."""
        if cls._client:
            await cls._client.setex(f"blacklist:{token}", expires_in, "1")
    
    @classmethod
    async def is_token_blacklisted(cls, token: str) -> bool:
        """Check if token is blacklisted."""
        if cls._client:
            result = await cls._client.get(f"blacklist:{token}")
            return result is not None
        return False


class AuthService:
    """Authentication service."""
    
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash."""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password."""
        return self.pwd_context.hash(password)
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token."""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        return encoded_jwt
    
    async def validate_token(self, token: str) -> Optional[UserResponse]:
        """Validate JWT token and return user."""
        try:
            # Check if token is blacklisted
            if await RedisService.is_token_blacklisted(token):
                return None
            
            # Decode token
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            user_id: str = payload.get("sub")
            
            if user_id is None:
                return None
            
            # Check if this is a dev token
            if payload.get("dev") and settings.DEV_MODE:
                return self.create_dev_user()
            
            # Get user from database
            user = await DatabaseService.get_user_by_id(UUID(user_id))
            return user
            
        except (JWTError, ValueError) as e:
            logger.warning("Token validation failed", error=str(e))
            return None
    
    async def authenticate_user(self, username: str, password: str) -> Optional[UserResponse]:
        """Authenticate user with username/password."""
        user_data = await DatabaseService.get_user_by_username(username)
        
        if not user_data or not self.verify_password(password, user_data["hashed_password"]):
            return None
        
        return UserResponse(
            id=user_data["id"],
            username=user_data["username"],
            email=user_data["email"],
            is_active=user_data["is_active"],
            created_at=user_data["created_at"],
            updated_at=user_data["updated_at"]
        )
    
    def create_dev_user(self) -> UserResponse:
        """Create development user for testing."""
        return UserResponse(
            id=UUID(settings.DEV_USER_ID),
            username=settings.DEV_USERNAME,
            email=settings.DEV_EMAIL,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )