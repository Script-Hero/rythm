import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Play,
  Pause,
  Square,
  Settings,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Target,
  BarChart3,
  Zap
} from "lucide-react"

export interface StrategyData {
  id: string
  name: string
  type: 'custom' | 'template'
  status: 'active' | 'paused' | 'stopped'
  account: string
  symbol: string
  performance: {
    totalReturn: number
    totalReturnPercent: number
    winRate: number
    totalTrades: number
    avgHoldTime: number
    maxDrawdown: number
  }
  lastSignal: 'BUY' | 'SELL' | 'HOLD'
  lastSignalTime: Date
  createdAt: Date
  description?: string
}

interface StrategyCardProps {
  strategy: StrategyData
  onPause?: (strategyId: string) => void
  onResume?: (strategyId: string) => void
  onStop?: (strategyId: string) => void
  onConfigure?: (strategyId: string) => void
  onViewDetails?: (strategyId: string) => void
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <Activity className="h-3 w-3 mr-1" />
          Active
        </Badge>
      )
    case 'paused':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Pause className="h-3 w-3 mr-1" />
          Paused
        </Badge>
      )
    case 'stopped':
      return (
        <Badge variant="outline" className="text-gray-600 border-gray-200">
          <Square className="h-3 w-3 mr-1" />
          Stopped
        </Badge>
      )
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

const getSignalBadge = (signal: string) => {
  switch (signal) {
    case 'BUY':
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <TrendingUp className="h-3 w-3 mr-1" />
          BUY
        </Badge>
      )
    case 'SELL':
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <TrendingDown className="h-3 w-3 mr-1" />
          SELL
        </Badge>
      )
    case 'HOLD':
      return (
        <Badge variant="outline" className="text-gray-600 border-gray-200">
          <Target className="h-3 w-3 mr-1" />
          HOLD
        </Badge>
      )
    default:
      return <Badge variant="outline">-</Badge>
  }
}

const getTypeIcon = (type: string) => {
  return type === 'custom' ? (
    <Zap className="h-4 w-4 text-blue-600" />
  ) : (
    <BarChart3 className="h-4 w-4 text-purple-600" />
  )
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const formatPercentage = (value: number) => {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

const formatHoldTime = (hours: number) => {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`
  } else if (hours < 24) {
    return `${hours.toFixed(1)}h`
  } else {
    return `${(hours / 24).toFixed(1)}d`
  }
}

export function StrategyCard({
  strategy,
  onPause,
  onResume,
  onStop,
  onConfigure,
  onViewDetails
}: StrategyCardProps) {
  const isPositiveReturn = strategy.performance.totalReturnPercent >= 0

  const getActionButton = () => {
    switch (strategy.status) {
      case 'active':
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPause?.(strategy.id)}
            className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
          >
            <Pause className="h-3 w-3 mr-1" />
            Pause
          </Button>
        )
      case 'paused':
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResume?.(strategy.id)}
            className="text-green-600 border-green-200 hover:bg-green-50"
          >
            <Play className="h-3 w-3 mr-1" />
            Resume
          </Button>
        )
      default:
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResume?.(strategy.id)}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Play className="h-3 w-3 mr-1" />
            Start
          </Button>
        )
    }
  }

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm">
              {getTypeIcon(strategy.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{strategy.name}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-gray-500">{strategy.symbol}</span>
                <span className="text-gray-300">•</span>
                <span className="text-sm text-gray-500">{strategy.account}</span>
              </div>
              {strategy.description && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{strategy.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {getStatusBadge(strategy.status)}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewDetails?.(strategy.id)}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onConfigure?.(strategy.id)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configure
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onStop?.(strategy.id)}
                  className="text-red-600"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop Strategy
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500">Total Return</p>
              <div className="flex items-center space-x-1">
                {isPositiveReturn ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-sm font-medium ${
                  isPositiveReturn ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatPercentage(strategy.performance.totalReturnPercent)}
                </span>
              </div>
              <p className={`text-xs ${
                isPositiveReturn ? 'text-green-500' : 'text-red-500'
              }`}>
                {formatCurrency(Math.abs(strategy.performance.totalReturn))}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500">Win Rate</p>
              <p className="text-sm font-medium text-gray-900">
                {strategy.performance.winRate.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">
                {strategy.performance.totalTrades} trades
              </p>
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
          <div>
            <p className="text-gray-500">Avg Hold Time</p>
            <p className="font-medium text-gray-900">
              {formatHoldTime(strategy.performance.avgHoldTime)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Max Drawdown</p>
            <p className="font-medium text-red-600">
              -{strategy.performance.maxDrawdown.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Last Signal */}
        <div className="flex items-center justify-between mb-4 pt-3 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500 mb-1">Last Signal</p>
            {getSignalBadge(strategy.lastSignal)}
          </div>
          <div className="text-right">
            <div className="flex items-center text-xs text-gray-400">
              <Clock className="h-3 w-3 mr-1" />
              {strategy.lastSignalTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          {getActionButton()}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails?.(strategy.id)}
            className="text-gray-600 hover:text-gray-900"
          >
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}