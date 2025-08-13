"""
AlgoTrade API Gateway
Main entry point for the microservices architecture.
Handles authentication, rate limiting, and request routing.
"""

import os
import time
from contextlib import asynccontextmanager
from typing import Dict, Any

import structlog
import uvicorn
import httpx
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
# from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from .config import settings
from .routers import strategies, forward_testing, backtesting, market_data, analytics
from .middleware import LoggingMiddleware
from .services import DatabaseService, RedisService

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(30),  # INFO level
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter(
    'api_gateway_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'api_gateway_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint']
)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("🚀 Starting AlgoTrade API Gateway")
    
    # Initialize services
    try:
        await DatabaseService.initialize()
        await RedisService.initialize()
        logger.info("✅ Services initialized successfully")
    except Exception as e:
        logger.error("❌ Failed to initialize services", error=str(e))
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down AlgoTrade API Gateway")
    await DatabaseService.close()
    await RedisService.close()


# Create FastAPI app
app = FastAPI(
    title="AlgoTrade API Gateway",
    description="Microservices API Gateway for AlgoTrade platform",
    version="2.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan
)

# Add middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TrustedHostMiddleware disabled for development
# if not settings.DEBUG:
#     app.add_middleware(
#         TrustedHostMiddleware,
#         allowed_hosts=settings.ALLOWED_HOSTS
#     )

app.add_middleware(LoggingMiddleware)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Collect Prometheus metrics for all requests."""
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    REQUEST_DURATION.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    return response


# Health check endpoints
@app.get("/health")
async def health_check():
    """Basic health check."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "2.0.0",
        "service": "api-gateway"
    }


@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check including dependencies."""
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "2.0.0",
        "service": "api-gateway",
        "dependencies": {}
    }
    
    # Check database
    try:
        await DatabaseService.health_check()
        health_status["dependencies"]["database"] = "healthy"
    except Exception as e:
        health_status["dependencies"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check Redis
    try:
        await RedisService.health_check()
        health_status["dependencies"]["redis"] = "healthy"
    except Exception as e:
        health_status["dependencies"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    return health_status


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# API Routes - Auth routes proxied to auth-service
app.include_router(strategies.router, prefix="/api/strategies", tags=["strategies"])
app.include_router(forward_testing.router, prefix="/api/forward-test", tags=["forward-testing"])
app.include_router(backtesting.router, prefix="/api/backtest", tags=["backtesting"])
app.include_router(market_data.router, prefix="/api/market", tags=["market-data"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])


# Global exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with consistent format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "timestamp": time.time(),
            "path": str(request.url)
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(
        "Unhandled exception",
        path=str(request.url),
        method=request.method,
        error=str(exc),
        exc_info=True
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error" if not settings.DEBUG else str(exc),
            "timestamp": time.time(),
            "path": str(request.url)
        }
    )


# Auth service proxy routes
@app.post("/api/auth/{path:path}")
@app.get("/api/auth/{path:path}")
async def proxy_auth_routes(path: str, request: Request):
    """Proxy all auth routes to auth service."""
    auth_service_url = "http://auth-service:8007"
    
    # Forward the request to auth service
    async with httpx.AsyncClient() as client:
        try:
            # Prepare request data
            method = request.method
            url = f"{auth_service_url}/{path}"
            headers = dict(request.headers)
            # Remove host header to avoid conflicts
            headers.pop("host", None)
            
            # Get request body if present
            body = None
            if method in ["POST", "PUT", "PATCH"]:
                body = await request.body()
            
            # Forward request
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                content=body,
                params=dict(request.query_params),
                timeout=30.0
            )
            
            # Return response with same status and content
            return JSONResponse(
                content=response.json() if response.content else {},
                status_code=response.status_code,
                headers=dict(response.headers)
            )
            
        except httpx.RequestError as e:
            logger.error("Auth service request failed", error=str(e))
            raise HTTPException(
                status_code=503,
                detail="Authentication service unavailable"
            )
        except Exception as e:
            logger.error("Auth proxy error", error=str(e))
            raise HTTPException(
                status_code=500,
                detail="Authentication proxy error"
            )


# Rate limited endpoints
@app.get("/api/status")
@limiter.limit("10/minute")
async def api_status(request: Request):
    """API status endpoint with rate limiting."""
    return {
        "message": "AlgoTrade API Gateway is running",
        "timestamp": time.time(),
        "authenticated_endpoints": [
            "/api/strategies/*",
            "/api/forward-test/*", 
            "/api/backtest/*",
            "/api/analytics/*"
        ],
        "public_endpoints": [
            "/api/market/symbols",
            "/api/auth/login",
            "/api/auth/register"
        ]
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )