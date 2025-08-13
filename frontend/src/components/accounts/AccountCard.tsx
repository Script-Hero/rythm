import { memo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  MoreVertical, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Settings, 
  Eye, 
  Unlink,
  Bitcoin,
  DollarSign,
  Building
} from "lucide-react"

export interface AccountData {
  id: string
  provider: 'coinbase' | 'paper' | 'etrade'
  name: string
  balance: number
  dailyPnL: number
  totalPnL: number
  status: 'connected' | 'disconnected' | 'error'
  lastUpdated: Date
  currency: string
  strategiesCount: number
}

interface AccountCardProps {
  account: AccountData
  onView?: (accountId: string) => void
  onSettings?: (accountId: string) => void
  onDisconnect?: (accountId: string) => void
}

const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'coinbase':
      return <Bitcoin className="h-5 w-5" />
    case 'etrade':
      return <Building className="h-5 w-5" />
    case 'paper':
      return <DollarSign className="h-5 w-5" />
    default:
      return <Wallet className="h-5 w-5" />
  }
}

const getProviderColor = (provider: string) => {
  switch (provider) {
    case 'coinbase':
      return 'from-orange-500 to-yellow-600'
    case 'etrade':
      return 'from-blue-500 to-indigo-600'
    case 'paper':
      return 'from-green-500 to-emerald-600'
    default:
      return 'from-gray-500 to-slate-600'
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'connected':
      return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Connected</Badge>
    case 'disconnected':
      return <Badge variant="outline" className="text-gray-600 border-gray-200 bg-gray-50">Disconnected</Badge>
    case 'error':
      return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Error</Badge>
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}


export function AccountCard({ 
  account, 
  onView, 
  onSettings, 
  onDisconnect 
}: AccountCardProps) {
  const isDailyPositive = account.dailyPnL >= 0
  const isTotalPositive = account.totalPnL >= 0

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 bg-gradient-to-br ${getProviderColor(account.provider)} rounded-lg shadow-sm`}>
              {getProviderIcon(account.provider)}
              <span className="sr-only">{account.provider}</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 capitalize">
                {account.provider}
              </h3>
              <p className="text-sm text-gray-500">{account.name}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {getStatusBadge(account.status)}
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
                <DropdownMenuItem onClick={() => onView?.(account.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSettings?.(account.id)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDisconnect?.(account.id)}
                  className="text-red-600"
                >
                  <Unlink className="mr-2 h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-500 mb-1">Balance</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(account.balance, account.currency)}
            </p>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500">Daily P&L</p>
              <div className="flex items-center space-x-1">
                {isDailyPositive ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-sm font-medium ${
                  isDailyPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(Math.abs(account.dailyPnL), account.currency)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500">Total P&L</p>
              <div className="flex items-center space-x-1">
                {isTotalPositive ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-sm font-medium ${
                  isTotalPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(Math.abs(account.totalPnL), account.currency)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              {account.strategiesCount} active {account.strategiesCount === 1 ? 'strategy' : 'strategies'}
            </span>
            <span className="text-xs text-gray-400">
              Updated {account.lastUpdated.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}