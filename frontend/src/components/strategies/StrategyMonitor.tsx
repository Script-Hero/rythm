import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StrategyCard, type StrategyData } from "./StrategyCard"
import { StrategyQuickApply } from "./StrategyQuickApply"
import {
  Search,
  Filter,
  Plus,
  Activity,
  Pause,
  Square,
  TrendingUp,
  Zap
} from "lucide-react"

interface StrategyMonitorProps {
  strategies?: StrategyData[]
  onPauseStrategy?: (strategyId: string) => void
  onResumeStrategy?: (strategyId: string) => void
  onStopStrategy?: (strategyId: string) => void
  onConfigureStrategy?: (strategyId: string) => void
  onViewStrategyDetails?: (strategyId: string) => void
  onApplyStrategy?: (templateId: string, symbol: string, account: string, params: any) => void
}

// Mock data for development
const mockStrategies: StrategyData[] = [
  {
    id: '1',
    name: 'SMA Crossover',
    type: 'template',
    status: 'active',
    account: 'Coinbase',
    symbol: 'BTC',
    performance: {
      totalReturn: 2500.00,
      totalReturnPercent: 12.5,
      winRate: 68.5,
      totalTrades: 42,
      avgHoldTime: 4.2,
      maxDrawdown: 8.3
    },
    lastSignal: 'BUY',
    lastSignalTime: new Date(Date.now() - 5 * 60 * 1000),
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    description: 'Simple moving average crossover strategy for trend following'
  },
  {
    id: '2',
    name: 'Custom Momentum Strategy',
    type: 'custom',
    status: 'active',
    account: 'E*TRADE',
    symbol: 'AAPL',
    performance: {
      totalReturn: -340.50,
      totalReturnPercent: -2.1,
      winRate: 45.2,
      totalTrades: 18,
      avgHoldTime: 2.8,
      maxDrawdown: 5.7
    },
    lastSignal: 'HOLD',
    lastSignalTime: new Date(Date.now() - 15 * 60 * 1000),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    description: 'Custom momentum-based strategy with RSI confirmation'
  },
  {
    id: '3',
    name: 'Ethereum Scalping',
    type: 'template',
    status: 'paused',
    account: 'Paper Trading',
    symbol: 'ETH',
    performance: {
      totalReturn: 890.25,
      totalReturnPercent: 4.8,
      winRate: 72.1,
      totalTrades: 156,
      avgHoldTime: 0.3,
      maxDrawdown: 3.2
    },
    lastSignal: 'SELL',
    lastSignalTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    description: 'High-frequency scalping strategy for Ethereum'
  },
  {
    id: '4',
    name: 'Tesla Mean Reversion',
    type: 'custom',
    status: 'stopped',
    account: 'E*TRADE',
    symbol: 'TSLA',
    performance: {
      totalReturn: 1250.75,
      totalReturnPercent: 7.3,
      winRate: 58.9,
      totalTrades: 28,
      avgHoldTime: 6.5,
      maxDrawdown: 12.1
    },
    lastSignal: 'HOLD',
    lastSignalTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    description: 'Mean reversion strategy targeting Tesla volatility'
  }
]

export function StrategyMonitor({
  strategies = mockStrategies,
  onPauseStrategy,
  onResumeStrategy,
  onStopStrategy,
  onConfigureStrategy,
  onViewStrategyDetails,
  onApplyStrategy
}: StrategyMonitorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showQuickApply, setShowQuickApply] = useState(false)

  const filteredStrategies = React.useMemo(() => {
    return strategies.filter(strategy => {
      const matchesSearch = 
        strategy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        strategy.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        strategy.account.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || strategy.status === statusFilter
      const matchesType = typeFilter === 'all' || strategy.type === typeFilter
      
      return matchesSearch && matchesStatus && matchesType
    })
  }, [strategies, searchQuery, statusFilter, typeFilter])

  const getStatusCounts = () => {
    return {
      active: strategies.filter(s => s.status === 'active').length,
      paused: strategies.filter(s => s.status === 'paused').length,
      stopped: strategies.filter(s => s.status === 'stopped').length,
      total: strategies.length
    }
  }

  const statusCounts = getStatusCounts()
  const totalReturn = strategies.reduce((sum, strategy) => sum + strategy.performance.totalReturn, 0)
  const avgWinRate = strategies.length > 0 
    ? strategies.reduce((sum, strategy) => sum + strategy.performance.winRate, 0) / strategies.length 
    : 0

  const handleApplyStrategy = (templateId: string, symbol: string, account: string, params: any) => {
    onApplyStrategy?.(templateId, symbol, account, params)
    setShowQuickApply(false)
  }

  return (
    <>
      <Card className="border-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Strategy Monitor</CardTitle>
                <p className="text-sm text-gray-500">
                  {statusCounts.active} active • {statusCounts.total} total strategies
                </p>
              </div>
            </div>
            
            <Button
              onClick={() => setShowQuickApply(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Apply Strategy
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Active Strategies</p>
                  <p className="text-2xl font-bold text-green-900">{statusCounts.active}</p>
                </div>
                <Activity className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border border-yellow-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-700 font-medium">Paused</p>
                  <p className="text-2xl font-bold text-yellow-900">{statusCounts.paused}</p>
                </div>
                <Pause className="h-8 w-8 text-yellow-600" />
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${
              totalReturn >= 0 
                ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100' 
                : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-100'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${
                    totalReturn >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Total Return
                  </p>
                  <p className={`text-2xl font-bold ${
                    totalReturn >= 0 ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {totalReturn >= 0 ? '+' : ''}${totalReturn.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </p>
                </div>
                <TrendingUp className={`h-8 w-8 ${
                  totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                }`} />
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Avg Win Rate</p>
                  <p className="text-2xl font-bold text-blue-900">{avgWinRate.toFixed(1)}%</p>
                </div>
                <Zap className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search strategies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="stopped">Stopped</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="template">Template</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Strategy Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">
                Strategies ({filteredStrategies.length})
              </h4>
              {filteredStrategies.length !== strategies.length && (
                <Badge variant="outline" className="text-xs">
                  Filtered from {strategies.length}
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredStrategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onPause={onPauseStrategy}
                  onResume={onResumeStrategy}
                  onStop={onStopStrategy}
                  onConfigure={onConfigureStrategy}
                  onViewDetails={onViewStrategyDetails}
                />
              ))}
            </div>

            {filteredStrategies.length === 0 && (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' 
                    ? 'No strategies match your filters' 
                    : 'No strategies running'
                  }
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                    ? 'Try adjusting your search or filter criteria'
                    : 'Apply a strategy template or create a custom strategy to get started'
                  }
                </p>
                <Button
                  onClick={() => setShowQuickApply(true)}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Apply Strategy
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <StrategyQuickApply
        open={showQuickApply}
        onOpenChange={setShowQuickApply}
        onApplyStrategy={handleApplyStrategy}
      />
    </>
  )
}