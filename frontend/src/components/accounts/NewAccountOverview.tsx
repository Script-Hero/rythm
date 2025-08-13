import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AccountRow, type AccountData } from "./AccountRow"
import { AccountSelector } from "./AccountSelector"
import { Wallet } from "lucide-react"

interface AccountOverviewProps {
  accounts?: AccountData[]
  onAddAccount?: (provider: string, credentials: any) => void
  onViewAccount?: (accountId: string) => void
  onSettingsAccount?: (accountId: string) => void
  onDisconnectAccount?: (accountId: string) => void
}

// Mock data for development
const mockAccounts: AccountData[] = [
  {
    id: '1',
    provider: 'coinbase',
    name: 'Main Trading',
    balance: 12543.67,
    dailyPnL: 234.12,
    totalPnL: 1543.78,
    status: 'connected',
    lastUpdated: new Date(),
    currency: 'USD',
    strategiesCount: 3
  },
  {
    id: '2',
    provider: 'paper',
    name: 'Practice Account',
    balance: 100000.00,
    dailyPnL: -156.45,
    totalPnL: 2341.89,
    status: 'connected',
    lastUpdated: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    currency: 'USD',
    strategiesCount: 1
  },
  {
    id: '3',
    provider: 'etrade',
    name: 'Stock Portfolio',
    balance: 45678.90,
    dailyPnL: 567.23,
    totalPnL: -890.12,
    status: 'error',
    lastUpdated: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    currency: 'USD',
    strategiesCount: 2
  }
]

export function AccountOverview({
  accounts = mockAccounts,
  onAddAccount,
  onViewAccount,
  onSettingsAccount,
  onDisconnectAccount
}: AccountOverviewProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all')

  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId)
  const displayAccounts = selectedAccountId === 'all' ? accounts : 
    selectedAccount ? [selectedAccount] : []

  // Aggregate stats for 'All' view
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
  const totalDailyPnL = accounts.reduce((sum, account) => sum + account.dailyPnL, 0)
  const connectedAccounts = accounts.filter(account => account.status === 'connected').length

  const getDisplayStats = () => {
    if (selectedAccountId === 'all') {
      return {
        balance: totalBalance,
        dailyPnL: totalDailyPnL,
        accountCount: accounts.length,
        connectedCount: connectedAccounts
      }
    } else if (selectedAccount) {
      return {
        balance: selectedAccount.balance,
        dailyPnL: selectedAccount.dailyPnL,
        accountCount: 1,
        connectedCount: selectedAccount.status === 'connected' ? 1 : 0
      }
    }
    return { balance: 0, dailyPnL: 0, accountCount: 0, connectedCount: 0 }
  }

  const stats = getDisplayStats()

  return (
    <Card className="border-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Account Overview</CardTitle>
              <p className="text-sm text-gray-500">
                {stats.connectedCount} of {stats.accountCount} account{stats.accountCount !== 1 ? 's' : ''} connected
              </p>
            </div>
          </div>
          
          <AccountSelector
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            onAccountChange={setSelectedAccountId}
            onAddAccount={onAddAccount}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
            <p className="text-sm text-green-700 font-medium">
              {selectedAccountId === 'all' ? 'Total Portfolio Value' : 'Account Balance'}
            </p>
            <p className="text-2xl font-bold text-green-900">
              ${stats.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className={`p-4 rounded-lg border ${
            stats.dailyPnL >= 0 
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100' 
              : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-100'
          }`}>
            <p className={`text-sm font-medium ${
              stats.dailyPnL >= 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              Daily P&L
            </p>
            <p className={`text-2xl font-bold ${
              stats.dailyPnL >= 0 ? 'text-green-900' : 'text-red-900'
            }`}>
              {stats.dailyPnL >= 0 ? '+' : ''}${stats.dailyPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Account Rows */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">
            {selectedAccountId === 'all' ? 'All Accounts' : 'Account Details'}
          </h4>
          
          {displayAccounts.length > 0 ? (
            <div className="space-y-2">
              {displayAccounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onView={onViewAccount}
                  onSettings={onSettingsAccount}
                  onDisconnect={onDisconnectAccount}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
              <p className="text-gray-500">
                {selectedAccountId === 'all' 
                  ? 'Connect your first trading account to get started'
                  : 'Selected account not found'
                }
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}