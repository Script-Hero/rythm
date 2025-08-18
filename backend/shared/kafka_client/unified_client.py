"""
Unified Kafka client with centralized topic management and error handling.
This replaces the need for individual services to manage their own Kafka connections.
"""

import asyncio
import json
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from decimal import Decimal

import structlog
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.errors import KafkaError

from .topics import Topics, TOPIC_CONFIGS
from .admin import KafkaAdmin

logger = structlog.get_logger()


class KafkaClient:
    """Unified Kafka client for producers and consumers."""
    
    def __init__(self, bootstrap_servers: str, service_name: str):
        self.bootstrap_servers = bootstrap_servers
        self.service_name = service_name
        self.producer: Optional[AIOKafkaProducer] = None
        self.consumers: Dict[str, AIOKafkaConsumer] = {}
        self.running = False
        
    async def start(self):
        """Start the Kafka client."""
        try:
            # Validate topics exist first
            await self._validate_topics_exist()
            
            # Initialize producer
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=self._serialize_value,
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                enable_idempotence=True,
                acks='all',
                retries=3
            )
            await self.producer.start()
            
            self.running = True
            logger.info("Kafka client started", service=self.service_name)
            
        except Exception as e:
            logger.error("Failed to start Kafka client", service=self.service_name, error=str(e))
            raise
    
    async def stop(self):
        """Stop the Kafka client."""
        self.running = False
        
        # Stop all consumers
        for consumer_id, consumer in self.consumers.items():
            try:
                await consumer.stop()
                logger.info("Consumer stopped", consumer_id=consumer_id)
            except Exception as e:
                logger.error("Error stopping consumer", consumer_id=consumer_id, error=str(e))
        
        # Stop producer
        if self.producer:
            try:
                await self.producer.stop()
                logger.info("Producer stopped")
            except Exception as e:
                logger.error("Error stopping producer", error=str(e))
        
        logger.info("Kafka client stopped", service=self.service_name)
    
    async def send_message(self, topic: Topics, message: Dict[str, Any], key: str = None) -> bool:
        """
        Send a message to a Kafka topic.
        
        Args:
            topic: Topic enum value
            message: Message data
            key: Optional message key for partitioning
            
        Returns:
            True if sent successfully
        """
        if not self.producer or not self.running:
            logger.error("Producer not available", topic=topic.value)
            return False
        
        try:
            await self.producer.send(topic.value, message, key)
            logger.debug("Message sent", topic=topic.value, key=key)
            return True
            
        except Exception as e:
            logger.error("Failed to send message", topic=topic.value, error=str(e))
            return False
    
    async def create_consumer(
        self, 
        consumer_id: str,
        topics: List[Topics], 
        group_id: str,
        message_handler: Callable[[str, Dict[str, Any], str], None],
        auto_offset_reset: str = "latest"
    ) -> bool:
        """
        Create a new consumer for the specified topics.
        
        Args:
            consumer_id: Unique identifier for this consumer
            topics: List of topics to subscribe to
            group_id: Consumer group ID
            message_handler: Async function to handle messages (topic, message, key)
            auto_offset_reset: Offset reset strategy
            
        Returns:
            True if consumer created successfully
        """
        if consumer_id in self.consumers:
            logger.warning("Consumer already exists", consumer_id=consumer_id)
            return False
        
        try:
            topic_names = [topic.value for topic in topics]
            
            consumer = AIOKafkaConsumer(
                *topic_names,
                bootstrap_servers=self.bootstrap_servers,
                group_id=group_id,
                auto_offset_reset=auto_offset_reset,
                value_deserializer=self._deserialize_value,
                key_deserializer=lambda k: k.decode('utf-8') if k else None,
                enable_auto_commit=True,
                auto_commit_interval_ms=1000
            )
            
            await consumer.start()
            self.consumers[consumer_id] = consumer
            
            # Start consumption loop in background
            asyncio.create_task(self._consume_messages(consumer_id, message_handler))
            
            logger.info("Consumer created", 
                       consumer_id=consumer_id, 
                       topics=topic_names, 
                       group_id=group_id)
            return True
            
        except Exception as e:
            logger.error("Failed to create consumer", 
                        consumer_id=consumer_id, error=str(e))
            return False
    
    async def _consume_messages(self, consumer_id: str, message_handler: Callable):
        """Consume messages for a specific consumer."""
        consumer = self.consumers.get(consumer_id)
        if not consumer:
            logger.error("Consumer not found", consumer_id=consumer_id)
            return
        
        max_retries = 3
        retry_delay = 5
        
        for attempt in range(max_retries):
            try:
                logger.info("Starting message consumption", 
                           consumer_id=consumer_id, attempt=attempt + 1)
                
                async for message in consumer:
                    if not self.running:
                        break
                    
                    try:
                        await message_handler(message.topic, message.value, message.key)
                        
                    except Exception as e:
                        logger.error("Message handler failed", 
                                   consumer_id=consumer_id,
                                   topic=message.topic,
                                   error=str(e))
                        # Continue processing other messages
                        continue
                
                # If we get here, consumption completed normally
                break
                
            except Exception as e:
                error_type = type(e).__name__
                logger.error("Message consumption failed", 
                           consumer_id=consumer_id,
                           error=str(e), 
                           error_type=error_type, 
                           attempt=attempt + 1)
                
                # Check for specific assignment errors
                if "AssertionError" in error_type or "assignment" in str(e).lower():
                    logger.error("Consumer group assignment error - topic mismatch likely",
                               consumer_id=consumer_id)
                    break  # Don't retry assignment errors
                
                # Retry with backoff for other errors
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (2 ** attempt)
                    logger.info("Retrying message consumption", 
                              consumer_id=consumer_id,
                              wait_time=wait_time)
                    await asyncio.sleep(wait_time)
                else:
                    logger.error("All retry attempts exhausted", consumer_id=consumer_id)
                    break
    
    async def _validate_topics_exist(self):
        """Validate that all registered topics exist in Kafka cluster."""
        admin = KafkaAdmin(self.bootstrap_servers)
        
        try:
            admin.connect()
            
            # Get list of existing topics
            cluster_metadata = admin._client.cluster
            available_topics = set(cluster_metadata.topics())
            
            # Check all defined topics
            all_topics = [topic.value for topic in Topics]
            missing_topics = []
            
            for topic in all_topics:
                if topic not in available_topics:
                    missing_topics.append(topic)
            
            if missing_topics:
                logger.error("Required topics missing from Kafka cluster",
                           missing_topics=missing_topics,
                           available_topics=list(available_topics))
                raise ValueError(f"Missing topics: {missing_topics}. "
                               f"Run 'python setup_kafka.py' to create topics.")
            
            logger.info("All topics validated successfully", 
                       topic_count=len(all_topics))
            
        except Exception as e:
            logger.error("Failed to validate topics", error=str(e))
            raise
        finally:
            admin.close()
    
    def _serialize_value(self, value: Any) -> bytes:
        """Serialize message value to JSON bytes."""
        def json_serializer(obj):
            """Custom JSON serializer for Decimal and datetime objects."""
            if isinstance(obj, Decimal):
                return float(obj)
            elif isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
        
        return json.dumps(value, default=json_serializer).encode('utf-8')
    
    def _deserialize_value(self, value: bytes) -> Dict[str, Any]:
        """Deserialize JSON bytes to Python object."""
        if not value:
            return {}
        return json.loads(value.decode('utf-8'))
    
    def get_stats(self) -> Dict[str, Any]:
        """Get client statistics."""
        return {
            "service": self.service_name,
            "running": self.running,
            "producer_active": self.producer is not None,
            "consumer_count": len(self.consumers),
            "consumers": list(self.consumers.keys())
        }


# Factory function for easy client creation
def create_kafka_client(bootstrap_servers: str, service_name: str) -> KafkaClient:
    """Create a configured Kafka client for a service."""
    return KafkaClient(bootstrap_servers, service_name)