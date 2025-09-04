import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, BarChart, Bar } from 'recharts';
import { TrendingUp, BarChart3, Activity, Target } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { apiService } from '@/services/api';
import { useForwardTesting } from '@/contexts/ForwardTestingContext';
import type {
  Trade,
  Portfolio,
  Metrics,
  SessionIdentifier
} from '@/types/forward-testing';
import {
  formatCurrency,
  formatTime,
  normalizeTimestamp,
  limitChartData
} from '@/utils/forward-testing';

// Types now imported from shared types file

interface ChartsGridProps {
  trades: Trade[];
  portfolio: Portfolio;
  metrics: Metrics;
  currentPrice: number;
  currentVolume?: number;
  sessionId?: SessionIdentifier;
  initialBalance?: number;
}

export const ChartsGrid = ({ trades, portfolio, metrics, currentPrice, currentVolume, sessionId, initialBalance = 10000 }: ChartsGridProps) => {
  // Use context for session-specific chart data
  const { sessionChartData, updateChartData, clearChartData } = useForwardTesting();
  
  // Get chart data for this specific session
  const sessionData = sessionId ? sessionChartData[sessionId] : null;
  const { priceHistory, portfolioHistory, drawdownHistory } = sessionData || {
    priceHistory: [],
    portfolioHistory: [],
    drawdownHistory: []
  };
  
  
  const lastPriceRef = useRef<number>(0);
  const peakValueRef = useRef<number>(initialBalance);
  const [isDataRestored, setIsDataRestored] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | undefined>(undefined);
  
  // Reset restoration flag and clear data when sessionId changes
  useEffect(() => {
    if (sessionId !== lastSessionId) {
      setIsDataRestored(false);
      setLastSessionId(sessionId);
      
      // Clear existing chart data when switching sessions
      if (sessionId !== lastSessionId && lastSessionId !== undefined) {
        console.log(`🔄 Clearing chart data for session change: ${lastSessionId} → ${sessionId}`);
        clearChartData(lastSessionId);
        lastPriceRef.current = 0;
        peakValueRef.current = initialBalance; // Reset peak value
      }
    }
  }, [sessionId, lastSessionId, clearChartData]);
  
  // Update peak value when portfolio history changes (from context)
  useEffect(() => {
    if (portfolioHistory.length > 0) {
      const maxValue = Math.max(...portfolioHistory.map(p => p.value));
      peakValueRef.current = Math.max(peakValueRef.current, maxValue);
    }
  }, [portfolioHistory]);
  
  // Price updates primarily come from WebSocket via context.
  // As a fallback, if no price history exists yet, seed an initial point from currentPrice.
  useEffect(() => {
    if (!sessionId) return;
    const hasHistory = (priceHistory?.length || 0) > 0;
    if (!hasHistory && currentPrice > 0) {
      const now = new Date();
      const newEntry = {
        time: now.toISOString(),
        price: currentPrice,
        volume: currentVolume || 100,
      };
      updateChartData(sessionId, 'price', newEntry);
      lastPriceRef.current = currentPrice;
    }
  }, [currentPrice, currentVolume, sessionId, updateChartData, priceHistory]);
  
  // Portfolio and drawdown data now comes from backend WebSocket events
  // Client-side calculations removed - data flows through portfolio_data/drawdown_data events

  // Generate trade performance data from actual trades
  const generateTradePerformanceData = () => {
    return trades.slice(0, 20).map((trade, index) => {
      // Handle timestamp conversion safely
      let timestamp: string;
      try {
        if (typeof trade.timestamp === 'number') {
          // Unix timestamp (seconds) - convert to milliseconds and create Date
          timestamp = new Date(trade.timestamp * 1000).toISOString();
        } else if (trade.timestamp instanceof Date) {
          // Already a Date object
          timestamp = trade.timestamp.toISOString();
        } else if (typeof trade.timestamp === 'string') {
          // String timestamp - try to parse it
          timestamp = new Date(trade.timestamp).toISOString();
        } else {
          // Fallback to current time
          timestamp = new Date().toISOString();
        }
      } catch (error) {
        console.warn('Invalid timestamp in trade data:', trade.timestamp, error);
        timestamp = new Date().toISOString();
      }

      return {
        tradeId: index + 1,
        pnl: trade.pnl || 0,
        side: trade.side,
        timestamp,
      };
    });
  };

  // Use real-time data arrays
  const tradePerformanceData = generateTradePerformanceData();

  // formatCurrency and formatTime now imported from utils

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Live Price Chart - Continuous Moving Line */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Live Price Feed {currentPrice > 0 && <span className="text-lg font-mono">${currentPrice.toFixed(2)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {priceHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={priceHistory}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="2 2" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => new Date(value).toLocaleTimeString('en-US', { 
                      hour12: false, 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit' 
                    })}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    domain={['dataMin - 50', 'dataMax + 50']}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    width={80}
                  />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: number) => [formatCurrency(value), 'Price']}
                    contentStyle={{ 
                      backgroundColor: '#f8f9fa', 
                      border: '1px solid #dee2e6',
                      borderRadius: '4px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#0066cc" 
                    strokeWidth={2}
                    dot={false}
                    connectNulls={true}
                    animationDuration={200}
                    animationEasing="ease-in-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="text-lg mb-2">Waiting for price data...</div>
                  <div className="text-sm">Start forward testing to see live price movements</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Value Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Portfolio Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatTime}
                  domain={['dataMin', 'dataMax']}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  domain={['dataMin - 500', 'dataMax + 500']}
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: number) => [formatCurrency(value), 'Portfolio Value']}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#16a34a" 
                  fill="#16a34a" 
                  fillOpacity={0.3}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Drawdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Drawdown Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={drawdownHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatTime}
                  domain={['dataMin', 'dataMax']}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  domain={['dataMin - 1', 'dataMax + 1']}
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
                />
                <Area 
                  type="monotone" 
                  dataKey="drawdown" 
                  stroke="#dc2626" 
                  fill="#dc2626" 
                  fillOpacity={0.3}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Trade Performance Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Recent Trade P&L
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {tradePerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={tradePerformanceData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="2 2" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="tradeId" 
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Trade #', position: 'insideBottom', offset: -5, style: { fontSize: '12px' } }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value >= 0 ? `+$${value.toFixed(2)}` : `-$${Math.abs(value).toFixed(2)}`}
                    label={{ value: 'P&L', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value >= 0 ? '+' : ''}${formatCurrency(value)}`, 
                      'P&L'
                    ]}
                    labelFormatter={(label) => `Trade #${label}`}
                    contentStyle={{ 
                      backgroundColor: '#f8f9fa', 
                      border: '1px solid #dee2e6',
                      borderRadius: '4px'
                    }}
                  />
                  <Bar 
                    dataKey="pnl" 
                    radius={[2, 2, 0, 0]}
                    stroke="none"
                  >
                    {tradePerformanceData.map((entry, index) => (
                      <Bar 
                        key={`cell-${index}`} 
                        fill={entry.pnl >= 0 ? '#16a34a' : '#dc2626'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="text-lg mb-2">No trades yet</div>
                  <div className="text-sm">Trade P&L will appear here after strategy executes trades</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Volume Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Volume Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {priceHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priceHistory.slice(-20)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatTime}
                  domain={['dataMin', 'dataMax']}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  domain={[0, 'dataMax + 100']}
                  tickFormatter={(value) => value.toFixed(0)}
                />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: number) => [value.toFixed(0), 'Volume']}
                />
                <Bar 
                  dataKey="volume" 
                  fill="#8b5cf6" 
                  opacity={0.7}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="text-lg mb-2">No volume data available</div>
                  <div className="text-sm">Volume data will appear when price data is available</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
