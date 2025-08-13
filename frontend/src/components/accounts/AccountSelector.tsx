import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AddAccountModal } from "./AddAccountModal"
import { 
  Globe,
  Bitcoin,
  DollarSign,
  Building,
  Plus
} from "lucide-react"
import type { AccountData } from "./AccountRow"

interface AccountSelectorProps {
  accounts: AccountData[]
  selectedAccountId: string
  onAccountChange: (accountId: string) => void
  onAddAccount?: (provider: string, credentials: any) => void
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

export function AccountSelector({ 
  accounts, 
  selectedAccountId, 
  onAccountChange,
  onAddAccount 
}: AccountSelectorProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const handleAddAccount = (provider: string, credentials: any) => {
    onAddAccount?.(provider, credentials)
    setIsAddModalOpen(false)
  }

  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId)
  const displayValue = selectedAccountId === 'all' ? 'All Accounts' : 
    selectedAccount ? `${selectedAccount.provider} - ${selectedAccount.name}` : 'Select Account'

  return (
    <>
      <div className="flex items-center space-x-3">
        <span className="text-sm font-medium text-gray-700">Account:</span>
        <Select value={selectedAccountId} onValueChange={onAccountChange}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder={displayValue} />
          </SelectTrigger>
          <SelectContent>
            {/* Pinned 'All' option at top */}
            <SelectItem value="all" className="font-medium">
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 text-blue-600" />
                <span>All Accounts</span>
              </div>
            </SelectItem>
            
            {accounts.length > 0 && <Separator className="my-1" />}
            
            {/* Individual accounts */}
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center space-x-2">
                  {getProviderIcon(account.provider)}
                  <span className="capitalize">{account.provider}</span>
                  <span className="text-gray-500">-</span>
                  <span className="text-gray-600">{account.name}</span>
                </div>
              </SelectItem>
            ))}
            
            <Separator className="my-1" />
            
            {/* Pinned 'Add Account' option at bottom */}
            <div className="p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
                className="w-full justify-start h-8"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </div>
          </SelectContent>
        </Select>
      </div>

      <AddAccountModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onAddAccount={handleAddAccount}
      />
    </>
  )
}