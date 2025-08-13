# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AlgoTrade Beta2 - Backend Services

This directory contains the complete implementation of AlgoTrade's microservices backend architecture - a scalable, event-driven trading platform.

### Architecture Overview

AlgoTrade Beta2 implements a **cloud-native microservices architecture** with the following key innovations:

#### 🚀 **Core Innovation: Redis Sliding Window Optimization**
- **Problem**: Traditional trading systems require each strategy to manage its own data storage and computation
- **Solution**: Centralized Redis streams with sliding windows (configurable size, default 1000 recent ticks)
- **Benefit**: Strategies simply call `GET /api/market/symbols/BTCUSD/latest?limit=100` for instant access to recent data
- **Impact**: Eliminates data management concerns, reduces latency to sub-millisecond, enables thousands of concurrent strategies

#### 📊 **Event-Driven Data Flow**
```
Market Data → Kafka → Redis Sliding Windows → Forward Testing → Trade Execution → WebSocket Updates
                ↓
          Strategy Service → Strategy Signals → Portfolio Updates → User Notifications
```

#### 🎯 **Kafka Event Streaming Architecture** ✅
- **8 Topic Categories**: Market data, strategy signals, trade executions, notifications
- **Producer/Consumer utilities** with automatic serialization and error handling
- **Topic management** with automated setup and configuration  
- **Message routing** with partitioning and consumer groups
- **Guaranteed delivery** with acknowledgments and retry mechanisms

### Service Architecture

#### **Infrastructure Services**
- **PostgreSQL**: Primary database with proper relational modeling (Users → Strategies → Sessions → Trades)
- **Redis**: Sliding window cache + pub/sub for real-time data
- **Kafka**: Event streaming backbone for all inter-service communication
- **Kubernetes**: Container orchestration with dynamic strategy pod scaling

#### **Core Microservices**

##### 1. **API Gateway** (`services/api-gateway/`) - Port 8000
- **FastAPI** with JWT authentication and rate limiting
- **Request routing** to appropriate microservices
- **CORS handling** for frontend integration
- **Prometheus metrics** collection
- **Health checks** for all downstream services

##### 2. **Market Data Service** (`services/market-data-service/`) - Port 8001
- **Real-time WebSocket feeds** from Coinbase Pro, Finnhub
- **Redis sliding window implementation** - core innovation
- **Multi-provider support** (Coinbase for crypto, Finnhub for stocks)
- **Symbol management** and search capabilities
- **Historical data APIs** with intelligent provider routing

**Key Redis Sliding Window Implementation:**
```python
# Each symbol gets a Redis stream: market:BTCUSD
await redis.xadd("market:BTCUSD", price_data)
await redis.xtrim("market:BTCUSD", maxlen=1000, approximate=True)
await redis.expire("market:BTCUSD", 86400)  # 24hr TTL

# Strategies access data instantly:
prices = await redis.xrevrange("market:BTCUSD", count=100)
```

##### 3. **Strategy Service** (`services/strategy-service/`) - Port 8002
- **Enhanced strategy compilation engine** from Beta1
- **Node-based visual strategy system** (20+ node types: indicators, logic, actions)
- **Topological sorting** for proper execution order
- **Strategy validation** and error reporting
- **Template management** for common patterns
- **Redis caching** of compiled strategies

**Strategy Compilation Flow:**
1. Validate React Flow JSON (nodes + edges)
2. Create node instances from registry
3. Build dependency graph and topological sort
4. Test execution with dummy data
5. Cache compiled strategy in Redis

##### 4. **Forward Testing Service** (`services/forward-test-service/`) - Port 8003 ✅
- **Multi-session paper trading** with isolated state and concurrent execution
- **Realistic order execution** with configurable fees and slippage simulation
- **Portfolio tracking** with real-time balance and position updates  
- **Performance metrics** calculation (PnL, drawdown, Sharpe ratio, win rate)
- **Risk management** with position size limits and validation
- **Background task system** for strategy execution and monitoring
- **Integration with Market Data Service** for live price feeds
- **Comprehensive REST API** for session CRUD operations

**Forward Testing Architecture:**
```python
# Session lifecycle management
session = await create_session(strategy_id, symbol, starting_balance=100000)
await start_session(session_id)  # Spawns background strategy execution
trades = await get_session_trades(session_id)
metrics = await get_session_metrics(session_id)  # Real-time performance
```

##### 5. **Backtesting Service** (`services/backtesting-service/`) - Port 8004
- **Distributed backtesting engine** with job queues
- **S3 integration** for large result storage
- **Comprehensive analytics** (Sharpe, Sortino, Calmar ratios)
- **Historical data management**
- **Performance optimization** with caching

##### 6. **Notification Service** (`services/notification-service/`) - Port 8005
- **WebSocket connection management** 
- **Real-time updates** (price, trades, portfolio)
- **Session-specific routing** for multi-session support
- **Alert system** for strategy events
- **Connection pooling** and failover

