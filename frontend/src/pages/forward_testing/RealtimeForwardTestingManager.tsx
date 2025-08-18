/**
 * Enhanced Forward Testing Manager with Real-time Updates
 * Integrates with WebSocket service for live portfolio and trade data
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Settings, 
  AlertCircle, 
  Activity, 
  Play, 
  Pause, 
  Square, 
  Trash2,
  Eye,
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { apiService, type ForwardTestSession, type PortfolioSummary, type SessionMetrics } from '@/services/api';
import { useWebSocket, useRealtimeData, MESSAGE_TYPES } from '@/hooks/useWebSocket';

interface SessionWithRealtimeData extends ForwardTestSession {
  portfolio?: PortfolioSummary;
  metrics?: SessionMetrics;
  lastUpdate?: number;
}

export default function RealtimeForwardTestingManager() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionWithRealtimeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // WebSocket connection for real-time updates
  const webSocket = useWebSocket({
    onConnect: () => {
      console.log('✅ ForwardTestingManager: Connected to WebSocket');
      setError(null);
      // Subscribe to all active sessions
      sessions.forEach(session => {
        if (session.status === 'RUNNING' || session.status === 'PAUSED') {
          webSocket.subscribeToSession(session.id);
        }
      });
    },
    onDisconnect: () => {
      console.log('⚠️ ForwardTestingManager: Disconnected from WebSocket');
    },
    onError: (err) => {
      console.error('❌ ForwardTestingManager: WebSocket error', err);
      setError(`WebSocket Error: ${err.message}`);
    }
  });

  // Handle real-time portfolio updates
  const handlePortfolioUpdate = useCallback((message: any) => {
    console.log('💰 ForwardTestingManager: Portfolio update', message);
    setSessions(prev => prev.map(session => {
      if (session.id === message.session_id) {
        return {
          ...session,
          portfolio: message.data.portfolio,
          current_capital: message.data.portfolio?.total_value,
          lastUpdate: message.timestamp
        };
      }
      return session;
    }));
  }, []);

  // Handle real-time trade executions
  const handleTradeExecution = useCallback((message: any) => {
    console.log('📈 ForwardTestingManager: Trade execution', message);
    setSessions(prev => prev.map(session => {
      if (session.id === message.session_id) {
        return {
          ...session,
          lastUpdate: message.timestamp
        };
      }
      return session;
    }));
    
    // Show toast notification for trade execution
    const trade = message.data.trade;
    if (trade) {
      toast.success(`Trade Executed: ${trade.side?.toUpperCase()} ${trade.quantity} @ $${trade.price}`, {
        description: `P&L: $${trade.pnl?.toFixed(2)}`
      });
    }
  }, []);

  // Handle session events
  const handleSessionEvent = useCallback((message: any) => {
    console.log('🎯 ForwardTestingManager: Session event', message);
    
    const eventType = message.event_type;
    const sessionId = message.session_id;
    
    switch (eventType) {
      case 'SESSION_STARTED':
        setSessions(prev => prev.map(session => 
          session.id === sessionId 
            ? { ...session, status: 'RUNNING', started_at: Date.now() }
            : session
        ));
        toast.success('Session Started');
        break;
        
      case 'SESSION_STOPPED':
        setSessions(prev => prev.map(session => 
          session.id === sessionId 
            ? { ...session, status: 'STOPPED', stopped_at: Date.now() }
            : session
        ));
        toast.info('Session Stopped');
        break;
        
      case 'SESSION_ERROR':
        setSessions(prev => prev.map(session => 
          session.id === sessionId 
            ? { ...session, status: 'ERROR' }
            : session
        ));
        toast.error(`Session Error: ${message.message || 'Unknown error'}`);
        break;
    }
  }, []);

  // Setup WebSocket message handlers
  useEffect(() => {
    webSocket.addMessageHandler(MESSAGE_TYPES.PORTFOLIO_UPDATE, handlePortfolioUpdate);
    webSocket.addMessageHandler(MESSAGE_TYPES.TRADE_EXECUTION, handleTradeExecution);
    webSocket.addMessageHandler(MESSAGE_TYPES.FORWARD_TEST_EVENT, handleSessionEvent);

    return () => {
      webSocket.removeMessageHandler(MESSAGE_TYPES.PORTFOLIO_UPDATE, handlePortfolioUpdate);
      webSocket.removeMessageHandler(MESSAGE_TYPES.TRADE_EXECUTION, handleTradeExecution);
      webSocket.removeMessageHandler(MESSAGE_TYPES.FORWARD_TEST_EVENT, handleSessionEvent);
    };
  }, [webSocket, handlePortfolioUpdate, handleTradeExecution, handleSessionEvent]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.getUserSessions();
      if (response.success && response.sessions) {
        // Load initial portfolio data for each session
        const sessionsWithData = await Promise.all(
          response.sessions.map(async (session: ForwardTestSession) => {
            try {
              // Load portfolio and metrics data
              const [portfolioResponse, metricsResponse] = await Promise.all([
                apiService.getPortfolioSummary(session.id).catch(() => null),
                apiService.getSessionMetrics(session.id).catch(() => null)
              ]);

              return {
                ...session,
                portfolio: portfolioResponse?.data,
                metrics: metricsResponse?.data,
                current_capital: portfolioResponse?.data?.total_value || session.initial_capital,
                lastUpdate: Date.now()
              };
            } catch (err) {
              console.warn(`Failed to load data for session ${session.id}:`, err);
              return session;
            }
          })
        );

        setSessions(sessionsWithData);

        // Subscribe to active sessions via WebSocket
        if (webSocket.connected) {
          sessionsWithData.forEach(session => {
            if (session.status === 'RUNNING' || session.status === 'PAUSED') {
              webSocket.subscribeToSession(session.id);
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [webSocket]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Session actions
  const handleSessionAction = async (sessionId: string, action: 'start' | 'pause' | 'stop' | 'delete') => {
    try {
      switch (action) {
        case 'start':
          await apiService.startForwardTestSession(sessionId);
          await webSocket.subscribeToSession(sessionId);
          break;
        case 'pause':
          await apiService.pauseForwardTest(sessionId);
          break;
        case 'stop':
          await apiService.stopForwardTest(sessionId);
          await webSocket.unsubscribeFromSession(sessionId);
          break;
        case 'delete':
          await apiService.deleteForwardTestSession(sessionId);
          await webSocket.unsubscribeFromSession(sessionId);
          break;
      }
      
      // Reload sessions to get updated data
      await loadSessions();
      
    } catch (err) {
      console.error(`Failed to ${action} session:`, err);
      toast.error(`Failed to ${action} session`);
    }
  };

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.symbol?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || session.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats calculations
  const stats = {
    total: sessions.length,
    running: sessions.filter(s => s.status === 'RUNNING').length,
    paused: sessions.filter(s => s.status === 'PAUSED').length,
    stopped: sessions.filter(s => s.status === 'STOPPED').length
  };

  // Connection status
  const ConnectionStatus = () => (
    <div className="flex items-center gap-2 text-sm">
      {webSocket.connected ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-green-600">Live Data Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-red-600">No Live Data</span>
        </>
      )}
    </div>
  );

  // Session card component
  const SessionCard = ({ session }: { session: SessionWithRealtimeData }) => {
    const portfolio = session.portfolio;
    const metrics = session.metrics;
    
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{session.name || 'Unnamed Session'}</CardTitle>
              <CardDescription>
                {session.symbol} • Created {new Date(session.created_at * 1000).toLocaleDateString()}
              </CardDescription>
            </div>
            <Badge variant={
              session.status === 'RUNNING' ? 'default' :
              session.status === 'PAUSED' ? 'secondary' :
              session.status === 'STOPPED' ? 'outline' : 'destructive'
            }>
              {session.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Portfolio Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Portfolio Value</div>
              <div className="text-lg font-bold">
                ${(portfolio?.total_value || session.initial_capital || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">P&L</div>
              <div className={`text-lg font-bold flex items-center gap-1 ${
                (portfolio?.total_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(portfolio?.total_pnl || 0) >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                ${(portfolio?.total_pnl || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Metrics */}
          {metrics && (
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-muted-foreground">Trades</div>
                <div className="font-medium">{metrics.total_trades}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Win Rate</div>
                <div className="font-medium">{(metrics.win_rate * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Drawdown</div>
                <div className="font-medium text-red-600">
                  {metrics.max_drawdown_percent.toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {/* Last Update */}
          {session.lastUpdate && (
            <div className="text-xs text-muted-foreground">
              Last update: {new Date(session.lastUpdate).toLocaleTimeString()}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/forward-testing/session/${session.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>

            {session.status === 'RUNNING' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSessionAction(session.id, 'pause')}
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
            ) : session.status === 'PAUSED' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSessionAction(session.id, 'start')}
              >
                <Play className="h-4 w-4 mr-1" />
                Resume
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSessionAction(session.id, 'start')}
                disabled={session.status === 'ERROR'}
              >
                <Play className="h-4 w-4 mr-1" />
                Start
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSessionAction(session.id, 'stop')}
              disabled={session.status === 'STOPPED'}
            >
              <Square className="h-4 w-4 mr-1" />
              Stop
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleSessionAction(session.id, 'delete')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading forward testing sessions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Forward Testing Manager</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of your trading strategies
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionStatus />
          <Button onClick={() => navigate('/forward-testing/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Test
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="ml-2 text-sm font-medium">Total Sessions</span>
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Play className="h-4 w-4 text-green-600" />
              <span className="ml-2 text-sm font-medium">Running</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.running}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Pause className="h-4 w-4 text-yellow-600" />
              <span className="ml-2 text-sm font-medium">Paused</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{stats.paused}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Square className="h-4 w-4 text-gray-600" />
              <span className="ml-2 text-sm font-medium">Stopped</span>
            </div>
            <div className="text-2xl font-bold text-gray-600">{stats.stopped}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 border rounded-md flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="ALL">All Status</option>
          <option value="RUNNING">Running</option>
          <option value="PAUSED">Paused</option>
          <option value="STOPPED">Stopped</option>
          <option value="ERROR">Error</option>
        </select>
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sessions found</h3>
            <p className="text-muted-foreground mb-4">
              {sessions.length === 0 
                ? 'Create your first forward testing session to start trading.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
            <Button onClick={() => navigate('/forward-testing/create')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}