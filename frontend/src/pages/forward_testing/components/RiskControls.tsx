import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Settings, AlertTriangle, Zap } from 'lucide-react';

interface Settings {
  speed: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoStop: boolean;
  maxDrawdown: number;
  maxRisk: number;
}

interface RiskControlsProps {
  settings: Settings;
  onSettingsChange: (newSettings: Partial<Settings>) => void;
}

export const RiskControls = ({ settings, onSettingsChange }: RiskControlsProps) => {
  const handleSpeedChange = (value: number[]) => {
    onSettingsChange({ speed: value[0] });
  };

  const handleMaxDrawdownChange = (value: number[]) => {
    onSettingsChange({ maxDrawdown: value[0] });
  };

  const handleMaxRiskChange = (value: number[]) => {
    onSettingsChange({ maxRisk: value[0] });
  };

  const getSpeedLabel = (speed: number) => {
    switch (speed) {
      case 1: return '1x (Real-time)';
      case 2: return '2x (2x Speed)';
      case 5: return '5x (Fast)';
      case 10: return '10x (Very Fast)';
      default: return `${speed}x`;
    }
  };

  const getRiskLevel = (drawdown: number) => {
    if (drawdown <= 5) return { level: 'Conservative', color: 'bg-green-100 text-green-800' };
    if (drawdown <= 10) return { level: 'Moderate', color: 'bg-yellow-100 text-yellow-800' };
    if (drawdown <= 20) return { level: 'Aggressive', color: 'bg-orange-100 text-orange-800' };
    return { level: 'Very Aggressive', color: 'bg-red-100 text-red-800' };
  };

  const riskLevel = getRiskLevel(settings.maxDrawdown);

  return (
    <div className="space-y-6">
      {/* Simulation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Simulation Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Speed Control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="speed">Simulation Speed</Label>
              <Badge variant="outline">{getSpeedLabel(settings.speed)}</Badge>
            </div>
            <Slider
              id="speed"
              value={[settings.speed]}
              onValueChange={handleSpeedChange}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Higher speeds accelerate the simulation for faster testing
            </div>
          </div>

          {/* Notification Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="sound">Sound Alerts</Label>
              <Switch
                id="sound"
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => onSettingsChange({ soundEnabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notifications">Browser Notifications</Label>
              <Switch
                id="notifications"
                checked={settings.notificationsEnabled}
                onCheckedChange={(checked) => onSettingsChange({ notificationsEnabled: checked })}
              />
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
        <CardContent className="space-y-6">
          {/* Auto-Stop Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="autoStop">Auto-Stop on Risk Limit</Label>
              <Switch
                id="autoStop"
                checked={settings.autoStop}
                onCheckedChange={(checked) => onSettingsChange({ autoStop: checked })}
              />
            </div>

            {settings.autoStop && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Trading will automatically stop when risk limits are exceeded
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Maximum Drawdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="maxDrawdown">Maximum Drawdown (%)</Label>
              <div className="flex items-center gap-2">
                <Badge className={riskLevel.color}>
                  {riskLevel.level}
                </Badge>
                <span className="text-sm font-medium">{settings.maxDrawdown}%</span>
              </div>
            </div>
            <Slider
              id="maxDrawdown"
              value={[settings.maxDrawdown]}
              onValueChange={handleMaxDrawdownChange}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Maximum acceptable portfolio drawdown before auto-stop
            </div>
          </div>

          {/* Position Size Risk */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="maxRisk">Max Position Risk (%)</Label>
              <span className="text-sm font-medium">{settings.maxRisk}%</span>
            </div>
            <Slider
              id="maxRisk"
              value={[settings.maxRisk]}
              onValueChange={handleMaxRiskChange}
              min={1}
              max={20}
              step={0.5}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Maximum risk per trade as percentage of portfolio
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Performance Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Performance Targets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Target Return (%)</Label>
              <Select defaultValue="10">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5% (Conservative)</SelectItem>
                  <SelectItem value="10">10% (Moderate)</SelectItem>
                  <SelectItem value="15">15% (Aggressive)</SelectItem>
                  <SelectItem value="20">20% (Very Aggressive)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Min Sharpe Ratio</Label>
              <Select defaultValue="1">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5 (Low)</SelectItem>
                  <SelectItem value="1">1.0 (Good)</SelectItem>
                  <SelectItem value="1.5">1.5 (Excellent)</SelectItem>
                  <SelectItem value="2">2.0 (Outstanding)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Set performance targets to automatically evaluate strategy success
          </div>
        </CardContent>
      </Card>

      {/* Current Risk Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Risk Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Risk Profile:</span>
              <Badge className={riskLevel.color}>{riskLevel.level}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Auto-Stop:</span>
              <Badge variant={settings.autoStop ? "default" : "secondary"}>
                {settings.autoStop ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Max Drawdown:</span>
              <span className="text-sm font-medium">{settings.maxDrawdown}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Max Position Risk:</span>
              <span className="text-sm font-medium">{settings.maxRisk}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};