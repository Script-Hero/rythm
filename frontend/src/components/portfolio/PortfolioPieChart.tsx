import { useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, PieChart as PieChartIcon } from "lucide-react"

export interface AllocationData {
  name: string
  value: number
  percentage: number
  change24h: number
  color: string
  symbol?: string
  account?: string
  sector?: string
}

interface PortfolioPieChartProps {
  data: AllocationData[]
  mode: 'accounts' | 'assets' | 'sectors'
  onModeChange?: (mode: 'accounts' | 'assets' | 'sectors') => void
  showLegend?: boolean
  interactive?: boolean
  title?: string
}

const COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
]

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">
          Value: <span className="font-medium">{formatCurrency(data.value)}</span>
        </p>
        <p className="text-sm text-gray-600">
          Share: <span className="font-medium">{formatPercentage(data.percentage)}</span>
        </p>
        <div className="flex items-center space-x-1 mt-1">
          {data.change24h >= 0 ? (
            <TrendingUp className="h-3 w-3 text-green-500" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <span className={`text-xs font-medium ${
            data.change24h >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
          </span>
        </div>
      </div>
    )
  }
  return null
}

const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center space-x-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-gray-600">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// Mock data for development
const mockAccountData: AllocationData[] = [
  { name: 'Coinbase', value: 12543.67, percentage: 35.2, change24h: 2.34, color: COLORS[0] },
  { name: 'Paper Trading', value: 100000.00, percentage: 56.1, change24h: -0.45, color: COLORS[1] },
  { name: 'E*TRADE', value: 45678.90, percentage: 8.7, change24h: 1.89, color: COLORS[2] },
]

const mockAssetData: AllocationData[] = [
  { name: 'Bitcoin', value: 45000, percentage: 28.5, change24h: 3.2, color: COLORS[0], symbol: 'BTC' },
  { name: 'Ethereum', value: 32000, percentage: 20.3, change24h: -1.5, color: COLORS[1], symbol: 'ETH' },
  { name: 'Apple', value: 25000, percentage: 15.8, change24h: 0.8, color: COLORS[2], symbol: 'AAPL' },
  { name: 'Tesla', value: 18000, percentage: 11.4, change24h: 2.1, color: COLORS[3], symbol: 'TSLA' },
  { name: 'Cash', value: 38000, percentage: 24.0, change24h: 0.0, color: COLORS[4], symbol: 'USD' },
]

const mockSectorData: AllocationData[] = [
  { name: 'Cryptocurrency', value: 77000, percentage: 48.8, change24h: 1.2, color: COLORS[0], sector: 'Crypto' },
  { name: 'Technology', value: 43000, percentage: 27.2, change24h: 1.4, color: COLORS[1], sector: 'Tech' },
  { name: 'Cash', value: 38000, percentage: 24.0, change24h: 0.0, color: COLORS[2], sector: 'Cash' },
]

export function PortfolioPieChart({
  data,
  mode,
  onModeChange,
  showLegend = true,
  interactive = true,
  title
}: PortfolioPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const getModeData = () => {
    switch (mode) {
      case 'accounts':
        return data.length > 0 ? data : mockAccountData
      case 'assets':
        return data.length > 0 ? data : mockAssetData
      case 'sectors':
        return data.length > 0 ? data : mockSectorData
      default:
        return mockAccountData
    }
  }

  const chartData = getModeData()
  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0)

  const onPieEnter = (_: any, index: number) => {
    if (interactive) {
      setActiveIndex(index)
    }
  }

  const onPieLeave = () => {
    if (interactive) {
      setActiveIndex(null)
    }
  }

  const getModeTitle = () => {
    switch (mode) {
      case 'accounts':
        return 'By Account'
      case 'assets':
        return 'By Asset'
      case 'sectors':
        return 'By Sector'
      default:
        return 'Portfolio Allocation'
    }
  }

  return (
    <Card className="border-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-sm">
              <PieChartIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {title || `Portfolio Allocation ${getModeTitle()}`}
              </CardTitle>
              <p className="text-sm text-gray-500">
                Total: {formatCurrency(totalValue)}
              </p>
            </div>
          </div>
          
          {onModeChange && (
            <div className="flex space-x-1">
              <Button
                variant={mode === 'accounts' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange('accounts')}
              >
                Accounts
              </Button>
              <Button
                variant={mode === 'assets' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange('assets')}
              >
                Assets
              </Button>
              <Button
                variant={mode === 'sectors' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onModeChange('sectors')}
              >
                Sectors
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke={activeIndex === index ? '#374151' : 'none'}
                    strokeWidth={activeIndex === index ? 2 : 0}
                    style={{
                      filter: activeIndex === index ? 'brightness(1.1)' : 'none',
                      cursor: interactive ? 'pointer' : 'default'
                    }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend content={<CustomLegend />} />}
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-4 border-t border-gray-100">
          {chartData.slice(0, 4).map((item, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-1">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-medium text-gray-600">{item.name}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {formatPercentage(item.percentage)}
              </p>
              <div className="flex items-center justify-center space-x-1">
                {item.change24h >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-xs ${
                  item.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}