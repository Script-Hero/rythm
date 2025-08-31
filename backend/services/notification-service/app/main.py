"""
AlgoTrade Notification Service
Real-time WebSocket connections for frontend updates.
Manages user sessions, portfolio updates, and trading notifications.
"""

import asyncio
import json
import time
from contextlib import asynccontextmanager
from typing import Dict, List, Any, Optional
from uuid import UUID

import structlog
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .connection_manager import ConnectionManager, UserSession
from .kafka_consumer import NotificationKafkaConsumer
from .auth import get_current_user_from_websocket, User

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

# Global managers
connection_manager = ConnectionManager()
kafka_consumer = NotificationKafkaConsumer(connection_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    logger.info("🚀 Starting Notification Service")
    
    # Initialize services
    await connection_manager.initialize()
    await kafka_consumer.initialize()
    
    # Start background tasks
    asyncio.create_task(kafka_consumer.start_consuming())
    asyncio.create_task(connection_monitor())
    
    logger.info("✅ Notification Service initialized")
    
    yield
    
    logger.info("🛑 Shutting down Notification Service")
    
    # Shutdown services
    await kafka_consumer.shutdown()
    await connection_manager.shutdown()


app = FastAPI(
    title="AlgoTrade Notification Service",
    description="Real-time WebSocket notifications for trading updates",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Frontend origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    """
    Main WebSocket endpoint for real-time notifications.
    Authenticates users and manages their connection lifecycle.
    """
    user_id: Optional[UUID] = None
    try:
        # Accept connection first
        await websocket.accept()
        
        # Authenticate user via token
        user = await get_current_user_from_websocket(token)
        if not user:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Authentication failed"
            }))
            await websocket.close(code=1008)
            return
        
        user_id = UUID(user.id)
        
        # Create user session
        session = UserSession(
            user_id=user_id,
            websocket=websocket,
            authenticated=True
        )
        
        # Register connection
        await connection_manager.connect_user(session)
        
        logger.info("WebSocket connection established", user_id=str(user_id))
        
        # Send welcome message
        await websocket.send_text(json.dumps({
            "type": "welcome",
            "user_id": str(user_id),
            "message": "Connected to AlgoTrade notifications",
            "timestamp": time.time()
        }))
        
        # Handle incoming messages
        while True:
            try:
                # Wait for message with timeout
                message = await asyncio.wait_for(
                    websocket.receive_text(), 
                    timeout=settings.WEBSOCKET_TIMEOUT
                )
                
                # Process message
                await handle_websocket_message(user_id, message)
                
            except asyncio.TimeoutError:
                # Send ping to check if connection is alive
                await websocket.send_text(json.dumps({
                    "type": "ping",
                    "timestamp": time.time()
                }))
                
    except WebSocketDisconnect:
        # user_id may not be set if disconnect occurred before auth
        logger.info("WebSocket disconnected normally", user_id=str(user_id) if user_id else None)
    except Exception as e:
        logger.error("WebSocket connection error", user_id=str(user_id) if user_id else None, error=str(e))
    finally:
        # Clean up connection (only if authenticated and user_id available)
        if user_id is not None:
            # Prefer passing websocket to remove just this connection
            await connection_manager.disconnect_user(user_id, websocket)


