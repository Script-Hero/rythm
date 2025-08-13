import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AccountCard, type AccountData } from "./AccountCard"
import { AddAccountModal } from "./AddAccountModal"
import { Plus, Wallet } from "lucide-react"

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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
  const totalDailyPnL = accounts.reduce((sum, account) => sum + account.dailyPnL, 0)
  const connectedAccounts = accounts.filter(account => account.status === 'connected').length

  const handleAddAccount = (provider: string, credentials: any) => {
    onAddAccount?.(provider, credentials)
    setIsAddModalOpen(false)
  }

  return (
    <>
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
                  {connectedAccounts} of {accounts.length} accounts connected
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
              <p className="text-sm text-green-700 font-medium">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-green-900">
                ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className={`p-4 rounded-lg border ${
              totalDailyPnL >= 0 
                ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100' 
                : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-100'
            }`}>
              <p className={`text-sm font-medium ${
                totalDailyPnL >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                Daily P&L
              </p>
              <p className={`text-2xl font-bold ${
                totalDailyPnL >= 0 ? 'text-green-900' : 'text-red-900'
              }`}>
                {totalDailyPnL >= 0 ? '+' : ''}${totalDailyPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Account Cards */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Connected Accounts</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onView={onViewAccount}
                  onSettings={onSettingsAccount}
                  onDisconnect={onDisconnectAccount}
                />
              ))}
            </div>
          </div>

          {accounts.length === 0 && (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts connected</h3>
              <p className="text-gray-500 mb-4">
                Connect your first trading account to start monitoring your portfolio
              </p>
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AddAccountModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onAddAccount={handleAddAccount}
      />
    </>
  )
}