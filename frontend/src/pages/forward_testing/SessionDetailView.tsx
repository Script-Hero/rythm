import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronLeft,
  Settings,
  Download,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useForwardTesting } from '@/contexts/ForwardTestingContext';
import { apiService } from '@/services/api';

// Import existing components
import { StrategyControlPanel } from './components/StrategyControlPanel';
import { LiveMetricsDashboard } from './components/LiveMetricsDashboard';
import { ChartsGrid } from './components/ChartsGrid';
import { TradeAlerts } from './components/TradeAlerts';
import { PerformanceStats } from './components/PerformanceStats';

interface SessionDetailState {
  currentPrice: number;
  currentVolume: number;
  portfolio: {
    cash: number;
    positions: Array<{
      symbol: string;
      quantity: number;
      avgPrice: number;
      currentValue: number;
    }>;
    totalValue: number;
    unrealizedPnL: number;
    realizedPnL: number;
  };
  metrics: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    currentDrawdown: number;
  };
  trades: Array<{
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    timestamp: Date | string | number;
    pnl?: number;
    status: 'OPEN' | 'CLOSED';
  }>;
  alerts: Array<{
    id: string;
    type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
    message: string;
    timestamp: Date | string | number;
  }>;
}

const SessionDetailView = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { 
    sessions,
    startTest, 
    pauseTest, 
    resumeTest, 
    stopTest,
    socket: globalSocket,
    updateChartData,
    getSessionPortfolio,
    getSessionMetrics,
    getSessionTrades,
    getSessionAlerts
  } = useForwardTesting();

  const [session, setSession] = useState<{
    id: string;
    name: string;
    strategyName: string;
    strategy: { name: string };
    status: string;
    startTime: Date;
    symbol: string;
    timeframe: string;
    portfolioValue: number;
    totalTrades: number;
    pnlPercent: number;
    pnlDollar: number;
    maxDrawdown: number;
    winRate: number;
    settings: Record<string, unknown>;
    isActive?: boolean;
  } | null>(null);
  const [state, setState] = useState<SessionDetailState>({
    currentPrice: 0,
    currentVolume: 100,
    portfolio: {
      cash: 10000,
      positions: [],
      totalValue: 10000,
      unrealizedPnL: 0,
      realizedPnL: 0,
    },
    metrics: {
      totalReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      totalTrades: 0,
      currentDrawdown: 0,
    },
    trades: [],
    alerts: [],
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [sessionNotFound, setSessionNotFound] = useState(false);

  // Helper functions
  const addAlert = useCallback((type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS', message: string) => {
    console.log(`Alert: ${type} - ${message}`);
  }, []);

  const loadSessionFromServer = useCallback(async () => {
    if (!sessionId || !globalSocket) return;
    
    try {
      setLoading(true);
      setSessionNotFound(false);
      
      // Set up one-time listener for session detail response
      const handleSessionDetailResponse = (data: any) => {
        if (data.test_id === sessionId) {
          globalSocket.off('session_detail_response', handleSessionDetailResponse);
          
          if (data.success && data.session_detail) {
            const detail = data.session_detail;
            const sessionData = detail.session;
            const settings = sessionData.settings || {};
            
            // Set session data from the comprehensive response
            setSession({
              id: sessionData.id || sessionId,
              name: settings.sessionName || sessionData.name || `${sessionData.strategy?.name || 'Unknown'} Test`,
              strategyName: sessionData.strategy?.name || 'Unknown Strategy',
              strategy: sessionData.strategy || { name: 'Unknown Strategy' },
              status: sessionData.status || 'STOPPED',
              startTime: new Date(sessionData.start_time || Date.now()),
              symbol: sessionData.symbol || 'BTC/USD',
              timeframe: settings.timeframe || '1m',
              portfolioValue: sessionData.portfolioValue || settings.initialBalance || 10000,
              totalTrades: (detail.trades || []).length,
              pnlPercent: 0, // Will be updated from metrics
              pnlDollar: 0,  // Will be updated from metrics
              maxDrawdown: 0, // Will be updated from metrics  
              winRate: 0,    // Will be updated from metrics
              settings: settings
            });

            // Set portfolio and metrics data
            if (detail.portfolio) {
              setState(prev => ({
                ...prev,
                portfolio: {
                  cash: detail.portfolio.cash || prev.portfolio.cash,
                  positions: detail.portfolio.positions || [],
                  totalValue: detail.portfolio.totalValue || prev.portfolio.totalValue,
                  unrealizedPnL: detail.portfolio.unrealizedPnL || 0,
                  realizedPnL: detail.portfolio.realizedPnL || 0
                }
              }));
            }

            if (detail.metrics) {
              setState(prev => ({
                ...prev,
                metrics: {
                  totalReturn: detail.metrics.totalReturn || 0,
                  sharpeRatio: detail.metrics.sharpeRatio || 0,
                  maxDrawdown: detail.metrics.maxDrawdown || 0,
                  winRate: detail.metrics.winRate || 0,
                  totalTrades: detail.metrics.totalTrades || (detail.trades || []).length,
                  currentDrawdown: detail.metrics.currentDrawdown || 0
                }
              }));
            }

            // Set trades data
            if (detail.trades && Array.isArray(detail.trades)) {
              setState(prev => ({
                ...prev,
                trades: detail.trades.map((trade: any) => ({
                  id: trade.id || `trade_${Date.now()}`,
                  symbol: trade.symbol || 'UNKNOWN',
                  side: trade.side as 'BUY' | 'SELL',
                  quantity: trade.quantity || 0,
                  price: trade.price || 0,
                  timestamp: new Date(trade.timestamp || Date.now()),
                  status: trade.status as 'OPEN' | 'CLOSED',
                  pnl: trade.pnl || 0
                }))
              }));
            }
            
          } else {
            // Session not found or error
            console.warn('Session detail not found via WebSocket:', data.error);
            setSessionNotFound(true);
            setSession({
              id: sessionId,
              name: 'Session Not Found',
              strategyName: 'Unknown Strategy',
              strategy: { name: 'Unknown Strategy' },
              status: 'STOPPED',
              startTime: new Date(),
              symbol: 'BTC/USD',
              timeframe: '1m',
              portfolioValue: 10000,
              totalTrades: 0,
              pnlPercent: 0,
              pnlDollar: 0,
              maxDrawdown: 0,
              winRate: 0,
              settings: {}
            });
          }
          
          setLoading(false);
        }
      };
      
      // Add timeout for the WebSocket request
      const timeout = setTimeout(() => {
        globalSocket.off('session_detail_response', handleSessionDetailResponse);
        console.error('WebSocket session detail request timed out');
        setSessionNotFound(true);
        setLoading(false);
      }, 5000);
      
      // Set up listener and send request
      globalSocket.on('session_detail_response', handleSessionDetailResponse);
      
      // Request session detail via WebSocket
      globalSocket.emit('forward_test_event', {
        type: 'GET_SESSION_DETAIL',
        test_id: sessionId
      });
      
      // Clear timeout when response is received
      globalSocket.on('session_detail_response', () => {
        clearTimeout(timeout);
      });
      
    } catch (error) {
      console.error('Error requesting session detail via WebSocket:', error);
      setSessionNotFound(true);
      setLoading(false);
    }
  }, [sessionId, globalSocket]);

  const handleTradeUpdate = (data: Record<string, unknown>) => {
    console.log('📡 [SessionDetailView] handleTradeUpdate called with:', data);
    
    // Handle individual trade format (backend sends single trade events)
    const formattedTrade = {
      id: (data.tradeId as string) || (data.id as string) || `trade_${Date.now()}`,
      symbol: (data.symbol as string) || 'UNKNOWN',
      side: data.side as 'BUY' | 'SELL',
      quantity: (data.quantity as number) || 0,
      price: (data.price as number) || 0,
      timestamp: new Date((data.timestamp as string) || Date.now()),
      status: (data.status as 'OPEN' | 'CLOSED') || 'CLOSED',
      pnl: (data.pnl as number) || 0
    };
    
    console.log('📡 [SessionDetailView] Formatted trade:', formattedTrade);
    
    setState(prev => ({ 
      ...prev, 
      trades: [formattedTrade, ...prev.trades].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    }));
  };

  // Load session data on mount
  useEffect(() => {
    if (sessionId) {
      loadSessionFromServer();
    }
  }, [sessionId, loadSessionFromServer]);

  // Initialize portfolio state when session is loaded
  useEffect(() => {
    if (session?.settings?.initialBalance) {
      const initialBalance = session.settings.initialBalance;
      setState(prev => ({
        ...prev,
        portfolio: {
          ...prev.portfolio,
          cash: initialBalance,
          totalValue: initialBalance
        }
      }));
      
    }
  }, [session?.settings?.initialBalance]);

  // Listen to WebSocket events for this specific session
  useEffect(() => {
    if (globalSocket && sessionId) {
      const handleWebSocketMessage = (data: Record<string, unknown>) => {
        // Only process messages for this session
        if (data.id !== sessionId && data.session_id !== sessionId) {
          return;
        }

        console.log(`📡 [SessionDetail-${sessionId}] WebSocket message:`, data);
        
        switch (data.type) {
          case 'PRICE_UPDATE':
            setState(prev => ({ 
              ...prev, 
              currentPrice: data.price as number,
              currentVolume: (data.volume as number) || 100  // Store volume for charts
            }));
            break;
          
          case 'PORTFOLIO_DATA': {
            // Update chart data directly via context
            const portfolioPoint = {
              time: new Date((data.timestamp as number) * 1000).toISOString(),
              value: data.value as number,
              return: data.return as number
            };
            updateChartData(sessionId, 'portfolio', portfolioPoint);
            break;
          }
          
          case 'DRAWDOWN_DATA': {
            // Update chart data directly via context
            const drawdownPoint = {
              time: new Date((data.timestamp as number) * 1000).toISOString(),
              drawdown: data.drawdown as number
            };
            updateChartData(sessionId, 'drawdown', drawdownPoint);
            break;
          }
          
          case 'TRADE_EXECUTED':
            handleTradeUpdate(data);
            break;

          case 'PORTFOLIO_UPDATE':
            setState(prev => ({
              ...prev,
              portfolio: { ...prev.portfolio, ...data.portfolio },
            }));
            break;

          case 'METRICS_UPDATE':
            setState(prev => ({
              ...prev,
              metrics: { ...prev.metrics, ...data.metrics },
            }));
            break;

          case 'ERROR':
            addAlert('ERROR', data.message as string);
            break;
        }
      };

      globalSocket.on('price_update', handleWebSocketMessage);
      globalSocket.on('portfolio_data', handleWebSocketMessage);
      globalSocket.on('drawdown_data', handleWebSocketMessage);
      globalSocket.on('trade_executed', handleWebSocketMessage);
      globalSocket.on('portfolio_update', handleWebSocketMessage);
      globalSocket.on('metrics_update', handleWebSocketMessage);
      globalSocket.on('forward_test_error', handleWebSocketMessage);

      return () => {
        globalSocket.off('price_update', handleWebSocketMessage);
        globalSocket.off('portfolio_data', handleWebSocketMessage);
        globalSocket.off('drawdown_data', handleWebSocketMessage);
        globalSocket.off('trade_executed', handleWebSocketMessage);
        globalSocket.off('portfolio_update', handleWebSocketMessage);
        globalSocket.off('metrics_update', handleWebSocketMessage);
        globalSocket.off('forward_test_error', handleWebSocketMessage);
      };
    }
  }, [globalSocket, sessionId, updateChartData, addAlert]);

  // Sync local session state with context updates and auto-populate from context data
  useEffect(() => {
    if (!sessionId) return;
    
    // Find the session in context
    const contextSession = (sessions || []).find(s => s.testId === sessionId);
    
    if (contextSession) {
      // If no local session exists, create it from context data
      if (!session) {
        console.log(`🔄 [SessionDetail-${sessionId}] Creating session from context data`);
        setSession({
          id: contextSession.testId,
          name: contextSession.name,
          strategyName: contextSession.strategyName,
          strategy: { name: contextSession.strategyName },
          status: contextSession.status,
          startTime: contextSession.startTime,
          symbol: contextSession.symbol,
          timeframe: contextSession.timeframe,
          portfolioValue: contextSession.portfolioValue,
          totalTrades: contextSession.totalTrades,
          pnlPercent: contextSession.pnlPercent,
          pnlDollar: contextSession.pnlDollar,
          maxDrawdown: contextSession.maxDrawdown,
          winRate: contextSession.winRate,
          settings: contextSession.settings,
          isActive: contextSession.isActive
        });
        
        // Get additional data from context stores
        const contextPortfolio = getSessionPortfolio(sessionId);
        const contextMetrics = getSessionMetrics(sessionId);
        const contextTrades = getSessionTrades(sessionId);
        
        // Set initial state from context data
        setState(prev => ({
          ...prev,
          portfolio: contextPortfolio || {
            ...prev.portfolio,
            totalValue: contextSession.portfolioValue,
            cash: contextSession.initialBalance || contextSession.portfolioValue || 10000
          },
          metrics: contextMetrics || {
            ...prev.metrics,
            totalReturn: contextSession.pnlPercent,
            maxDrawdown: contextSession.maxDrawdown,
            winRate: contextSession.winRate,
            totalTrades: contextSession.totalTrades
          },
          trades: contextTrades || prev.trades
        }));
        
        setLoading(false);
      } 
      // If local session exists, sync any changes from context
      else if (contextSession.status !== session.status || 
               contextSession.portfolioValue !== session.portfolioValue ||
               contextSession.totalTrades !== session.totalTrades ||
               contextSession.pnlPercent !== session.pnlPercent ||
               contextSession.pnlDollar !== session.pnlDollar ||
               contextSession.maxDrawdown !== session.maxDrawdown ||
               contextSession.winRate !== session.winRate) {
        
        console.log(`🔄 [SessionDetail-${sessionId}] Syncing context updates to local state`);
        setSession(prev => ({
          ...prev!,
          status: contextSession.status,
          portfolioValue: contextSession.portfolioValue,
          totalTrades: contextSession.totalTrades,
          pnlPercent: contextSession.pnlPercent,
          pnlDollar: contextSession.pnlDollar,
          maxDrawdown: contextSession.maxDrawdown,
          winRate: contextSession.winRate,
          isActive: contextSession.isActive
        }));
        
        // Get updated data from context stores
        const contextPortfolio = getSessionPortfolio(sessionId);
        const contextMetrics = getSessionMetrics(sessionId);
        const contextTrades = getSessionTrades(sessionId);
        
        // Update state with context data
        setState(prev => ({
          ...prev,
          portfolio: contextPortfolio || {
            ...prev.portfolio,
            totalValue: contextSession.portfolioValue
          },
          metrics: contextMetrics || {
            ...prev.metrics,
            totalReturn: contextSession.pnlPercent,
            maxDrawdown: contextSession.maxDrawdown,
            winRate: contextSession.winRate,
            totalTrades: contextSession.totalTrades
          },
          trades: contextTrades || prev.trades
        }));
      }
    }
  }, [sessions, sessionId, session, getSessionPortfolio, getSessionMetrics, getSessionTrades]);

  const handlePlay = async () => {
    if (sessionId) {
      const success = await startTest(sessionId);
      if (success) {
        addAlert('INFO', 'Forward testing started');
      }
    }
  };

  const handlePauseResume = async () => {
    if (!sessionId) return;
    
    if (session?.status === 'PAUSED') {
      await resumeTest(sessionId);
      addAlert('INFO', 'Forward testing resumed');
    } else {
      await pauseTest(sessionId);
      addAlert('INFO', 'Forward testing paused');
    }
  };

  const handleStop = async () => {
    if (sessionId) {
      await stopTest(sessionId);
      addAlert('INFO', 'Forward testing stopped - data preserved for analysis');
    }
  };

  const handleExportData = () => {
    const exportData = {
      sessionId: sessionId,
      sessionName: session?.name,
      strategy: session?.strategyName,
      startTime: state.trades[state.trades.length - 1]?.timestamp,
      endTime: state.trades[0]?.timestamp,
      trades: state.trades,
      finalMetrics: state.metrics,
      finalPortfolio: state.portfolio,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forward-test-${session?.name}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Data exported successfully');
  };

  if (sessionNotFound) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/forward-testing')}
            className="mr-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Sessions
          </Button>
        </div>
        
        <Card className="p-12">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Session Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The requested forward testing session could not be found.
            </p>
            <Button onClick={() => navigate('/forward-testing')}>
              Return to Sessions
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (loading || !session) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading session data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/forward-testing')}
            className="mr-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Sessions
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{session.name}</h1>
              <Badge 
                variant={session.status === 'RUNNING' ? 'default' : 'secondary'}
                className={
                  session.status === 'RUNNING' ? 'bg-green-100 text-green-800' :
                  session.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }
              >
                {session.status}
              </Badge>
              <Badge variant="outline" className="text-sm">
                {session.symbol} • {session.timeframe}
              </Badge>
              {state.currentPrice > 0 && (
                <Badge variant="outline" className="text-sm">
                  ${state.currentPrice.toFixed(2)}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {session.strategyName} • Started {session.startTime.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportData}
            disabled={state.trades.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Control Panel */}
      <StrategyControlPanel
        selectedStrategy={session.strategy}
        isRunning={session.status === 'RUNNING'}
        isPaused={session.status === 'PAUSED'}
        onSelectStrategy={() => {}} // Disabled in session view
        onPlay={handlePlay}
        onPauseResume={handlePauseResume}
        onStop={handleStop}
      />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="trades">Trades</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <LiveMetricsDashboard
                portfolio={state.portfolio}
                metrics={state.metrics}
                currentPrice={state.currentPrice}
                initialBalance={session?.settings?.initialBalance || 10000}
              />
            </div>
            <div className="space-y-6">
              <PerformanceStats metrics={state.metrics} />
              
              {/* Session Settings Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Session Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Symbol:</div>
                    <div className="font-mono">{session.symbol}</div>
                    
                    <div className="text-muted-foreground">Timeframe:</div>
                    <div className="font-mono">{session.timeframe}</div>
                    
                    <div className="text-muted-foreground">Initial Balance:</div>
                    <div className="font-mono">${session.portfolioValue.toLocaleString()}</div>
                    
                    <div className="text-muted-foreground">Total Trades:</div>
                    <div className="font-mono">{session.totalTrades}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="charts">
          <ChartsGrid
            trades={state.trades}
            portfolio={state.portfolio}
            metrics={state.metrics}
            currentPrice={state.currentPrice}
            currentVolume={state.currentVolume}
            sessionId={sessionId}
            initialBalance={session?.settings?.initialBalance || 10000}
          />
        </TabsContent>

        <TabsContent value="trades">
          <TradeAlerts trades={state.trades} />
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {state.alerts.map((alert) => (
                    <Alert key={alert.id} className={`
                      ${alert.type === 'ERROR' ? 'border-red-200 bg-red-50' : ''}
                      ${alert.type === 'WARNING' ? 'border-yellow-200 bg-yellow-50' : ''}
                      ${alert.type === 'SUCCESS' ? 'border-green-200 bg-green-50' : ''}
                    `}>
                      <AlertDescription className="flex justify-between">
                        <span>{alert.message}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SessionDetailView;