/**
 * Real-time Dashboard Component
 * Displays live trading data, portfolio updates, and performance metrics
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Users, 
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { useRealtimeData, useWebSocket } from '../../hooks/useWebSocket';
import { apiService, type SessionMetrics, type PortfolioSummary } from '../../services/api';

interface RealtimeDashboardProps {
  sessionId?: string;
  onSessionSelect?: (sessionId: string) => void;
}

interface ActiveSession {
  id: string;
  name: string;
  symbol: string;
  status: string;
  current_capital?: number;
  created_at: number;
}

export function RealtimeDashboard({ sessionId, onSessionSelect }: RealtimeDashboardProps) {
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>(sessionId || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection for real-time updates
  const webSocket = useWebSocket({
    onConnect: () => {
      console.log('✅ RealtimeDashboard: Connected to WebSocket');
      setError(null);
    },
    onDisconnect: () => {
      console.log('⚠️ RealtimeDashboard: Disconnected from WebSocket');
    },
    onError: (err) => {
      console.error('❌ RealtimeDashboard: WebSocket error', err);
      setError(err.message);
    }
  });

  // Real-time data for selected session
  const realtimeData = useRealtimeData({
    sessionId: selectedSession,
    autoSubscribe: true
  });

  // Load active sessions
  const loadActiveSessions = async () => {
    setLoading(true);
    try {
      const response = await apiService.getUserSessions();
      if (response.success && response.sessions) {
        const sessions = response.sessions.filter(s => s.status === 'RUNNING' || s.status === 'PAUSED');
        setActiveSessions(sessions);
        
        // Auto-select first session if none selected
        if (!selectedSession && sessions.length > 0) {
          setSelectedSession(sessions[0].id);
          onSessionSelect?.(sessions[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load active sessions', err);
      setError('Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  };

  // Load sessions on mount
  useEffect(() => {
    loadActiveSessions();
  }, []);

  // Handle session selection
  const handleSessionSelect = (sessionId: string) => {
    setSelectedSession(sessionId);
    onSessionSelect?.(sessionId);
  };

  // Memoized metrics calculations
  const portfolioMetrics = useMemo(() => {
    const portfolio: PortfolioSummary = realtimeData.data.portfolio;
    const metrics: SessionMetrics = realtimeData.data.metrics;
    
    if (!portfolio && !metrics) {
      return null;
    }

    return {
      totalValue: portfolio?.total_value || 0,
      totalPnL: portfolio?.total_pnl || 0,
      totalPnLPercent: portfolio?.total_pnl_percent || 0,
      cashBalance: portfolio?.cash_balance || 0,
      positionCount: portfolio?.position_count || 0,
      winRate: metrics?.win_rate || 0,
      totalTrades: metrics?.total_trades || 0,
      maxDrawdown: metrics?.max_drawdown_percent || 0,
      lastUpdate: realtimeData.data.lastUpdate
    };
  }, [realtimeData.data]);

  // Connection status indicator
  const ConnectionStatus = () => (
    <div className="flex items-center gap-2 text-sm">
      {webSocket.connected ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-green-600">Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-red-600">Disconnected</span>
        </>
      )}
      {webSocket.connecting && (
        <RefreshCw className="h-4 w-4 animate-spin text-yellow-500" />
      )}
    </div>
  );

  // Session selector
  const SessionSelector = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Active Sessions</CardTitle>
          <Button variant="outline" size="sm" onClick={loadActiveSessions}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activeSessions.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No active sessions found
          </div>
        ) : (
          <div className="space-y-2">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedSession === session.id
                    ? 'bg-blue-50 border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleSessionSelect(session.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{session.name}</div>
                    <div className="text-sm text-gray-500">
                      {session.symbol} • {session.status}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      ${(session.current_capital || 0).toLocaleString()}
                    </div>
                    <Badge
                      variant={session.status === 'RUNNING' ? 'default' : 'secondary'}
                    >
                      {session.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Portfolio summary cards
  const PortfolioCards = () => {
    if (!portfolioMetrics) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="ml-2 text-sm font-medium">Total Value</span>
            </div>
            <div className="text-2xl font-bold">
              ${portfolioMetrics.totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Cash: ${portfolioMetrics.cashBalance.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              {portfolioMetrics.totalPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className="ml-2 text-sm font-medium">P&L</span>
            </div>
            <div className={`text-2xl font-bold ${
              portfolioMetrics.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ${portfolioMetrics.totalPnL.toLocaleString()}
            </div>
            <p className={`text-xs ${
              portfolioMetrics.totalPnLPercent >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {portfolioMetrics.totalPnLPercent >= 0 ? '+' : ''}
              {portfolioMetrics.totalPnLPercent.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="ml-2 text-sm font-medium">Trades</span>
            </div>
            <div className="text-2xl font-bold">
              {portfolioMetrics.totalTrades}
            </div>
            <p className="text-xs text-muted-foreground">
              Win Rate: {(portfolioMetrics.winRate * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="ml-2 text-sm font-medium">Positions</span>
            </div>
            <div className="text-2xl font-bold">
              {portfolioMetrics.positionCount}
            </div>
            <p className="text-xs text-red-600">
              Max DD: {portfolioMetrics.maxDrawdown.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Recent trades list
  const RecentTrades = () => {
    const trades = realtimeData.data.trades;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
          <CardDescription>
            Latest trade executions • Last update: {
              realtimeData.data.lastUpdate 
                ? new Date(realtimeData.data.lastUpdate).toLocaleTimeString()
                : 'Never'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No trades executed yet
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {trades.slice(0, 10).map((trade, index) => (
                <div
                  key={trade.trade_id || index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={trade.side === 'buy' ? 'default' : 'destructive'}
                    >
                      {trade.side?.toUpperCase()}
                    </Badge>
                    <span className="text-sm">
                      {trade.quantity} @ ${trade.price}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${trade.pnl?.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(trade.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Real-time Dashboard</h1>
          <p className="text-muted-foreground">
            Live trading performance and portfolio updates
          </p>
        </div>
        <ConnectionStatus />
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session Selector */}
        <div className="lg:col-span-1">
          <SessionSelector />
        </div>

        {/* Main Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          {selectedSession ? (
            <>
              {/* Portfolio Metrics */}
              <PortfolioCards />

              {/* Tabs for detailed views */}
              <Tabs defaultValue="trades" className="w-full">
                <TabsList>
                  <TabsTrigger value="trades">Recent Trades</TabsTrigger>
                  <TabsTrigger value="positions">Positions</TabsTrigger>
                  <TabsTrigger value="chart">Chart</TabsTrigger>
                </TabsList>
                
                <TabsContent value="trades">
                  <RecentTrades />
                </TabsContent>
                
                <TabsContent value="positions">
                  <Card>
                    <CardHeader>
                      <CardTitle>Current Positions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-4 text-gray-500">
                        Position details coming soon
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="chart">
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Chart</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-4 text-gray-500">
                        Real-time chart coming soon
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Session</h3>
                <p className="text-gray-500">
                  Choose an active trading session to view real-time data
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}