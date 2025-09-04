// Forward Testing Utilities - Centralized utility functions
// Multi-session architecture supporting concurrent testing sessions

import type { 
  Portfolio, 
  Metrics, 
  Trade, 
  ForwardTestSession, 
  Alert,
  ChartDataPoint,
  PriceDataPoint,
  PortfolioDataPoint,
  DrawdownDataPoint,
  SessionIdentifier
} from '@/types/forward-testing';

// ================================
// FORMATTING UTILITIES
// ================================

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

export const formatPercentage = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

export const formatLargeNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
};

export const formatTime = (timeString: string | Date): string => {
  const date = typeof timeString === 'string' ? new Date(timeString) : timeString;
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

export const formatDateTime = (timeString: string | Date): string => {
  const date = typeof timeString === 'string' ? new Date(timeString) : timeString;
  return date.toLocaleString();
};

export const formatRuntime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

// ================================
// CALCULATION UTILITIES
// ================================

export const calculateTotalPnL = (portfolio: Portfolio): number => {
  return portfolio.unrealizedPnL + portfolio.realizedPnL;
};

export const calculatePnLPercentage = (portfolio: Portfolio, initialBalance: number): number => {
  return ((portfolio.totalValue - initialBalance) / initialBalance) * 100;
};

export const calculatePositionValue = (quantity: number, currentPrice: number): number => {
  return quantity * currentPrice;
};

export const calculatePositionPnL = (
  quantity: number, 
  avgPrice: number, 
  currentPrice: number
): number => {
  return quantity * (currentPrice - avgPrice);
};

export const calculateRuntime = (startTime: Date): number => {
  return Math.floor((Date.now() - startTime.getTime()) / 1000);
};

export const calculateDrawdown = (currentValue: number, peakValue: number): number => {
  if (peakValue === 0) return 0;
  return ((currentValue - peakValue) / peakValue) * 100;
};

// ================================
// SESSION MANAGEMENT UTILITIES
// ================================

export const getSessionById = (
  sessions: ForwardTestSession[], 
  sessionId: SessionIdentifier
): ForwardTestSession | null => {
  return sessions.find(s => s.testId === sessionId) || null;
};

export const isSessionActive = (session: ForwardTestSession): boolean => {
  return session.status === 'RUNNING' || session.status === 'PAUSED';
};

export const getActiveSessionIds = (sessions: ForwardTestSession[]): SessionIdentifier[] => {
  return sessions.filter(isSessionActive).map(s => s.testId);
};

export const getSessionsByStatus = (
  sessions: ForwardTestSession[], 
  status: ForwardTestSession['status']
): ForwardTestSession[] => {
  return sessions.filter(s => s.status === status);
};

export const generateSessionName = (strategyName: string): string => {
  return `${strategyName} - ${new Date().toLocaleString()}`;
};

// ================================
// TRADE UTILITIES
// ================================

export const filterTradesBySession = (
  trades: Trade[], 
  sessionId: SessionIdentifier
): Trade[] => {
  return trades.filter(t => t.sessionId === sessionId);
};

export const sortTradesByTime = (trades: Trade[]): Trade[] => {
  return [...trades].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA; // Most recent first
  });
};

export const calculateTradePnL = (
  side: 'BUY' | 'SELL',
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  commission = 0,
  slippage = 0
): number => {
  const priceWithSlippage = side === 'BUY' 
    ? exitPrice * (1 - slippage) 
    : exitPrice * (1 + slippage);
  
  const pnl = side === 'BUY' 
    ? (priceWithSlippage - entryPrice) * quantity
    : (entryPrice - priceWithSlippage) * quantity;
  
  return pnl - commission;
};

// ================================
// ALERT UTILITIES
// ================================

export const filterAlertsBySession = (
  alerts: Alert[], 
  sessionId: SessionIdentifier
): Alert[] => {
  return alerts.filter(a => a.sessionId === sessionId);
};

export const sortAlertsByTime = (alerts: Alert[]): Alert[] => {
  return [...alerts].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA; // Most recent first
  });
};

export const createAlert = (
  sessionId: SessionIdentifier,
  type: Alert['type'],
  message: string
): Alert => {
  return {
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    sessionId,
    type,
    message,
    timestamp: new Date(),
    acknowledged: false
  };
};

// ================================
// CHART DATA UTILITIES
// ================================

