"""
Kafka producer utilities with error handling and serialization.
"""

import asyncio
import json
import time
from typing import Any, Dict, Optional, Union, List, Any
from datetime import datetime
from decimal import Decimal

import structlog
from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaError

logger = structlog.get_logger()


class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for Kafka messages."""
    
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif hasattr(obj, '__str__') and 'UUID' in str(type(obj)):
            return str(obj)
        elif hasattr(obj, '__dict__'):
            return obj.__dict__
        return super().default(obj)


class KafkaProducer:
    """Async Kafka producer with reliability features."""
    
    def __init__(self, bootstrap_servers: str):
        self.bootstrap_servers = bootstrap_servers
        self.producer: Optional[AIOKafkaProducer] = None
        self._connected = False
    
    async def start(self):
        """Start the Kafka producer."""
        try:
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=self._serialize_json,
                key_serializer=self._serialize_key,
                retry_backoff_ms=1000,
                request_timeout_ms=30000,
                max_batch_size=16384,
                linger_ms=10  # Small batch delay for better throughput
            )
            
            await self.producer.start()
            self._connected = True
            
            logger.info("Kafka producer started", bootstrap_servers=self.bootstrap_servers)
            
        except Exception as e:
            logger.error("Failed to start Kafka producer", error=str(e))
            self._connected = False
            raise
    
    async def stop(self):
        """Stop the Kafka producer."""
        if self.producer:
            await self.producer.stop()
            self._connected = False
            logger.info("Kafka producer stopped")
    
    async def send_message(
        self,
        topic: str,
        message: Dict[str, Any],
        key: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        partition: Optional[int] = None
    ) -> bool:
        """
        Send a message to Kafka topic.
        
        Args:
            topic: Kafka topic name
            message: Message payload
            key: Optional message key for partitioning
            headers: Optional message headers
            partition: Optional partition number
            
        Returns:
            True if message sent successfully, False otherwise
        """
        if not self._connected or not self.producer:
            logger.error("Kafka producer not connected")
            return False
        
        try:
            # Add timestamp and service metadata
            enriched_message = {
                **message,
                "timestamp": datetime.utcnow(),
                "producer_service": "algotrade-microservice"
            }
            
            # Convert headers to bytes if provided
            kafka_headers = None
            if headers:
                kafka_headers = [(k, v.encode('utf-8')) for k, v in headers.items()]
            
            # Send message
            record_metadata = await self.producer.send_and_wait(
                topic=topic,
                value=enriched_message,
                key=key,
                headers=kafka_headers,
                partition=partition
            )
            
            logger.debug(
                "Message sent to Kafka",
                topic=topic,
                partition=record_metadata.partition,
                offset=record_metadata.offset
            )
            
            return True
            
        except KafkaError as e:
            logger.error(
                "Kafka error sending message",
                topic=topic,
                error=str(e),
                error_type=type(e).__name__
            )
            return False
            
        except Exception as e:
            logger.error(
                "Unexpected error sending message",
                topic=topic,
                error=str(e)
            )
            return False
    
    async def send_batch(
        self,
        topic: str,
        messages: List[Dict[str, Any]],
        key_extractor: Optional[callable] = None
    ) -> int:
        """
        Send multiple messages to Kafka topic.
        
        Args:
            topic: Kafka topic name
            messages: List of message payloads
            key_extractor: Optional function to extract key from message
            
        Returns:
            Number of messages sent successfully
        """
        if not self._connected or not self.producer:
            logger.error("Kafka producer not connected")
            return 0
        
        sent_count = 0
        
        for message in messages:
            key = key_extractor(message) if key_extractor else None
            
            success = await self.send_message(topic, message, key)
            if success:
                sent_count += 1
        
        logger.info(
            "Batch messages sent",
            topic=topic,
            total=len(messages),
            sent=sent_count,
            failed=len(messages) - sent_count
        )
        
        return sent_count
    
    def _serialize_json(self, value: Any) -> bytes:
        """Serialize value to JSON bytes."""
        return json.dumps(value, cls=JSONEncoder, separators=(',', ':')).encode('utf-8')
    
    def _serialize_key(self, key: Union[str, bytes, None]) -> Optional[bytes]:
        """Serialize key to bytes."""
        if key is None:
            return None
        elif isinstance(key, bytes):
            return key
        else:
            return str(key).encode('utf-8')
    
    @property
    def is_connected(self) -> bool:
        """Check if producer is connected."""
        return self._connected
    
    async def flush(self, timeout: Optional[float] = None) -> bool:
        """
        Flush pending messages.
        
        Args:
            timeout: Optional timeout in seconds
            
        Returns:
            True if all messages flushed successfully
        """
        if not self.producer:
            return False
        
        try:
            if timeout:
                await asyncio.wait_for(self.producer.flush(), timeout=timeout)
            else:
                await self.producer.flush()
            
            return True
            
        except asyncio.TimeoutError:
            logger.error("Kafka producer flush timeout")
            return False
        except Exception as e:
            logger.error("Kafka producer flush error", error=str(e))
            return False