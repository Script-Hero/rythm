# Kafka Infrastructure for AlgoTrade Microservices

This document describes the Kafka event streaming infrastructure used by AlgoTrade microservices.

## Overview

Kafka serves as the central message broker for AlgoTrade, enabling:
- **Real-time market data streaming**
- **Strategy signal distribution**
- **Trade execution events** 
- **Portfolio updates**
- **System-wide notifications**

## Topics

### Market Data Topics
- `market-data-updates` - Real-time price/volume updates (8 partitions, 24h retention)
- `symbol-subscriptions` - Symbol subscription/unsubscription events

### Strategy Topics  
- `strategy-signals` - Trading signals from strategy execution (4 partitions, 7d retention)
- `strategy-compilations` - Strategy compilation events and results

### Trading Topics
- `trade-executions` - Trade execution results and confirmations (4 partitions, 30d retention)
- `portfolio-updates` - Portfolio balance and position changes
- `forward-test-events` - Forward testing session events and metrics

### Notification Topics
- `user-notifications` - User-specific notifications (24h retention)
- `realtime-updates` - Real-time UI updates and WebSocket messages (1h retention)

### System Topics
- `service-health` - Service health checks and status updates
- `audit-logs` - System audit and compliance logs

## Setup

### Prerequisites
- Docker and docker-compose
- Python 3.11+ (for setup script)

### Quick Start
```bash
# Start Kafka (and other infrastructure)
docker-compose up kafka redis postgres -d

# Setup topics
python setup_kafka.py

# Verify setup
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list
```

### Manual Topic Creation
```bash
docker-compose exec kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic market-data-updates \
  --partitions 8 \
  --replication-factor 1
```

## Usage

### Producer Example
```python
from shared.kafka_client import KafkaProducer, Topics

producer = KafkaProducer("kafka:9092")
await producer.start()

await producer.send_message(
    topic=Topics.MARKET_DATA_UPDATES,
    message={
        "symbol": "BTCUSD",
        "price": 50000.00,
        "volume": 1.5,
        "timestamp": "2024-01-01T12:00:00Z"
    },
    key="BTCUSD"
)

await producer.stop()
```

### Consumer Example
```python
from shared.kafka_client import KafkaConsumer, Topics

consumer = KafkaConsumer(
    topics=[Topics.STRATEGY_SIGNALS],
    bootstrap_servers="kafka:9092",
    group_id="forward-test-service"
)

async def handle_signal(message, key):
    print(f"Received signal: {message}")

consumer.add_message_handler(Topics.STRATEGY_SIGNALS, handle_signal)
await consumer.start()
await consumer.start_consuming()  # Blocking call
```

## Message Format

All messages follow a standard format:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "producer_service": "algotrade-microservice",
  "data": {
    // Actual message payload
  }
}
```

### Market Data Message
```json
{
  "symbol": "BTCUSD",
  "price": 50000.00,
  "volume": 1.5,
  "timestamp": "2024-01-01T12:00:00Z",
  "source": "coinbase"
}
```

### Strategy Signal Message
```json
{
  "session_id": "uuid",
  "strategy_id": "uuid", 
  "signal": {
    "action": "BUY",
    "quantity": 1.0,
    "reason": "SMA crossover"
  },
  "market_data": {
    "symbol": "BTCUSD",
    "price": 50000.00
  }
}
```

### Trade Execution Message
```json
{
  "trade_id": "uuid",
  "session_id": "uuid",
  "symbol": "BTCUSD",
  "action": "BUY",
  "quantity": 1.0,
  "price": 50000.00,
  "status": "FILLED",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Service Integration

### Market Data Service
- **Produces**: `market-data-updates`, `symbol-subscriptions`  
- **Consumes**: None (WebSocket source)

### Forward Testing Service  
- **Produces**: `forward-test-events`, `trade-executions`
- **Consumes**: `strategy-signals`, `market-data-updates`

### Strategy Service
- **Produces**: `strategy-signals`, `strategy-compilations`
- **Consumes**: `market-data-updates`

### Notification Service
- **Produces**: `realtime-updates`
- **Consumes**: `user-notifications`, `forward-test-events`, `trade-executions`

## Monitoring

### Topic Monitoring
```bash
# List all topics
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Describe topic
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --describe --topic market-data-updates

# Monitor messages
docker-compose exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic market-data-updates --from-beginning
```

### Consumer Group Monitoring
```bash
# List consumer groups
docker-compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --list

# Describe consumer group
docker-compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group forward-test-service
```

## Performance Tuning

### Producer Settings
- `linger_ms=10` - Small batching delay for better throughput
- `max_batch_size=16384` - Optimal batch size
- `compression_type=gzip` - Enable compression

### Consumer Settings  
- `max_poll_records=500` - Batch size per poll
- `fetch_max_wait_ms=500` - Max wait time for batching
- `session_timeout_ms=30000` - Session timeout

### Topic Settings
- **High throughput topics**: More partitions (8 for market-data-updates)
- **Low latency topics**: Fewer partitions (2 for notifications)
- **Retention**: Based on data importance and storage capacity

## Error Handling

### Producer Errors
- Automatic retries with exponential backoff
- Failed messages logged with details
- Circuit breaker pattern for persistent failures

### Consumer Errors
- Dead letter queue for failed message processing
- Configurable retry attempts
- Offset management for replay capability

## Security

### Authentication
- SASL/PLAIN authentication (production)
- SSL encryption for data in transit
- ACLs for topic-level permissions

### Network Security
- Internal Docker network isolation
- Firewall rules for external access
- VPN access for production monitoring

## Troubleshooting

### Common Issues

**Cannot connect to Kafka**
```bash
# Check if Kafka is running
docker-compose ps kafka

# Check Kafka logs
docker-compose logs kafka

# Test connection
docker-compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092
```

**Topics not created**
```bash
# Run setup script again
python setup_kafka.py

# Manual topic creation
docker-compose exec kafka kafka-topics --create --bootstrap-server localhost:9092 --topic test-topic --partitions 1 --replication-factor 1
```

**Consumer lag**
```bash
# Check consumer group lag
docker-compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group [group-id]

# Reset consumer offset
docker-compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --reset-offsets --to-latest --group [group-id] --topic [topic]
```

## Future Enhancements

### Planned Features
- **Schema Registry** - Avro schema management
- **Kafka Streams** - Real-time stream processing
- **Kafka Connect** - External system integration
- **Multi-region replication** - Disaster recovery

### Monitoring Improvements  
- Prometheus metrics integration
- Grafana dashboards
- Alert rules for critical errors
- Performance analytics