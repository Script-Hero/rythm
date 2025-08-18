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
                settings.KAFKA_FORWARD_TEST_EVENTS_TOPIC,
                settings.KAFKA_PORTFOLIO_UPDATES_TOPIC,
                settings.KAFKA_TRADE_EXECUTIONS_TOPIC,
                settings.KAFKA_STRATEGY_SIGNALS_TOPIC,
                settings.KAFKA_REALTIME_UPDATES_TOPIC,
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
                           settings.KAFKA_FORWARD_TEST_EVENTS_TOPIC,
                           settings.KAFKA_PORTFOLIO_UPDATES_TOPIC,
                           settings.KAFKA_TRADE_EXECUTIONS_TOPIC,
                           settings.KAFKA_STRATEGY_SIGNALS_TOPIC,
                           settings.KAFKA_REALTIME_UPDATES_TOPIC
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
            settings.KAFKA_FORWARD_TEST_EVENTS_TOPIC: self._handle_forward_test_event,
            settings.KAFKA_PORTFOLIO_UPDATES_TOPIC: self._handle_portfolio_update,
            settings.KAFKA_TRADE_EXECUTIONS_TOPIC: self._handle_trade_execution,
            settings.KAFKA_STRATEGY_SIGNALS_TOPIC: self._handle_strategy_signal,
            settings.KAFKA_REALTIME_UPDATES_TOPIC: self._handle_realtime_update
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
            
            # Send to session subscribers
            delivered_count = await self.connection_manager.send_to_session(
                UUID(session_id), notification
            )
            
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
            
            if not session_id:
                logger.warning("Portfolio update missing session_id", data=data)
                return
            
            # Create notification message
            notification = {
                "type": "portfolio_update",
                "session_id": session_id,
                "portfolio": data.get("portfolio", {}),
                "positions": data.get("positions", []),
                "balance": data.get("balance", {}),
                "timestamp": time.time(),
                "data": data
            }
            
            # Send to session subscribers
            delivered_count = await self.connection_manager.send_to_session(
                UUID(session_id), notification
            )
            
            # Also send to specific user if provided
            if user_id:
                await self.connection_manager.send_to_user(UUID(user_id), notification)
            
            logger.debug("Processed portfolio update", 
                        session_id=session_id,
                        delivered_count=delivered_count)
            
        except Exception as e:
            logger.error("Failed to handle portfolio update", error=str(e), data=data)
    
    async def _handle_trade_execution(self, data: Dict[str, Any]):
        """Handle trade execution notifications."""
        try:
            session_id = data.get("session_id")
            user_id = data.get("user_id")
            trade_id = data.get("trade_id")
            
            if not session_id:
                logger.warning("Trade execution missing session_id", data=data)
                return
            
            # Create notification message
            notification = {
                "type": "trade_execution",
                "session_id": session_id,
                "trade_id": trade_id,
                "trade": data.get("trade", {}),
                "execution_price": data.get("execution_price"),
                "quantity": data.get("quantity"),
                "action": data.get("action"),
                "symbol": data.get("symbol"),
                "timestamp": time.time(),
                "data": data
            }
            
            # Send to session subscribers
            delivered_count = await self.connection_manager.send_to_session(
                UUID(session_id), notification
            )
            
            # Also send to specific user if provided
            if user_id:
                await self.connection_manager.send_to_user(UUID(user_id), notification)
            
            logger.debug("Processed trade execution", 
                        trade_id=trade_id,
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
                "signal": signal,
                "symbol": data.get("symbol"),
                "action": signal.get("action"),
                "price": data.get("market_data", {}).get("price"),
                "confidence": signal.get("confidence"),
                "timestamp": time.time(),
                "data": data
            }
            
            # Send to session subscribers
            delivered_count = await self.connection_manager.send_to_session(
                UUID(session_id), notification
            )
            
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
                delivered_count = await self.connection_manager.send_to_session(
                    UUID(session_id), notification
                )
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