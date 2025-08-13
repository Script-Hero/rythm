import React, { useState } from "react"
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
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Zap, 
  BarChart3, 
  TrendingUp, 
  Target, 
  Shield,
  Info,
  Rocket
} from "lucide-react"

interface StrategyQuickApplyProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplyStrategy: (templateId: string, symbol: string, account: string, params: any) => void
}

const strategyTemplates = [
  {
    id: 'sma-crossover',
    name: 'SMA Crossover',
    description: 'Simple moving average crossover strategy for trend following',
    icon: TrendingUp,
    difficulty: 'Beginner',
    expectedReturn: '8-15%',
    riskLevel: 'Medium',
    color: 'from-green-500 to-emerald-600',
    params: {
      shortPeriod: { default: 20, min: 5, max: 50, step: 1, label: 'Short SMA Period' },
      longPeriod: { default: 50, min: 20, max: 200, step: 1, label: 'Long SMA Period' },
      stopLoss: { default: 5, min: 1, max: 20, step: 0.5, label: 'Stop Loss (%)' },
      takeProfit: { default: 10, min: 5, max: 50, step: 1, label: 'Take Profit (%)' }
    }
  },
  {
    id: 'rsi-mean-reversion',
    name: 'RSI Mean Reversion',
    description: 'Contrarian strategy using RSI oversold/overbought levels',
    icon: Target,
    difficulty: 'Intermediate',
    expectedReturn: '12-20%',
    riskLevel: 'High',
    color: 'from-purple-500 to-indigo-600',
    params: {
      rsiPeriod: { default: 14, min: 7, max: 30, step: 1, label: 'RSI Period' },
      oversoldLevel: { default: 30, min: 20, max: 40, step: 1, label: 'Oversold Level' },
      overboughtLevel: { default: 70, min: 60, max: 80, step: 1, label: 'Overbought Level' },
      stopLoss: { default: 3, min: 1, max: 10, step: 0.5, label: 'Stop Loss (%)' }
    }
  },
  {
    id: 'momentum-breakout',
    name: 'Momentum Breakout',
    description: 'Breakout strategy following strong price momentum',
    icon: Rocket,
    difficulty: 'Advanced',
    expectedReturn: '15-25%',
    riskLevel: 'High',
    color: 'from-orange-500 to-red-600',
    params: {
      lookbackPeriod: { default: 20, min: 10, max: 50, step: 1, label: 'Lookback Period' },
      breakoutThreshold: { default: 2, min: 1, max: 5, step: 0.1, label: 'Breakout Threshold (%)' },
      volumeFilter: { default: true, label: 'Require Volume Confirmation' },
      stopLoss: { default: 4, min: 2, max: 10, step: 0.5, label: 'Stop Loss (%)' }
    }
  }
]

const availableAccounts = [
  { id: 'coinbase', name: 'Coinbase', type: 'crypto' },
  { id: 'paper', name: 'Paper Trading', type: 'universal' },
  { id: 'etrade', name: 'E*TRADE', type: 'stocks' }
]

const popularSymbols = {
  crypto: ['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'UNI'],
  stocks: ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'NVDA'],
  universal: ['BTC', 'ETH', 'AAPL', 'TSLA', 'GOOGL', 'MSFT']
}

