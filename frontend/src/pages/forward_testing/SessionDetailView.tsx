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
import { ForwardTestHeader } from './components/ForwardTestHeader';

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
    sessionChartData,
    sessionTrades,
    sessionMetrics,
    sessionPortfolios,
    startTest, 
    pauseTest, 
    resumeTest, 
    stopTest,
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
    if (!sessionId) return;
    try {
      setLoading(true);
      setSessionNotFound(false);
      const res = await apiService.getForwardTestSessionDetail(sessionId);
      if (res?.success && res?.session_detail?.session) {
        const detail = res.session_detail;
        const sessionData = detail.session;
        const settings = sessionData.settings || {};

        // Use standardized field names from backend - no more field mapping needed
        setSession({
          id: sessionData.session_id || sessionId,
          name: sessionData.session_name || `${sessionData.strategy_name || 'Unknown'} Test`,
          strategyName: sessionData.strategy_name || 'Unknown Strategy',
          strategy: { name: sessionData.strategy_name || 'Unknown Strategy' },
          status: sessionData.status || 'STOPPED',
          startTime: new Date(sessionData.started_at || sessionData.created_at || Date.now()),
          symbol: sessionData.symbol || 'BTC/USD',
          timeframe: sessionData.timeframe, // Trust backend data for timeframe
          portfolioValue: parseFloat(sessionData.current_portfolio_value || sessionData.initial_balance || 10000),
          totalTrades: sessionData.total_trades || 0,
          pnlPercent: parseFloat(sessionData.total_return || 0),
          pnlDollar: parseFloat(sessionData.total_pnl || 0),
          maxDrawdown: parseFloat(sessionData.max_drawdown || 0),
          winRate: parseFloat(sessionData.win_rate || 0),
          settings: {
            initialBalance: parseFloat(sessionData.initial_balance || 10000),
            ...settings
          }
        });

        if (detail.portfolio) {
          setState(prev => ({
            ...prev,
            portfolio: {
              cash: parseFloat(detail.portfolio.cash_balance ?? prev.portfolio.cash),
              positions: detail.portfolio.positions || [],
              totalValue: parseFloat(detail.portfolio.total_value ?? prev.portfolio.totalValue),
              unrealizedPnL: parseFloat(detail.portfolio.unrealized_pnl ?? 0),
              realizedPnL: parseFloat(detail.portfolio.realized_pnl ?? 0)
            }
          }));
        }

        const m = detail.metrics || {};
        setState(prev => ({
          ...prev,
          metrics: {
            totalReturn: parseFloat(m.total_return ?? sessionData.total_return ?? 0),
            sharpeRatio: parseFloat(m.sharpe_ratio ?? sessionData.sharpe_ratio ?? 0),
            maxDrawdown: parseFloat(m.max_drawdown ?? sessionData.max_drawdown ?? 0),
            winRate: parseFloat(m.win_rate ?? sessionData.win_rate ?? 0),
            totalTrades: m.total_trades ?? sessionData.total_trades ?? 0,
            currentDrawdown: parseFloat(m.current_drawdown ?? 0)
          }
        }));

        if (Array.isArray(detail.trades)) {
          setState(prev => ({
            ...prev,
            trades: detail.trades.map((trade: any) => ({
              id: trade.trade_id || trade.id || `trade_${Date.now()}`,
              symbol: trade.symbol || 'UNKNOWN',
              side: trade.side as 'BUY' | 'SELL',
              quantity: trade.quantity || 0,
              price: trade.price || 0,
              timestamp: new Date(trade.timestamp || Date.now()),
              status: (trade.status as 'OPEN' | 'CLOSED') || 'CLOSED',
              pnl: trade.pnl || 0
            }))
          }));
        }

        setLoading(false);
      } else {
        setSessionNotFound(true);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading session detail:', error);
      setSessionNotFound(true);
      setLoading(false);
    }
  }, [sessionId]);

  // Removed legacy trade update helper (context manages trades)

  // Load session data on mount
  useEffect(() => {
    if (sessionId) {
      loadSessionFromServer();
    }
  }, [sessionId, loadSessionFromServer]);

  // Derive live data from context stores when they change
  useEffect(() => {
    if (!sessionId) return;
    // Live price/volume from chart data
    const sd = sessionChartData?.[sessionId];
    if (sd && sd.priceHistory && sd.priceHistory.length > 0) {
      const last = sd.priceHistory[sd.priceHistory.length - 1];
      setState(prev => ({
        ...prev,
        currentPrice: typeof last.price === 'number' ? last.price : prev.currentPrice,
        currentVolume: typeof last.volume === 'number' ? last.volume : prev.currentVolume,
      }));
    }
    // Portfolio/metrics updates from context
    const p = sessionPortfolios?.[sessionId];
    const m = sessionMetrics?.[sessionId];
    if (p || m) {
      setState(prev => ({
        ...prev,
        portfolio: p ? {
          cash: p.cash,
          positions: p.positions,
          totalValue: p.totalValue,
          unrealizedPnL: p.unrealizedPnL,
          realizedPnL: p.realizedPnL,
        } : prev.portfolio,
        metrics: m ? {
          totalReturn: m.totalReturn,
          sharpeRatio: m.sharpeRatio,
          maxDrawdown: m.maxDrawdown,
          winRate: m.winRate,
          totalTrades: m.totalTrades,
          currentDrawdown: m.currentDrawdown,
        } : prev.metrics,
      }));
    }
    // Trades list
    const t = sessionTrades?.[sessionId];
    if (t) {
      setState(prev => ({ ...prev, trades: t }));
    }
  }, [sessionId, sessionChartData, sessionPortfolios, sessionMetrics, sessionTrades]);

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

  // Removed legacy socket.io listeners; real-time updates come via context

  // Sync local session state with context updates and auto-populate from context data
  useEffect(() => {
    if (!sessionId) return;
    
    // Find the session in context using session_id
    const contextSession = (sessions || []).find(s => s.session_id === sessionId);
    
    if (contextSession) {
      // If no local session exists, create it from context data
      if (!session) {
        console.log(`🔄 [SessionDetail-${sessionId}] Creating session from context data`);
        setSession({
          id: contextSession.session_id,
          name: contextSession.session_name,
          strategyName: contextSession.strategy_name,
          strategy: { name: contextSession.strategy_name },
          status: contextSession.status,
          startTime: new Date(contextSession.start_time),
          symbol: contextSession.symbol,
          timeframe: contextSession.timeframe,
          portfolioValue: contextSession.current_portfolio_value,
          totalTrades: contextSession.total_trades,
          pnlPercent: contextSession.total_return,
          pnlDollar: contextSession.total_pnl,
          maxDrawdown: contextSession.max_drawdown,
          winRate: contextSession.win_rate,
          settings: contextSession.settings,
          isActive: contextSession.is_active
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
            totalValue: contextSession.current_portfolio_value,
            cash: contextSession.initial_balance || contextSession.current_portfolio_value || 10000
          },
          metrics: contextMetrics || {
            ...prev.metrics,
            totalReturn: contextSession.total_return,
            maxDrawdown: contextSession.max_drawdown,
            winRate: contextSession.win_rate,
            totalTrades: contextSession.total_trades,
            currentDrawdown: prev.metrics.currentDrawdown,
            sharpeRatio: prev.metrics.sharpeRatio
          },
          trades: contextTrades || prev.trades
        }));
        
        setLoading(false);
      } 
      // If local session exists, sync any changes from context
      else if (contextSession.status !== session.status || 
               contextSession.current_portfolio_value !== session.portfolioValue ||
               contextSession.total_trades !== session.totalTrades ||
               contextSession.total_return !== session.pnlPercent ||
               contextSession.total_pnl !== session.pnlDollar ||
               contextSession.max_drawdown !== session.maxDrawdown ||
               contextSession.win_rate !== session.winRate) {
        
        console.log(`🔄 [SessionDetail-${sessionId}] Syncing context updates to local state`);
        setSession(prev => ({
          ...prev!,
          status: contextSession.status,
          portfolioValue: contextSession.current_portfolio_value,
          totalTrades: contextSession.total_trades,
          pnlPercent: contextSession.total_return,
          pnlDollar: contextSession.total_pnl,
          maxDrawdown: contextSession.max_drawdown,
          winRate: contextSession.win_rate,
          isActive: contextSession.is_active
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
            totalValue: contextSession.current_portfolio_value
          },
          metrics: contextMetrics || {
            ...prev.metrics,
            totalReturn: contextSession.total_return,
            maxDrawdown: contextSession.max_drawdown,
            winRate: contextSession.win_rate,
            totalTrades: contextSession.total_trades,
            currentDrawdown: prev.metrics.currentDrawdown,
            sharpeRatio: prev.metrics.sharpeRatio
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
          <div className="min-w-[300px]">
            <ForwardTestHeader
              settings={{
                symbol: session.symbol,
                timeframe: session.timeframe, // ensure correct timeframe flows to header
                slippage: Number((session.settings as any)?.slippage ?? 0),
                commissionType: ((session.settings as any)?.commissionType ?? 'percentage') as 'fixed' | 'percentage',
                commission: Number((session.settings as any)?.commission ?? 0),
                soundEnabled: Boolean((session.settings as any)?.soundEnabled),
                notificationsEnabled: Boolean((session.settings as any)?.notificationsEnabled),
              }}
              currentPrice={state.currentPrice}
              tradesCount={state.trades.length}
              onToggleSound={() => {
                setSession(prev => prev ? {
                  ...prev,
                  settings: { ...prev.settings, soundEnabled: !Boolean((prev.settings as any)?.soundEnabled) }
                } : prev);
              }}
              onToggleNotifications={() => {
                setSession(prev => prev ? {
                  ...prev,
                  settings: { ...prev.settings, notificationsEnabled: !Boolean((prev.settings as any)?.notificationsEnabled) }
                } : prev);
              }}
              onExportData={handleExportData}
              onRestoreSession={() => {
                // Placeholder: could call an API to restore chart data if available
                toast.info('Restore session requested');
              }}
            />
            <p className="text-muted-foreground">
              {session.strategyName} • Started {session.startTime.toLocaleString()}
            </p>
          </div>
        </div>
        {/* Right-side controls are provided by ForwardTestHeader */}
        <div />
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
