"""
Shared Kafka client utilities for microservices.
"""

from .producer import KafkaProducer
from .consumer import KafkaConsumer
from .topics import Topics
from .admin import KafkaAdmin

__all__ = ["KafkaProducer", "KafkaConsumer", "Topics", "KafkaAdmin"]