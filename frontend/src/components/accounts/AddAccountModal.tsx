import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Bitcoin, 
  Building, 
  DollarSign, 
  Shield, 
  ExternalLink,
  CheckCircle,
  AlertTriangle
} from "lucide-react"

interface AddAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddAccount: (provider: string, credentials: any) => void
}

const providers = [
  {
    id: 'coinbase',
    name: 'Coinbase Pro',
    icon: Bitcoin,
    description: 'Connect your Coinbase Pro account for cryptocurrency trading',
    color: 'from-orange-500 to-yellow-600',
    status: 'available',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true },
      { key: 'apiSecret', label: 'API Secret', type: 'password', required: true },
      { key: 'passphrase', label: 'Passphrase', type: 'password', required: true }
    ]
  },
  {
    id: 'etrade',
    name: 'E*TRADE',
    icon: Building,
    description: 'Connect your E*TRADE account for stock and options trading',
    color: 'from-blue-500 to-indigo-600',
    status: 'available',
    fields: [
      { key: 'consumerKey', label: 'Consumer Key', type: 'text', required: true },
      { key: 'consumerSecret', label: 'Consumer Secret', type: 'password', required: true }
    ]
  },
  {
    id: 'paper',
    name: 'Paper Trading',
    icon: DollarSign,
    description: 'Create a simulated trading account with virtual funds',
    color: 'from-green-500 to-emerald-600',
    status: 'available',
    fields: [
      { key: 'accountName', label: 'Account Name', type: 'text', required: true },
      { key: 'initialBalance', label: 'Initial Balance', type: 'number', required: true, placeholder: '100000' }
    ]
  }
]

export function AddAccountModal({ open, onOpenChange, onAddAccount }: AddAccountModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId)
    setCredentials({})
    setError('')
  }

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }))
    setError('')
  }

  const handleSubmit = async () => {
    const provider = providers.find(p => p.id === selectedProvider)
    if (!provider) return

    // Validate required fields
    const missingFields = provider.fields
      .filter(field => field.required && !credentials[field.key])
      .map(field => field.label)

    if (missingFields.length > 0) {
      setError(`Please fill in required fields: ${missingFields.join(', ')}`)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // In a real implementation, this would validate credentials with the provider
      onAddAccount(selectedProvider, credentials)
      
      // Reset form
      setSelectedProvider('')
      setCredentials({})
    } catch (err) {
      setError('Failed to connect account. Please check your credentials and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedProviderData = providers.find(p => p.id === selectedProvider)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>Add Trading Account</span>
          </DialogTitle>
          <DialogDescription>
            Securely connect your trading accounts to monitor and manage your portfolio.
            Your credentials are encrypted and never stored on our servers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!selectedProvider ? (
            <>
              <div>
                <Label className="text-sm font-medium text-gray-900">Choose a provider</Label>
                <div className="grid gap-3 mt-2">
                  {providers.map((provider) => {
                    const IconComponent = provider.icon
                    return (
                      <Card
                        key={provider.id}
                        className="cursor-pointer transition-all hover:shadow-md hover:border-blue-200"
                        onClick={() => handleProviderSelect(provider.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 bg-gradient-to-br ${provider.color} rounded-lg`}>
                                <IconComponent className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">{provider.name}</h3>
                                <p className="text-sm text-gray-500">{provider.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {provider.status === 'available' && (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Available
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security:</strong> We use bank-level encryption to protect your credentials.
                  API keys are stored securely and can be revoked at any time from your account settings.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 bg-gradient-to-br ${selectedProviderData?.color} rounded-lg`}>
                    {selectedProviderData?.icon && (
                      <selectedProviderData.icon className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{selectedProviderData?.name}</h3>
                    <p className="text-sm text-gray-500">{selectedProviderData?.description}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedProvider('')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Change
                </Button>
              </div>

              <div className="space-y-4">
                {selectedProviderData?.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <Input
                      id={field.key}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={credentials[field.key] || ''}
                      onChange={(e) => handleCredentialChange(field.key, e.target.value)}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              {selectedProvider === 'coinbase' && (
                <Alert>
                  <ExternalLink className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Getting your Coinbase Pro API credentials:</strong>
                    <br />
                    1. Go to Coinbase Pro Settings → API
                    <br />
                    2. Create a new API key with "View" and "Trade" permissions
                    <br />
                    3. Copy the API Key, Secret, and Passphrase here
                  </AlertDescription>
                </Alert>
              )}

              {selectedProvider === 'etrade' && (
                <Alert>
                  <ExternalLink className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Getting your E*TRADE API credentials:</strong>
                    <br />
                    1. Apply for E*TRADE API access at developer.etrade.com
                    <br />
                    2. Once approved, you'll receive Consumer Key and Secret
                    <br />
                    3. OAuth authentication will be completed after connection
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  {isLoading ? 'Connecting...' : 'Connect Account'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedProvider('')}
                  disabled={isLoading}
                >
                  Back
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}