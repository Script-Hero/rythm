"""WebSocket connection management for real-time notifications."""

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Dict, List, Set, Any, Optional
from uuid import UUID

import structlog
import redis.asyncio as redis
from fastapi import WebSocket

from .config import settings

logger = structlog.get_logger()


@dataclass
class UserSession:
    """Represents a user's WebSocket session."""
    user_id: UUID
    websocket: WebSocket
    authenticated: bool = False
    connected_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    subscribed_sessions: Set[UUID] = field(default_factory=set)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time notifications.
    Handles user authentication, session subscriptions, and message routing.
    """
    
    def __init__(self):
        # Active connections: user_id -> List[UserSession] (multiple connections per user)
        self.active_connections: Dict[UUID, List[UserSession]] = {}
        
        # Session subscriptions (internal UUID)
        self.session_subscriptions: Dict[UUID, Set[UUID]] = {}
        # Removed: External session subscriptions no longer needed (unified to UUID)
        
        # Redis client for connection state persistence
        self.redis_client: Optional[redis.Redis] = None
        
        # Connection statistics
        self.connection_count: int = 0
        self.message_count: int = 0
        
    async def initialize(self):
        """Initialize the connection manager."""
        # Initialize Redis for connection state
        self.redis_client = redis.from_url(settings.REDIS_URL)
        await self.redis_client.ping()
        
        logger.info("Connection manager initialized")
    
    async def shutdown(self):
        """Shutdown the connection manager."""
        # Close all active connections
        for user_sessions in self.active_connections.values():
            for session in user_sessions:
                try:
                    await session.websocket.close()
                except Exception:
                    pass
        
        # Close Redis connection
        if self.redis_client:
            await self.redis_client.close()
        
        logger.info("Connection manager shutdown complete")
    
    async def connect_user(self, session: UserSession) -> bool:
        """Register a new user connection."""
        try:
            user_id = session.user_id
            
            # Initialize user connection list if not exists
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            
            # Check connection limit per user
            if len(self.active_connections[user_id]) >= settings.MAX_CONNECTIONS_PER_USER:
                logger.warning("User connection limit exceeded", 
                             user_id=str(user_id), 
                             limit=settings.MAX_CONNECTIONS_PER_USER)
                # Remove oldest connection
                oldest_session = self.active_connections[user_id].pop(0)
                try:
                    await oldest_session.websocket.close()
                except Exception:
                    pass
            
            # Add new connection
            self.active_connections[user_id].append(session)
            self.connection_count += 1
            
            # Store connection state in Redis
            await self._store_connection_state(user_id, session)
            
            logger.info("User connected", 
                       user_id=str(user_id), 
                       total_connections=self.connection_count)
            
            return True
            
        except Exception as e:
            logger.error("Failed to connect user", 
                        user_id=str(session.user_id), error=str(e))
            return False
    
    async def disconnect_user(self, user_id: UUID, websocket: WebSocket = None) -> bool:
        """Disconnect a user's WebSocket connection."""
        try:
            if user_id not in self.active_connections:
                return False
            
            user_sessions = self.active_connections[user_id]
            
            # Remove specific websocket or all sessions
            if websocket:
                user_sessions = [s for s in user_sessions if s.websocket != websocket]
                self.active_connections[user_id] = user_sessions
            else:
                # Remove all sessions for user
                del self.active_connections[user_id]
            
            # Update connection count
            self.connection_count = sum(len(sessions) for sessions in self.active_connections.values())
            
            # Clean up session subscriptions
            await self._cleanup_user_subscriptions(user_id)
            
            # Remove from Redis
            await self._remove_connection_state(user_id)
            
            logger.info("User disconnected", 
                       user_id=str(user_id), 
                       total_connections=self.connection_count)
            
            return True
            
        except Exception as e:
            logger.error("Failed to disconnect user", 
                        user_id=str(user_id), error=str(e))
            return False
    
    async def send_to_user(self, user_id: UUID, message: Dict[str, Any]) -> bool:
        """Send message to all of a user's connections."""
        if user_id not in self.active_connections:
            return False
        
        user_sessions = self.active_connections[user_id]
        success_count = 0
        
        # Send to all user sessions
        for session in user_sessions[:]:  # Create copy to avoid modification during iteration
            try:
                session.last_activity = time.time()
                await session.websocket.send_text(json.dumps(message, default=str))
                success_count += 1
                
            except Exception as e:
                logger.error("Failed to send message to user session", 
                           user_id=str(user_id), error=str(e))
                # Remove failed connection
                user_sessions.remove(session)
        
        # Update active connections if sessions were removed
        if success_count == 0 and user_id in self.active_connections:
            del self.active_connections[user_id]
        
        self.message_count += success_count
        return success_count > 0
    
    async def send_to_session(self, session_id: UUID, message: Dict[str, Any]) -> int:
        """Send message to all users subscribed to a session."""
        if session_id not in self.session_subscriptions:
            return 0
        
        subscribed_users = self.session_subscriptions[session_id].copy()
        delivered_count = 0
        
        # Add session context to message
        message["session_id"] = str(session_id)
        
        for user_id in subscribed_users:
            success = await self.send_to_user(user_id, message)
            if success:
                delivered_count += 1
        
        return delivered_count

    
    async def broadcast(self, message: Dict[str, Any]) -> int:
        """Broadcast message to all connected users."""
        delivered_count = 0
        
        for user_id in list(self.active_connections.keys()):
            success = await self.send_to_user(user_id, message)
            if success:
                delivered_count += 1
        
        return delivered_count
    
    async def subscribe_to_session(self, user_id: UUID, session_id: UUID):
        """Subscribe user to session updates."""
        try:
            # Add to session subscriptions
            if session_id not in self.session_subscriptions:
                self.session_subscriptions[session_id] = set()
            
            self.session_subscriptions[session_id].add(user_id)
            
            # Add to user's subscribed sessions
            if user_id in self.active_connections:
                for session in self.active_connections[user_id]:
                    session.subscribed_sessions.add(session_id)
            
            # Store in Redis
            await self._store_session_subscription(user_id, session_id)
            
            logger.debug("User subscribed to session", 
                        user_id=str(user_id), session_id=str(session_id))
            
        except Exception as e:
            logger.error("Failed to subscribe user to session", 
                        user_id=str(user_id), session_id=str(session_id), error=str(e))

    
    async def unsubscribe_from_session(self, user_id: UUID, session_id: UUID):
        """Unsubscribe user from session updates."""
        try:
            # Remove from session subscriptions
            if session_id in self.session_subscriptions:
                self.session_subscriptions[session_id].discard(user_id)
                
                # Clean up empty subscription sets
                if not self.session_subscriptions[session_id]:
                    del self.session_subscriptions[session_id]
            
            # Remove from user's subscribed sessions
            if user_id in self.active_connections:
                for session in self.active_connections[user_id]:
                    session.subscribed_sessions.discard(session_id)
            
            # Remove from Redis
            await self._remove_session_subscription(user_id, session_id)
            
            logger.debug("User unsubscribed from session", 
                        user_id=str(user_id), session_id=str(session_id))
            
        except Exception as e:
            logger.error("Failed to unsubscribe user from session", 
                        user_id=str(user_id), session_id=str(session_id), error=str(e))

    
    async def cleanup_stale_connections(self):
        """Clean up stale WebSocket connections."""
        current_time = time.time()
        stale_threshold = settings.WEBSOCKET_TIMEOUT
        
        stale_users = []
        
        for user_id, user_sessions in self.active_connections.items():
            active_sessions = []
            
            for session in user_sessions:
                # Check if connection is stale
                if current_time - session.last_activity > stale_threshold:
                    try:
                        # Try to ping the connection
                        await session.websocket.send_text(json.dumps({
                            "type": "ping",
                            "timestamp": current_time
                        }))
                        active_sessions.append(session)
                    except Exception:
                        # Connection is dead
                        logger.debug("Removing stale connection", user_id=str(user_id))
                else:
                    active_sessions.append(session)
            
            if active_sessions:
                self.active_connections[user_id] = active_sessions
            else:
                stale_users.append(user_id)
        
        # Remove users with no active sessions
        for user_id in stale_users:
            await self.disconnect_user(user_id)
        
        if stale_users:
            logger.info("Cleaned up stale connections", count=len(stale_users))
    
    async def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        return {
            "total_connections": self.connection_count,
            "total_users": len(self.active_connections),
            "total_sessions": len(self.session_subscriptions),
            "messages_sent": self.message_count,
            "users_per_session": {
                str(session_id): len(users) 
                for session_id, users in self.session_subscriptions.items()
            }
        }
    
    async def _store_connection_state(self, user_id: UUID, session: UserSession):
        """Store connection state in Redis."""
        if not self.redis_client:
            return
        
        try:
            connection_data = {
                "user_id": str(user_id),
                "connected_at": session.connected_at,
                "last_activity": session.last_activity,
                "subscribed_sessions": [str(s) for s in session.subscribed_sessions]
            }
            
            await self.redis_client.setex(
                f"connection:{user_id}",
                settings.CONNECTION_STATE_TTL,
                json.dumps(connection_data, default=str)
            )
            
        except Exception as e:
            logger.error("Failed to store connection state", 
                        user_id=str(user_id), error=str(e))
    
    async def _remove_connection_state(self, user_id: UUID):
        """Remove connection state from Redis."""
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.delete(f"connection:{user_id}")
        except Exception as e:
            logger.error("Failed to remove connection state", 
                        user_id=str(user_id), error=str(e))
    
    async def _store_session_subscription(self, user_id: UUID, session_id: UUID):
        """Store session subscription in Redis."""
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.sadd(f"session_subscribers:{session_id}", str(user_id))
            await self.redis_client.expire(f"session_subscribers:{session_id}", 
                                         settings.CONNECTION_STATE_TTL)
        except Exception as e:
            logger.error("Failed to store session subscription", 
                        user_id=str(user_id), session_id=str(session_id), error=str(e))
    
    async def _remove_session_subscription(self, user_id: UUID, session_id: UUID):
        """Remove session subscription from Redis."""
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.srem(f"session_subscribers:{session_id}", str(user_id))
        except Exception as e:
            logger.error("Failed to remove session subscription", 
                        user_id=str(user_id), session_id=str(session_id), error=str(e))
    
    async def _cleanup_user_subscriptions(self, user_id: UUID):
        """Clean up user's session subscriptions."""
        sessions_to_clean = []
        
        for session_id, users in self.session_subscriptions.items():
            if user_id in users:
                users.remove(user_id)
                if not users:
                    sessions_to_clean.append(session_id)
        
        # Remove empty session subscription sets
        for session_id in sessions_to_clean:
            del self.session_subscriptions[session_id]
