"""
Kafka admin utilities for topic management and cluster operations.
"""

import asyncio
from typing import Dict, List, Optional, Any

import structlog
from kafka.admin import KafkaAdminClient, ConfigResource, ConfigResourceType
from kafka.admin.config_resource import ConfigResource
from kafka.admin.new_topic import NewTopic
from kafka.errors import TopicAlreadyExistsError, KafkaError

from .topics import Topics, TOPIC_CONFIGS

logger = structlog.get_logger()


class KafkaAdmin:
    """Kafka admin client for topic and cluster management."""
    
    def __init__(self, bootstrap_servers: str):
        self.bootstrap_servers = bootstrap_servers
        self.admin_client: Optional[KafkaAdminClient] = None
    
    def connect(self):
        """Connect to Kafka cluster."""
        try:
            self.admin_client = KafkaAdminClient(
                bootstrap_servers=self.bootstrap_servers,
                client_id='algotrade-admin'
            )
            logger.info("Kafka admin client connected", servers=self.bootstrap_servers)
            
        except Exception as e:
            logger.error("Failed to connect Kafka admin client", error=str(e))
            raise
    
    def close(self):
        """Close admin client connection."""
        if self.admin_client:
            self.admin_client.close()
            logger.info("Kafka admin client closed")
    
    def create_topics(self, topics: List[Topics] = None) -> bool:
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
            
            # Add topic configuration
            topic_configs = {}
            if 'retention_ms' in config:
                topic_configs['retention.ms'] = str(config['retention_ms'])
            if 'cleanup_policy' in config:
                topic_configs['cleanup.policy'] = config['cleanup_policy']
            
            if topic_configs:
                new_topic.topic_configs = topic_configs
            
            topic_list.append(new_topic)
        
        try:
            # Create topics
            futures = self.admin_client.create_topics(topic_list, validate_only=False)
            
            # Wait for creation to complete
            for topic, future in futures.items():
                try:
                    future.result()  # Block until topic is created
                    logger.info("Topic created successfully", topic=topic)
                    
                except TopicAlreadyExistsError:
                    logger.info("Topic already exists", topic=topic)
                    
                except Exception as e:
                    logger.error("Failed to create topic", topic=topic, error=str(e))
                    return False
            
            logger.info("All topics processed successfully")
            return True
            
        except Exception as e:
            logger.error("Failed to create topics", error=str(e))
            return False
    
    def list_topics(self) -> Optional[Dict[str, Any]]:
        """
        List all topics in the cluster.
        
        Returns:
            Dict with topic information or None on error
        """
        if not self.admin_client:
            logger.error("Admin client not connected")
            return None
        
        try:
            metadata = self.admin_client.list_consumer_groups()
            topic_metadata = self.admin_client.describe_topics()
            
            return {
                "topics": list(topic_metadata.keys()),
                "topic_count": len(topic_metadata)
            }
            
        except Exception as e:
            logger.error("Failed to list topics", error=str(e))
            return None
    
    def delete_topics(self, topics: List[str]) -> bool:
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
            futures = self.admin_client.delete_topics(topics, timeout_ms=30000)
            
            # Wait for deletion to complete
            for topic, future in futures.items():
                try:
                    future.result()
                    logger.info("Topic deleted successfully", topic=topic)
                    
                except Exception as e:
                    logger.error("Failed to delete topic", topic=topic, error=str(e))
                    return False
            
            return True
            
        except Exception as e:
            logger.error("Failed to delete topics", error=str(e))
            return False
    
    def describe_topics(self, topics: List[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about topics.
        
        Args:
            topics: List of topic names. If None, describes all topics.
            
        Returns:
            Dict with topic details or None on error
        """
        if not self.admin_client:
            logger.error("Admin client not connected")
            return None
        
        try:
            if topics is None:
                # Get all topics
                cluster_metadata = self.admin_client._client.cluster
                topics = list(cluster_metadata.topics())
            
            topic_metadata = {}
            
            for topic in topics:
                try:
                    partitions = self.admin_client._client.cluster.partitions_for_topic(topic)
                    if partitions:
                        topic_metadata[topic] = {
                            "partitions": list(partitions),
                            "partition_count": len(partitions)
                        }
                        
                except Exception as e:
                    logger.error("Failed to describe topic", topic=topic, error=str(e))
            
            return topic_metadata
            
        except Exception as e:
            logger.error("Failed to describe topics", error=str(e))
            return None
    
    def get_cluster_info(self) -> Optional[Dict[str, Any]]:
        """
        Get general cluster information.
        
        Returns:
            Dict with cluster information or None on error
        """
        if not self.admin_client:
            logger.error("Admin client not connected")
            return None
        
        try:
            cluster = self.admin_client._client.cluster
            
            return {
                "cluster_id": cluster.cluster_id,
                "controller": cluster.controller.id if cluster.controller else None,
                "brokers": [
                    {
                        "id": broker.nodeId,
                        "host": broker.host,
                        "port": broker.port
                    }
                    for broker in cluster.brokers()
                ],
                "broker_count": len(list(cluster.brokers()))
            }
            
        except Exception as e:
            logger.error("Failed to get cluster info", error=str(e))
            return None
    
    async def setup_topics(self) -> bool:
        """
        Set up all required topics for AlgoTrade microservices.
        
        Returns:
            True if setup successful
        """
        try:
            self.connect()
            
            # Create all topics
            success = self.create_topics()
            
            if success:
                logger.info("Kafka topics setup completed successfully")
            else:
                logger.error("Kafka topics setup failed")
            
            self.close()
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