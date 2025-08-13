import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, TrendingUp, Settings, DollarSign, Shield } from 'lucide-react';
import type { Strategy } from '@/types/strategy';

interface SessionSettings {
  name: string;
  symbol: string;
  timeframe: string;
  speed: number;
  initialBalance: number;
  maxDrawdown: number;
  maxPositions: number;
  maxDailyTrades: number;
  maxDailyLoss: number;
  stopLossDefault: number;
  takeProfitDefault: number;
  autoStop: boolean;
  slippage: number;
  commission: number;
  commissionType: 'fixed' | 'percentage';
}

interface WizardReviewStepProps {
  selectedStrategy: Strategy | null;
  settings: SessionSettings;
}

export const WizardReviewStep: React.FC<WizardReviewStepProps> = ({
  selectedStrategy,
  settings,
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Configuration</h2>
        <p className="text-gray-600">
          Please review your forward testing session settings before proceeding
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strategy Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Selected Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedStrategy ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800">{selectedStrategy.name}</h3>
                <Badge variant="secondary" className="mt-2">Ready for Testing</Badge>
              </div>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">No strategy selected</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Basic Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Session Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{settings.name || 'Unnamed Session'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Symbol:</span>
                <span className="font-medium">{settings.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timeframe:</span>
                <span className="font-medium">{settings.timeframe}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Speed:</span>
                <span className="font-medium">{settings.speed}x</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Initial Balance:</span>
                <span className="font-medium">{formatCurrency(settings.initialBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slippage:</span>
                <span className="font-medium">{(settings.slippage * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commission:</span>
                <span className="font-medium">
                  {settings.commissionType === 'fixed' 
                    ? formatCurrency(settings.commission)
                    : `${settings.commission}%`
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Risk Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Drawdown:</span>
                <span className="font-medium">{settings.maxDrawdown}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Positions:</span>
                <span className="font-medium">{settings.maxPositions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Daily Trade Limit:</span>
                <span className="font-medium">
                  {settings.maxDailyTrades === 0 ? 'Unlimited' : settings.maxDailyTrades}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Daily Loss Limit:</span>
                <span className="font-medium">
                  {settings.maxDailyLoss === 0 ? 'None' : formatCurrency(settings.maxDailyLoss)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-stop:</span>
                <span className="font-medium">
                  {settings.autoStop ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};