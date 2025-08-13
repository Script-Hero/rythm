"""
Kafka topic definitions for AlgoTrade microservices.
"""

from enum import Enum


class Topics(str, Enum):
    """Kafka topic names."""
    
    # Market Data Topics
    MARKET_DATA_UPDATES = "market-data-updates"
    SYMBOL_SUBSCRIPTIONS = "symbol-subscriptions"
    
    # Strategy Topics  
    STRATEGY_SIGNALS = "strategy-signals"
    STRATEGY_COMPILATIONS = "strategy-compilations"
    
    # Trading Topics
    TRADE_EXECUTIONS = "trade-executions"
    PORTFOLIO_UPDATES = "portfolio-updates"
    FORWARD_TEST_EVENTS = "forward-test-events"
    
    # Notification Topics
    USER_NOTIFICATIONS = "user-notifications"
    REALTIME_UPDATES = "realtime-updates"
    
    # System Topics
    SERVICE_HEALTH = "service-health"
    AUDIT_LOGS = "audit-logs"


# Topic configurations
TOPIC_CONFIGS = {
    Topics.MARKET_DATA_UPDATES: {
        "partitions": 8,
        "replication_factor": 1,
        "retention_ms": 86400000,  # 24 hours
        "cleanup_policy": "delete"
    },
    
    Topics.STRATEGY_SIGNALS: {
        "partitions": 4, 
        "replication_factor": 1,
        "retention_ms": 604800000,  # 7 days
        "cleanup_policy": "delete"
    },
    
    Topics.TRADE_EXECUTIONS: {
        "partitions": 4,
        "replication_factor": 1, 
        "retention_ms": 2592000000,  # 30 days
        "cleanup_policy": "delete"
    },
    
    Topics.FORWARD_TEST_EVENTS: {
        "partitions": 4,
        "replication_factor": 1,
        "retention_ms": 2592000000,  # 30 days
        "cleanup_policy": "delete"
    },
    
    Topics.USER_NOTIFICATIONS: {
        "partitions": 2,
        "replication_factor": 1,
        "retention_ms": 86400000,  # 24 hours
        "cleanup_policy": "delete"
    },
    
    Topics.REALTIME_UPDATES: {
        "partitions": 4,
        "replication_factor": 1,
        "retention_ms": 3600000,  # 1 hour
        "cleanup_policy": "delete"
    }
}