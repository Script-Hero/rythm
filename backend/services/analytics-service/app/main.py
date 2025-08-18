"""
AlgoTrade Analytics Service
Provides real-time and historical analytics for trading strategies.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .cache_manager import CacheManager
from .kafka_processor import AnalyticsKafkaProcessor
from .routers import analytics_router, health_router

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

# Global services
cache_manager = CacheManager()
kafka_processor = AnalyticsKafkaProcessor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    # Startup
    logger.info("Starting Analytics Service")
    
    try:
        # Initialize database
        await init_db()
        logger.info("Database initialized")
        
        # Connect to Redis
        await cache_manager.connect()
        logger.info("Connected to Redis")
        
        # Start Kafka processor in background
        kafka_task = None
        if not settings.DEBUG:  # Skip Kafka in debug mode
            kafka_task = asyncio.create_task(kafka_processor.start())
            logger.info("Kafka processor started")
        
        yield
        
    except Exception as e:
        logger.error("Failed to start Analytics Service", error=str(e))
        raise
    
    finally:
        # Shutdown
        logger.info("Shutting down Analytics Service")
        
        # Stop Kafka processor
        if kafka_task and not kafka_task.done():
            kafka_task.cancel()
            try:
                await kafka_task
            except asyncio.CancelledError:
                pass
        
        await kafka_processor.stop()
        
        # Disconnect Redis
        await cache_manager.disconnect()
        
        logger.info("Analytics Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="AlgoTrade Analytics Service",
    description="Real-time and historical analytics for trading strategies",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(analytics_router)

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "analytics-service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error("Unhandled exception", error=str(exc), path=request.url.path)
    return HTTPException(
        status_code=500,
        detail="Internal server error"
    )

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.SERVICE_PORT,
        reload=settings.DEBUG,
        log_level="info"
    )