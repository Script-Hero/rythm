import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, DollarSign, Activity, Target } from 'lucide-react';
import type { Portfolio, Metrics } from '@/types/forward-testing';
import { formatCurrency, formatPercentage } from '@/utils/forward-testing';

// Types now imported from shared types file

interface LiveMetricsDashboardProps {
  portfolio: Portfolio;
  metrics: Metrics;
  currentPrice: number;
  initialBalance?: number;
}

export const LiveMetricsDashboard = ({ portfolio, metrics, currentPrice, initialBalance = 10000 }: LiveMetricsDashboardProps) => {
  const totalPnL = portfolio.unrealizedPnL + portfolio.realizedPnL;
  const pnlPercentage = ((portfolio.totalValue - initialBalance) / initialBalance) * 100;

  // formatCurrency and formatPercentage now imported from utils

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Portfolio Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Total Value</div>
              <div className="text-2xl font-bold">
                {formatCurrency(portfolio.totalValue)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Cash</div>
              <div className="text-xl font-semibold">
                {formatCurrency(portfolio.cash)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Total P&L</div>
              <div className={`text-xl font-semibold flex items-center gap-1 ${
                totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {totalPnL >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {formatCurrency(totalPnL)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Return %</div>
              <div className={`text-xl font-semibold ${
                pnlPercentage >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatPercentage(pnlPercentage)}
              </div>
            </div>
          </div>

          {/* Current Positions */}
          {portfolio.positions.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">Current Positions</h4>
              <div className="space-y-2">
                {portfolio.positions.map((position, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{position.symbol}</span>
                      <span className="text-sm text-muted-foreground">
                        {position.quantity} shares @ {formatCurrency(position.avgPrice)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(position.currentValue)}</div>
                      <div className={`text-sm ${
                        position.currentValue >= position.quantity * position.avgPrice
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(position.currentValue - (position.quantity * position.avgPrice))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
                <span className="font-medium">{metrics.sharpeRatio.toFixed(2)}</span>
              </div>
              <Progress 
                value={Math.min(Math.max((metrics.sharpeRatio + 2) * 25, 0), 100)} 
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Win Rate</span>
                <span className="font-medium">{formatPercentage(metrics.winRate)}</span>
              </div>
              <Progress value={metrics.winRate} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Max Drawdown</span>
                <span className={`font-medium ${metrics.maxDrawdown < -5 ? 'text-red-600' : 'text-yellow-600'}`}>
                  {formatPercentage(metrics.maxDrawdown)}
                </span>
              </div>
              <Progress 
                value={Math.abs(metrics.maxDrawdown)} 
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Drawdown</span>
                <span className={`font-medium ${metrics.currentDrawdown < -3 ? 'text-red-600' : 'text-gray-600'}`}>
                  {formatPercentage(metrics.currentDrawdown)}
                </span>
              </div>
              <Progress 
                value={Math.abs(metrics.currentDrawdown)} 
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Trades</span>
                <span className="font-medium">{metrics.totalTrades}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Price</span>
                <span className="font-medium">{formatCurrency(currentPrice)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};