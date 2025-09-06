import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiService } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { MESSAGE_TYPES } from '@/services/websocket';
import { toast } from 'sonner';
import type {
  ForwardTestSession,
  Portfolio,
  Metrics,
  Trade,
  Alert,
  ChartData,
  ForwardTestSettings,
  SessionRestoreData,
  WebSocketEvent,
  PriceUpdateEvent,
  TradeExecutedEvent,
  PortfolioUpdateEvent,
  ChartDataRestoredEvent,
  SessionIdentifier
} from '@/types/forward-testing';
import {
  extractSessionId,
  normalizeTimestamp,
  isValidSessionId,
  createAlert,
  createPriceDataPoint,
  createPortfolioDataPoint,
  playTradeSound,
  sendNotification,
  limitChartData
} from '@/utils/forward-testing';

// Types now imported from shared types file

interface ForwardTestingContextType {
  // Multi-session state
  sessions: ForwardTestSession[];
  sessionPortfolios: Record<SessionIdentifier, Portfolio>;
  sessionMetrics: Record<SessionIdentifier, Metrics>;
  sessionTrades: Record<SessionIdentifier, Trade[]>;
  sessionAlerts: Record<SessionIdentifier, Alert[]>;
  sessionChartData: Record<SessionIdentifier, ChartData>;
  
  // Connection state
  isConnected: boolean;
  socket: Socket | null;
  
  // Chart data management
  updateChartData: (sessionId: SessionIdentifier, type: 'price' | 'portfolio' | 'drawdown', data: any) => void;
  setChartData: (sessionId: SessionIdentifier, type: 'price' | 'portfolio' | 'drawdown', data: any[]) => void;
  clearChartData: (sessionId: SessionIdentifier) => void;
  
  // Session management
  createSession: (name: string, strategy: any, settings: ForwardTestSettings) => Promise<SessionIdentifier | null>;
  startTest: (sessionId: SessionIdentifier) => Promise<boolean>;
  pauseTest: (sessionId: SessionIdentifier) => Promise<void>;
  resumeTest: (sessionId: SessionIdentifier) => Promise<void>;
  stopTest: (sessionId: SessionIdentifier) => Promise<void>;
  deleteSession: (sessionId: SessionIdentifier) => Promise<void>;
  updateSessionStatus: (sessionId: SessionIdentifier, status: string, portfolio?: any, metrics?: any) => Promise<void>;
  getSession: (sessionId: SessionIdentifier) => ForwardTestSession | null;
  restoreSession: (sessionData: SessionRestoreData) => void;
  
  // Session-specific data access
  getSessionPortfolio: (sessionId: SessionIdentifier) => Portfolio | null;
  getSessionMetrics: (sessionId: SessionIdentifier) => Metrics | null;
  getSessionTrades: (sessionId: SessionIdentifier) => Trade[];
  getSessionAlerts: (sessionId: SessionIdentifier) => Alert[];
  addSessionAlert: (sessionId: SessionIdentifier, type: Alert['type'], message: string) => void;
  
  // Legacy support for single session components
  activeSession: ForwardTestSession | null;
  chartData: ChartData;
}

const ForwardTestingContext = createContext<ForwardTestingContextType | null>(null);

export const useForwardTesting = () => {
  const context = useContext(ForwardTestingContext);
  if (!context) {
    throw new Error('useForwardTesting must be used within ForwardTestingProvider');
  }
  return context;
};

interface ForwardTestingProviderProps {
  children: React.ReactNode;
}

