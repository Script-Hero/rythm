"""Kafka consumer for processing real-time events and routing to WebSocket connections."""

import asyncio
import json
import time
from typing import Dict, Any, Optional
from uuid import UUID

import structlog
from aiokafka import AIOKafkaConsumer, TopicPartition
from aiokafka.errors import KafkaError

from .config import settings
from .connection_manager import ConnectionManager

# Add shared modules to path
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from shared.kafka_client.topics import Topics

logger = structlog.get_logger()


class NotificationKafkaConsumer:
    """
    Kafka consumer that processes events from other services
    and routes them to appropriate WebSocket connections.
    """
    
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.running = False
        self.message_handlers = {}
        self.processed_messages = 0
        
    async def initialize(self):
        """Initialize Kafka consumer."""
        try:
            self.consumer = AIOKafkaConsumer(
                Topics.FORWARD_TEST_EVENTS.value,
                Topics.PORTFOLIO_UPDATES.value,
                Topics.TRADE_EXECUTIONS.value,
                Topics.STRATEGY_SIGNALS.value,
                Topics.REALTIME_UPDATES.value,
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                group_id=settings.KAFKA_CONSUMER_GROUP,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                enable_auto_commit=True,
                auto_commit_interval_ms=1000,
                consumer_timeout_ms=settings.KAFKA_CONSUMER_TIMEOUT * 1000
            )
            
            # Register message handlers
            self._register_handlers()
            
            logger.info("Kafka consumer initialized", 
                       topics=[
                           Topics.FORWARD_TEST_EVENTS.value,
                           Topics.PORTFOLIO_UPDATES.value,
                           Topics.TRADE_EXECUTIONS.value,
                           Topics.STRATEGY_SIGNALS.value,
                           Topics.REALTIME_UPDATES.value
                       ])
            
        except Exception as e:
            logger.error("Failed to initialize Kafka consumer", error=str(e))
            raise
    
    async def start_consuming(self):
        """Start consuming messages from Kafka."""
        if not self.consumer:
            raise RuntimeError("Consumer not initialized")
        
        try:
            await self.consumer.start()
            self.running = True
            
            logger.info("Kafka consumer started")
            
            async for message in self.consumer:
                if not self.running:
                    break
                
                try:
                    await self._process_message(message)
                    self.processed_messages += 1
                    
                except Exception as e:
                    logger.error("Failed to process Kafka message", 
                               topic=message.topic,
                               partition=message.partition,
                               offset=message.offset,
                               error=str(e))
                    # Continue processing other messages
        
        except Exception as e:
            logger.error("Kafka consumer error", error=str(e))
            raise
        finally:
            self.running = False
    
    async def shutdown(self):
        """Shutdown Kafka consumer."""
        self.running = False
        
        if self.consumer:
            await self.consumer.stop()
        
        logger.info("Kafka consumer shutdown complete")
    
    async def is_connected(self) -> bool:
        """Check if Kafka consumer is connected."""
        return self.consumer is not None and self.running
    
    def _register_handlers(self):
        """Register message handlers for different topics."""
        self.message_handlers = {
            Topics.FORWARD_TEST_EVENTS.value: self._handle_forward_test_event,
            Topics.PORTFOLIO_UPDATES.value: self._handle_portfolio_update,
            Topics.TRADE_EXECUTIONS.value: self._handle_trade_execution,
            Topics.STRATEGY_SIGNALS.value: self._handle_strategy_signal,
            Topics.REALTIME_UPDATES.value: self._handle_realtime_update
        }
    
    async def _process_message(self, message):
        """Process a single Kafka message."""
        topic = message.topic
        value = message.value
        
        logger.debug("Processing Kafka message", 
                    topic=topic, 
                    partition=message.partition,
                    offset=message.offset)
        
        # Get handler for topic
        handler = self.message_handlers.get(topic)
        if not handler:
            logger.warning("No handler for topic", topic=topic)
            return
        
        # Process message with handler
        await handler(value)
    
    async def _handle_forward_test_event(self, data: Dict[str, Any]):
        """Handle forward testing events (session start/stop/error)."""
        try:
            event_type = data.get("event_type")
            session_id = data.get("session_id")
            user_id = data.get("user_id")
            
            if not session_id:
                logger.warning("Forward test event missing session_id", data=data)
                return
            
            # Create notification message
            notification = {
                "type": "forward_test_event",
                "event_type": event_type,
                "session_id": session_id,
                "message": data.get("message", ""),
                "timestamp": time.time(),
                "data": data
            }
            
            # Send to session subscribers (handle non-UUID session ids safely)
            delivered_count = 0
            try:
                delivered_count = await self.connection_manager.send_to_session(
                    UUID(session_id), notification
                )
            except Exception:
                logger.warning("Session ID is not a UUID; skipping session broadcast", session_id=session_id)
            
            # Also send to specific user if provided
            if user_id:
                await self.connection_manager.send_to_user(UUID(user_id), notification)
            
            logger.debug("Processed forward test event", 
                        event_type=event_type,
                        session_id=session_id,
                        delivered_count=delivered_count)
            
        except Exception as e:
            logger.error("Failed to handle forward test event", error=str(e), data=data)
    
    async def _handle_portfolio_update(self, data: Dict[str, Any]):
        """Handle portfolio updates (balance changes, new positions)."""
        try:
            session_id = data.get("session_id")
            user_id = data.get("user_id")
            portfolio_data = data.get("portfolio_data", data.get("data", {}))
            
            if not session_id:
                logger.warning("Portfolio update missing session_id", data=data)
                return
            
            # Create notification message with proper structure for frontend
            notification = {
                "type": "portfolio_update",
                "session_id": session_id,
                "test_id": data.get("external_session_id") or data.get("test_id"),
                "data": {
                    "portfolio": portfolio_data,
                    "session_id": session_id,
                    "test_id": data.get("external_session_id") or data.get("test_id"),
                    "user_id": user_id,
                    "timestamp": data.get("timestamp", time.time())
                },
                "timestamp": data.get("timestamp", time.time())
            }
            
            # Send to session subscribers
            delivered_count = 0
            try:
                delivered_count = await self.connection_manager.send_to_session(
                    UUID(session_id), notification
                )
            except Exception:
                logger.warning("Session ID is not a UUID; skipping session broadcast", session_id=session_id)
            
            # Also send to specific user if provided
            if user_id:
                await self.connection_manager.send_to_user(UUID(user_id), notification)

            # Fan-out to session subscribers using UUID
            if session_id:
                try:
                    session_uuid = UUID(session_id)
                    await self.connection_manager.send_to_session(session_uuid, notification)
                except ValueError:
                    logger.warning("Invalid session_id format for notification", session_id=session_id)
            
            logger.info("Processed portfolio update", 
                        session_id=session_id,
                        delivered_count=delivered_count,
                        has_portfolio_data=bool(portfolio_data))
            
        except Exception as e:
            logger.error("Failed to handle portfolio update", error=str(e), data=data)
    
    async def _handle_trade_execution(self, data: Dict[str, Any]):
        """Handle trade execution notifications."""
        try:
            session_id = data.get("session_id")
            user_id = data.get("user_id")
            trade_data = data.get("trade", {})
            
            if not session_id:
                logger.warning("Trade execution missing session_id", data=data)
                return
            
            # Create notification message with proper structure for frontend
            notification = {
                "type": "trade_execution",
                "session_id": session_id,
                "test_id": data.get("external_session_id") or data.get("test_id"),
                "data": {
                    "trade": trade_data,
                    "session_id": session_id,
                    "test_id": data.get("external_session_id") or data.get("test_id"),
                    "user_id": user_id,
                    "timestamp": data.get("timestamp", time.time())
                },
                "timestamp": data.get("timestamp", time.time())
            }
            
            # Send to session subscribers
            delivered_count = 0
            try:
                delivered_count = await self.connection_manager.send_to_session(
                    UUID(session_id), notification
                )
            except Exception:
                logger.warning("Session ID is not a UUID; skipping session broadcast", session_id=session_id)
            
            # Also send to specific user if provided
            if user_id:
                await self.connection_manager.send_to_user(UUID(user_id), notification)

            # Fan-out to session subscribers using UUID
            if session_id:
                try:
                    session_uuid = UUID(session_id)
                    await self.connection_manager.send_to_session(session_uuid, notification)
                except ValueError:
                    logger.warning("Invalid session_id format for notification", session_id=session_id)
            
            logger.info("Processed trade execution", 
                        trade_id=trade_data.get("trade_id"),
                        action=trade_data.get("action"),
                        symbol=trade_data.get("symbol"),
                        session_id=session_id,
                        delivered_count=delivered_count)
            
        except Exception as e:
            logger.error("Failed to handle trade execution", error=str(e), data=data)
    
    async def _handle_strategy_signal(self, data: Dict[str, Any]):
        """Handle strategy signals (buy/sell/hold decisions)."""
        try:
            session_id = data.get("session_id")
            user_id = data.get("user_id")
            signal = data.get("signal", {})
            
            if not session_id:
                logger.warning("Strategy signal missing session_id", data=data)
                return
            
            # Create notification message
            notification = {
                "type": "strategy_signal",
                "session_id": session_id,
                "test_id": data.get("external_session_id") or data.get("test_id"),
                "signal": signal,
                "symbol": data.get("symbol"),
                "action": signal.get("action"),
                "price": data.get("market_data", {}).get("price"),
                "confidence": signal.get("confidence"),
                "timestamp": time.time(),
                "data": data
            }
            
            # Send to session subscribers
            delivered_count = 0
            try:
                delivered_count = await self.connection_manager.send_to_session(
                    UUID(session_id), notification
                )
            except Exception:
                logger.warning("Session ID is not a UUID; skipping session broadcast", session_id=session_id)
            
            # Also send to specific user if provided
            if user_id:
                await self.connection_manager.send_to_user(UUID(user_id), notification)
            
            logger.debug("Processed strategy signal", 
                        action=signal.get("action"),
                        session_id=session_id,
                        delivered_count=delivered_count)
            
        except Exception as e:
            logger.error("Failed to handle strategy signal", error=str(e), data=data)
    
    async def _handle_realtime_update(self, data: Dict[str, Any]):
        """Handle general real-time updates (price updates, metrics)."""
        try:
            update_type = data.get("update_type")
            session_id = data.get("session_id")
            user_id = data.get("user_id")
            
            # Create notification message
            notification = {
                "type": "realtime_update",
                "update_type": update_type,
                "timestamp": time.time(),
                "data": data
            }
            
            # Route based on session_id or user_id
            if session_id:
                try:
                    delivered_count = await self.connection_manager.send_to_session(
                        UUID(session_id), notification
                    )
                except Exception:
                    logger.warning("Session ID is not a UUID; skipping session broadcast", session_id=session_id)
                logger.debug("Processed session realtime update", 
                           update_type=update_type,
                           session_id=session_id,
                           delivered_count=delivered_count)
                
            elif user_id:
                success = await self.connection_manager.send_to_user(
                    UUID(user_id), notification
                )
                logger.debug("Processed user realtime update", 
                           update_type=update_type,
                           user_id=user_id,
                           delivered=success)
            else:
                # Broadcast if no specific target
                delivered_count = await self.connection_manager.broadcast(notification)
                logger.debug("Processed broadcast realtime update", 
                           update_type=update_type,
                           delivered_count=delivered_count)
            
        except Exception as e:
            logger.error("Failed to handle realtime update", error=str(e), data=data)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get consumer statistics."""
        return {
            "running": self.running,
            "processed_messages": self.processed_messages,
            "topics": list(self.message_handlers.keys())
        }