export const filterChartDataBySession = <T extends ChartDataPoint>(
  data: T[], 
  sessionId: SessionIdentifier
): T[] => {
  return data.filter(d => d.sessionId === sessionId);
};

export const limitChartData = <T>(data: T[], maxPoints = 50): T[] => {
  return data.slice(-maxPoints);
};

export const createPriceDataPoint = (
  sessionId: SessionIdentifier,
  price: number,
  volume = 100,
  signal?: string
): PriceDataPoint => {
  return {
    time: new Date().toISOString(),
    sessionId,
    price,
    volume,
    signal
  };
};

export const createPortfolioDataPoint = (
  sessionId: SessionIdentifier,
  value: number,
  cash?: number,
  positions?: Record<string, unknown>,
  returnPct?: number
): PortfolioDataPoint => {
  return {
    time: new Date().toISOString(),
    sessionId,
    value,
    cash,
    positions,
    return: returnPct
  };
};

export const createDrawdownDataPoint = (
  sessionId: SessionIdentifier,
  drawdown: number
): DrawdownDataPoint => {
  return {
    time: new Date().toISOString(),
    sessionId,
    drawdown
  };
};

// ================================
// WEBSOCKET EVENT UTILITIES
// ================================

export const extractSessionId = (event: { session_id?: string }): string | null => {
  // Unified on canonical session UUID only
  return event.session_id || null;
};

export const isEventForSession = (
  event: { session_id?: string },
  targetSessionId: SessionIdentifier
): boolean => {
  const eventSessionId = extractSessionId(event);
  return eventSessionId === targetSessionId;
};

export const normalizeTimestamp = (timestamp: number | string | Date): string => {
  if (typeof timestamp === 'number') {
    // Assume Unix timestamp in seconds, convert to milliseconds
    return new Date(timestamp * 1000).toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp).toISOString();
  }
  return new Date().toISOString();
};

// ================================
// VALIDATION UTILITIES
// ================================

export const isValidSessionId = (sessionId: unknown): sessionId is string => {
  return typeof sessionId === 'string' && sessionId.length > 0;
};

export const isValidPrice = (price: unknown): price is number => {
  return typeof price === 'number' && price > 0 && isFinite(price);
};

export const isValidQuantity = (quantity: unknown): quantity is number => {
  return typeof quantity === 'number' && quantity > 0 && isFinite(quantity);
};

// ================================
// STATUS UTILITIES
// ================================

export const getStatusColor = (status: ForwardTestSession['status']): string => {
  switch (status) {
    case 'RUNNING': return 'bg-green-100 text-green-800 border-green-300';
    case 'PAUSED': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'STOPPED': return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'ERROR': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export const getPnLColor = (pnl: number): string => {
  if (pnl > 0) return 'text-green-600';
  if (pnl < 0) return 'text-red-600';
  return 'text-gray-600';
};

export const getDrawdownSeverity = (drawdown: number): 'low' | 'medium' | 'high' => {
  const absDrawdown = Math.abs(drawdown);
  if (absDrawdown <= 2) return 'low';
  if (absDrawdown <= 5) return 'medium';
  return 'high';
};

// ================================
// AUDIO/NOTIFICATION UTILITIES
// ================================

export const playTradeSound = (soundEnabled: boolean): void => {
  if (!soundEnabled) return;
  
  const audio = new Audio('/sounds/trade-executed.mp3');
  audio.volume = 0.3;
  audio.play().catch(() => {
    // Silently fail if audio can't play
  });
};

export const sendNotification = (
  notificationsEnabled: boolean,
  title: string,
  message: string
): void => {
  if (!notificationsEnabled || !('Notification' in window)) return;
  
  new Notification(title, { body: message });
};

// ================================
// DATA EXPORT UTILITIES
// ================================

export const exportSessionData = (
  session: ForwardTestSession,
  trades: Trade[],
  portfolio: Portfolio,
  metrics: Metrics
): void => {
  const exportData = {
    session: {
      id: session.testId,
      name: session.name,
      strategyName: session.strategyName,
      status: session.status,
      startTime: session.startTime,
      runtime: calculateRuntime(session.startTime),
      settings: session.settings
    },
    finalPortfolio: portfolio,
    finalMetrics: metrics,
    trades: sortTradesByTime(trades),
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
    type: 'application/json' 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `forward-test-${session.testId}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
