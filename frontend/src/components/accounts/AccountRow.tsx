import { memo } from "react"
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

interface AccountRowProps {
  account: AccountData
  onView?: (accountId: string) => void
  onSettings?: (accountId: string) => void
  onDisconnect?: (accountId: string) => void
}

const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'coinbase':
      return <Bitcoin className="h-4 w-4 text-orange-600" />
    case 'etrade':
      return <Building className="h-4 w-4 text-blue-600" />
    case 'paper':
      return <DollarSign className="h-4 w-4 text-green-600" />
    default:
      return <DollarSign className="h-4 w-4 text-gray-600" />
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'connected':
      return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">Connected</Badge>
    case 'disconnected':
      return <Badge variant="outline" className="text-gray-600 border-gray-200 bg-gray-50 text-xs">Disconnected</Badge>
    case 'error':
      return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">Error</Badge>
    default:
      return <Badge variant="outline" className="text-xs">Unknown</Badge>
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

export const AccountRow = memo(function AccountRow({ 
  account, 
  onView, 
  onSettings, 
  onDisconnect 
}: AccountRowProps) {
  const isDailyPositive = account.dailyPnL >= 0
  const isTotalPositive = account.totalPnL >= 0

  return (
    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-white hover:bg-gray-50 transition-colors">
      {/* Left section - Account info */}
      <div className="flex items-center space-x-4 flex-1 min-w-0">
        <div className="flex items-center space-x-3">
          {getProviderIcon(account.provider)}
          <div className="min-w-0">
            <h4 className="font-medium text-gray-900 capitalize truncate">
              {account.provider}
            </h4>
            <p className="text-sm text-gray-500 truncate">{account.name}</p>
          </div>
        </div>
        
        <div className="flex-shrink-0">
          {getStatusBadge(account.status)}
        </div>
      </div>

      {/* Middle section - Balance */}
      <div className="flex-shrink-0 text-right mx-6">
        <p className="font-semibold text-gray-900">
          {formatCurrency(account.balance, account.currency)}
        </p>
        <p className="text-xs text-gray-500">
          {account.strategiesCount} {account.strategiesCount === 1 ? 'strategy' : 'strategies'}
        </p>
      </div>

      {/* Right section - P&L and actions */}
      <div className="flex items-center space-x-4 flex-shrink-0">
        <div className="text-right">
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
          <p className="text-xs text-gray-400">
            Updated {account.lastUpdated.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
  )
})