export const ForwardTestingProvider: React.FC<ForwardTestingProviderProps> = ({ children }) => {
  // Multi-session state management
  const [sessions, setSessions] = useState<ForwardTestSession[]>([]);
  const [sessionPortfolios, setSessionPortfolios] = useState<Record<SessionIdentifier, Portfolio>>({});
  const [sessionMetrics, setSessionMetrics] = useState<Record<SessionIdentifier, Metrics>>({});
  const [sessionTrades, setSessionTrades] = useState<Record<SessionIdentifier, Trade[]>>({});
  const [sessionAlerts, setSessionAlerts] = useState<Record<SessionIdentifier, Alert[]>>({});
  const [sessionChartData, setSessionChartData] = useState<Record<SessionIdentifier, ChartData>>({});
  
  // State trigger to force updates when sessions change
  const [sessionUpdateTrigger, setSessionUpdateTrigger] = useState(0);
  const triggerSessionUpdate = useCallback(() => {
    setSessionUpdateTrigger(prev => prev + 1);
  }, []);
  
  // Connection state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const webSocket = useWebSocket({
    autoConnect: true,
    onConnect: () => setIsConnected(true),
    onDisconnect: () => setIsConnected(false),
    onError: () => setIsConnected(false)
  });
  const [hasLocalSessions, setHasLocalSessions] = useState(false);
  // Guard to avoid repeated initial fetches
  const didInitialFetchRef = useRef(false);
  
  // Ref to store restoreSession function for WebSocket handler access
  const restoreSessionRef = useRef<((sessionData: any) => void) | null>(null);


    // Centralized WebSocket event handler for multi-session architecture
  const handleWebSocketEvent = useCallback((data: any) => {
    console.log('📡 [ForwardTestingContext] WebSocket event received:', data);
    
    // Handle both single object and array formats from backend
    const events = Array.isArray(data) ? data : [data];
    
    events.forEach((event: WebSocketEvent) => {
      const sessionId = extractSessionId(event);
      if (!isValidSessionId(sessionId)) {
        console.warn('📡 Invalid session ID in event:', event);
        return;
      }
      
      console.log(`📡 Processing event type: ${event.type} for session: ${sessionId}`);
      
      switch (event.type) {
        case 'PRICE_UPDATE':
          handlePriceUpdate(event as PriceUpdateEvent, sessionId!);
          break;
          
        case 'TRADE_EXECUTED':
          handleTradeExecuted(event as TradeExecutedEvent, sessionId!);
          break;
          
        case 'PORTFOLIO_UPDATE':
          handlePortfolioUpdate(event as PortfolioUpdateEvent, sessionId!);
          break;
          
        case 'METRICS_UPDATE':
          handleMetricsUpdate(event, sessionId!);
          break;
          
        case 'CHART_DATA_RESTORED':
        case 'chart_data_restored':
          handleChartDataRestored(event as ChartDataRestoredEvent, sessionId!);
          break;
          
        case 'ERROR':
          handleError(event, sessionId!);
          break;
          
        default:
          console.log(`📡 Unhandled event type: ${event.type}`);
      }
    });
  }, []);

  // Define functions before useEffect to avoid hoisting issues
  const checkActiveTests = useCallback(async () => {
    try {
      console.log('🔄 [ForwardTestingContext] checkActiveTests called');
      const response = await apiService.getUserSessions();
      console.log('🔄 [ForwardTestingContext] getUserSessions response:', response);
      
      // Process all sessions
      if (response.success && response.message.sessions && response.message.count > 0) {
        const toNum = (v: any, d: number = 0) => {
          const n = Number(v);
          return Number.isFinite(n) ? n : d;
        };
        const sessions = response.message.sessions.map((test: any) => {
          const strategy_name = test.strategy_name || test.strategyName || test.strategy?.name || 'Strategy';
          const session_id = test.session_id || test.sessionId || test.id; // canonical UUID only
          return {
            session_id,
            session_name: test.session_name || test.name || `${strategy_name} Test`,
            strategy_name,
            status: test.status,
            start_time: new Date(test.started_at || test.start_time || test.startTime || Date.now()),
            is_active: test.status === 'RUNNING' || test.status === 'PAUSED',
            settings: test.settings || {},
            symbol: test.symbol || 'BTC/USD',
            timeframe: test.timeframe, // Don't override with default - trust backend data
            current_portfolio_value: toNum(test.current_portfolio_value ?? test.portfolioValue ?? test.initial_balance, 10000),
            total_trades: toNum(test.total_trades ?? test.totalTrades, 0),
            total_return: toNum(test.total_return ?? test.pnlPercent, 0),
            total_pnl: toNum(test.total_pnl ?? test.realized_pnl ?? test.pnlDollar, 0),
            max_drawdown: toNum(test.max_drawdown ?? test.maxDrawdown, 0),
            win_rate: toNum(test.win_rate ?? test.winRate, 0),
            initial_balance: toNum(test.initial_balance ?? test.initialBalance, 10000)
          } as ForwardTestSession;
        });
        console.log('🔄 [ForwardTestingContext] Parsed sessions from server:', sessions);
        
        setSessions(sessions);
        setHasLocalSessions(false); // Reset flag since we got server data
      } else {
        console.log('🔄 [ForwardTestingContext] No sessions from server');
        if (!hasLocalSessions) {
          setSessions([]);
        }
      }
    } catch (error) {
      console.error('❌ [ForwardTestingContext] Error checking active tests - keeping existing sessions:', error);
      // Don't clear existing sessions on network error - keep what we have locally
    }
  }, [hasLocalSessions]);



  // (moved) WebSocket bridging effect is declared after handler definitions to avoid TDZ

  // Chart data management functions - memoized to prevent infinite re-renders
  const updateChartData = useCallback((sessionId: SessionIdentifier, type: 'price' | 'portfolio' | 'drawdown', data: any) => {
    console.log(`📊 updateChartData called - Session: ${sessionId}, Type: ${type}, Data:`, data);
    setSessionChartData(prev => {
      const sessionData = prev[sessionId] || {
        priceHistory: [],
        portfolioHistory: [],
        drawdownHistory: []
      };
      
      const newSessionData = { ...sessionData };
      
      if (type === 'price') {
        newSessionData.priceHistory = limitChartData([...sessionData.priceHistory, data], 50);
        console.log(`📈 Price history updated - ${newSessionData.priceHistory.length} points`);
      } else if (type === 'portfolio') {
        newSessionData.portfolioHistory = limitChartData([...sessionData.portfolioHistory, data], 50);
        console.log(`💼 Portfolio history updated - ${newSessionData.portfolioHistory.length} points`);
      } else if (type === 'drawdown') {
        newSessionData.drawdownHistory = limitChartData([...sessionData.drawdownHistory, data], 50);
        console.log(`📉 Drawdown history updated - ${newSessionData.drawdownHistory.length} points`);
      }
      
      return {
        ...prev,
        [sessionId]: newSessionData
      };
    });
  }, []);

  const setChartData = useCallback((sessionId: string, type: 'price' | 'portfolio' | 'drawdown', data: any[]) => {
    console.log(`📊 Setting complete ${type} chart data for session ${sessionId}:`, data.length, 'points');
    setSessionChartData(prev => {
      const sessionData = prev[sessionId] || {
        priceHistory: [],
        portfolioHistory: [],
        drawdownHistory: []
      };
      
      const newSessionData = { ...sessionData };
      
      if (type === 'price') {
        newSessionData.priceHistory = data;
      } else if (type === 'portfolio') {
        newSessionData.portfolioHistory = data;
      } else if (type === 'drawdown') {
        newSessionData.drawdownHistory = data;
      }
      
      return {
        ...prev,
        [sessionId]: newSessionData
      };
    });
  }, []);

  // No aliasing required anymore; the system is unified on UUID session IDs

  const clearChartData = useCallback((sessionId: string) => {
    console.log(`🧹 Clearing chart data for session ${sessionId}`);
    setSessionChartData(prev => ({
      ...prev,
      [sessionId]: {
        priceHistory: [],
        portfolioHistory: [],
        drawdownHistory: []
      }
    }));
  }, []);

  
  // Individual event handlers for multi-session support
  const handlePriceUpdate = useCallback((event: PriceUpdateEvent, sessionId: SessionIdentifier) => {
    const priceData = createPriceDataPoint(
      sessionId,
      event.price,
      event.volume,
      event.symbol
    );
    updateChartData(sessionId, 'price', priceData);
    // Update session's visible currentPrice for header/overview
    setSessions(prev => prev.map(s => s.session_id === sessionId ? { ...s, current_price: event.price } : s));
  }, []);
  
  const handleTradeExecuted = useCallback((event: TradeExecutedEvent, sessionId: SessionIdentifier) => {
    // Create trade object
    const trade: Trade = {
      id: event.tradeId || event.id || `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      symbol: event.symbol,
      side: event.side,
      quantity: event.quantity,
      price: event.price,
      timestamp: normalizeTimestamp(event.timestamp || Date.now()),
      status: event.status || 'CLOSED',
      pnl: event.pnl || 0
    };
    
    // Add trade to session trades
    setSessionTrades(prev => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), trade]
    }));
    
    // Create price data point for chart
    const priceData = createPriceDataPoint(
      sessionId,
      event.price,
      100, // Default volume
      event.signal
    );
    updateChartData(sessionId, 'price', priceData);
    
    // Add alert
    addSessionAlert(sessionId, 'SUCCESS', 
      `Trade executed: ${event.side} ${event.quantity} ${event.symbol} @ $${event.price}`);
    
    // Play sound notification
    playTradeSound(true); // TODO: Get from session settings

    console.log('💰 Trade executed for session:', sessionId, trade);

    // Ensure session exists in list for UI binding
    setSessions(prev => {
      if (prev.some(s => s.session_id === sessionId)) return prev;
      const placeholder: ForwardTestSession = {
        session_id: sessionId,
        session_name: `Session ${sessionId.slice(0, 8)}`,
        strategy_name: 'Unknown',
        status: 'RUNNING',
        start_time: new Date(),
        is_active: true,
        settings: {} as any,
        symbol: (event as any).symbol || 'UNKNOWN',
        timeframe: '1m',
        current_portfolio_value: 0,
        initial_balance: 0,
        total_trades: 1,
        total_return: 0,
        total_pnl: 0,
        max_drawdown: 0,
        win_rate: 0,
        current_price: event.price
      };
      return [...prev, placeholder];
    });

    // Increment trade counters in metrics and session list (snake_case only)
    setSessionMetrics(prev => {
      const existing = prev[sessionId] as Partial<Metrics> | undefined;
      const updated: Metrics = {
        total_return: (existing?.total_return ?? 0) as number,
        sharpe_ratio: (existing?.sharpe_ratio ?? 0) as number,
        max_drawdown: (existing?.max_drawdown ?? 0) as number,
        max_drawdown_percent: (existing?.max_drawdown_percent ?? 0) as number,
        win_rate: (existing?.win_rate ?? 0) as number,
        total_trades: ((existing?.total_trades ?? 0) as number) + 1,
        winning_trades: (existing?.winning_trades ?? 0) as number,
        losing_trades: (existing?.losing_trades ?? 0) as number,
        current_drawdown: (existing?.current_drawdown ?? 0) as number,
        total_pnl: (existing?.total_pnl ?? 0) as number,
        total_pnl_percent: (existing?.total_pnl_percent ?? 0) as number,
      };
      return { ...prev, [sessionId]: updated };
    });
    setSessions(prev => prev.map(s => s.session_id === sessionId ? { ...s, total_trades: (s.total_trades ?? 0) + 1 } : s));
  }, []);
  
  const handlePortfolioUpdate = useCallback((event: PortfolioUpdateEvent, sessionId: SessionIdentifier) => {
    const { portfolio, metrics } = event;
    
    console.log('💼 [ForwardTestingContext] Portfolio update received:', { sessionId, portfolio, metrics });
    
    // Update session portfolio - standardized to snake_case
    const updatedPortfolio: Portfolio = {
      cash_balance: portfolio.cash_balance || portfolio.cash || 0,
      positions: portfolio.positions || [],
      total_value: portfolio.total_value || portfolio.totalValue || 0,
      unrealized_pnl: portfolio.unrealized_pnl || portfolio.unrealizedPnL || 0,
      realized_pnl: portfolio.realized_pnl || portfolio.realizedPnL || 0,
      total_pnl: portfolio.total_pnl || (portfolio.realized_pnl || 0) + (portfolio.unrealized_pnl || 0),
      total_pnl_percent: portfolio.total_pnl_percent || 0,
      position_count: portfolio.position_count || (portfolio.positions || []).length,
      updated_at: portfolio.updated_at || Date.now()
    };
    
    setSessionPortfolios(prev => {
      console.log('💼 Updating portfolio for session:', sessionId, 'Previous:', prev[sessionId], 'New:', updatedPortfolio);
      return {
        ...prev,
        [sessionId]: updatedPortfolio
      };
    });
    
    // Update session metrics - use only canonical snake_case field names
    const candidate: Partial<Metrics> = {
      total_return: metrics?.total_return,
      sharpe_ratio: metrics?.sharpe_ratio,
      max_drawdown: metrics?.max_drawdown,
      max_drawdown_percent: metrics?.max_drawdown_percent,
      win_rate: metrics?.win_rate,
      total_trades: metrics?.total_trades,
      winning_trades: metrics?.winning_trades,
      losing_trades: metrics?.losing_trades,
      current_drawdown: metrics?.current_drawdown,
      total_pnl: metrics?.total_pnl,
      total_pnl_percent: metrics?.total_pnl_percent
    };
    const cleanMetrics = Object.fromEntries(
      Object.entries(candidate).filter(([, v]) => v !== undefined && v !== null)
    );
    let effectiveMetrics: Metrics | undefined = undefined;
    if (Object.keys(cleanMetrics).length > 0) {
      const existing = (sessionMetrics[sessionId] || {
        total_return: 0,
        sharpe_ratio: 0,
        max_drawdown: 0,
        max_drawdown_percent: 0,
        win_rate: 0,
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        current_drawdown: 0,
        total_pnl: 0,
        total_pnl_percent: 0
      }) as Metrics;
      effectiveMetrics = { ...existing, ...(cleanMetrics as Partial<Metrics>) } as Metrics;
      setSessionMetrics(prev => {
        const next = { ...(prev[sessionId] || existing), ...(cleanMetrics as Partial<Metrics>) } as Metrics;
        console.log('📊 Merging metrics for session:', sessionId, 'Incoming:', cleanMetrics, 'Result:', next);
        return { ...prev, [sessionId]: next };
      });
    }
    
    // Create portfolio chart data point
    const portfolioData = createPortfolioDataPoint(
      sessionId,
      updatedPortfolio.total_value,
      updatedPortfolio.cash_balance,
      updatedPortfolio.positions,
      (effectiveMetrics?.total_return ?? sessionMetrics[sessionId]?.total_return ?? 0)
    );
    updateChartData(sessionId, 'portfolio', portfolioData);

    // Append drawdown data point if available
    const dd = (cleanMetrics as Partial<Metrics>).current_drawdown;
    if (typeof dd === 'number') {
      updateChartData(sessionId, 'drawdown', { time: new Date().toISOString(), sessionId, drawdown: dd });
    }
    
    // Update session objects with fresh data
    setSessions(prev => prev.map(session => 
      session.session_id === sessionId 
        ? {
            ...session,
            current_portfolio_value: updatedPortfolio.total_value,
            total_trades: effectiveMetrics?.total_trades ?? sessionMetrics[sessionId]?.total_trades ?? session.total_trades,
            total_return: effectiveMetrics?.total_return ?? sessionMetrics[sessionId]?.total_return ?? session.total_return,
            total_pnl: effectiveMetrics?.total_pnl ?? sessionMetrics[sessionId]?.total_pnl ?? session.total_pnl,
            max_drawdown: effectiveMetrics?.max_drawdown ?? sessionMetrics[sessionId]?.max_drawdown ?? session.max_drawdown,
            win_rate: effectiveMetrics?.win_rate ?? sessionMetrics[sessionId]?.win_rate ?? session.win_rate
          }
        : session
    ));
    
    console.log('💼 Portfolio update complete for session:', sessionId);

    // If session isn't present yet (e.g. page opened mid-run), insert a placeholder so UI can bind
    setSessions(prev => {
      if (prev.some(s => s.session_id === sessionId)) return prev;
      const placeholder: ForwardTestSession = {
        session_id: sessionId,
        session_name: `Session ${sessionId.slice(0, 8)}`,
        strategy_name: 'Unknown',
        status: 'RUNNING',
        start_time: new Date(),
        is_active: true,
        settings: {} as any,
        symbol: 'UNKNOWN',
        timeframe: '1m',
        current_portfolio_value: updatedPortfolio.total_value || 0,
        initial_balance: updatedPortfolio.total_value || 0,
        total_trades: effectiveMetrics?.total_trades || 0,
        total_return: effectiveMetrics?.total_return || 0,
        total_pnl: effectiveMetrics?.total_pnl || 0,
        max_drawdown: effectiveMetrics?.max_drawdown || 0,
        win_rate: effectiveMetrics?.win_rate || 0,
      };
      return [...prev, placeholder];
    });
  }, [updateChartData, sessionMetrics]);
  
  const handleMetricsUpdate = useCallback((event: any, sessionId: SessionIdentifier) => {
    const metricsData = event.metrics || event.data?.metrics || {};
    
    // Use only canonical snake_case metrics
    const updatedMetrics: Partial<Metrics> = {
      total_return: metricsData.total_return,
      sharpe_ratio: metricsData.sharpe_ratio,
      max_drawdown: metricsData.max_drawdown,
      win_rate: metricsData.win_rate,
      total_trades: metricsData.total_trades,
      current_drawdown: metricsData.current_drawdown
    };
    
    // Filter out undefined/null values
    const cleanMetrics = Object.fromEntries(
      Object.entries(updatedMetrics).filter(([, value]) => value !== undefined && value !== null)
    );
    
    if (Object.keys(cleanMetrics).length > 0) {
      setSessionMetrics(prev => {
        const existing = prev[sessionId] || { 
          total_return: 0, sharpe_ratio: 0, max_drawdown: 0, win_rate: 0, total_trades: 0, current_drawdown: 0,
          winning_trades: 0, losing_trades: 0, total_pnl: 0, total_pnl_percent: 0, max_drawdown_percent: 0
        } as unknown as Metrics;
        const updated = { ...existing, ...cleanMetrics } as Metrics;
        console.log('📊 Metrics update for session:', sessionId, 'Incoming:', cleanMetrics, 'Result:', updated);
        return {
          ...prev,
          [sessionId]: updated
        };
      });
    }
  }, []);
  
  const handleChartDataRestored = useCallback((event: ChartDataRestoredEvent, sessionId: SessionIdentifier) => {
    console.log('📊 Chart data restored for session:', sessionId);
    
    const sessionData: SessionRestoreData = {
      session: { session_id: sessionId } as any,
      chart_data: event.chart_data,
      trades: event.trades
    };
    
    restoreSession(sessionData);
    toast.success(`Chart data restored for session ${sessionId}`);
  }, []);
  
  const handleError = useCallback((event: any, sessionId: SessionIdentifier) => {
    addSessionAlert(sessionId, 'ERROR', event.message || 'Unknown error occurred');
    toast.error(event.message || 'Forward test error');
  }, []);

  // Subscribe to active sessions whenever connection or session list changes
  // Track already-subscribed sessions to avoid duplicate subscribe messages
  const subscribedSessionsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isConnected) return;
    const active = (sessions || []).filter(s => s.is_active).map(s => s.session_id);
    const toSubscribe = active.filter(id => !subscribedSessionsRef.current.has(id));
    if (toSubscribe.length === 0) return;
    Promise.all(toSubscribe.map(id => webSocket.subscribeToSession(id)))
      .then(() => {
        toSubscribe.forEach(id => subscribedSessionsRef.current.add(id));
      })
      .catch(() => {});
  }, [isConnected, webSocket, sessions]);

  // Bridge all WebSocket messages through centralized event handler
  useEffect(() => {
    // Single handler that routes all messages through handleWebSocketEvent
    const messageRouter = (msg: any) => {
      console.log('📡 [ForwardTestingContext] Message router received:', msg.type, msg);
      
      // Convert WebSocket message to internal event format
      let event;
      switch (msg.type) {
        case 'portfolio_update':
          event = {
            type: 'PORTFOLIO_UPDATE',
            session_id: msg.session_id || msg.data?.session_id,
            portfolio: msg.data?.portfolio || msg.portfolio,
            metrics: msg.data?.metrics || msg.metrics
          };
          break;
        case 'trade_execution':
          event = {
            type: 'TRADE_EXECUTED',
            session_id: msg.session_id || msg.data?.session_id,
            trade: msg.data?.trade || msg.trade,
            tradeId: msg.data?.trade?.trade_id || msg.trade?.id,
            symbol: msg.data?.trade?.symbol || msg.trade?.symbol,
            side: msg.data?.trade?.side || msg.data?.trade?.action,
            quantity: msg.data?.trade?.quantity,
            price: msg.data?.trade?.price,
            timestamp: msg.timestamp || msg.data?.timestamp
          };
          break;
        case 'forward_test_event':
          event = {
            type: 'FORWARD_TEST_EVENT',
            session_id: msg.session_id || msg.data?.session_id,
            event_type: msg.event_type || msg.data?.event_type
          };
          break;
        case 'realtime_update': {
          const payload = msg.data || {};
          const eventType = payload.event_type || msg.update_type || payload.update_type;
          const sid = payload.session_id || msg.session_id;

          if (eventType === 'PORTFOLIO_UPDATE') {
            event = {
              type: 'PORTFOLIO_UPDATE',
              session_id: sid,
              portfolio: payload.data?.portfolio || payload.data || {},
              metrics: payload.session_metrics || payload.metrics
            };
          } else if (eventType === 'TRADE_EXECUTED') {
            const t = payload.data || {};
            event = {
              type: 'TRADE_EXECUTED',
              session_id: sid,
              trade: t,
              tradeId: t.trade_id || t.id,
              symbol: t.symbol,
              side: t.side || t.action,
              quantity: t.quantity,
              price: t.price,
              timestamp: payload.timestamp || t.timestamp
            };
          } else if (eventType === 'PRICE_UPDATE') {
            event = {
              type: 'PRICE_UPDATE',
              session_id: sid,
              symbol: payload.data?.symbol,
              price: payload.data?.price,
              timestamp: payload.data?.timestamp
            };
          } else {
            // Fallback passthrough for other realtime updates
            event = {
              type: 'REALTIME_UPDATE',
              session_id: sid,
              update_type: eventType,
              data: payload
            };
          }
          break;
        }
        default:
          // Pass through other message types as-is
          event = msg;
      }
      
      handleWebSocketEvent(event);
    };

    // Register the single router for all message types
    webSocket.addMessageHandler(MESSAGE_TYPES.PORTFOLIO_UPDATE, messageRouter);
    webSocket.addMessageHandler(MESSAGE_TYPES.TRADE_EXECUTION, messageRouter);
    webSocket.addMessageHandler(MESSAGE_TYPES.FORWARD_TEST_EVENT, messageRouter);
    webSocket.addMessageHandler(MESSAGE_TYPES.REALTIME_UPDATE, messageRouter);
    webSocket.addMessageHandler(MESSAGE_TYPES.STRATEGY_SIGNAL, messageRouter);

    return () => {
      webSocket.removeMessageHandler(MESSAGE_TYPES.PORTFOLIO_UPDATE, messageRouter);
      webSocket.removeMessageHandler(MESSAGE_TYPES.TRADE_EXECUTION, messageRouter);
      webSocket.removeMessageHandler(MESSAGE_TYPES.FORWARD_TEST_EVENT, messageRouter);
      webSocket.removeMessageHandler(MESSAGE_TYPES.REALTIME_UPDATE, messageRouter);
      webSocket.removeMessageHandler(MESSAGE_TYPES.STRATEGY_SIGNAL, messageRouter);
    };
  }, [webSocket]); // Remove handleWebSocketEvent dependency to prevent re-registration

  // Initial sessions load (once) or on first connect
  useEffect(() => {
    if (didInitialFetchRef.current) return;
    // Optionally wait for socket connection to reduce duplicate work
    if (!isConnected) return;
    didInitialFetchRef.current = true;
    checkActiveTests();
  }, [isConnected, checkActiveTests]);
  
  // (moved above) Chart data management functions

  // Session management functions
  const getSession = useCallback((sessionId: string): ForwardTestSession | null => {
    console.log('🔍 [ForwardTestingContext] getSession looking for sessionId:', sessionId);
    console.log('🔍 [ForwardTestingContext] sessions:', sessions.map(s => ({ session_id: s.session_id, status: s.status })));
    
    // Look in all sessions
    const session = sessions.find(session => session.session_id === sessionId);
    
    console.log('🔍 [ForwardTestingContext] getSession found:', session);
    return session || null;
  }, [sessions]);

  // Session-specific data access methods
  const getSessionPortfolio = useCallback((sessionId: SessionIdentifier): Portfolio | null => {
    return sessionPortfolios[sessionId] || null;
  }, [sessionPortfolios]);
  
  const getSessionMetrics = useCallback((sessionId: SessionIdentifier): Metrics | null => {
    return sessionMetrics[sessionId] || null;
  }, [sessionMetrics]);
  
  const getSessionTrades = useCallback((sessionId: SessionIdentifier): Trade[] => {
    return sessionTrades[sessionId] || [];
  }, [sessionTrades]);
  
  const getSessionAlerts = useCallback((sessionId: SessionIdentifier): Alert[] => {
    return sessionAlerts[sessionId] || [];
  }, [sessionAlerts]);
  
  const addSessionAlert = useCallback((sessionId: SessionIdentifier, type: Alert['type'], message: string) => {
    const alert = createAlert(sessionId, type, message);
    
    setSessionAlerts(prev => ({
      ...prev,
      [sessionId]: limitChartData([alert, ...(prev[sessionId] || [])], 50)
    }));
    
    // Show toast notification
    switch (type) {
      case 'SUCCESS':
        toast.success(message);
        break;
      case 'ERROR':
        toast.error(message);
        break;
      case 'WARNING':
        toast.warning(message);
        break;
      default:
        toast.info(message);
    }
    
    // Send browser notification if enabled
    sendNotification(true, `Forward Test ${type}`, message); // TODO: Get from session settings
  }, []);
  
  const createSession = useCallback(async (name: string, strategy: any, settings: ForwardTestSettings): Promise<SessionIdentifier | null> => {
    try {
      console.log('🚀 [Frontend] Creating forward test session:', { name, strategy, settings });
      console.log('🔍 [Frontend] Strategy object type:', typeof strategy, strategy);
      
      const sessionData = {
        name,
        strategy,
        settings: {
          ...settings,
          sessionName: name
        }
      };
      
      // Create session on server
      const response = await apiService.createForwardTestSession(sessionData);
      console.log('📡 [Frontend] Forward test session creation response:', response);
      
      if (response.success) {
        // Initialize empty chart data and session data for this session
        clearChartData(response.session_id);
        
        // Initialize session-specific data stores
        const initialPortfolio: Portfolio = {
          cash: settings.initialBalance || 10000,
          positions: [],
          totalValue: settings.initialBalance || 10000,
          unrealizedPnL: 0,
          realizedPnL: 0
        };
        
        const initialMetrics: Metrics = {
          total_return: 0,
          sharpe_ratio: 0,
          max_drawdown: 0,
          max_drawdown_percent: 0,
          win_rate: 0,
          total_trades: 0,
          winning_trades: 0,
          losing_trades: 0,
          current_drawdown: 0,
          total_pnl: 0,
          total_pnl_percent: 0,
        };
        
        setSessionPortfolios(prev => ({ ...prev, [response.session_id]: initialPortfolio }));
        setSessionMetrics(prev => ({ ...prev, [response.session_id]: initialMetrics }));
        setSessionTrades(prev => ({ ...prev, [response.session_id]: [] }));
        setSessionAlerts(prev => ({ ...prev, [response.session_id]: [] }));
        
        // Add to local sessions so it can be found by getSession
        const newSession: ForwardTestSession = {
          session_id: response.session_id,
          session_name: name,
          strategy_name: strategy.name,
          status: 'STOPPED',
          start_time: new Date(),
          is_active: false,
          settings: settings,
          symbol: settings.symbol || 'BTC/USD',
          timeframe: settings.timeframe, // Preserve the actual timeframe from settings
          current_portfolio_value: settings.initialBalance || 10000,
          initial_balance: settings.initialBalance || 10000,
          total_trades: 0,
          total_return: 0,
          total_pnl: 0,
          max_drawdown: 0,
          win_rate: 0
        };
        
        setSessions(prev => {
          console.log('🔄 [ForwardTestingContext] setSessions - previous sessions:', prev);
          const updated = [...prev, newSession];
          console.log('🔄 [ForwardTestingContext] setSessions - updated sessions:', updated);
          return updated;
        });
        setHasLocalSessions(true);
        console.log('✅ [Frontend] Forward test session created and added to local state with ID:', response.session_id);
        toast.success(`Created session: ${name}`);
        return response.session_id;
      } else {
        console.error('❌ [Frontend] Failed to create session:', response);
        toast.error('Failed to create session');
        return null;
      }
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session');
      return null;
    }
  }, [clearChartData]);

  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      // Stop the session first if it's running
      const session = getSession(sessionId);
      if (session && session.status !== 'STOPPED') {
        await apiService.stopForwardTest(sessionId);
      }
      
      // Delete from backend
      await apiService.deleteForwardTestSession(sessionId);
      
      // Remove session from local state immediately for responsive UI
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      
      // Clear all session data
      setSessionChartData(prev => {
        const newData = { ...prev };
        delete newData[sessionId];
        return newData;
      });
      
      setSessionPortfolios(prev => {
        const newData = { ...prev };
        delete newData[sessionId];
        return newData;
      });
      
      setSessionMetrics(prev => {
        const newData = { ...prev };
        delete newData[sessionId];
        return newData;
      });
      
      setSessionTrades(prev => {
        const newData = { ...prev };
        delete newData[sessionId];
        return newData;
      });
      
      setSessionAlerts(prev => {
        const newData = { ...prev };
        delete newData[sessionId];
        return newData;
      });
      // Remove subscription tracking
      subscribedSessionsRef.current.delete(sessionId);

      // Refresh session list from backend after successful delete
      await checkActiveTests();
      
      toast.success('Session deleted');
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  }, [getSession, checkActiveTests]);

  const startTest = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      console.log('🚀 [ForwardTestingContext] startTest called with sessionId:', sessionId);
      console.log('🚀 [ForwardTestingContext] sessions:', sessions);
      
      const session = getSession(sessionId);
      console.log('🚀 [ForwardTestingContext] getSession returned:', session);
      
      if (!session) {
        console.log('❌ [ForwardTestingContext] Session not found in sessions');
        toast.error('Session not found');
        return false;
      }

      console.log('🚀 [ForwardTestingContext] Starting forward test session:', sessionId);
      
      // For existing sessions, we use the resume endpoint if paused, or start if stopped
      if (session.status === 'PAUSED') {
        return await resumeTest(sessionId);
      }
      
      // Start the session via API
      await apiService.startForwardTestSession(sessionId);
      
      // Update local state immediately
      setSessions(prev => prev.map(s => 
        s.session_id === sessionId ? { ...s, status: 'RUNNING' as any, is_active: true } : s
      ));
      triggerSessionUpdate();
      
      try { await webSocket.subscribeToSession(sessionId); } catch {}
      subscribedSessionsRef.current.add(sessionId);
      toast.success(`Started session: ${session.session_name}`);
      return true;
    } catch (error) {
      console.error('Error starting forward test:', error);
      toast.error('Failed to start forward test');
      return false;
    }
  }, [webSocket, getSession]);

  const pauseTest = useCallback(async (sessionId: string): Promise<void> => {
    try {
      const session = getSession(sessionId);
      if (!session) {
        toast.error('Session not found');
        return;
      }

      await apiService.pauseForwardTest(sessionId);
      
      // Update local state immediately
      setSessions(prev => prev.map(s => 
        s.session_id === sessionId ? { ...s, status: 'PAUSED' as any, is_active: true } : s
      ));
      triggerSessionUpdate();
      
      // keep subscription during pause
      
      toast.success(`Paused session: ${session.session_name}`);
    } catch (error) {
      console.error('Error pausing forward test:', error);
      toast.error('Failed to pause forward test');
    }
  }, [getSession]);

  const resumeTest = useCallback(async (sessionId: string): Promise<boolean> => {    
    try {
      const session = getSession(sessionId);
      if (!session) {
        toast.error('Session not found');
        return false;
      }

      await apiService.resumeForwardTest(sessionId);
      
      // Update local state immediately
      setSessions(prev => prev.map(s => 
        s.session_id === sessionId ? { ...s, status: 'RUNNING' as any, is_active: true } : s
      ));
      triggerSessionUpdate();
      
      if (socket) {
        socket.emit('forward_test_event', {
          type: 'START_FORWARD_TEST', // Resume by starting again
          session_id: sessionId,
        });
      }
      
      toast.success(`Resumed session: ${session.session_name}`);
      return true;
    } catch (error) {
      console.error('Error resuming forward test:', error);
      toast.error('Failed to resume forward test');
      return false;
    }
  }, [socket, getSession]);

  const stopTest = useCallback(async (sessionId: string): Promise<void> => {
    try {
      const session = getSession(sessionId);
      if (!session) {
        toast.error('Session not found');
        return;
      }

      await apiService.stopForwardTest(sessionId);
      
      // Update local state immediately
      setSessions(prev => prev.map(s => 
        s.session_id === sessionId ? { ...s, status: 'STOPPED' as any, is_active: false } : s
      ));
      triggerSessionUpdate();
      
      try { await webSocket.unsubscribeFromSession(sessionId); } catch {}
      subscribedSessionsRef.current.delete(sessionId);
      
      toast.success(`Stopped session: ${session.session_name}`);
    } catch (error) {
      console.error('Error stopping forward test:', error);
      toast.error('Failed to stop forward test');
    }
  }, [webSocket, getSession]);

  const updateSessionStatus = useCallback(async (sessionId: string, status: string, portfolio?: any, metrics?: any) => {
    try {
      console.log(`🔄 [ForwardTestingContext] Updating session ${sessionId} status to ${status}`);
      
      const response = await apiService.updateSessionStatus(sessionId, status, portfolio, metrics);
      
      if (response.success) {
        // Update local session status
        setSessions(prev => prev.map(session => 
          session.session_id === sessionId 
            ? { ...session, status: status as any, is_active: ['RUNNING', 'PAUSED'].includes(status) }
            : session
        ));
        triggerSessionUpdate();

        console.log(`✅ [ForwardTestingContext] Updated session ${sessionId} status to ${status}`);
        toast.success(`Session status updated to ${status}`);
      } else {
        throw new Error('Failed to update session status');
      }
    } catch (error) {
      console.error('Error updating session status:', error);
      toast.error('Failed to update session status');
    }
  }, []);

  const restoreSession = useCallback((sessionData: any) => {
    if (sessionData.session) {
      const sessionId = sessionData.session.session_id;

      const restoredSession: ForwardTestSession = {
        session_id: sessionId,
        session_name: sessionData.session.session_name || sessionData.session.name || `${sessionData.session.strategy_name} Test`,
        strategy_name: sessionData.session.strategy_name,
        status: sessionData.session.status || 'STOPPED',
        start_time: new Date(sessionData.session.start_time),
        is_active: ['RUNNING', 'PAUSED'].includes(sessionData.session.status),
        settings: sessionData.session.settings || {},
        symbol: sessionData.session.symbol || 'BTC/USD',
        timeframe: sessionData.session.timeframe, // Don't override with default - trust backend data
        current_portfolio_value: sessionData.session.current_portfolio_value || sessionData.session.initial_balance || 10000,
        initial_balance: sessionData.session.initial_balance || 10000,
        total_trades: sessionData.session.total_trades || 0,
        total_return: sessionData.session.total_return || 0,
        total_pnl: sessionData.session.total_pnl || sessionData.session.realized_pnl || 0,
        max_drawdown: sessionData.session.max_drawdown || 0,
        win_rate: sessionData.session.win_rate || 0,
        current_price: 0,
        runtime: 0
      };
      
      console.log('🔄 [Context] Restoring session to global context:', restoredSession);
      
      // Update or add the session
      setSessions(prev => {
        const existingIndex = prev.findIndex(s => s.session_id === sessionId);
        if (existingIndex >= 0) {
          const newSessions = [...prev];
          newSessions[existingIndex] = restoredSession;
          return newSessions;
        }
        return [...prev, restoredSession];
      });
    }

    // Restore chart data to context
    if (sessionData.chart_data && sessionData.session) {
      const sessionId = sessionData.session.session_id;
      const restoredChartData: ChartData = {
        priceHistory: [],
        portfolioHistory: [],
        drawdownHistory: []
      };

      // Restore price history with sessionId
      if (sessionData.chart_data.price && Array.isArray(sessionData.chart_data.price)) {
        restoredChartData.priceHistory = sessionData.chart_data.price.map((point: any) => ({
          time: typeof point.timestamp === 'number' ? new Date(point.timestamp * 1000).toISOString() : (point.time || point.timestamp),
          sessionId,
          price: point.price,
          volume: point.volume || 100
        }));
      }

      // Restore portfolio history with sessionId
      if (sessionData.chart_data.portfolio && Array.isArray(sessionData.chart_data.portfolio)) {
        restoredChartData.portfolioHistory = sessionData.chart_data.portfolio.map((point: any) => ({
          time: typeof point.timestamp === 'number' ? new Date(point.timestamp * 1000).toISOString() : (point.time || point.timestamp),
          sessionId,
          value: point.value,
          return: point.return || 0
        }));
      }

      // Restore drawdown history with sessionId
      if (sessionData.chart_data.drawdown && Array.isArray(sessionData.chart_data.drawdown)) {
        restoredChartData.drawdownHistory = sessionData.chart_data.drawdown.map((point: any) => ({
          time: typeof point.timestamp === 'number' ? new Date(point.timestamp * 1000).toISOString() : (point.time || point.timestamp),
          sessionId,
          drawdown: point.drawdown || 0
        }));
      }

      console.log('📊 [Context] Restoring chart data:', {
        sessionId,
        price: restoredChartData.priceHistory.length,
        portfolio: restoredChartData.portfolioHistory.length,
        drawdown: restoredChartData.drawdownHistory.length
      });
      
      setSessionChartData(prev => ({
        ...prev,
        [sessionId]: restoredChartData
      }));
    }
    
    // Restore trades data if available
    if (sessionData.trades && Array.isArray(sessionData.trades) && sessionData.session) {
      const sessionId = sessionData.session.session_id;
      const restoredTrades: Trade[] = sessionData.trades.map((trade: any) => ({
        id: trade.id || `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        symbol: trade.symbol || 'UNKNOWN',
        side: trade.side as 'BUY' | 'SELL',
        quantity: trade.quantity || 0,
        price: trade.price || 0,
        timestamp: normalizeTimestamp(trade.timestamp || Date.now()),
        status: trade.status as 'OPEN' | 'CLOSED' || 'CLOSED',
        pnl: trade.pnl || 0
      }));
      
      console.log(`📊 [Context] Restoring ${restoredTrades.length} trades for session:`, sessionId);
      
      setSessionTrades(prev => ({
        ...prev,
        [sessionId]: restoredTrades
      }));
    }
  }, []);

  // Update ref when restoreSession changes
  useEffect(() => {
    restoreSessionRef.current = restoreSession;
  }, [restoreSession]);

  const value: ForwardTestingContextType = useMemo(() => ({
    // Multi-session state
    sessions,
    sessionPortfolios,
    sessionMetrics,
    sessionTrades,
    sessionAlerts,
    sessionChartData,
    
    // Connection state
    isConnected,
    socket,
    
    // Chart data management
    updateChartData,
    setChartData,
    clearChartData,
    
    // Session management
    createSession,
    startTest,
    pauseTest,
    resumeTest,
    stopTest,
    deleteSession,
    updateSessionStatus,
    getSession,
    restoreSession,
    
    // Session-specific data access
    getSessionPortfolio,
    getSessionMetrics,
    getSessionTrades,
    getSessionAlerts,
    addSessionAlert,
    
    // Legacy compatibility (for existing components)
    activeSession: sessions.length > 0 ? sessions.find(s => s.is_active) || sessions[0] : null,
    chartData: sessions.length > 0 && sessionChartData[sessions[0].session_id] 
      ? sessionChartData[sessions[0].session_id] 
      : { priceHistory: [], portfolioHistory: [], drawdownHistory: [] },
  }), [
    sessions,
    sessionPortfolios,
    sessionMetrics,
    sessionTrades,
    sessionAlerts,
    sessionChartData,
    sessionUpdateTrigger, // Include trigger to force updates
    isConnected,
    socket,
    updateChartData,
    setChartData,
    clearChartData,
    createSession,
    startTest,
    pauseTest,
    resumeTest,
    stopTest,
    deleteSession,
    updateSessionStatus,
    getSession,
    restoreSession,
    getSessionPortfolio,
    getSessionMetrics,
    getSessionTrades,
    getSessionAlerts,
    addSessionAlert,
  ]);

  return (
    <ForwardTestingContext.Provider value={value}>
      {children}
    </ForwardTestingContext.Provider>
  );
};
