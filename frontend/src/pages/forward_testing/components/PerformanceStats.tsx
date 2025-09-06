import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Target, Activity, Award, AlertTriangle } from 'lucide-react';
import type { Metrics } from '@/types/forward-testing';

interface PerformanceStatsProps {
  metrics: Metrics;
}

export const PerformanceStats = ({ metrics }: PerformanceStatsProps) => {
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getPerformanceRating = (metric: string, value: number) => {
    switch (metric) {
      case 'sharpe':
        if (value >= 2) return { rating: 'Excellent', color: 'bg-green-100 text-green-800' };
        if (value >= 1) return { rating: 'Good', color: 'bg-blue-100 text-blue-800' };
        if (value >= 0) return { rating: 'Fair', color: 'bg-yellow-100 text-yellow-800' };
        return { rating: 'Poor', color: 'bg-red-100 text-red-800' };
      
      case 'winRate':
        if (value >= 60) return { rating: 'Excellent', color: 'bg-green-100 text-green-800' };
        if (value >= 50) return { rating: 'Good', color: 'bg-blue-100 text-blue-800' };
        if (value >= 40) return { rating: 'Fair', color: 'bg-yellow-100 text-yellow-800' };
        return { rating: 'Poor', color: 'bg-red-100 text-red-800' };
      
      case 'drawdown':
        if (value >= -5) return { rating: 'Excellent', color: 'bg-green-100 text-green-800' };
        if (value >= -10) return { rating: 'Good', color: 'bg-blue-100 text-blue-800' };
        if (value >= -20) return { rating: 'Fair', color: 'bg-yellow-100 text-yellow-800' };
        return { rating: 'Poor', color: 'bg-red-100 text-red-800' };
      
      default:
        return { rating: 'N/A', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const sharpeRating = getPerformanceRating('sharpe', metrics.sharpe_ratio);
  const winRateRating = getPerformanceRating('winRate', metrics.win_rate);
  const drawdownRating = getPerformanceRating('drawdown', metrics.max_drawdown);

  return (
    <div className="space-y-6">
      {/* Overall Performance Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Performance Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-3xl font-bold mb-2">
              {Math.max(0, 50 + metrics.sharpe_ratio * 15 + metrics.win_rate * 0.3 - Math.abs(metrics.max_drawdown) * 2).toFixed(0)}
            </div>
            <div className="text-sm text-muted-foreground mb-4">Overall Score (0-100)</div>
            <Progress 
              value={Math.max(0, 50 + metrics.sharpe_ratio * 15 + metrics.win_rate * 0.3 - Math.abs(metrics.max_drawdown) * 2)}
              className="h-3"
            />
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Key Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Total Return */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {metrics.total_return >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium">Total Return</span>
            </div>
            <div className="text-right">
              <div className={`font-bold ${metrics.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(metrics.total_return)}
              </div>
            </div>
          </div>

          {/* Sharpe Ratio */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Sharpe Ratio</span>
            </div>
            <div className="text-right flex items-center gap-2">
              <Badge className={sharpeRating.color}>
                {sharpeRating.rating}
              </Badge>
              <div className="font-bold">
                {metrics.sharpe_ratio.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Win Rate */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">Win Rate</span>
            </div>
            <div className="text-right flex items-center gap-2">
              <Badge className={winRateRating.color}>
                {winRateRating.rating}
              </Badge>
              <div className="font-bold">
                {formatPercentage(metrics.win_rate)}
              </div>
            </div>
          </div>

          {/* Max Drawdown */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Max Drawdown</span>
            </div>
            <div className="text-right flex items-center gap-2">
              <Badge className={drawdownRating.color}>
                {drawdownRating.rating}
              </Badge>
              <div className="font-bold text-red-600">
                {formatPercentage(metrics.max_drawdown)}
              </div>
            </div>
          </div>

          {/* Current Drawdown */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Current Drawdown</span>
            </div>
            <div className="text-right">
              <div className={`font-bold ${Math.abs(metrics.current_drawdown) > 5 ? 'text-red-600' : 'text-orange-600'}`}>
                {formatPercentage(metrics.current_drawdown)}
              </div>
            </div>
          </div>

          {/* Total Trades */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Total Trades</span>
            </div>
            <div className="text-right">
              <div className="font-bold">
                {metrics.total_trades}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Risk Level</span>
              <Badge className={
                Math.abs(metrics.max_drawdown) < 5 ? 'bg-green-100 text-green-800' :
                Math.abs(metrics.max_drawdown) < 10 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }>
                {Math.abs(metrics.max_drawdown) < 5 ? 'Low' :
                 Math.abs(metrics.max_drawdown) < 10 ? 'Medium' : 'High'}
              </Badge>
            </div>
            <Progress 
              value={Math.min(Math.abs(metrics.max_drawdown) * 5, 100)} 
              className="h-2"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Risk assessment based on maximum drawdown, volatility, and win rate.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
