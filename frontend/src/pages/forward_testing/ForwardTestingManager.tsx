import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Settings, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import { useForwardTesting } from '@/contexts/ForwardTestingContext';
import type {
  ForwardTestSession,
  SessionStatusFilter,
  SessionIdentifier
} from '@/types/forward-testing';
import {
  calculateRuntime,
  getSessionsByStatus
} from '@/utils/forward-testing';

// Import new components
import { SessionStatsCards } from './components/SessionStatsCards';
import { SessionFilters } from './components/SessionFilters';
import { SessionCard } from './components/SessionCard';

// Types now imported from shared types file

const ForwardTestingManager = () => {
  const navigate = useNavigate();
  const { sessions, pauseTest, resumeTest, stopTest, deleteSession } = useForwardTesting();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>('ALL');
  const [loading, setLoading] = useState(true);

  // Convert context sessions to ForwardTestSession format  
  const formattedSessions = React.useMemo(() => {    
    return (sessions || []).map((s) => ({
      testId: s.testId,
      name: s.name,
      strategyName: s.strategyName,
      status: s.status,
      startTime: s.startTime,
      isActive: s.isActive,
      settings: s.settings,
      symbol: s.symbol,
      timeframe: s.timeframe,
      portfolioValue: s.portfolioValue,
      initialBalance: s.portfolioValue,
      totalTrades: s.totalTrades,
      pnlPercent: s.pnlPercent,
      pnlDollar: s.pnlDollar,
      maxDrawdown: s.maxDrawdown,
      winRate: s.winRate,
      currentPrice: s.currentPrice || 0,
      runtime: s.startTime ? calculateRuntime(s.startTime) : 0
    }));
  }, [sessions]);

  // Set loading to false when context data is available
  useEffect(() => {
    if (sessions !== undefined) {
      setLoading(false);
    }
  }, [sessions]);


  useEffect(() => {
    console.log(formattedSessions);
  }, [formattedSessions])

  const filteredSessions = formattedSessions.filter(session => {
    const sessionName = session.name || `${session.strategyName} Test`;
    const matchesSearch = sessionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.strategyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || session.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSessionAction = async (sessionId: SessionIdentifier, action: 'pause' | 'resume' | 'stop' | 'delete') => {
    console.log(`Attempting to ${action} session:`, sessionId);
    try {
      switch (action) {
        case 'pause':
          await pauseTest(sessionId);
          toast.success('Session paused');
          break;
        case 'resume':
          await resumeTest(sessionId);
          toast.success('Session resumed');
          break;
        case 'stop':
          await stopTest(sessionId);
          toast.success('Session stopped');
          break;
        case 'delete':
          await deleteSession(sessionId);
          toast.success('Session deleted');
          break;
      }
      // Context will automatically update the sessions
    } catch (error) {
      console.error(`Failed to ${action} session:`, error);
      toast.error(`Failed to ${action} session - this feature requires backend updates`);
    }
  };

  const handleCreateNew = () => {
    navigate('/forward-testing/create');
  };

  const handleViewSession = (sessionId: SessionIdentifier) => {
    navigate(`/forward-testing/session/${sessionId}`);
  };

  // Stats calculations using utility functions
  const getRunningCount = () => getSessionsByStatus(formattedSessions, 'RUNNING').length;
  const getPausedCount = () => getSessionsByStatus(formattedSessions, 'PAUSED').length;
  const getStoppedCount = () => getSessionsByStatus(formattedSessions, 'STOPPED').length;

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading forward testing sessions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Forward Testing Manager</h1>
          <p className="text-muted-foreground">
            Manage multiple forward testing sessions and monitor their performance
          </p>
        </div>
        <Button onClick={handleCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Create New Test
        </Button>
      </div>

      {/* Backend Notice */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Multi-session management requires backend database updates. 
          Session creation currently uses the existing single-session API and some features may be limited.
        </AlertDescription>
      </Alert>

      {/* Stats Overview */}
      <SessionStatsCards
        runningCount={getRunningCount()}
        pausedCount={getPausedCount()}
        stoppedCount={getStoppedCount()}
        totalCount={formattedSessions.length}
      />

      {/* Filters and Search */}
      <SessionFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSessions.map((session) => (
          <SessionCard
            key={session.testId}
            session={session}
            onView={handleViewSession}
            onAction={handleSessionAction}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredSessions.length === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm || statusFilter !== 'ALL' ? 'No sessions found' : 'No forward testing sessions yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'ALL' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first forward testing session to start paper trading your strategies. Note: Full session management requires backend updates.'
              }
            </p>
            {!searchTerm && statusFilter === 'ALL' && (
              <Button onClick={handleCreateNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Test
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ForwardTestingManager;