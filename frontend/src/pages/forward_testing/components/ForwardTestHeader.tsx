import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Bell,
  BellOff,
  Download,
  Volume2,
  VolumeX,
  History
} from 'lucide-react';

interface ForwardTestHeaderProps {
  settings: {
    symbol?: string;
    timeframe?: string;
    slippage: number;
    commissionType?: 'fixed' | 'percentage';
    commission: number;
    soundEnabled: boolean;
    notificationsEnabled: boolean;
  };
  currentPrice: number;
  tradesCount: number;
  onToggleSound: () => void;
  onToggleNotifications: () => void;
  onExportData: () => void;
  onRestoreSession: () => void;
}

export const ForwardTestHeader: React.FC<ForwardTestHeaderProps> = ({
  settings,
  currentPrice,
  tradesCount,
  onToggleSound,
  onToggleNotifications,
  onExportData,
  onRestoreSession,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Forward Testing</h1>
          {settings.symbol && (
            <Badge variant="secondary" className="text-sm">
              {settings.symbol} • {settings.timeframe}
            </Badge>
          )}
          {currentPrice > 0 && (
            <Badge variant="outline" className="text-sm">
              ${currentPrice.toFixed(2)}
            </Badge>
          )}
          {settings.slippage > 0 && (
            <Badge variant="outline" className="text-sm">
              {(settings.slippage * 100).toFixed(2)}% slip
            </Badge>
          )}
          {settings.commissionType && (
            <Badge variant="outline" className="text-sm">
              {settings.commissionType === 'fixed' ? `$${settings.commission}` : `${settings.commission}%`} fee
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Live strategy testing with real-time market data and risk management
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onRestoreSession}
        >
          <History className="h-4 w-4 mr-2" />
          Restore Session
        </Button>
        <Button
          variant="outline"
          onClick={onExportData}
          disabled={tradesCount === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
        <Button
          variant="outline"
          onClick={onToggleSound}
        >
          {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          onClick={onToggleNotifications}
        >
          {settings.notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};