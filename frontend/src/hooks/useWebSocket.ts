/**
 * React hook for managing WebSocket connections with the AlgoTrade backend
 * Provides real-time data updates for forward testing, portfolio tracking, and notifications
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  webSocketService, 
  defaultWebSocketConfig, 
  MESSAGE_TYPES,
  type WebSocketMessage,
  type MessageHandler,
  type ConnectionStateHandler,
  type ErrorHandler
} from '../services/websocket';
import { apiService } from '../services/api';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  reconnectOnMount?: boolean;
}

export interface WebSocketHookReturn {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribeToSession: (sessionId: string) => Promise<void>;
  unsubscribeFromSession: (sessionId: string) => Promise<void>;
  addMessageHandler: (messageType: string, handler: MessageHandler) => void;
  removeMessageHandler: (messageType: string, handler: MessageHandler) => void;
  stats: any;
}

export function useWebSocket(options: UseWebSocketOptions = {}): WebSocketHookReturn {
  const {
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
    reconnectOnMount = true
  } = options;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use refs to store handlers to avoid stale closures
  const handlersRef = useRef<Map<string, MessageHandler[]>>(new Map());
  const connectionHandlerRef = useRef<ConnectionStateHandler | null>(null);
  const errorHandlerRef = useRef<ErrorHandler | null>(null);

  // Connection state handler
  const handleConnectionState = useCallback<ConnectionStateHandler>((isConnected: boolean) => {
    console.log('🔌 useWebSocket: Connection state changed', isConnected);
    setConnected(isConnected);
    setConnecting(false);
    
    if (isConnected) {
      setError(null);
      onConnect?.();
    } else {
      onDisconnect?.();
    }
  }, [onConnect, onDisconnect]);

  // Error handler
  const handleError = useCallback<ErrorHandler>((err: Error) => {
    console.error('❌ useWebSocket: Error occurred', err);
    setError(err);
    setConnecting(false);
    onError?.(err);
  }, [onError]);

  // Connect function
  const connect = useCallback(async (): Promise<void> => {
    if (webSocketService.isConnected() || connecting) {
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      // Get auth token
      const token = localStorage.getItem('algotrade_auth_token');
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Connect to WebSocket service
      await webSocketService.connect({
        ...defaultWebSocketConfig,
        token
      });

      console.log('✅ useWebSocket: Connected successfully');
      
    } catch (err) {
      console.error('❌ useWebSocket: Connection failed', err);
      setError(err instanceof Error ? err : new Error('Connection failed'));
      setConnecting(false);
      throw err;
    }
  }, [connecting]);

  // Disconnect function
  const disconnect = useCallback((): void => {
    webSocketService.disconnect();
    setConnected(false);
    setConnecting(false);
  }, []);

  // Session subscription functions
  const subscribeToSession = useCallback(async (sessionId: string): Promise<void> => {
    console.log('📡 useWebSocket: Subscribing to session', sessionId);
    await webSocketService.subscribeToSession(sessionId);
  }, []);

  const unsubscribeFromSession = useCallback(async (sessionId: string): Promise<void> => {
    console.log('📡 useWebSocket: Unsubscribing from session', sessionId);
    await webSocketService.unsubscribeFromSession(sessionId);
  }, []);

  // Message handler management
  const addMessageHandler = useCallback((messageType: string, handler: MessageHandler): void => {
    console.log('🎯 useWebSocket: Adding message handler', messageType);
    
    // Store handler reference
    if (!handlersRef.current.has(messageType)) {
      handlersRef.current.set(messageType, []);
    }
    handlersRef.current.get(messageType)!.push(handler);
    
    // Add to WebSocket service
    webSocketService.addMessageHandler(messageType, handler);
  }, []);

  const removeMessageHandler = useCallback((messageType: string, handler: MessageHandler): void => {
    console.log('🗑️ useWebSocket: Removing message handler', messageType);
    
    // Remove handler reference
    const handlers = handlersRef.current.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
    
    // Remove from WebSocket service
    webSocketService.removeMessageHandler(messageType, handler);
  }, []);

  // Get stats
  const getStats = useCallback(() => {
    return webSocketService.getStats();
  }, []);

  // Setup connection and error handlers on mount
  useEffect(() => {
    connectionHandlerRef.current = handleConnectionState;
    errorHandlerRef.current = handleError;

    webSocketService.addConnectionStateHandler(handleConnectionState);
    webSocketService.addErrorHandler(handleError);

    return () => {
      if (connectionHandlerRef.current) {
        webSocketService.removeConnectionStateHandler(connectionHandlerRef.current);
      }
      if (errorHandlerRef.current) {
        webSocketService.removeErrorHandler(errorHandlerRef.current);
      }
    };
  }, [handleConnectionState, handleError]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && !webSocketService.isConnected()) {
      connect().catch(err => {
        console.error('❌ useWebSocket: Auto-connect failed', err);
      });
    }
  }, [autoConnect, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up message handlers
      handlersRef.current.forEach((handlers, messageType) => {
        handlers.forEach(handler => {
          webSocketService.removeMessageHandler(messageType, handler);
        });
      });
      handlersRef.current.clear();
    };
  }, []);

  return {
    connected,
    connecting,
    error,
    connect,
    disconnect,
    subscribeToSession,
    unsubscribeFromSession,
    addMessageHandler,
    removeMessageHandler,
    stats: getStats()
  };
}

// Specialized hooks for specific use cases

export interface UseRealtimeDataOptions {
  sessionId?: string;
  autoSubscribe?: boolean;
}

export interface RealtimeDataState {
  portfolio: any;
  metrics: any;
  trades: any[];
  chartData: any[];
  lastUpdate: number;
  loading: boolean;
}

/**
 * Hook for managing real-time session data updates
 */
