"""
AlgoTrade Authentication Service
Centralized authentication and user management service.
"""

import time
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Optional

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import settings
from .models import (
    UserCreate, UserLogin, UserResponse, TokenResponse, 
    TokenValidation, TokenValidationResponse, DevAuthRequest
)
from .services import DatabaseService, RedisService, AuthService

# Configure logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(30),
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    logger.info("🔐 Starting Authentication Service")
    
    # Initialize services
    await DatabaseService.initialize()
    await RedisService.initialize()
    
    logger.info("✅ Authentication Service initialized")
    
    yield
    
    logger.info("🛑 Shutting down Authentication Service")
    await DatabaseService.close()
    await RedisService.close()


app = FastAPI(
    title="AlgoTrade Authentication Service",
    description="Centralized authentication and user management service",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize auth service
auth_service = AuthService()


@app.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate) -> TokenResponse:
    """Register a new user."""
    try:
        # Check if user already exists
        existing_user = await DatabaseService.get_user_by_username(user_data.username)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )
        
        # Create user
        password_hash = auth_service.get_password_hash(user_data.password)
        user = await DatabaseService.create_user(
            username=user_data.username,
            email=user_data.email,
            password_hash=password_hash
        )
        
        # Create access token
        access_token = auth_service.create_access_token(
            data={"sub": str(user.id)}
        )
        
        logger.info("User registered", user_id=str(user.id), username=user.username)
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.JWT_EXPIRE_MINUTES * 60,
            user=user
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Registration failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@app.post("/login", response_model=TokenResponse)
async def login(user_credentials: UserLogin) -> TokenResponse:
    """Authenticate user and return token."""
    try:
        user = await auth_service.authenticate_user(
            user_credentials.username, 
            user_credentials.password
        )
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        # Create access token
        access_token = auth_service.create_access_token(
            data={"sub": str(user.id)}
        )
        
        logger.info("User logged in", user_id=str(user.id), username=user.username)
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.JWT_EXPIRE_MINUTES * 60,
            user=user
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Login failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@app.post("/dev-login", response_model=TokenResponse)
async def dev_login(dev_request: Optional[DevAuthRequest] = None) -> TokenResponse:
    """Development authentication - tries real dev user first, then creates demo token."""
    if not settings.DEV_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development authentication disabled"
        )
    
    try:
        # First try to authenticate with the real dev user from database
        real_dev_user = await auth_service.authenticate_user(settings.DEV_USERNAME, "dev_password")
        
        if real_dev_user:
            # Use real dev user from database
            access_token = auth_service.create_access_token(
                data={"sub": str(real_dev_user.id)}
            )
            
            logger.info("Development login with real user", user_id=str(real_dev_user.id), username=real_dev_user.username)
            
            return TokenResponse(
                access_token=access_token,
                token_type="bearer",
                expires_in=settings.JWT_EXPIRE_MINUTES * 60,
                user=real_dev_user
            )
        else:
            # Fallback to temporary dev user
            dev_user = auth_service.create_dev_user()
            
            # Create access token with dev flag
            access_token = auth_service.create_access_token(
                data={"sub": str(dev_user.id), "dev": True}
            )
            
            logger.info("Development login with temporary user", user_id=str(dev_user.id))
            
            return TokenResponse(
                access_token=access_token,
                token_type="bearer",
                expires_in=settings.JWT_EXPIRE_MINUTES * 60,
                user=dev_user
            )
        
    except Exception as e:
        logger.error("Development login failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Development login failed"
        )


@app.post("/validate", response_model=TokenValidationResponse)
async def validate_token(token_data: TokenValidation) -> TokenValidationResponse:
    """Validate JWT token and return user information."""
    try:
        user = await auth_service.validate_token(token_data.token)
        
        if user:
            return TokenValidationResponse(
                valid=True,
                user=user
            )
        else:
            return TokenValidationResponse(
                valid=False,
                error="Invalid or expired token"
            )
            
    except Exception as e:
        logger.error("Token validation failed", error=str(e))
        return TokenValidationResponse(
            valid=False,
            error="Token validation failed"
        )


@app.post("/logout")
async def logout(token_data: TokenValidation) -> dict:
    """Logout user by blacklisting token."""
    try:
        # Blacklist the token
        await RedisService.blacklist_token(
            token_data.token, 
            settings.JWT_EXPIRE_MINUTES * 60
        )
        
        logger.info("User logged out")
        
        return {"message": "Successfully logged out"}
        
    except Exception as e:
        logger.error("Logout failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )


# HTTP Bearer token scheme
security = HTTPBearer()

@app.get("/me", response_model=UserResponse)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
    """Get current user information using Bearer token."""
    try:
        user = await auth_service.validate_token(credentials.credentials)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get user failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user information"
        )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "auth-service",
        "dev_mode": settings.DEV_MODE,
        "database_connected": DatabaseService._pool is not None,
        "redis_connected": RedisService._client is not None
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8007,
        reload=settings.DEBUG
    )