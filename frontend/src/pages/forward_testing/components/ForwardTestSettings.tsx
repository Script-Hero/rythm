import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, DollarSign } from 'lucide-react';
import CryptoSymbolSelector from '@/components/forms/crypto-symbol-selector';
import { ForwardTestSettings as ForwardTestingSettings } from '@/types/forward-testing';

// Types now imported from shared types file

interface ForwardTestSettingsProps {
  settings: ForwardTestingSettings;
  isRunning: boolean;
  onSettingsChange: (updates: Partial<ForwardTestingSettings>) => void;
  onBalanceChange: (balance: number) => void;
}

export const ForwardTestSettings: React.FC<ForwardTestSettingsProps> = ({
  settings,
  isRunning,
  onSettingsChange,
  onBalanceChange,
}) => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>

        {/* Basic Settings Tab */}
        <TabsContent value="basic" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Symbol & Timeframe
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Trading Symbol</label>
                  <CryptoSymbolSelector
                    value={settings.symbol}
                    onChange={(value) => onSettingsChange({ symbol: value })}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Timeframe</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={settings.timeframe}
                    onChange={(e) => onSettingsChange({ timeframe: e.target.value })}
                    disabled={isRunning}
                  >
                    <optgroup label="Sub-Minute (Tick-based)">
                      <option value="5s">5 Seconds</option>
                      <option value="10s">10 Seconds</option>
                      <option value="15s">15 Seconds</option>
                      <option value="30s">30 Seconds</option>
                    </optgroup>
                    <optgroup label="Coinbase Native">
                      <option value="1m">1 Minute</option>
                      <option value="5m">5 Minutes</option>
                      <option value="15m">15 Minutes</option>
                      <option value="1h">1 Hour</option>
                      <option value="6h">6 Hours</option>
                      <option value="1d">1 Day</option>
                    </optgroup>
                  </select>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Initial Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={settings.initialBalance}
                      onChange={(e) => {
                        const balance = parseFloat(e.target.value);
                        if (!isNaN(balance) && balance > 0) {
                          onBalanceChange(balance);
                        }
                      }}
                      placeholder="10000"
                      min="100"
                      max="1000000"
                      step="100"
                      disabled={isRunning}
                    />
                    <span className="flex items-center text-sm text-muted-foreground">USD</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Starting capital for paper trading (minimum: $100)
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Simulation Speed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Slider
                    value={[settings.speed]}
                    onValueChange={([value]) => onSettingsChange({ speed: value })}
                    min={1}
                    max={10}
                    step={1}
                    disabled={isRunning}
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>1x Real-time</span>
                    <span>{settings.speed}x Speed</span>
                    <span>10x Fast</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Execution Settings Tab */}
        <TabsContent value="execution" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    disabled={isRunning}
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
                    disabled={isRunning}
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
                    disabled={isRunning}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Feed Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <strong>Note:</strong> Position sizing is handled by your strategy blocks. Configure position sizing logic within your strategy nodes.
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Data Quality</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    defaultValue="standard"
                    disabled={isRunning}
                  >
                    <option value="tick">Tick-by-tick (Highest precision)</option>
                    <option value="high_freq">High Frequency (Sub-second)</option>
                    <option value="standard">Standard (OHLCV candles)</option>
                  </select>
                  <div className="text-xs text-muted-foreground mt-1">
                    Higher precision uses more resources
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    defaultChecked={true}
                    disabled={isRunning}
                  />
                  <label className="text-sm font-medium">Include extended hours data</label>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risk Management Tab */}
        <TabsContent value="risk" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Risk Controls</CardTitle>
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
                    disabled={isRunning}
                  />
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
                    disabled={isRunning}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.autoStop}
                    onCheckedChange={(checked) => onSettingsChange({ autoStop: checked })}
                    disabled={isRunning}
                  />
                  <label className="text-sm font-medium">Auto-stop on max drawdown</label>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};