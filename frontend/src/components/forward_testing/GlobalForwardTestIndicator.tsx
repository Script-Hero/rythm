import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Play, Pause, Square, Activity, ExternalLink, Plus, Eye, MoreHorizontal } from 'lucide-react';
import { useForwardTesting } from '@/contexts/ForwardTestingContext';
import { useNavigate } from 'react-router-dom';

export const GlobalForwardTestIndicator = () => {
  const { sessions, isConnected, pauseTest, resumeTest, stopTest } = useForwardTesting();
  const navigate = useNavigate();
  const [showPopover, setShowPopover] = useState(false);

  const activeSessions = sessions.filter(s => s.isActive);
  const runningCount = activeSessions.filter(s => s.status === 'RUNNING').length;
  const pausedCount = activeSessions.filter(s => s.status === 'PAUSED').length;
  const totalActive = runningCount + pausedCount;

  if (totalActive === 0) {
    return null;
  }

  const handleViewDetails = () => {
    setShowPopover(false);
    navigate('/forward-testing');
  };

  const handleSessionView = (sessionId: string) => {
    setShowPopover(false);
    navigate(`/forward-testing/session/${sessionId}`);
  };

  const handleSessionAction = async (sessionId: string, action: 'pause' | 'resume' | 'stop') => {
    try {
      switch (action) {
        case 'pause':
          await pauseTest(sessionId);
          break;
        case 'resume':
          await resumeTest(sessionId);
          break;
        case 'stop':
          await stopTest(sessionId);
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} session:`, error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'STOPPED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDuration = (startTime: Date) => {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatPnL = (pnl: number) => {
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}${pnl.toFixed(2)}%`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Popover open={showPopover} onOpenChange={setShowPopover}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="shadow-lg bg-white hover:bg-gray-50 border-2"
            size="sm"
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                runningCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
              }`} />
              <Activity className="h-4 w-4" />
              <span className="font-medium">{totalActive} Active</span>
              {runningCount > 0 && pausedCount > 0 && (
                <Badge variant="secondary" className="text-xs px-1 py-0">
                  {runningCount}R/{pausedCount}P
                </Badge>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        
        <PopoverContent 
          className="w-96 p-0"
          side="top"
          align="end"
          sideOffset={8}
        >
          <Card className="border-0 shadow-none">
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Active Forward Tests</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {totalActive} Sessions
                    </Badge>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${
                        isConnected ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="text-xs text-muted-foreground">
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sessions List */}
                <ScrollArea className="h-[320px] pr-4">
                  <div className="space-y-3">
                    {activeSessions.map((session, index) => (
                      <div key={session.testId}>
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{session.name}</p>
                                <Badge size="sm" className={getStatusColor(session.status)}>
                                  {session.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {session.strategyName}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Duration:</span>
                              <div className="font-medium">{formatDuration(session.startTime)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">P&L:</span>
                              <div className={`font-medium ${
                                session.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatPnL(session.pnlPercent)}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Trades:</span>
                              <div className="font-medium">{session.totalTrades}</div>
                            </div>
                          </div>

                          {/* Session Actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSessionView(session.testId)}
                              className="flex-1 h-7"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            
                            {session.status === 'RUNNING' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSessionAction(session.testId, 'pause')}
                                className="h-7 px-2"
                              >
                                <Pause className="h-3 w-3" />
                              </Button>
                            ) : session.status === 'PAUSED' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSessionAction(session.testId, 'resume')}
                                className="h-7 px-2"
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                            ) : null}
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSessionAction(session.testId, 'stop')}
                              className="h-7 px-2 text-red-600 hover:text-red-700"
                            >
                              <Square className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {index < activeSessions.length - 1 && (
                          <Separator className="mt-3" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Footer Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowPopover(false);
                      navigate('/forward-testing/create');
                    }}
                    className="flex-1"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New Session
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={handleViewDetails}
                    className="flex-1"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Manage All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
};