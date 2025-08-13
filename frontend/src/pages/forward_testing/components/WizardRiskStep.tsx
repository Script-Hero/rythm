import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Shield } from 'lucide-react';

interface RiskSettings {
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

interface WizardRiskStepProps {
  settings: RiskSettings;
  onSettingsChange: (updates: Partial<RiskSettings>) => void;
}

export const WizardRiskStep: React.FC<WizardRiskStepProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Risk Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Max Drawdown (%)</label>
              <Input
                type="number"
                value={settings.maxDrawdown}
                onChange={(e) => onSettingsChange({ maxDrawdown: parseFloat(e.target.value) || 0 })}
                min="1"
                max="50"
                step="1"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Stop testing if portfolio drops by this percentage
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Max Positions</label>
              <Input
                type="number"
                value={settings.maxPositions}
                onChange={(e) => onSettingsChange({ maxPositions: parseInt(e.target.value) || 1 })}
                min="1"
                max="20"
                step="1"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Maximum number of concurrent positions
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Max Daily Trades</label>
              <Input
                type="number"
                value={settings.maxDailyTrades}
                onChange={(e) => onSettingsChange({ maxDailyTrades: parseInt(e.target.value) || 0 })}
                min="0"
                max="100"
                step="1"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Limit number of trades per day (0 = unlimited)
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Max Daily Loss ($)</label>
              <Input
                type="number"
                value={settings.maxDailyLoss}
                onChange={(e) => onSettingsChange({ maxDailyLoss: parseFloat(e.target.value) || 0 })}
                min="0"
                step="10"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Stop trading if daily loss exceeds this amount
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={settings.autoStop}
                onCheckedChange={(checked) => onSettingsChange({ autoStop: checked })}
              />
              <label className="text-sm font-medium">Auto-stop on max drawdown</label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trading Costs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Slippage (%)</label>
              <Input
                type="number"
                value={settings.slippage * 100}
                onChange={(e) => onSettingsChange({ slippage: parseFloat(e.target.value) / 100 })}
                min="0"
                max="5"
                step="0.01"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Price impact when executing trades (0.1% is typical)
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Commission Type</label>
              <select
                className="w-full p-2 border rounded-md"
                value={settings.commissionType}
                onChange={(e) => onSettingsChange({ commissionType: e.target.value as 'fixed' | 'percentage' })}
              >
                <option value="percentage">Percentage of Trade</option>
                <option value="fixed">Fixed Dollar Amount</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {settings.commissionType === 'percentage' ? 'Commission (%)' : 'Commission ($)'}
              </label>
              <Input
                type="number"
                value={settings.commission}
                onChange={(e) => onSettingsChange({ commission: parseFloat(e.target.value) || 0 })}
                min="0"
                step={settings.commissionType === 'percentage' ? '0.001' : '0.01'}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Default Stop Loss (%)</label>
              <Input
                type="number"
                value={settings.stopLossDefault}
                onChange={(e) => onSettingsChange({ stopLossDefault: parseFloat(e.target.value) || 0 })}
                min="0"
                max="50"
                step="0.5"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Default stop loss for positions (0 = none)
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Default Take Profit (%)</label>
              <Input
                type="number"
                value={settings.takeProfitDefault}
                onChange={(e) => onSettingsChange({ takeProfitDefault: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
                step="0.5"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Default take profit for positions (0 = none)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};