import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Settings, DollarSign } from 'lucide-react';
import CryptoSymbolSelector from '@/components/forms/crypto-symbol-selector';

interface SessionSettings {
  name: string;
  symbol: string;
  timeframe: string;
  speed: number;
  initialBalance: number;
}

interface WizardBasicStepProps {
  settings: SessionSettings;
  onSettingsChange: (updates: Partial<SessionSettings>) => void;
}

export const WizardBasicStep: React.FC<WizardBasicStepProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Session Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Session Name</label>
              <Input
                value={settings.name}
                onChange={(e) => onSettingsChange({ name: e.target.value })}
                placeholder="My Forward Test Session"
              />
              <div className="text-xs text-muted-foreground mt-1">
                A descriptive name for this testing session
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Trading Symbol</label>
              <CryptoSymbolSelector
                value={settings.symbol}
                onChange={(value) => onSettingsChange({ symbol: value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Timeframe</label>
              <select
                className="w-full p-2 border rounded-md"
                value={settings.timeframe}
                onChange={(e) => onSettingsChange({ timeframe: e.target.value })}
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
              <div className="text-xs text-muted-foreground mt-1">
                Data granularity for price simulation and strategy execution
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Trading Configuration  
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Initial Balance</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={settings.initialBalance}
                  onChange={(e) => {
                    const balance = parseFloat(e.target.value);
                    if (!isNaN(balance) && balance > 0) {
                      onSettingsChange({ initialBalance: balance });
                    }
                  }}
                  placeholder="10000"
                  min="100"
                  max="1000000"
                  step="100"
                />
                <span className="flex items-center text-sm text-muted-foreground">USD</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Starting capital for paper trading (minimum: $100)
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Simulation Speed</label>
              <Slider
                value={[settings.speed]}
                onValueChange={([value]) => onSettingsChange({ speed: value })}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>1x Real-time</span>
                <span>{settings.speed}x Speed</span>
                <span>10x Fast</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                How fast the simulation runs compared to real-time
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};