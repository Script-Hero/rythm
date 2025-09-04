// Forward Testing Types - Centralized type definitions
// Multi-session architecture supporting concurrent testing sessions

export interface ForwardTestSession {
  testId: string; // Primary identifier for session
  name: string;
  strategyName: string;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  settings: ForwardTestSettings;
  symbol: string;
  timeframe: string;
  portfolioValue: number;
  initialBalance: number;
  totalTrades: number;
  pnlPercent: number;
  pnlDollar: number;
  maxDrawdown: number;
  winRate: number;
  currentPrice?: number;
  runtime?: number;
}

export interface Portfolio {
  cash: number;
  positions: Position[];
  totalValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentValue: number;
  unrealizedPnL?: number;
}

export interface Metrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  currentDrawdown: number;
  profitFactor?: number;
  avgWin?: number;
  avgLoss?: number;
  consecutiveWins?: number;
  consecutiveLosses?: number;
}

export interface Trade {
  id: string;
  sessionId: string; // Links trade to specific session
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: Date | string | number;
  pnl?: number;
  status: 'OPEN' | 'CLOSED';
  commission?: number;
  slippage?: number;
}

export interface Alert {
  id: string;
  sessionId: string; // Links alert to specific session
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  message: string;
  timestamp: Date | string | number;
  acknowledged?: boolean;
}

export interface ForwardTestSettings {
  symbol: string;
  timeframe: string;
  speed: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoStop: boolean;
  maxDrawdown: number;
  initialBalance: number;
  slippage: number;
  commission: number;
  commissionType: 'fixed' | 'percentage';
  maxPositions: number;
  sessionName?: string;
}

// Chart data types for multi-session support
export interface ChartDataPoint {
  time: string;
  sessionId: string; // Session identifier for multi-session support
}

export interface PriceDataPoint extends ChartDataPoint {
  price: number;
  volume: number;
  signal?: string;
}

export interface PortfolioDataPoint extends ChartDataPoint {
  value: number;
  cash?: number;
  positions?: Record<string, unknown>;
  return?: number;
}

export interface DrawdownDataPoint extends ChartDataPoint {
  drawdown: number;
}

export interface ChartData {
  priceHistory: PriceDataPoint[];
  portfolioHistory: PortfolioDataPoint[];
  drawdownHistory: DrawdownDataPoint[];
}

// WebSocket event types for multi-session architecture
export interface WebSocketEvent {
  type: string;
  session_id?: string; // Session identifier
  timestamp?: number | string;
}

export interface PriceUpdateEvent extends WebSocketEvent {
  type: 'PRICE_UPDATE';
  price: number;
  volume?: number;
  symbol: string;
}

export interface TradeExecutedEvent extends WebSocketEvent {
  type: 'TRADE_EXECUTED';
  tradeId?: string;
  id?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  pnl?: number;
  status: 'OPEN' | 'CLOSED';
  signal?: string;
}

export interface PortfolioUpdateEvent extends WebSocketEvent {
  type: 'PORTFOLIO_UPDATE';
  portfolio: {
    total_value: number;
    cash: number;
    positions: Record<string, unknown>;
  };
  metrics: {
    total_trades: number;
    return_percentage?: number;
    total_return?: number;
    max_drawdown: number;
    win_rate: number;
    current_drawdown?: number;
  };
}

export interface ChartDataRestoredEvent extends WebSocketEvent {
  type: 'CHART_DATA_RESTORED' | 'chart_data_restored';
  chart_data: {
    price?: Array<{
      timestamp: number | string;
      price: number;
      volume?: number;
    }>;
    portfolio?: Array<{
      timestamp: number | string;
      value: number;
      return?: number;
    }>;
    drawdown?: Array<{
      timestamp: number | string;
      drawdown: number;
    }>;
  };
  trades?: Array<{
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    timestamp: number | string;
    pnl?: number;
    status: 'OPEN' | 'CLOSED';
  }>;
}

// Session management types
export interface SessionCreateRequest {
  name: string;
  strategy: {
    name: string;
    [key: string]: unknown;
  };
  settings: ForwardTestSettings;
}

export interface SessionRestoreData {
  session: {
    session_id: string;
    name?: string;
    strategy_name: string;
    status: string;
    start_time: string;
    settings?: ForwardTestSettings;
    symbol?: string;
    timeframe?: string;
    current_portfolio_value?: number;
    initial_balance?: number;
    total_trades?: number;
    total_return?: number;
    realized_pnl?: number;
    max_drawdown?: number;
    win_rate?: number;
  };
  chart_data?: ChartDataRestoredEvent['chart_data'];
  trades?: ChartDataRestoredEvent['trades'];
}

// Component prop types for consistent interfaces
export interface SessionSpecificProps {
  sessionId: string;
}

export interface MultiSessionProps {
  sessions: ForwardTestSession[];
  activeSessionId?: string;
}

// Filter and search types
export type SessionStatusFilter = 'ALL' | 'RUNNING' | 'PAUSED' | 'STOPPED';

export interface SessionFilters {
  searchTerm: string;
  statusFilter: SessionStatusFilter;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// API response types
export interface APIResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface SessionAPIResponse extends APIResponse {
  session_id?: string;
  active_sessions?: ForwardTestSession[];
  recent_sessions?: ForwardTestSession[];
}

// Export utility type for session identification
export type SessionIdentifier = string;

// Export constants for session management
export const SESSION_STATUSES = ['RUNNING', 'PAUSED', 'STOPPED', 'ERROR'] as const;
export const TRADE_SIDES = ['BUY', 'SELL'] as const;
export const ALERT_TYPES = ['INFO', 'WARNING', 'ERROR', 'SUCCESS'] as const;
export const COMMISSION_TYPES = ['fixed', 'percentage'] as const;
