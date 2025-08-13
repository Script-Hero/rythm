import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Clock, TrendingUp } from 'lucide-react';
import { apiService } from '@/services/api';

interface SessionRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreSession: (sessionData: any) => void;
}

export const SessionRestoreDialog = ({ 
  open, 
  onOpenChange, 
  onRestoreSession 
}: SessionRestoreDialogProps) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Load user sessions when dialog opens
  useEffect(() => {
    if (open) {
      loadSessions();
    }
  }, [open]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const response = await apiService.getUserSessions();
      if (response.success) {
        setSessions(response.message?.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (sessionId: string) => {
    setRestoring(sessionId);
    try {
      const response = await apiService.restoreSessionData(sessionId);
      if (response.success) {
        onRestoreSession(response);
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-green-100 text-green-800';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
      case 'STOPPED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Restore Previous Session
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading sessions...</p>
            </div>
          ) : (
            <>
              {/* Active Sessions */}
              {sessions.filter(s => s.status === 'RUNNING' || s.status === 'PAUSED').length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Active Sessions
                  </h3>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {sessions.filter(s => s.status === 'RUNNING' || s.status === 'PAUSED').map((session) => (
                        <div 
                          key={session.id} 
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{session.strategyName}</span>
                              <Badge variant="outline">{session.symbol}</Badge>
                              <Badge className={getStatusColor(session.status)}>
                                {session.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Started: {formatDate(session.startTime)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleRestore(session.id)}
                            disabled={restoring === session.id}
                          >
                            {restoring === session.id ? 'Restoring...' : 'Continue'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Recent Sessions */}
              {sessions.filter(s => s.status !== 'RUNNING' && s.status !== 'PAUSED').length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    Recent Sessions
                  </h3>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {sessions.filter(s => s.status !== 'RUNNING' && s.status !== 'PAUSED').map((session) => (
                        <div 
                          key={session.id} 
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{session.strategyName}</span>
                              <Badge variant="outline">{session.symbol}</Badge>
                              <Badge className={getStatusColor(session.status)}>
                                {session.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Started: {formatDate(session.startTime)}
                              {session.last_activity && (
                                <> • Last activity: {formatDate(session.last_activity)}</>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(session.id)}
                            disabled={restoring === session.id}
                          >
                            {restoring === session.id ? 'Restoring...' : 'Restore'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {sessions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No previous sessions found</p>
                  <p className="text-sm">Start a forward test to create your first session</p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};