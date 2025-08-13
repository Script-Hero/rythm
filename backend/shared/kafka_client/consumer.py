"""
Kafka consumer utilities with automatic deserialization and error handling.
"""

import asyncio
import json
from typing import Any, Dict, List, Optional, Callable, AsyncIterator
from datetime import datetime

import structlog
from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaError
from aiokafka.structs import ConsumerRecord

logger = structlog.get_logger()


class KafkaConsumer:
    """Async Kafka consumer with reliability features."""
    
    def __init__(
        self,
        topics: List[str],
        bootstrap_servers: str,
        group_id: str,
        auto_offset_reset: str = "latest",
        enable_auto_commit: bool = True,
        auto_commit_interval_ms: int = 1000
    ):
        self.topics = topics
        self.bootstrap_servers = bootstrap_servers
        self.group_id = group_id
        self.consumer: Optional[AIOKafkaConsumer] = None
        self._connected = False
        self.message_handlers: Dict[str, List[Callable]] = {}
        
        # Consumer configuration
        self.config = {
            "bootstrap_servers": bootstrap_servers,
            "group_id": group_id,
            "auto_offset_reset": auto_offset_reset,
            "enable_auto_commit": enable_auto_commit,
            "auto_commit_interval_ms": auto_commit_interval_ms,
            "value_deserializer": self._deserialize_json,
            "key_deserializer": self._deserialize_key,
            "session_timeout_ms": 30000,
            "heartbeat_interval_ms": 10000,
            "max_poll_records": 500,
            "fetch_max_wait_ms": 500
        }
    
    async def start(self):
        """Start the Kafka consumer."""
        try:
            self.consumer = AIOKafkaConsumer(*self.topics, **self.config)
            await self.consumer.start()
            self._connected = True
            
            logger.info(
                "Kafka consumer started",
                topics=self.topics,
                group_id=self.group_id,
                bootstrap_servers=self.bootstrap_servers
            )
            
        except Exception as e:
            logger.error("Failed to start Kafka consumer", error=str(e))
            self._connected = False
            raise
    
    async def stop(self):
        """Stop the Kafka consumer."""
        if self.consumer:
            await self.consumer.stop()
            self._connected = False
            logger.info("Kafka consumer stopped", group_id=self.group_id)
    
    def add_message_handler(self, topic: str, handler: Callable[[Dict[str, Any], str], None]):
        """
        Add a message handler for a specific topic.
        
        Args:
            topic: Topic to handle messages for
            handler: Async function to handle messages (message, key)
        """
        if topic not in self.message_handlers:
            self.message_handlers[topic] = []
        
        self.message_handlers[topic].append(handler)
        logger.info("Message handler added", topic=topic, handler=handler.__name__)
    
    async def consume_messages(self) -> AsyncIterator[ConsumerRecord]:
        """
        Consume messages from subscribed topics.
        
        Yields:
            ConsumerRecord objects with deserialized message data
        """
        if not self._connected or not self.consumer:
            logger.error("Kafka consumer not connected")
            return
        
        try:
            async for message in self.consumer:
                yield message
                
        except KafkaError as e:
            logger.error("Kafka error consuming messages", error=str(e))
            raise
        except Exception as e:
            logger.error("Unexpected error consuming messages", error=str(e))
            raise
    
    async def start_consuming(self):
        """
        Start consuming messages and route them to registered handlers.
        This is a blocking operation that runs until stopped.
        """
        if not self._connected:
            logger.error("Consumer not connected")
            return
        
        logger.info("Starting message consumption loop", topics=self.topics)
        
        try:
            async for message in self.consume_messages():
                await self._handle_message(message)
                
        except Exception as e:
            logger.error("Message consumption loop failed", error=str(e))
            raise
    
    async def _handle_message(self, message: ConsumerRecord):
        """Handle a single message by routing to appropriate handlers."""
        topic = message.topic
        
        if topic not in self.message_handlers:
            logger.debug("No handlers for topic", topic=topic)
            return
        
        # Process message with all registered handlers
        for handler in self.message_handlers[topic]:
            try:
                await handler(message.value, message.key)
                
            except Exception as e:
                logger.error(
                    "Message handler failed",
                    topic=topic,
                    handler=handler.__name__,
                    error=str(e),
                    offset=message.offset,
                    partition=message.partition
                )
    
    async def consume_single_message(self, timeout_ms: int = 5000) -> Optional[ConsumerRecord]:
        """
        Consume a single message with timeout.
        
        Args:
            timeout_ms: Timeout in milliseconds
            
        Returns:
            ConsumerRecord if message received, None if timeout
        """
        if not self._connected or not self.consumer:
            logger.error("Kafka consumer not connected")
            return None
        
        try:
            # Get message batch with timeout
            message_batch = await self.consumer.getmany(timeout_ms=timeout_ms)
            
            # Return first message from batch
            for topic_partition, messages in message_batch.items():
                if messages:
                    return messages[0]
            
            return None
            
        except Exception as e:
            logger.error("Error consuming single message", error=str(e))
            return None
    
    async def commit(self):
        """Manually commit current offsets."""
        if not self.consumer:
            return False
        
        try:
            await self.consumer.commit()
            return True
        except Exception as e:
            logger.error("Failed to commit offsets", error=str(e))
            return False
    
    def _deserialize_json(self, value: bytes) -> Dict[str, Any]:
        """Deserialize JSON value from bytes."""
        if value is None:
            return {}
        
        try:
            return json.loads(value.decode('utf-8'))
        except json.JSONDecodeError as e:
            logger.error("Failed to deserialize JSON message", error=str(e))
            return {"_deserialization_error": str(e), "_raw_value": value.decode('utf-8', errors='ignore')}
    
    def _deserialize_key(self, key: Optional[bytes]) -> Optional[str]:
        """Deserialize key from bytes."""
        if key is None:
            return None
        return key.decode('utf-8')
    
    @property
    def is_connected(self) -> bool:
        """Check if consumer is connected."""
        return self._connected
    
    async def seek_to_beginning(self, topic: str, partition: int = 0):
        """Seek to beginning of topic partition."""
        if not self.consumer:
            return False
        
        try:
            from kafka import TopicPartition
            tp = TopicPartition(topic, partition)
            self.consumer.seek_to_beginning(tp)
            return True
        except Exception as e:
            logger.error("Failed to seek to beginning", topic=topic, error=str(e))
            return False
    
    async def get_partition_metadata(self, topic: str) -> Optional[Dict[str, Any]]:
        """Get partition metadata for topic."""
        if not self.consumer:
            return None
        
        try:
            partitions = self.consumer.partitions_for_topic(topic)
            if partitions:
                return {
                    "topic": topic,
                    "partitions": list(partitions),
                    "partition_count": len(partitions)
                }
        except Exception as e:
            logger.error("Failed to get partition metadata", topic=topic, error=str(e))
        
        return None