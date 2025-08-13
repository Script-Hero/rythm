# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AlgoTrade Beta2 - Full-Stack Trading Platform

This repository contains a comprehensive algorithmic trading platform with a React TypeScript frontend and Python microservices backend architecture.

## Project Structure

### Frontend: React + TypeScript + Vite (`AlgoTradeFrontend/`)
- **Technology Stack**: React 19, TypeScript, Vite, TailwindCSS, Radix UI
- **Architecture**: Component-based with modern React patterns
- **Key Features**: Strategy builder (node-based), backtesting UI, forward testing dashboard, live trading interface

### Backend: Microservices Architecture (`backend/`)
- **Status**: ✅ Production-ready with Kafka event streaming
- **Innovation**: Redis sliding window optimization for sub-millisecond market data access
- **Services**: API Gateway, Market Data, Strategy, Forward Testing, Backtesting, Notifications, Analytics

## Development Commands

### Frontend Development (`AlgoTradeFrontend/`)
```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Lint TypeScript and React code
npm run lint

# Preview production build
npm run preview

# Type checking
npx tsc --noEmit
```

### Backend Development (`backend/`)

#### **Infrastructure Setup**
```bash
# Start core infrastructure (required first)
docker-compose up kafka redis postgres -d

# Setup Kafka topics (run once after infrastructure start)
python setup_kafka.py

# Start all services
docker-compose up --build

# Development mode (single service with hot reload)
cd services/forward-test-service/
uvicorn app.main:app --port 8003 --reload
```

#### **Service Health Checks**
```bash
# Check all service health
curl http://localhost:8000/health/detailed  # API Gateway
curl http://localhost:8001/health           # Market Data Service  
curl http://localhost:8002/health           # Strategy Service
curl http://localhost:8003/health           # Forward Testing Service
```

#### **Database Operations**
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U algotrade -d algotrade

# View Redis sliding windows
docker-compose exec redis redis-cli
> XREVRANGE market:BTCUSD + - COUNT 10

# Monitor Kafka topics
docker-compose exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic market-data-updates
```

## Core Architecture Concepts

### Redis Sliding Window Innovation
- **Problem Solved**: Traditional systems require each strategy to manage data storage
- **Solution**: Centralized Redis streams with configurable windows (default: 1000 recent ticks)
- **Access Pattern**: `GET /api/market/symbols/BTCUSD/latest?limit=100` for instant data
- **Performance**: Sub-millisecond latency, supports thousands of concurrent strategies

### Event-Driven Flow
```
Market Data → Kafka → Redis Sliding Windows → Forward Testing → Trade Execution → WebSocket Updates
                ↓
          Strategy Service → Strategy Signals → Portfolio Updates → User Notifications
```

### Service Architecture

| Service | Port | Key Functionality |
|---------|------|-------------------|
| API Gateway | 8000 | JWT auth, routing, rate limiting |
| Market Data | 8001 | Redis sliding windows, WebSocket feeds |
| Strategy | 8002 | Visual node-based strategy compilation |
| Forward Testing | 8003 | Multi-session paper trading |
| Backtesting | 8004 | Distributed backtesting engine |
| Notifications | 8005 | WebSocket real-time updates |
| Analytics | 8006 | Performance metrics & reporting |

### Frontend Architecture (`AlgoTradeFrontend/`)

#### **Page Structure**
- **Build Algorithm** (`/build_algorithm`): Visual strategy builder with React Flow
- **Backtest** (`/backtest`): Historical strategy testing with comprehensive analytics
- **Forward Testing** (`/forward_testing`): Live paper trading with multi-session support
- **Live Dashboard** (`/live_dashboard`): Real-time market data and strategy monitoring
- **Strategies** (`/strategies`): Strategy management and browsing

#### **Key Components**
- **Strategy Nodes** (`components/nodes/`): 20+ node types (indicators, logic, actions)
- **Charts** (`components/charts/`): Backtesting analytics and live data visualization  
- **UI Library** (`components/ui/`): Radix UI components with TailwindCSS styling

#### **State Management**
- **React Context**: ForwardTestingContext for session management
- **React Hook Form**: Form validation with Zod schemas
- **React Router**: Client-side routing

## Common Development Workflows

### Adding New Strategy Nodes
1. Create node component in `AlgoTradeFrontend/src/components/nodes/`
2. Add node type to `backend/shared/strategy_engine/nodes.py`
3. Update node registry in Strategy Service
4. Test compilation and execution

### Creating New Service
1. Copy service template from existing service
2. Add service to `docker-compose.yml`
3. Update shared models if needed
4. Add service health check to API Gateway

### Frontend API Integration
- **Base URL**: API Gateway at `http://localhost:8000`
- **Authentication**: JWT tokens via `/auth/login`
- **TypeScript Types**: Defined in `src/types/`

## Important File Locations

### Configuration Files
- **Frontend**: `AlgoTradeFrontend/package.json`, `tsconfig.json`, `vite.config.ts`
- **Backend**: `backend/docker-compose.yml`, service-specific `requirements.txt`
- **Database**: `backend/init-db.sql`

### Shared Libraries (`backend/shared/`)
- **Strategy Engine**: Node-based strategy compilation and execution
- **Kafka Client**: Producer/consumer utilities with error handling
- **Data Models**: Pydantic models for all services

## Testing

### Frontend Testing
```bash
# No test framework currently configured
# Consider adding Vitest + React Testing Library
```

### Backend Testing  
```bash
# Run tests for individual services
cd services/forward-test-service/
pytest tests/ -v

# Integration tests
docker-compose -f docker-compose.test.yml up --build
```

## Environment Setup

### Required Environment Variables
```bash
# External API keys
FINNHUB_TOKEN=your_finnhub_token
COINBASE_API_KEY=your_coinbase_key

# S3 Storage (for backtesting results)
S3_ENDPOINT=your_s3_endpoint  
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
```

## Performance Considerations

### Frontend Optimization
- **Code Splitting**: Lazy load pages and heavy components
- **React Flow**: Optimize node rendering for large strategies
- **Chart Performance**: Use efficient charting libraries (Recharts, ECharts)

### Backend Optimization
- **Redis Memory**: Configure sliding window sizes appropriately
- **Kafka Partitioning**: Scale topics based on message volume
- **Database Indexing**: User-scoped queries optimized
- **Connection Pooling**: Async database connections

## Architecture Benefits

### Key Features
- **Authentication**: JWT with rate limiting
- **Market Data**: Redis sliding window optimization for sub-millisecond access
- **Strategy System**: Visual node-based compilation with 20+ node types
- **Trading**: Multi-session paper trading with realistic execution
- **Event System**: Comprehensive 8-topic Kafka event streaming

## Troubleshooting

### Common Issues
- **Kafka Connection**: Ensure topics setup with `python setup_kafka.py`
- **Database Schema**: Check `init-db.sql` applied correctly
- **Redis Memory**: Monitor with `docker-compose exec redis redis-cli info memory`
- **TypeScript Errors**: Run `npm run lint` in frontend

### Debug Commands
```bash
# View service logs
docker-compose logs -f market-data-service

# Check Kafka topics
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Monitor Redis streams  
docker-compose exec redis redis-cli XLEN market:BTCUSD
```