/**
 * Complete Real-time Integration Example
 * Demonstrates all implemented WebSocket and API features
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Wifi, 
  Activity, 
  TrendingUp, 
  DollarSign, 
  RefreshCw,
  Play,
  Square,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

import { 
  webSocketService, 
  defaultWebSocketConfig, 
  MESSAGE_TYPES,
  type WebSocketMessage 
} from '../services/websocket';
import { useWebSocket, useRealtimeData } from '../hooks/useWebSocket';
import { 
  apiService,
  WEBSOCKET_URL,
  type ForwardTestSession,
  type PortfolioSummary,
  type SessionMetrics,
  type BacktestJobResponse
} from '../services/api';

export default function RealtimeIntegrationExample() {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sessions, setSessions] = useState<ForwardTestSession[]>([]);
  const [backtestJobs, setBacktestJobs] = useState<any[]>([]);
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [marketData, setMarketData] = useState<any[]>([]);

  // Main WebSocket connection
  const webSocket = useWebSocket({
    onConnect: () => {
      addLog('✅ Connected to WebSocket');
      toast.success('Connected to real-time updates');
    },
    onDisconnect: () => {
      addLog('⚠️ Disconnected from WebSocket');
      toast.warning('Lost real-time connection');
    },
    onError: (error) => {
      addLog(`❌ WebSocket Error: ${error.message}`);
      toast.error(`WebSocket Error: ${error.message}`);
    }
  });

  // Real-time data for selected session
  const realtimeData = useRealtimeData({
    sessionId: selectedSessionId,
    autoSubscribe: true
  });

  // Helper function to add logs
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  // Load initial data
  useEffect(() => {
    loadSessions();
    loadBacktestJobs();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await apiService.getUserSessions();
      if (response.success && response.sessions) {
        setSessions(response.sessions);
        if (response.sessions.length > 0 && !selectedSessionId) {
          setSelectedSessionId(response.sessions[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast.error('Failed to load sessions');
    }
  };

  const loadBacktestJobs = async () => {
    try {
      const response = await apiService.listBacktestJobs({ limit: 10 });
      if (response && Array.isArray(response)) {
        setBacktestJobs(response);
      }
    } catch (error) {
      console.error('Failed to load backtest jobs:', error);
    }
  };

  // WebSocket message handlers
  useEffect(() => {
    // Portfolio updates
    const handlePortfolioUpdate = (message: WebSocketMessage) => {
      addLog(`💰 Portfolio Update: Session ${message.session_id}`);
      if (message.data?.portfolio) {
        addLog(`  - Total Value: $${message.data.portfolio.total_value?.toLocaleString()}`);
        addLog(`  - P&L: $${message.data.portfolio.total_pnl?.toLocaleString()}`);
      }
    };

    // Trade executions
    const handleTradeExecution = (message: WebSocketMessage) => {
      const trade = message.data?.trade;
      if (trade) {
        addLog(`📈 Trade: ${trade.side?.toUpperCase()} ${trade.quantity} @ $${trade.price}`);
        addLog(`  - P&L: $${trade.pnl?.toFixed(2)}`);
        toast.success(`Trade Executed: ${trade.side?.toUpperCase()} ${trade.quantity}`, {
          description: `P&L: $${trade.pnl?.toFixed(2)}`
        });
      }
    };

    // Strategy signals
    const handleStrategySignal = (message: WebSocketMessage) => {
      const signal = message.data?.signal;
      if (signal) {
        addLog(`🎯 Signal: ${signal.action} (${signal.confidence || 'N/A'}% confidence)`);
      }
    };

    // Session events
    const handleSessionEvent = (message: WebSocketMessage) => {
      addLog(`🎯 Session Event: ${message.event_type} - ${message.message || 'No details'}`);
    };

    // Real-time updates
    const handleRealtimeUpdate = (message: WebSocketMessage) => {
      if (message.data?.update_type === 'price_update') {
        setMarketData(prev => [...prev.slice(-99), {
          symbol: message.data.symbol,
          price: message.data.price,
          timestamp: message.timestamp
        }]);
        addLog(`📊 Price Update: ${message.data.symbol} = $${message.data.price}`);
      }
    };

    // Add handlers
    webSocket.addMessageHandler(MESSAGE_TYPES.PORTFOLIO_UPDATE, handlePortfolioUpdate);
    webSocket.addMessageHandler(MESSAGE_TYPES.TRADE_EXECUTION, handleTradeExecution);
    webSocket.addMessageHandler(MESSAGE_TYPES.STRATEGY_SIGNAL, handleStrategySignal);
    webSocket.addMessageHandler(MESSAGE_TYPES.FORWARD_TEST_EVENT, handleSessionEvent);
    webSocket.addMessageHandler(MESSAGE_TYPES.REALTIME_UPDATE, handleRealtimeUpdate);

    return () => {
      webSocket.removeMessageHandler(MESSAGE_TYPES.PORTFOLIO_UPDATE, handlePortfolioUpdate);
      webSocket.removeMessageHandler(MESSAGE_TYPES.TRADE_EXECUTION, handleTradeExecution);
      webSocket.removeMessageHandler(MESSAGE_TYPES.STRATEGY_SIGNAL, handleStrategySignal);
      webSocket.removeMessageHandler(MESSAGE_TYPES.FORWARD_TEST_EVENT, handleSessionEvent);
      webSocket.removeMessageHandler(MESSAGE_TYPES.REALTIME_UPDATE, handleRealtimeUpdate);
    };
  }, [webSocket]);

  // API Testing Functions
  const testCreateSession = async () => {
    try {
      addLog('🔄 Testing session creation...');
      const response = await apiService.createForwardTestSession({
        name: `Test Session ${Date.now()}`,
        strategy_id: 'test-strategy-id',
        symbol: 'BTC/USD',
        initial_capital: 10000,
        description: 'Created via integration example'
      });
      
      if (response.success) {
        addLog(`✅ Session created: ${response.session_id}`);
        toast.success('Session created successfully');
        await loadSessions();
      }
    } catch (error) {
      addLog(`❌ Session creation failed: ${error}`);
      toast.error('Failed to create session');
    }
  };

  const testStartSession = async () => {
    if (!selectedSessionId) {
      toast.error('No session selected');
      return;
    }

    try {
      addLog(`🔄 Starting session ${selectedSessionId}...`);
      await apiService.startForwardTestSession(selectedSessionId);
      await webSocket.subscribeToSession(selectedSessionId);
      addLog(`✅ Session started and subscribed`);
      toast.success('Session started');
      await loadSessions();
    } catch (error) {
      addLog(`❌ Failed to start session: ${error}`);
      toast.error('Failed to start session');
    }
  };

  const testStopSession = async () => {
    if (!selectedSessionId) {
      toast.error('No session selected');
      return;
    }

    try {
      addLog(`🔄 Stopping session ${selectedSessionId}...`);
      await apiService.stopForwardTest(selectedSessionId);
      await webSocket.unsubscribeFromSession(selectedSessionId);
      addLog(`✅ Session stopped and unsubscribed`);
      toast.success('Session stopped');
      await loadSessions();
    } catch (error) {
      addLog(`❌ Failed to stop session: ${error}`);
      toast.error('Failed to stop session');
    }
  };

  const testBacktest = async () => {
    try {
      addLog('🔄 Submitting backtest job...');
      const response = await apiService.runBacktest({
        strategy_id: 'test-strategy-id',
        ticker: 'BTC/USD',
        fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString(),
        interval: '1d'
      });
      
      if (response.success) {
        addLog(`✅ Backtest job submitted: ${response.job_id}`);
        toast.success('Backtest job submitted');
        await loadBacktestJobs();
      }
    } catch (error) {
      addLog(`❌ Backtest failed: ${error}`);
      toast.error('Failed to submit backtest');
    }
  };

  const testMarketData = async () => {
    try {
      addLog('🔄 Testing market data API...');
      const response = await apiService.getLatestPrices('BTC/USD', 5);
      addLog(`✅ Retrieved ${response.count || 0} price points`);
      toast.success('Market data retrieved');
    } catch (error) {
      addLog(`❌ Market data failed: ${error}`);
      toast.error('Failed to get market data');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Real-time Integration Example</h1>
          <p className="text-muted-foreground">
            Complete demonstration of WebSocket and API integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Wifi className={`h-4 w-4 ${webSocket.connected ? 'text-green-500' : 'text-red-500'}`} />
          <span className={webSocket.connected ? 'text-green-600' : 'text-red-600'}>
            {webSocket.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Connection Info */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Information</CardTitle>
          <CardDescription>WebSocket and API status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">WebSocket URL</div>
              <div className="font-mono text-sm">{WEBSOCKET_URL}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Connection Status</div>
              <Badge variant={webSocket.connected ? 'default' : 'destructive'}>
                {webSocket.connected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Subscriptions</div>
              <div className="text-sm">{webSocket.stats.subscriptions.length} active</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="realtime">Real-time Data</TabsTrigger>
          <TabsTrigger value="backtests">Backtests</TabsTrigger>
          <TabsTrigger value="testing">API Testing</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Forward Testing Sessions</CardTitle>
              <CardDescription>Manage and monitor active sessions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No sessions found. Create one using the API testing tab.
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-4 border rounded-lg cursor-pointer ${
                      selectedSessionId === session.id ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{session.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {session.symbol} • ${session.initial_capital?.toLocaleString()}
                        </div>
                      </div>
                      <Badge variant={
                        session.status === 'RUNNING' ? 'default' :
                        session.status === 'PAUSED' ? 'secondary' : 'outline'
                      }>
                        {session.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Real-time Data Tab */}
        <TabsContent value="realtime" className="space-y-4">
          {selectedSessionId ? (
            <>
              {/* Portfolio Data */}
              {realtimeData.data.portfolio && (
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio Summary</CardTitle>
                    <CardDescription>Live portfolio data for session {selectedSessionId}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Value</div>
                        <div className="text-xl font-bold">
                          ${realtimeData.data.portfolio.total_value?.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">P&L</div>
                        <div className={`text-xl font-bold ${
                          (realtimeData.data.portfolio.total_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${realtimeData.data.portfolio.total_pnl?.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Positions</div>
                        <div className="text-xl font-bold">
                          {realtimeData.data.portfolio.position_count}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Cash Balance</div>
                        <div className="text-xl font-bold">
                          ${realtimeData.data.portfolio.cash_balance?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Trades */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Trades</CardTitle>
                  <CardDescription>Live trade executions</CardDescription>
                </CardHeader>
                <CardContent>
                  {realtimeData.data.trades.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No trades executed yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {realtimeData.data.trades.slice(0, 5).map((trade, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant={trade.side === 'buy' ? 'default' : 'destructive'}>
                              {trade.side?.toUpperCase()}
                            </Badge>
                            <span>{trade.quantity} @ ${trade.price}</span>
                          </div>
                          <div className={trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                            ${trade.pnl?.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Session</h3>
                <p className="text-muted-foreground">
                  Choose a session from the Sessions tab to view real-time data
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Backtests Tab */}
        <TabsContent value="backtests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backtest Jobs</CardTitle>
              <CardDescription>Historical strategy testing jobs</CardDescription>
            </CardHeader>
            <CardContent>
              {backtestJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No backtest jobs found. Submit one using the API testing tab.
                </div>
              ) : (
                <div className="space-y-2">
                  {backtestJobs.map((job, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">Job {job.job_id}</div>
                        <div className="text-sm text-muted-foreground">
                          {job.created_at ? new Date(job.created_at * 1000).toLocaleString() : 'Unknown date'}
                        </div>
                      </div>
                      <Badge variant={
                        job.status === 'completed' ? 'default' :
                        job.status === 'running' ? 'secondary' :
                        job.status === 'failed' ? 'destructive' : 'outline'
                      }>
                        {job.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Testing Tab */}
        <TabsContent value="testing" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Session Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={testCreateSession} className="w-full">
                  Create Test Session
                </Button>
                <Button 
                  onClick={testStartSession} 
                  disabled={!selectedSessionId}
                  variant="outline" 
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Selected Session
                </Button>
                <Button 
                  onClick={testStopSession}
                  disabled={!selectedSessionId}
                  variant="outline" 
                  className="w-full"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Selected Session
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data & Testing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={testBacktest} variant="outline" className="w-full">
                  Submit Test Backtest
                </Button>
                <Button onClick={testMarketData} variant="outline" className="w-full">
                  Test Market Data API
                </Button>
                <Button onClick={loadSessions} variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Connection Logs</CardTitle>
                  <CardDescription>Real-time WebSocket and API activity</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setConnectionLogs([])}
                >
                  Clear Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-sm bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                {connectionLogs.length === 0 ? (
                  <div className="text-muted-foreground">No logs yet...</div>
                ) : (
                  connectionLogs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}