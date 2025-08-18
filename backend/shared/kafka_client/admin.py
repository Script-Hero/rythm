"""
Kafka admin utilities for topic management and cluster operations.
"""

import asyncio
from typing import Dict, List, Optional, Any

import structlog
from aiokafka.admin import AIOKafkaAdminClient, NewTopic
from aiokafka.errors import TopicAlreadyExistsError, KafkaError

from .topics import Topics, TOPIC_CONFIGS

logger = structlog.get_logger()


class KafkaAdmin:
    """Kafka admin client for topic and cluster management."""
    
    def __init__(self, bootstrap_servers: str):
        self.bootstrap_servers = bootstrap_servers
        self.admin_client: Optional[AIOKafkaAdminClient] = None
    
    async def connect(self):
        """Connect to Kafka cluster."""
        try:
            self.admin_client = AIOKafkaAdminClient(
                bootstrap_servers=self.bootstrap_servers,
                client_id='algotrade-admin'
            )
            await self.admin_client.start()
            logger.info("Kafka admin client connected", servers=self.bootstrap_servers)
            
        except Exception as e:
            logger.error("Failed to connect Kafka admin client", error=str(e))
            raise
    
    async def close(self):
        """Close admin client connection."""
        if self.admin_client:
            await self.admin_client.close()
            logger.info("Kafka admin client closed")
    
    async def create_topics(self, topics: List[Topics] = None) -> bool:
        """
        Create Kafka topics if they don't exist.
        
        Args:
            topics: List of topics to create. If None, creates all defined topics.
            
        Returns:
            True if all topics created successfully, False otherwise
        """
        if not self.admin_client:
            logger.error("Admin client not connected")
            return False
        
        # Use all topics if none specified
        if topics is None:
            topics = list(Topics)
        
        topic_list = []
        
        for topic in topics:
            config = TOPIC_CONFIGS.get(topic, {})
            
            new_topic = NewTopic(
                name=topic.value,
                num_partitions=config.get('partitions', 2),
                replication_factor=config.get('replication_factor', 1)
            )
            
            # Add topic configuration for aiokafka
            topic_configs = {}
            if 'retention_ms' in config:
                topic_configs['retention.ms'] = str(config['retention_ms'])
            if 'cleanup_policy' in config:
                topic_configs['cleanup.policy'] = config['cleanup_policy']
            
            if topic_configs:
                new_topic.topic_configs = topic_configs
            
            topic_list.append(new_topic)
        
        try:
            # Create topics using aiokafka
            await self.admin_client.create_topics(topic_list)
            logger.info("All topics created successfully")
            return True
            
        except TopicAlreadyExistsError:
            logger.info("Some topics already exist, continuing")
            return True
            
        except Exception as e:
            logger.error("Failed to create topics", error=str(e))
            return False
    
    async def list_topics(self) -> Optional[Dict[str, Any]]:
        """
        List all topics in the cluster.
        
        Returns:
            Dict with topic information or None on error
        """
        if not self.admin_client:
            logger.error("Admin client not connected")
            return None
        
        try:
            topic_metadata = await self.admin_client.list_topics()
            
            return {
                "topics": list(topic_metadata.topics),
                "topic_count": len(topic_metadata.topics)
            }
            
        except Exception as e:
            logger.error("Failed to list topics", error=str(e))
            return None
    
    async def delete_topics(self, topics: List[str]) -> bool:
        """
        Delete topics from the cluster.
        
        Args:
            topics: List of topic names to delete
            
        Returns:
            True if all topics deleted successfully
        """
        if not self.admin_client:
            logger.error("Admin client not connected")
            return False
        
        try:
            await self.admin_client.delete_topics(topics)
            logger.info("Topics deleted successfully", topics=topics)
            return True
            
        except Exception as e:
            logger.error("Failed to delete topics", error=str(e))
            return False
    
    async def setup_topics(self) -> bool:
        """
        Set up all required topics for AlgoTrade microservices.
        
        Returns:
            True if setup successful
        """
        try:
            await self.connect()
            
            # Create all topics
            success = await self.create_topics()
            
            if success:
                logger.info("Kafka topics setup completed successfully")
            else:
                logger.error("Kafka topics setup failed")
            
            await self.close()
            return success
            
        except Exception as e:
            logger.error("Kafka setup failed", error=str(e))
            return False


async def setup_kafka_infrastructure(bootstrap_servers: str) -> bool:
    """
    Setup Kafka infrastructure for AlgoTrade.
    
    Args:
        bootstrap_servers: Kafka bootstrap servers
        
    Returns:
        True if setup successful
    """
    admin = KafkaAdmin(bootstrap_servers)
    return await admin.setup_topics()