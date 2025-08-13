import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiService } from '@/services/api';
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
  
  // Connection state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasLocalSessions, setHasLocalSessions] = useState(false);
  
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
        const sessions = response.message.sessions.map((test: any) => ({
          testId: test.session_id || test.id,
          name: test.name || `${test.strategyName} Test`,
          strategyName: test.strategyName,
          status: test.status,
          startTime: new Date(test.startTime || test.start_time),
          isActive: test.status === 'RUNNING' || test.status === 'PAUSED',
          settings: test.settings || {},
          symbol: test.symbol || 'BTC/USD',
          timeframe: test.timeframe || '1m',
          portfolioValue: test.portfolioValue || test.current_portfolio_value || test.initial_balance || 10000,
          totalTrades: test.totalTrades || test.total_trades || 0,
          pnlPercent: test.pnlPercent || test.total_return || 0,
          pnlDollar: test.pnlDollar || test.realized_pnl || 0,
          maxDrawdown: test.maxDrawdown || test.max_drawdown || 0,
          winRate: test.winRate || test.win_rate || 0,
          initialBalance : test.initialBalance || -1
        }));
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



  // Initialize socket connection when app starts
  useEffect(() => {
    // TODO: Enable Socket.IO connection when notification service is ready
    console.log('🔧 [ForwardTestingContext] Socket.IO disabled - notification service not yet implemented');
    return; // Disable Socket.IO for now
    
    const newSocket = io('http://localhost:8000', {
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: false,
      timeout: 20000,
      forceNew: true
    });
    
    newSocket.on('connect', () => {
      console.log('Global forward testing socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Global forward testing socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('forward_test_error', (data) => {
      console.error('Forward test error:', data);
      toast.error(data.error || 'Forward test error');
    });

    // Handle automatic chart data restoration from backend
    newSocket.on('chart_data_restored', (data) => {
      console.log('📊 [ForwardTestingContext] chart_data_restored event received:', data);
      
      if (data.session_id && data.chart_data) {
        // Use the existing restoreSession function to process the data
        const sessionData = {
          session: { session_id: data.session_id },
          chart_data: data.chart_data,
          trades: data.trades || []
        };
        
        console.log('📊 [ForwardTestingContext] Automatically restoring chart data for session:', data.session_id);
        // Call restoreSession (defined below) to handle the data
        // This will be available due to closure when restoreSession is defined
        setTimeout(() => {
          // Use setTimeout to ensure restoreSession is available
          restoreSessionRef.current?.(sessionData);
        }, 0);
        
        toast.success(`Chart data automatically restored for session ${data.session_id}`);
      }
    });

    // Centralized multi-session WebSocket event handling
    newSocket.on('forward_test_update', handleWebSocketEvent);
    newSocket.on('price_update', handleWebSocketEvent);
    newSocket.on('portfolio_update', handleWebSocketEvent);
    newSocket.on('trade_executed', handleWebSocketEvent);
    newSocket.on('metrics_update', handleWebSocketEvent);
    newSocket.on('portfolio_data', handleWebSocketEvent);
    newSocket.on('drawdown_data', handleWebSocketEvent);

    // Add debugging for all WebSocket events
    newSocket.onAny((eventName, ...args) => {
      console.log('🔗 [ForwardTestingContext] WebSocket event received:', eventName, args);
    });

    setSocket(newSocket);

    // Check for active sessions on startup
    checkActiveTests();

    return () => {
      newSocket.disconnect();
    };
  }, [handleWebSocketEvent, checkActiveTests]);

  
  // Individual event handlers for multi-session support
  const handlePriceUpdate = useCallback((event: PriceUpdateEvent, sessionId: SessionIdentifier) => {
    const priceData = createPriceDataPoint(
      sessionId,
      event.price,
      event.volume,
      event.symbol
    );
    updateChartData(sessionId, 'price', priceData);
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
  }, []);
  
  const handlePortfolioUpdate = useCallback((event: PortfolioUpdateEvent, sessionId: SessionIdentifier) => {
    const { portfolio, metrics } = event;
    
    // Update session portfolio
    const updatedPortfolio: Portfolio = {
      cash: portfolio.cash || 0,
      positions: [], // TODO: Parse positions from backend
      totalValue: portfolio.total_value || 0,
      unrealizedPnL: 0, // TODO: Calculate from positions
      realizedPnL: 0 // TODO: Get from backend
    };
    
    setSessionPortfolios(prev => ({
      ...prev,
      [sessionId]: updatedPortfolio
    }));
    
    // Update session metrics
    const updatedMetrics: Metrics = {
      totalReturn: metrics.return_percentage || metrics.total_return || 0,
      sharpeRatio: 0, // TODO: Calculate or get from backend
      maxDrawdown: metrics.max_drawdown || 0,
      winRate: metrics.win_rate || 0,
      totalTrades: metrics.total_trades || 0,
      currentDrawdown: metrics.current_drawdown || 0
    };
    
    setSessionMetrics(prev => ({
      ...prev,
      [sessionId]: updatedMetrics
    }));
    
    // Create portfolio chart data point
    const portfolioData = createPortfolioDataPoint(
      sessionId,
      portfolio.total_value || 0,
      portfolio.cash,
      portfolio.positions,
      metrics.return_percentage
    );
    updateChartData(sessionId, 'portfolio', portfolioData);
    
    // Update session objects
    const updateSessionInList = (sessions: ForwardTestSession[]) => 
      sessions.map(session => 
        session.testId === sessionId 
          ? {
              ...session,
              portfolioValue: portfolio.total_value || session.portfolioValue,
              totalTrades: metrics.total_trades || session.totalTrades,
              pnlPercent: metrics.return_percentage || metrics.total_return || session.pnlPercent,
              maxDrawdown: metrics.max_drawdown || session.maxDrawdown,
              winRate: metrics.win_rate || session.winRate
            }
          : session
      );
    
    //setActiveSessions(prev => updateSessionInList(prev));
    //setRecentSessions(prev => updateSessionInList(prev));
    setSessions(prev => updateSessionInList(prev));
    console.log('💼 Portfolio updated for session:', sessionId, updatedPortfolio, updatedMetrics);
  }, []);
  
  const handleMetricsUpdate = useCallback((event: any, sessionId: SessionIdentifier) => {
    const updatedMetrics: Partial<Metrics> = event.metrics || {};
    
    setSessionMetrics(prev => ({
      ...prev,
      [sessionId]: {
        ...prev[sessionId],
        ...updatedMetrics
      } as Metrics
    }));
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

  // Session management functions
  const getSession = useCallback((sessionId: string): ForwardTestSession | null => {
    console.log('🔍 [ForwardTestingContext] getSession looking for sessionId:', sessionId);
    console.log('🔍 [ForwardTestingContext] sessions:', sessions.map(s => ({ testId: s.testId, status: s.status })));
    
    // Look in all sessions
    const session = sessions.find(session => session.testId === sessionId);
    
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
          totalReturn: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          winRate: 0,
          totalTrades: 0,
          currentDrawdown: 0
        };
        
        setSessionPortfolios(prev => ({ ...prev, [response.session_id]: initialPortfolio }));
        setSessionMetrics(prev => ({ ...prev, [response.session_id]: initialMetrics }));
        setSessionTrades(prev => ({ ...prev, [response.session_id]: [] }));
        setSessionAlerts(prev => ({ ...prev, [response.session_id]: [] }));
        
        // Add to local sessions so it can be found by getSession
        const newSession: ForwardTestSession = {
          testId: response.session_id,
          name: name,
          strategyName: strategy.name,
          status: 'STOPPED',
          startTime: new Date(),
          isActive: false,
          settings: settings,
          symbol: settings.symbol || 'BTC/USD',
          timeframe: settings.timeframe || '1m',
          portfolioValue: settings.initialBalance || 10000,
          initialBalance: settings.initialBalance || 10000,
          totalTrades: 0,
          pnlPercent: 0,
          pnlDollar: 0,
          maxDrawdown: 0,
          winRate: 0
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
      
      toast.success('Session deleted');
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  }, [getSession]);

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
        s.testId === sessionId ? { ...s, status: 'RUNNING' as any, isActive: true } : s
      ));
      
      toast.success(`Started session: ${session.name}`);
      return true;
    } catch (error) {
      console.error('Error starting forward test:', error);
      toast.error('Failed to start forward test');
      return false;
    }
  }, [socket, getSession]);

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
        s.testId === sessionId ? { ...s, status: 'PAUSED' as any, isActive: true } : s
      ));
      
      if (socket) {
        socket.emit('forward_test_event', {
          type: 'PAUSE_FORWARD_TEST',
          test_id: sessionId,
        });
      }
      
      toast.success(`Paused session: ${session.name}`);
    } catch (error) {
      console.error('Error pausing forward test:', error);
      toast.error('Failed to pause forward test');
    }
  }, [socket, getSession]);

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
        s.testId === sessionId ? { ...s, status: 'RUNNING' as any, isActive: true } : s
      ));
      
      if (socket) {
        socket.emit('forward_test_event', {
          type: 'START_FORWARD_TEST', // Resume by starting again
          test_id: sessionId,
        });
      }
      
      toast.success(`Resumed session: ${session.name}`);
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
        s.testId === sessionId ? { ...s, status: 'STOPPED' as any, isActive: false } : s
      ));
      
      if (socket) {
        socket.emit('forward_test_event', {
          type: 'STOP_FORWARD_TEST',
          test_id: sessionId,
        });
      }
      
      toast.success(`Stopped session: ${session.name}`);
    } catch (error) {
      console.error('Error stopping forward test:', error);
      toast.error('Failed to stop forward test');
    }
  }, [socket, getSession]);

  const updateSessionStatus = useCallback(async (sessionId: string, status: string, portfolio?: any, metrics?: any) => {
    try {
      console.log(`🔄 [ForwardTestingContext] Updating session ${sessionId} status to ${status}`);
      
      const response = await apiService.updateSessionStatus(sessionId, status, portfolio, metrics);
      
      if (response.success) {
        // Update local session status
        setSessions(prev => prev.map(session => 
          session.testId === sessionId 
            ? { ...session, status: status as any, isActive: ['RUNNING', 'PAUSED'].includes(status) }
            : session
        ));

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
        testId: sessionId,
        name: sessionData.session.name || `${sessionData.session.strategy_name} Test`,
        strategyName: sessionData.session.strategy_name,
        status: sessionData.session.status || 'STOPPED',
        startTime: new Date(sessionData.session.start_time),
        isActive: ['RUNNING', 'PAUSED'].includes(sessionData.session.status),
        settings: sessionData.session.settings || {},
        symbol: sessionData.session.symbol || 'BTC/USD',
        timeframe: sessionData.session.timeframe || '1m',
        portfolioValue: sessionData.session.current_portfolio_value || sessionData.session.initial_balance || 10000,
        initialBalance: sessionData.session.initial_balance || 10000,
        totalTrades: sessionData.session.total_trades || 0,
        pnlPercent: sessionData.session.total_return || 0,
        pnlDollar: sessionData.session.realized_pnl || 0,
        maxDrawdown: sessionData.session.max_drawdown || 0,
        winRate: sessionData.session.win_rate || 0,
        currentPrice: 0,
        runtime: 0
      };
      
      console.log('🔄 [Context] Restoring session to global context:', restoredSession);
      
      // Update or add the session
      setSessions(prev => {
        const existingIndex = prev.findIndex(s => s.testId === sessionId);
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
    activeSession: sessions.length > 0 ? sessions.find(s => s.isActive) || sessions[0] : null,
    chartData: sessions.length > 0 && sessionChartData[sessions[0].testId] 
      ? sessionChartData[sessions[0].testId] 
      : { priceHistory: [], portfolioHistory: [], drawdownHistory: [] },
  }), [
    sessions,
    sessionPortfolios,
    sessionMetrics,
    sessionTrades,
    sessionAlerts,
    sessionChartData,
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