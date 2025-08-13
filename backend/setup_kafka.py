#!/usr/bin/env python3
"""
Kafka infrastructure setup script for AlgoTrade microservices.
Run this script to create all required topics and verify Kafka configuration.
"""

import asyncio
import sys
import os
from typing import List

# Add shared modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'shared'))

import structlog
from shared.kafka_client.admin import KafkaAdmin, setup_kafka_infrastructure
from shared.kafka_client.topics import Topics, TOPIC_CONFIGS

# Configure logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


def print_topic_summary():
    """Print summary of topics to be created."""
    print("\n=== AlgoTrade Kafka Topics ===")
    print(f"Total topics to create: {len(Topics)}")
    print()
    
    categories = {
        "Market Data": [Topics.MARKET_DATA_UPDATES, Topics.SYMBOL_SUBSCRIPTIONS],
        "Strategy": [Topics.STRATEGY_SIGNALS, Topics.STRATEGY_COMPILATIONS],
        "Trading": [Topics.TRADE_EXECUTIONS, Topics.PORTFOLIO_UPDATES, Topics.FORWARD_TEST_EVENTS],
        "Notifications": [Topics.USER_NOTIFICATIONS, Topics.REALTIME_UPDATES],
        "System": [Topics.SERVICE_HEALTH, Topics.AUDIT_LOGS]
    }
    
    for category, topics in categories.items():
        print(f"{category} Topics:")
        for topic in topics:
            config = TOPIC_CONFIGS.get(topic, {})
            partitions = config.get('partitions', 2)
            retention = config.get('retention_ms', 86400000) // (1000 * 3600)  # Convert to hours
            print(f"  • {topic.value:<25} ({partitions} partitions, {retention}h retention)")
        print()


async def verify_kafka_connection(bootstrap_servers: str) -> bool:
    """Verify Kafka cluster is accessible."""
    admin = KafkaAdmin(bootstrap_servers)
    
    try:
        admin.connect()
        
        cluster_info = admin.get_cluster_info()
        if cluster_info:
            print(f"✅ Connected to Kafka cluster")
            print(f"   Cluster ID: {cluster_info.get('cluster_id', 'unknown')}")
            print(f"   Brokers: {cluster_info.get('broker_count', 0)}")
            
            admin.close()
            return True
        else:
            print("❌ Failed to get cluster information")
            admin.close()
            return False
            
    except Exception as e:
        print(f"❌ Failed to connect to Kafka: {e}")
        return False


async def setup_topics(bootstrap_servers: str) -> bool:
    """Setup all required Kafka topics."""
    print("\n=== Setting up Kafka Topics ===")
    
    admin = KafkaAdmin(bootstrap_servers)
    
    try:
        admin.connect()
        
        # Create all topics
        success = admin.create_topics()
        
        if success:
            print("✅ All topics created successfully")
            
            # Verify topics exist
            topics_info = admin.describe_topics()
            if topics_info:
                print(f"\n📊 Topic Summary:")
                for topic, info in topics_info.items():
                    print(f"   {topic}: {info.get('partition_count', 0)} partitions")
        else:
            print("❌ Failed to create some topics")
        
        admin.close()
        return success
        
    except Exception as e:
        print(f"❌ Topic setup failed: {e}")
        return False


async def main():
    """Main setup function."""
    print("🚀 AlgoTrade Kafka Infrastructure Setup")
    print("=====================================")
    
    # Get Kafka bootstrap servers from environment or use default
    bootstrap_servers = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
    print(f"Kafka Bootstrap Servers: {bootstrap_servers}")
    
    # Print topic summary
    print_topic_summary()
    
    # Verify Kafka connection
    print("=== Verifying Kafka Connection ===")
    if not await verify_kafka_connection(bootstrap_servers):
        print("\n❌ Setup failed: Cannot connect to Kafka cluster")
        print("\nMake sure Kafka is running and accessible at:", bootstrap_servers)
        print("You can start Kafka with: docker-compose up kafka -d")
        sys.exit(1)
    
    # Setup topics
    if not await setup_topics(bootstrap_servers):
        print("\n❌ Setup failed: Could not create topics")
        sys.exit(1)
    
    print("\n🎉 Kafka infrastructure setup completed successfully!")
    print("\nNext steps:")
    print("1. Start all microservices: docker-compose up --build")
    print("2. Check service logs: docker-compose logs -f [service-name]")
    print("3. Monitor Kafka topics: docker-compose exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic [topic-name]")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed with error: {e}")
        sys.exit(1)