##### 7. **Analytics Service** (`services/analytics-service/`) - Port 8006
- **Performance metric calculations**
- **Risk analysis** and reporting
- **Portfolio analytics**
- **Historical performance tracking**
- **Dashboard data aggregation**

#### **Dynamic Strategy Execution (Advanced)**

##### 8. **Strategy Execution Pods** (`k8s/strategy-pods/`)
- **Kubernetes Jobs/Pods** spawned per forward testing session
- **Isolated strategy execution** with dedicated resources
- **Redis stream consumption** for live data
- **Kafka event publishing** for trade signals
- **Auto-scaling** (0→N based on active sessions)

**Strategy Pod Lifecycle:**
1. Forward test session created → API Gateway
2. Strategy compiled → Strategy Service  
3. Kubernetes Job created → Strategy Execution Pod
4. Pod subscribes to Redis: `market:BTCUSD`
5. Strategy generates signals → Kafka: `strategy-signals`
6. Forward Testing Service executes paper trades
7. Results streamed to frontend via WebSocket

### Technology Stack

#### **Backend Technologies**
- **FastAPI** - Modern async Python framework (replaces Flask)
- **PostgreSQL** - ACID-compliant relational database
- **Redis** - In-memory cache with streams for sliding windows
- **Kafka** - Distributed event streaming platform
- **Docker** - Containerization for all services
- **Kubernetes** - Container orchestration and scaling

#### **Data & Analytics**
- **Pandas/NumPy** - Data processing and analytics
- **CCXT** - Cryptocurrency exchange integration
- **WebSockets** - Real-time market data feeds
- **S3-compatible storage** - Historical data and backtest results

#### **Monitoring & Observability**
- **Prometheus** - Metrics collection
- **Grafana** - Monitoring dashboards
- **Structlog** - Structured logging
- **Health checks** - Service dependency monitoring

### Database Schema Design

#### **Core Relationships**
```sql
Users (1) → (N) Strategies
Users (1) → (N) ForwardTestSessions  
Users (1) → (N) BacktestResults

ForwardTestSessions (1) → (N) Trades
ForwardTestSessions (1) → (N) PortfolioPositions
ForwardTestSessions (1) → (N) ChartData

Strategies → (N) ForwardTestSessions (strategy can be used in multiple sessions)
Strategies → (N) BacktestResults (strategy can be backtested multiple times)
```

#### **Key Schema Features**
- **Strategy Snapshots**: Full strategy preserved in sessions/backtests for historical analysis
- **User-centric**: All major queries scoped to user_id
- **Foreign Key Integrity**: Proper CASCADE/SET NULL relationships
- **Performance Indexes**: Optimized for common query patterns

### Development Commands

#### **Local Development**
```bash
# Start entire infrastructure
docker-compose up --build

# Individual service development
cd services/api-gateway/
uvicorn app.main:app --port 8000 --reload

# View service logs
docker-compose logs -f market-data-service
```

#### **Database Management**
```bash
# Initialize database schema
docker-compose exec postgres psql -U algotrade -d algotrade -f /init-db.sql

# Backup/restore
docker-compose exec postgres pg_dump -U algotrade algotrade > backup.sql
```

#### **Kafka Infrastructure Setup**
```bash
# Setup all Kafka topics
python setup_kafka.py

# Monitor Kafka topics
docker-compose exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic market-data-updates

# List all topics
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Check consumer groups
docker-compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --list
```

#### **Monitoring & Debugging**
```bash
# Check service health
curl http://localhost:8000/health/detailed  # API Gateway
curl http://localhost:8001/health           # Market Data Service  
curl http://localhost:8002/health           # Strategy Service
curl http://localhost:8003/health           # Forward Testing Service

# View Redis sliding windows
docker-compose exec redis redis-cli
> XREVRANGE market:BTCUSD + - COUNT 10

# Monitor forward testing sessions
curl http://localhost:8003/ -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Development Status

#### **Core Infrastructure (✅ Complete)**
- [x] Docker-compose with Kafka, Redis, PostgreSQL
- [x] Kubernetes namespace setup
- [x] Database schema migration

#### **Core Services (✅ Complete)**  
- [x] API Gateway with authentication
- [x] Market Data Service with Redis sliding windows
- [x] Strategy Service with enhanced compilation engine
- [x] Forward Testing Service with multi-session support
- [x] Kafka Event Streaming infrastructure with full topic management
- [x] Shared utilities for producers/consumers with error handling

#### **Advanced Features (🔄 In Progress)**
- [ ] Backtesting Service with job queues
- [ ] Notification Service for WebSocket connections
- [ ] Dynamic Strategy Execution Pods
- [ ] Analytics Service with advanced metrics  
- [ ] Kubernetes deployment configurations
- [ ] Performance optimization and monitoring

### Kafka Event Streaming Implementation

#### **Topics Architecture**
```python
# Market Data Topics
MARKET_DATA_UPDATES = "market-data-updates"      # Real-time price/volume (8 partitions, 24h retention)
SYMBOL_SUBSCRIPTIONS = "symbol-subscriptions"     # Subscribe/unsubscribe events

