// Forward Testing Types - Centralized type definitions
// Multi-session architecture supporting concurrent testing sessions

export interface ForwardTestSession {
  session_id: string; // Primary identifier for session (standardized from testId)
  session_name: string;
  strategy_name: string;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
  start_time: Date;
  end_time?: Date;
  is_active: boolean;
  settings: ForwardTestSettings;
  symbol: string;
  timeframe: string;
  current_portfolio_value: number;
  initial_balance: number;
  total_trades: number;
  total_return: number; // percentage (standardized from pnlPercent)
  total_pnl: number; // dollar amount (standardized from pnlDollar) 
  max_drawdown: number;
  win_rate: number;
  current_price?: number;
  runtime?: number;
}

export interface Portfolio {
  cash_balance: number;
  positions: Position[];
  total_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_pnl: number;
  total_pnl_percent: number;
  position_count: number;
  updated_at: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  average_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl?: number;
  unrealized_pnl_percent?: number;
  last_updated: number;
}

export interface Metrics {
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  max_drawdown_percent: number;
  win_rate: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  current_drawdown: number;
  total_pnl: number;
  total_pnl_percent: number;
  updated_at?: string;
}

export interface Trade {
  trade_id: string;
  session_id: string; // Links trade to specific session
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: number;
  pnl?: number;
  pnl_percent?: number;
  status: string;
  fee?: number;
  total_cost?: number;
}

export interface Alert {
  id: string;
  session_id: string; // Links alert to specific session
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
  session_id: string; // Session identifier for multi-session support
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
    cash_balance: number;
    positions: Record<string, unknown>;
    realized_pnl: number;
    unrealized_pnl: number;
  };
  metrics: {
    total_trades: number;
    winning_trades?: number;
    losing_trades?: number;
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
