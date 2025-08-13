# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AlgoTrade Beta2 - Full-Stack Trading Platform

This is a comprehensive algorithmic trading platform with a microservices backend and React frontend, designed for building, backtesting, and forward testing trading strategies using visual node-based programming.

### Architecture Overview

**AlgoTrade Beta2** is a cloud-native, event-driven trading platform consisting of:
- **Frontend**: React + TypeScript + Vite application with visual strategy builder
- **Backend**: 7 Python microservices using FastAPI with Kafka event streaming
- **Infrastructure**: PostgreSQL, Redis, Kafka for data persistence and real-time processing

### Key Innovation: Redis Sliding Window Optimization
- Centralized Redis streams with sliding windows (default 1000 recent ticks)
- Strategies access data via `GET /api/market/symbols/BTCUSD/latest?limit=100`
- Sub-millisecond latency for market data access
- Eliminates individual strategy data management overhead

### Development Commands

#### Frontend Development (React + TypeScript + Vite)
```bash
cd frontend/
npm install                  # Install dependencies
npm run dev                 # Start development server (localhost:5173)
npm run build              # Build for production (TypeScript check + Vite build)
npm run lint               # Run ESLint
npm run preview            # Preview production build
```

#### Backend Development (Python Microservices)
```bash
cd backend/

# Start full infrastructure
docker-compose up --build                    # Start all services
docker-compose up kafka redis postgres -d    # Infrastructure only

# Setup Kafka topics (run once after Kafka starts)
python setup_kafka.py

# Individual service development with hot reload
cd services/api-gateway/
uvicorn app.main:app --port 8000 --reload

cd services/market-data-service/
uvicorn app.main:app --port 8001 --reload

cd services/strategy-service/
uvicorn app.main:app --port 8002 --reload

cd services/forward-test-service/
uvicorn app.main:app --port 8003 --reload
```

#### Database Management
```bash
# Initialize database schema
docker-compose exec postgres psql -U algotrade -d algotrade -f /init-db.sql

# View strategy compilation reports
docker-compose exec postgres psql -U algotrade -d algotrade
SELECT name, compilation_report FROM strategies WHERE user_id = 'user-uuid';

# Monitor Redis sliding windows
docker-compose exec redis redis-cli
> XLEN market:BTCUSD
> XREVRANGE market:BTCUSD + - COUNT 10
```

#### Health Checks & Monitoring
```bash
# Service health checks
curl http://localhost:8000/health/detailed  # API Gateway
curl http://localhost:8001/health           # Market Data Service
curl http://localhost:8002/health           # Strategy Service
curl http://localhost:8003/health           # Forward Testing Service

# Monitor Kafka topics
docker-compose exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic market-data-updates
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list
```

### Frontend Architecture

#### Technology Stack
- **React 19** with TypeScript
- **Vite** for build tooling and dev server
- **Tailwind CSS 4** for styling
- **Radix UI** components for accessible UI primitives
- **React Flow (@xyflow/react)** for visual strategy builder
- **React Router DOM** for navigation
- **Recharts & ECharts** for data visualization
- **Socket.io-client** for real-time updates

#### Key Components Structure
```
src/
├── components/
│   ├── strategies/          # Visual strategy builder (React Flow)
│   ├── forward_testing/     # Forward testing UI components
│   ├── charts/             # Chart components (backtest + live)
│   ├── dashboard/          # Live dashboard components
│   └── ui/                 # Shadcn/ui components (Radix UI + Tailwind)
├── pages/
│   ├── build_algorithm/    # Visual strategy builder page
│   ├── backtest/          # Backtesting interface
│   ├── forward_testing/   # Forward testing management
│   └── live_dashboard/    # Real-time trading dashboard
├── contexts/              # React contexts for state management
├── hooks/                # Custom React hooks
└── services/             # API client functions
```

#### Visual Strategy Builder
- **Node-based programming** using React Flow
- **20+ node types**: Indicators (SMA, EMA, RSI, MACD), Logic (AND, OR, Compare), Actions (Buy, Sell, Position Size)
- **Real-time validation** and compilation
- **Template system** for common strategies
- **Export/import** strategy configurations

### Backend Architecture

#### Microservices (Ports 8000-8006)
1. **API Gateway** (8000): FastAPI with JWT auth, request routing, CORS
2. **Market Data Service** (8001): Real-time WebSocket feeds, Redis sliding windows
3. **Strategy Service** (8002): Node-based strategy compilation engine
4. **Forward Testing Service** (8003): Multi-session paper trading with realistic execution
5. **Backtesting Service** (8004): Historical strategy testing with S3 storage
6. **Notification Service** (8005): WebSocket connection management
7. **Analytics Service** (8006): Performance metrics and risk analysis

#### Event-Driven Architecture
- **Kafka Topics**: Market data, strategy signals, trade executions, notifications
- **Redis Streams**: Sliding window market data cache
- **PostgreSQL**: Relational data (users, strategies, sessions, trades)

#### Core Data Flow
```
Market Data → Kafka → Redis Sliding Windows → Strategy Service → Signals
                                                      ↓
Forward Testing Service → Paper Trades → Portfolio Updates → WebSocket Updates
```

### Database Schema

#### Key Relationships
- Users (1:N) → Strategies, ForwardTestSessions, BacktestResults
- ForwardTestSessions (1:N) → Trades, PortfolioPositions, ChartData
- Strategies → (N:N) Sessions/Backtests (strategy snapshots preserved)

### Testing

#### Frontend Tests
```bash
cd frontend/
# No specific test framework configured - check package.json for additions
```

#### Backend Tests
```bash
cd backend/
# Each service has a tests/ directory
# Run individual service tests:
cd services/forward-test-service/
python -m pytest tests/
```

### Common Workflows

#### Adding New Trading Strategy Node
1. Create node component in `frontend/src/components/nodes/[category]/`
2. Add node type to `frontend/src/pages/build_algorithm/config/nodeTypes.js`
3. Update backend strategy engine in `backend/shared/strategy_engine/nodes.py`
4. Add compilation logic in `backend/shared/strategy_engine/compiler.py`

#### Creating New Microservice
1. Create service directory in `backend/services/[service-name]/`
2. Add Dockerfile and requirements.txt
3. Update docker-compose.yml with service definition
4. Add health check endpoint
5. Register with API Gateway routing

#### Forward Testing Workflow
1. Build strategy using visual editor
2. Compile strategy via Strategy Service
3. Create forward testing session with starting capital
4. Session spawns background strategy execution
5. Real-time portfolio updates via WebSocket
6. Performance metrics calculated continuously

### Environment Variables

#### Backend Services
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string  
- `KAFKA_BOOTSTRAP_SERVERS`: Kafka broker addresses
- `FINNHUB_TOKEN`: Market data API token
- `S3_*`: Object storage credentials for backtesting results

#### Development Setup
1. Copy environment variables from docker-compose.yml
2. Install backend dependencies: `pip install -r requirements.txt` (per service)
3. Install frontend dependencies: `npm install`
4. Start infrastructure: `docker-compose up kafka redis postgres -d`
5. Setup Kafka: `python setup_kafka.py`
6. Start services individually for development

### Performance Considerations

- **Redis sliding windows** provide sub-millisecond data access
- **Kafka partitioning** enables horizontal scaling
- **WebSocket connections** minimize frontend polling
- **Database indexing** optimized for user-scoped queries
- **Strategy compilation** cached in Redis

This platform supports thousands of concurrent strategies with real-time execution and comprehensive backtesting capabilities.