export function useRealtimeData(options: UseRealtimeDataOptions = {}) {
  const { sessionId, autoSubscribe = true } = options;
  const webSocket = useWebSocket({ autoConnect: true });

  const [data, setData] = useState<RealtimeDataState>({
    portfolio: null,
    metrics: null,
    trades: [],
    chartData: [],
    lastUpdate: 0,
    loading: false
  });

  // Handle portfolio updates
  const handlePortfolioUpdate = useCallback((message: WebSocketMessage) => {
    const msgSessionId = message.session_id as any;
    if (msgSessionId === sessionId) {
      console.log('💰 useRealtimeData: Portfolio update received', message.data);
      setData(prev => ({
        ...prev,
        portfolio: message.data.portfolio,
        lastUpdate: message.timestamp || Date.now()
      }));
    }
  }, [sessionId]);

  // Handle trade executions
  const handleTradeExecution = useCallback((message: WebSocketMessage) => {
    const msgSessionId = message.session_id as any;
    if (msgSessionId === sessionId) {
      console.log('📈 useRealtimeData: Trade execution received', message.data);
      // Normalize trade shape (support action->side)
      const incoming = message.data?.trade || {};
      const normalizedTrade = { ...incoming, side: incoming.side || incoming.action };
      setData(prev => ({
        ...prev,
        trades: [normalizedTrade, ...prev.trades.slice(0, 99)], // Keep last 100 trades
        lastUpdate: message.timestamp || Date.now()
      }));
    }
  }, [sessionId]);

  // Handle strategy signals
  const handleStrategySignal = useCallback((message: WebSocketMessage) => {
    const msgSessionId = message.session_id as any;
    if (msgSessionId === sessionId) {
      console.log('🎯 useRealtimeData: Strategy signal received', message.data);
      // Could trigger UI notifications or charts updates
    }
  }, [sessionId]);

  // Handle real-time updates (price data, metrics)
  const handleRealtimeUpdate = useCallback((message: WebSocketMessage) => {
    const msgSessionId = message.session_id as any;
    if (msgSessionId === sessionId) {
      console.log('📊 useRealtimeData: Realtime update received', message.data);
      
      if (message.data.update_type === 'price_update') {
        // Add to chart data
        setData(prev => ({
          ...prev,
          chartData: [...prev.chartData.slice(-999), { // Keep last 1000 points
            timestamp: message.timestamp,
            price: message.data.price,
            volume: message.data.volume
          }],
          lastUpdate: message.timestamp || Date.now()
        }));
      } else if (message.data.update_type === 'metrics_update') {
        setData(prev => ({
          ...prev,
          metrics: message.data.metrics,
          lastUpdate: message.timestamp || Date.now()
        }));
      }
    }
  }, [sessionId]);

  // Subscribe to session updates
  useEffect(() => {
    if (sessionId && autoSubscribe && webSocket.connected) {
      webSocket.subscribeToSession(sessionId).catch(err => {
        console.error('❌ useRealtimeData: Failed to subscribe to session', err);
      });

      return () => {
        webSocket.unsubscribeFromSession(sessionId).catch(err => {
          console.error('❌ useRealtimeData: Failed to unsubscribe from session', err);
        });
      };
    }
  }, [sessionId, autoSubscribe, webSocket.connected]);

  // Add message handlers
  useEffect(() => {
    webSocket.addMessageHandler(MESSAGE_TYPES.PORTFOLIO_UPDATE, handlePortfolioUpdate);
    webSocket.addMessageHandler(MESSAGE_TYPES.TRADE_EXECUTION, handleTradeExecution);
    webSocket.addMessageHandler(MESSAGE_TYPES.STRATEGY_SIGNAL, handleStrategySignal);
    webSocket.addMessageHandler(MESSAGE_TYPES.REALTIME_UPDATE, handleRealtimeUpdate);

    return () => {
      webSocket.removeMessageHandler(MESSAGE_TYPES.PORTFOLIO_UPDATE, handlePortfolioUpdate);
      webSocket.removeMessageHandler(MESSAGE_TYPES.TRADE_EXECUTION, handleTradeExecution);
      webSocket.removeMessageHandler(MESSAGE_TYPES.STRATEGY_SIGNAL, handleStrategySignal);
      webSocket.removeMessageHandler(MESSAGE_TYPES.REALTIME_UPDATE, handleRealtimeUpdate);
    };
  }, [webSocket, handlePortfolioUpdate, handleTradeExecution, handleStrategySignal, handleRealtimeUpdate]);

  // Load initial data when session ID changes
  useEffect(() => {
    if (sessionId) {
      setData(prev => ({ ...prev, loading: true }));
      
      // Load initial data from API
      Promise.all([
        apiService.getPortfolioSummary(sessionId).catch(() => null),
        apiService.getSessionMetrics(sessionId).catch(() => null),
        apiService.getSessionTrades(sessionId, 50).catch(() => []),
        apiService.getSessionChartData(sessionId, 1000).catch(() => [])
      ]).then(([portfolio, metrics, trades, chartData]) => {
        setData(prev => ({
          ...prev,
          portfolio,
          metrics,
          trades: trades || [],
          chartData: chartData || [],
          loading: false,
          lastUpdate: Date.now()
        }));
      }).catch(err => {
        console.error('❌ useRealtimeData: Failed to load initial data', err);
        setData(prev => ({ ...prev, loading: false }));
      });
    }
  }, [sessionId]);

  return {
    ...webSocket,
    data,
    sessionId,
    refreshData: () => {
      if (sessionId) {
        // Trigger data refresh
        setData(prev => ({ ...prev, loading: true }));
        // Re-run the data loading effect
      }
    }
  };
}