# Strategy Topics  
STRATEGY_SIGNALS = "strategy-signals"             # Trading signals (4 partitions, 7d retention)
STRATEGY_COMPILATIONS = "strategy-compilations"   # Compilation events

# Trading Topics
TRADE_EXECUTIONS = "trade-executions"             # Trade results (4 partitions, 30d retention)  
PORTFOLIO_UPDATES = "portfolio-updates"           # Balance/position changes
FORWARD_TEST_EVENTS = "forward-test-events"       # Session events and metrics

# Notification Topics
USER_NOTIFICATIONS = "user-notifications"         # User-specific alerts (24h retention)
REALTIME_UPDATES = "realtime-updates"            # UI updates (1h retention)
```

#### **Producer/Consumer Implementation**
```python
# Shared Kafka utilities with error handling
from shared.kafka_client import KafkaProducer, KafkaConsumer, Topics

# Producer usage
producer = KafkaProducer("kafka:9092")
await producer.start()

await producer.send_message(
    topic=Topics.TRADE_EXECUTIONS,
    message={"trade_id": "uuid", "action": "BUY", "price": 50000},
    key="session_id"
)

# Consumer usage  
consumer = KafkaConsumer(
    topics=[Topics.STRATEGY_SIGNALS],
    bootstrap_servers="kafka:9092", 
    group_id="forward-test-service"
)

async def handle_signal(message, key):
    # Process strategy signal
    await execute_trade(message)

consumer.add_message_handler(Topics.STRATEGY_SIGNALS, handle_signal)
await consumer.start_consuming()
```

### Key Performance Optimizations

#### **Redis Sliding Windows**
- **Sub-millisecond data access** for strategies
- **Automatic memory management** with TTL expiry
- **Configurable window sizes** per symbol
- **Horizontal scaling** with Redis Cluster

#### **Kafka Event Streaming**
- **High throughput** message processing (100k+ events/sec)
- **Guaranteed delivery** with acknowledgments and retries
- **Topic partitioning** for parallel processing and load balancing
- **Consumer group scaling** for automatic load distribution
- **JSON serialization** with Decimal/datetime support
- **Automatic topic setup** with `setup_kafka.py` script

#### **Database Optimizations**
- **Proper indexing** for user-scoped queries
- **Connection pooling** across services
- **Read replicas** for analytics queries
- **Partitioning** for time-series data (chart_data, trades)

### Monitoring & Alerting

#### **Health Checks**
- Service dependency monitoring
- Database connection health
- Redis/Kafka connectivity
- WebSocket connection status

#### **Performance Metrics**
- Request latency per service
- Redis memory usage
- Kafka lag monitoring  
- Strategy execution performance

#### **Business Metrics**
- Active forward testing sessions
- Strategy compilation success rate
- Trade execution latency
- User engagement metrics

### Security Considerations

#### **Authentication & Authorization**
- JWT tokens with expiry
- User-scoped data access
- API rate limiting
- CORS configuration

#### **Data Security**
- Database connection encryption
- Redis AUTH configuration
- Kafka SASL authentication
- Service-to-service TLS

#### **Strategy Security**
- Sandboxed strategy execution
- Resource limits per strategy pod
- Strategy compilation validation
- No arbitrary code execution

### Future Enhancements

#### **Scalability**
- Multi-region deployment
- Database sharding strategies
- Redis Cluster implementation
- Kafka scaling patterns

#### **Features**
- Live trading integration (Alpaca, Interactive Brokers)
- Advanced risk management
- Social trading features
- Strategy marketplace

#### **Performance**
- WebAssembly strategy execution
- GPU-accelerated backtesting  
- Edge computing for low-latency trading
- Advanced caching strategies

---

## Quick Command Reference

### Most Common Development Tasks

#### **Service Development**
```bash
# Start infrastructure only
docker-compose up kafka redis postgres -d

# Setup Kafka topics (run once)
python setup_kafka.py

# Run service locally with hot reload
cd services/strategy-service/
uvicorn app.main:app --port 8002 --reload

# Run Forward Testing Service locally
cd services/forward-test-service/
uvicorn app.main:app --port 8003 --reload
```

#### **Database Operations**
```bash
# View strategy compilation reports
docker-compose exec postgres psql -U algotrade -d algotrade
SELECT name, compilation_report FROM strategies WHERE user_id = 'user-uuid';

# Monitor Redis sliding windows  
docker-compose exec redis redis-cli XLEN market:BTCUSD
```

#### **Debugging**
```bash
# Service health checks
curl http://localhost:8000/health/detailed
curl http://localhost:8001/health
curl http://localhost:8002/health

# View service metrics
curl http://localhost:8000/metrics
```

This backend architecture transforms AlgoTrade into a **scalable, cloud-native trading platform** capable of handling thousands of concurrent strategies while maintaining sub-millisecond latency for market data access.