async def handle_websocket_message(user_id: UUID, message: str):
    """Handle incoming WebSocket messages from clients."""
    try:
        data = json.loads(message)
        message_type = data.get("type")
        
        logger.debug("Received WebSocket message", 
                    user_id=str(user_id), type=message_type)
        
        if message_type == "ping":
            # Respond to ping with pong
            await connection_manager.send_to_user(user_id, {
                "type": "pong",
                "timestamp": time.time()
            })
            
        elif message_type == "pong":
            # Handle pong responses (client responding to our ping)
            logger.debug("Received pong from client", user_id=str(user_id))
            
        elif message_type == "subscribe":
            # Subscribe to specific session updates
            session_id = data.get("session_id")
            if session_id:
                try:
                    # Handle both UUID format and string format (ft_ prefixed)
                    if session_id.startswith("ft_"):
                        # For frontend session IDs like ft_1756361372017, skip UUID conversion
                        # These are external session IDs, not UUIDs
                        logger.info("User subscribed to session", 
                                  user_id=str(user_id), session_id=session_id)
                    else:
                        # Try to parse as UUID
                        session_uuid = UUID(session_id)
                        await connection_manager.subscribe_to_session(user_id, session_uuid)
                        logger.info("User subscribed to session", 
                                  user_id=str(user_id), session_id=session_id)
                except ValueError:
                    logger.warning("Invalid session_id format", 
                                 user_id=str(user_id), session_id=session_id)
            
        elif message_type == "unsubscribe":
            # Unsubscribe from session updates
            session_id = data.get("session_id")
            if session_id:
                try:
                    # Handle both UUID format and string format (ft_ prefixed)
                    if session_id.startswith("ft_"):
                        # For frontend session IDs like ft_1756361372017, skip UUID conversion
                        logger.info("User unsubscribed from session", 
                                  user_id=str(user_id), session_id=session_id)
                    else:
                        # Try to parse as UUID
                        session_uuid = UUID(session_id)
                        await connection_manager.unsubscribe_from_session(user_id, session_uuid)
                        logger.info("User unsubscribed from session", 
                                  user_id=str(user_id), session_id=session_id)
                except ValueError:
                    logger.warning("Invalid session_id format", 
                                 user_id=str(user_id), session_id=session_id)
            
        else:
            logger.warning("Unknown message type", 
                          user_id=str(user_id), type=message_type)
        
    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in WebSocket message", 
                    user_id=str(user_id), error=str(e))
    except Exception as e:
        logger.error("WebSocket message handling error", 
                    user_id=str(user_id), error=str(e))


# REST API endpoints for notification management
@app.get("/connections")
async def get_connections():
    """Get current WebSocket connection statistics."""
    stats = await connection_manager.get_connection_stats()
    return {
        "success": True,
        "stats": stats,
        "timestamp": time.time()
    }


@app.post("/notify/user/{user_id}")
async def notify_user(user_id: UUID, notification: Dict[str, Any]):
    """
    Send notification to a specific user.
    Used by other services for direct notifications.
    """
    try:
        success = await connection_manager.send_to_user(user_id, notification)
        
        return {
            "success": success,
            "user_id": str(user_id),
            "delivered": success,
            "message": "Notification sent" if success else "User not connected"
        }
        
    except Exception as e:
        logger.error("Failed to send user notification", 
                    user_id=str(user_id), error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/notify/session/{session_id}")
async def notify_session(session_id: UUID, notification: Dict[str, Any]):
    """
    Send notification to all users subscribed to a session.
    Used for session-specific updates (trades, portfolio changes).
    """
    try:
        delivered_count = await connection_manager.send_to_session(session_id, notification)
        
        return {
            "success": True,
            "session_id": str(session_id),
            "delivered_count": delivered_count,
            "message": f"Notification sent to {delivered_count} users"
        }
        
    except Exception as e:
        logger.error("Failed to send session notification", 
                    session_id=str(session_id), error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/notify/broadcast")
async def broadcast_notification(notification: Dict[str, Any]):
    """
    Broadcast notification to all connected users.
    Used for system-wide announcements.
    """
    try:
        delivered_count = await connection_manager.broadcast(notification)
        
        return {
            "success": True,
            "delivered_count": delivered_count,
            "message": f"Notification broadcast to {delivered_count} users"
        }
        
    except Exception as e:
        logger.error("Failed to broadcast notification", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# Background tasks
async def connection_monitor():
    """Monitor WebSocket connections and clean up stale ones."""
    while True:
        try:
            await connection_manager.cleanup_stale_connections()
            await asyncio.sleep(60)  # Check every minute
            
        except Exception as e:
            logger.error("Connection monitor error", error=str(e))
            await asyncio.sleep(300)  # Backoff on error


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint with connection statistics."""
    stats = await connection_manager.get_connection_stats()
    
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "notification-service",
        "connections": stats,
        "kafka_connected": await kafka_consumer.is_connected()
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8005,
        reload=settings.DEBUG
    )
