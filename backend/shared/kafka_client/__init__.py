"""
Shared Kafka client utilities for microservices.
"""

from .producer import KafkaProducer
from .consumer import KafkaConsumer
from .topics import Topics
from .unified_client import KafkaClient, create_kafka_client

# Import admin conditionally to avoid dependency issues
try:
    from .admin import KafkaAdmin
    __all__ = ["KafkaProducer", "KafkaConsumer", "Topics", "KafkaAdmin", "KafkaClient", "create_kafka_client"]
except ImportError:
    __all__ = ["KafkaProducer", "KafkaConsumer", "Topics", "KafkaClient", "create_kafka_client"]