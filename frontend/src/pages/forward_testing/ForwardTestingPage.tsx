import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { StrategyBrowserDialog } from '@/components/strategies/StrategyBrowserDialog';
import type { Strategy } from '@/types/strategy';
import { useForwardTesting } from '@/contexts/ForwardTestingContext';
import { apiService } from '@/services/api';
import {
  ForwardTestSession,
  Portfolio,
  Metrics,
  Trade,
  Alert,
  ForwardTestSettings,
  SessionIdentifier
} from '@/types/forward-testing';
import {
  playTradeSound,
  sendNotification,
  exportSessionData,
  calculateRuntime
} from '@/utils/forward-testing';

// Import new components 
import { ForwardTestHeader } from './components/ForwardTestHeader';
import { StrategyControlPanel } from './components/StrategyControlPanel';
import { ForwardTestTabs } from './components/ForwardTestTabs';
import { SessionRestoreDialog } from './components/SessionRestoreDialog';

const ForwardTestingPage = () => {
  const { 
    activeSession,
    createSession,
    startTest,
    pauseTest,
    resumeTest,
    stopTest,
    restoreSession,
    getSessionPortfolio,
    getSessionMetrics,
    getSessionTrades,
    getSessionAlerts,
    addSessionAlert
  } = useForwardTesting();

  // Single session ID state - the page focuses on one session at a time
  const [currentSessionId, setCurrentSessionId] = useState<SessionIdentifier | null>(null);
  // Page-specific state (non-session data)
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [settings, setSettings] = useState<ForwardTestSettings>({
    symbol: 'BTC/USD',
    timeframe: '1m',
    speed: 1,
    soundEnabled: true,
    notificationsEnabled: true,
    autoStop: true,
    maxDrawdown: 10,
    initialBalance: 10000,
    slippage: 0.001,
    commission: 0.1,
    commissionType: 'percentage',
    maxPositions: 5,
  });

  // UI state
  const [activeTab, setActiveTab] = useState('overview');
  const [showStrategyDialog, setShowStrategyDialog] = useState(false);
  const [showSessionRestoreDialog, setShowSessionRestoreDialog] = useState(false);
  
  // Derived state from context - get session-specific data
  const currentSession = useMemo(() => {
    return currentSessionId && activeSession?.testId === currentSessionId ? activeSession : null;
  }, [currentSessionId, activeSession]);
  
  const portfolio = useMemo(() => {
    return currentSessionId ? getSessionPortfolio(currentSessionId) : null;
  }, [currentSessionId, getSessionPortfolio]);
  
  const metrics = useMemo(() => {
    return currentSessionId ? getSessionMetrics(currentSessionId) : null;
  }, [currentSessionId, getSessionMetrics]);
  
  const trades = useMemo(() => {
    return currentSessionId ? getSessionTrades(currentSessionId) : [];
  }, [currentSessionId, getSessionTrades]);
  
  const alerts = useMemo(() => {
    return currentSessionId ? getSessionAlerts(currentSessionId) : [];
  }, [currentSessionId, getSessionAlerts]);
  
  // Derived UI state
  const isRunning = currentSession?.status === 'RUNNING';
  const isPaused = currentSession?.status === 'PAUSED';
  const currentPrice = currentSession?.currentPrice || 0;
  const currentVolume = 100; // TODO: Get from real-time data

  // Simplified alert handler that uses context
  const addAlert = useCallback((type: Alert['type'], message: string) => {
    if (currentSessionId) {
      addSessionAlert(currentSessionId, type, message);
    }
  }, [currentSessionId, addSessionAlert]);

  const handleStop = useCallback(async () => {
    if (currentSessionId) {
      await stopTest(currentSessionId);
      addAlert('INFO', 'Forward testing stopped - data preserved for analysis');
    }
  }, [currentSessionId, stopTest, addAlert]);

  // All WebSocket handling is now centralized in the Context
  // No duplicate event handling needed in the page component

  // WebSocket handling is now centralized in ForwardTestingContext
  // No need for page-level WebSocket event listeners

  // Update selected strategy when session changes
  useEffect(() => {
    if (currentSession) {
      setSelectedStrategy({ name: currentSession.strategyName } as Strategy);
    }
  }, [currentSession]);

  // Session switching effect - data is now handled by context
  useEffect(() => {
    if (!currentSessionId) return;
    
    console.log('🔄 [ForwardTestingPage] Session switched to:', currentSessionId);
    
    // Context automatically handles historical data loading
    // No need for page-level data management
  }, [currentSessionId]);

  // Strategy selection handlers
  const handleStrategySelect = async (strategy: Strategy) => {
    if (!strategy) return;
    
    const sessionName = `${strategy.name} - ${new Date().toLocaleString()}`;
    const sessionId = await createSession(sessionName, strategy, settings);
    
    if (sessionId) {
      setCurrentSessionId(sessionId);
      setSelectedStrategy(strategy);
      setShowStrategyDialog(false);
      addAlert('SUCCESS', `Strategy "${strategy.name}" selected for forward testing`);
    }
  };

  // Control handlers
  const handlePlay = async () => {
    console.log('🚀 [ForwardTestingPage] handlePlay clicked!');
    console.log('🚀 [ForwardTestingPage] currentSessionId:', currentSessionId);
    
    if (currentSessionId) {
      console.log('🚀 [ForwardTestingPage] Calling startTest with sessionId:', currentSessionId);
      try {
        const success = await startTest(currentSessionId);
        console.log('🚀 [ForwardTestingPage] startTest returned:', success);
        if (success) {
          addAlert('INFO', 'Forward testing started');
        } else {
          console.log('❌ [ForwardTestingPage] startTest failed');
          addAlert('ERROR', 'Failed to start forward test');
        }
      } catch (error) {
        console.error('❌ [ForwardTestingPage] Error in startTest:', error);
        addAlert('ERROR', `Error starting test: ${error}`);
      }
    } else {
      console.log('❌ [ForwardTestingPage] No currentSessionId available');
      addAlert('ERROR', 'No session selected. Please select a strategy first.');
    }
  };

  const handlePauseResume = async () => {
    if (!currentSessionId) return;
    
    if (currentSession?.status === 'PAUSED') {
      await resumeTest(currentSessionId);
      addAlert('INFO', 'Forward testing resumed');
    } else {
      await pauseTest(currentSessionId);
      addAlert('INFO', 'Forward testing paused');
    }
  };

  // Settings handlers
  const handleSettingsChange = useCallback((updates: Partial<ForwardTestSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const handleBalanceChange = useCallback((balance: number) => {
    setSettings(prev => ({ ...prev, initialBalance: balance }));
  }, []);

  // Export functionality
  const handleExportData = () => {
    if (!currentSession || !portfolio || !metrics) {
      toast.error('No session data to export');
      return;
    }
    
    exportSessionData(currentSession, trades, portfolio, metrics);
    toast.success('Data exported successfully');
  };

  // Header action handlers
  const handleToggleSound = () => {
    setSettings(prev => ({ 
      ...prev, 
      soundEnabled: !prev.soundEnabled 
    }));
  };

  const handleToggleNotifications = () => {
    setSettings(prev => ({ 
      ...prev, 
      notificationsEnabled: !prev.notificationsEnabled 
    }));
  };

  const handleRestoreSession = () => {
    setShowSessionRestoreDialog(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <ForwardTestHeader
        settings={settings}
        currentPrice={currentPrice}
        tradesCount={trades.length}
        onToggleSound={handleToggleSound}
        onToggleNotifications={handleToggleNotifications}
        onExportData={handleExportData}
        onRestoreSession={handleRestoreSession}
      />

      <StrategyControlPanel
        selectedStrategy={selectedStrategy}
        isRunning={isRunning}
        isPaused={isPaused}
        onSelectStrategy={() => setShowStrategyDialog(true)}
        onPlay={handlePlay}
        onPauseResume={handlePauseResume}
        onStop={handleStop}
      />

      <ForwardTestTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        portfolio={portfolio || {
          cash: settings.initialBalance,
          positions: [],
          totalValue: settings.initialBalance,
          unrealizedPnL: 0,
          realizedPnL: 0
        }}
        metrics={metrics || {
          totalReturn: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          winRate: 0,
          totalTrades: 0,
          currentDrawdown: 0
        }}
        trades={trades}
        alerts={alerts}
        currentPrice={currentPrice}
        currentVolume={currentVolume}
        settings={settings}
        isRunning={isRunning}
        onSettingsChange={handleSettingsChange}
        onBalanceChange={handleBalanceChange}
      />

      <StrategyBrowserDialog
        open={showStrategyDialog}
        onOpenChange={setShowStrategyDialog}
        onLoadStrategy={handleStrategySelect}
        mode="load"
      />

      <SessionRestoreDialog
        open={showSessionRestoreDialog}
        onOpenChange={setShowSessionRestoreDialog}
        onSessionRestore={(sessionData) => {
          console.log(sessionData);
          restoreSession(sessionData);
          setShowSessionRestoreDialog(false);
          addAlert('SUCCESS', 'Session restored successfully');
        }}
      />
    </div>
  );
};

export default ForwardTestingPage;