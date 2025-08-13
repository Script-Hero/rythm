import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiveMetricsDashboard } from './LiveMetricsDashboard';
import { ChartsGrid } from './ChartsGrid';
import { TradeAlerts } from './TradeAlerts';
import { PerformanceStats } from './PerformanceStats';
import { ForwardTestSettings } from './ForwardTestSettings';
import {
  Portfolio,
  Metrics,
  Trade,
  Alert,
  ForwardTestSettings as ForwardTestingSettings
} from '@/types/forward-testing';

// Types now imported from shared types file

interface ForwardTestTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  portfolio: Portfolio;
  metrics: Metrics;
  trades: Trade[];
  alerts: Alert[];
  currentPrice: number;
  currentVolume: number;
  settings: ForwardTestingSettings;
  isRunning: boolean;
  onSettingsChange: (updates: Partial<ForwardTestingSettings>) => void;
  onBalanceChange: (balance: number) => void;
}

export const ForwardTestTabs: React.FC<ForwardTestTabsProps> = ({
  activeTab,
  onTabChange,
  portfolio,
  metrics,
  trades,
  alerts,
  currentPrice,
  currentVolume,
  settings,
  isRunning,
  onSettingsChange,
  onBalanceChange,
}) => {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="charts">Charts</TabsTrigger>
        <TabsTrigger value="trades">Trades</TabsTrigger>
        <TabsTrigger value="alerts">Alerts</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LiveMetricsDashboard
              portfolio={portfolio}
              metrics={metrics}
              currentPrice={currentPrice}
            />
          </div>
          <div>
            <PerformanceStats metrics={metrics} />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="charts">
        <ChartsGrid
          trades={trades}
          portfolio={portfolio}
          metrics={metrics}
          currentPrice={currentPrice}
          currentVolume={currentVolume}
        />
      </TabsContent>

      <TabsContent value="trades">
        <TradeAlerts trades={trades} />
      </TabsContent>

      <TabsContent value="alerts">
        <TradeAlerts trades={[]} alerts={alerts} />
      </TabsContent>

      <TabsContent value="settings">
        <ForwardTestSettings
          settings={settings}
          isRunning={isRunning}
          onSettingsChange={onSettingsChange}
          onBalanceChange={onBalanceChange}
        />
      </TabsContent>
    </Tabs>
  );
};