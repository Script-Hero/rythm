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
  // Normalize portfolio fields (support camelCase and snake_case)
  const totalValue = (portfolio as any).totalValue ?? (portfolio as any).total_value ?? 0;
  const cash = (portfolio as any).cash ?? (portfolio as any).cash_balance ?? 0;
  const unrealizedPnL = (portfolio as any).unrealizedPnL ?? (portfolio as any).unrealized_pnl ?? 0;
  const realizedPnL = (portfolio as any).realizedPnL ?? (portfolio as any).realized_pnl ?? 0;
  const totalPnL = (unrealizedPnL || 0) + (realizedPnL || 0);
  const pnlPercentage = ((totalValue - initialBalance) / initialBalance) * 100;

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
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Cash</div>
              <div className="text-xl font-semibold">{formatCurrency(cash)}</div>
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
                        {position.quantity} shares @ {formatCurrency(((position as any).avg_price ?? (position as any).avgPrice ?? 0))}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(((position as any).current_value ?? (position as any).currentValue ?? 0))}</div>
                      <div className={`text-sm ${
                        (((position as any).current_value ?? (position as any).currentValue ?? 0) >= position.quantity * (((position as any).avg_price ?? (position as any).avgPrice) ?? 0))
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(((position as any).current_value ?? (position as any).currentValue ?? 0) - (position.quantity * (((position as any).avg_price ?? (position as any).avgPrice) ?? 0)))}
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
                <span className="font-medium">{(metrics.sharpe_ratio || 0).toFixed(2)}</span>
              </div>
              <Progress 
                value={Math.min(Math.max(((metrics.sharpe_ratio || 0) + 2) * 25, 0), 100)} 
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Win Rate</span>
                <span className="font-medium">{formatPercentage(metrics.win_rate || 0)}</span>
              </div>
              <Progress value={metrics.win_rate || 0} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Max Drawdown</span>
                <span className={`font-medium ${(metrics.max_drawdown || 0) < -5 ? 'text-red-600' : 'text-yellow-600'}`}>
                  {formatPercentage(metrics.max_drawdown || 0)}
                </span>
              </div>
              <Progress 
                value={Math.abs(metrics.max_drawdown || 0)} 
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Drawdown</span>
                <span className={`font-medium ${(metrics.current_drawdown || 0) < -3 ? 'text-red-600' : 'text-gray-600'}`}>
                  {formatPercentage(metrics.current_drawdown || 0)}
                </span>
              </div>
              <Progress 
                value={Math.abs(metrics.current_drawdown || 0)} 
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Trades</span>
                <span className="font-medium">{metrics.total_trades || 0}</span>
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