export function StrategyQuickApply({ open, onOpenChange, onApplyStrategy }: StrategyQuickApplyProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [customSymbol, setCustomSymbol] = useState<string>('')
  const [parameters, setParameters] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(false)

  const selectedTemplateData = strategyTemplates.find(t => t.id === selectedTemplate)
  const selectedAccountData = availableAccounts.find(a => a.id === selectedAccount)

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = strategyTemplates.find(t => t.id === templateId)
    if (template) {
      const defaultParams: Record<string, any> = {}
      Object.entries(template.params).forEach(([key, param]) => {
        defaultParams[key] = param.default
      })
      setParameters(defaultParams)
    }
  }

  const handleParameterChange = (key: string, value: any) => {
    setParameters(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!selectedTemplate || !selectedAccount || (!selectedSymbol && !customSymbol)) {
      return
    }

    setIsLoading(true)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      onApplyStrategy(
        selectedTemplate,
        customSymbol || selectedSymbol,
        selectedAccount,
        parameters
      )
      
      // Reset form
      setSelectedTemplate('')
      setSelectedAccount('')
      setSelectedSymbol('')
      setCustomSymbol('')
      setParameters({})
    } finally {
      setIsLoading(false)
    }
  }

  const getAccountSymbols = () => {
    if (!selectedAccountData) return []
    return popularSymbols[selectedAccountData.type as keyof typeof popularSymbols] || []
  }

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Low':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'High':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-blue-600" />
            <span>Quick Apply Strategy</span>
          </DialogTitle>
          <DialogDescription>
            Choose a template strategy and configure it for your trading account.
            You can customize parameters to match your risk tolerance and trading style.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Selection */}
          {!selectedTemplate ? (
            <div>
              <Label className="text-sm font-medium text-gray-900">Choose a strategy template</Label>
              <div className="grid gap-3 mt-2">
                {strategyTemplates.map((template) => {
                  const IconComponent = template.icon
                  return (
                    <Card
                      key={template.id}
                      className="cursor-pointer transition-all hover:shadow-md hover:border-blue-200"
                      onClick={() => handleTemplateSelect(template.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className={`p-2 bg-gradient-to-br ${template.color} rounded-lg`}>
                              <IconComponent className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{template.name}</h3>
                              <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                              <div className="flex items-center space-x-3 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {template.difficulty}
                                </Badge>
                                <Badge variant="outline" className={`text-xs ${getRiskBadgeColor(template.riskLevel)}`}>
                                  {template.riskLevel} Risk
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  Expected: {template.expectedReturn}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Selected Template Header */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 bg-gradient-to-br ${selectedTemplateData?.color} rounded-lg`}>
                    {selectedTemplateData?.icon && (
                      <selectedTemplateData.icon className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{selectedTemplateData?.name}</h3>
                    <p className="text-sm text-gray-500">{selectedTemplateData?.description}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedTemplate('')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Change
                </Button>
              </div>

              {/* Account Selection */}
              <div className="space-y-2">
                <Label htmlFor="account" className="text-sm font-medium">
                  Trading Account *
                </Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Symbol Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Trading Symbol *
                </Label>
                <div className="space-y-3">
                  {selectedAccount && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Popular symbols for {selectedAccountData?.name}:</p>
                        <div className="flex flex-wrap gap-2">
                          {getAccountSymbols().map((symbol) => (
                            <Button
                              key={symbol}
                              variant={selectedSymbol === symbol ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setSelectedSymbol(symbol)
                                setCustomSymbol('')
                              }}
                            >
                              {symbol}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">or</span>
                      </div>
                    </>
                  )}
                  <div>
                    <Input
                      placeholder="Enter custom symbol (e.g., NVDA, SOL)"
                      value={customSymbol}
                      onChange={(e) => {
                        setCustomSymbol(e.target.value.toUpperCase())
                        setSelectedSymbol('')
                      }}
                      className="uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Parameter Configuration */}
              {selectedTemplateData && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <Label className="text-sm font-medium">Strategy Parameters</Label>
                  </div>
                  
                  <div className="grid gap-4">
                    {Object.entries(selectedTemplateData.params).map(([key, param]) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">{param.label}</Label>
                          {typeof param.default === 'boolean' ? (
                            <Switch
                              checked={parameters[key] || false}
                              onCheckedChange={(checked) => handleParameterChange(key, checked)}
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-900">
                              {parameters[key] || param.default}
                              {param.label.includes('%') ? '%' : ''}
                            </span>
                          )}
                        </div>
                        {typeof param.default !== 'boolean' && (
                          <Slider
                            value={[parameters[key] || param.default]}
                            onValueChange={([value]) => handleParameterChange(key, value)}
                            min={param.min}
                            max={param.max}
                            step={param.step}
                            className="w-full"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Risk Warning:</strong> Strategy performance is not guaranteed and past results 
                  do not predict future returns. Start with paper trading to test strategies risk-free.
                </AlertDescription>
              </Alert>

              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !selectedTemplate || !selectedAccount || (!selectedSymbol && !customSymbol)}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  {isLoading ? 'Applying Strategy...' : 'Apply Strategy'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedTemplate('')}
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