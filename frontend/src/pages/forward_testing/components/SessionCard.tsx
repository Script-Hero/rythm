import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Eye,
  Play,
  Pause,
  Square,
  Trash2,
  Clock,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import type { ForwardTestSession } from '@/types/forward-testing';
import {
  formatCurrency,
  formatRuntime,
  getStatusColor,
  getPnLColor
} from '@/utils/forward-testing';

// Types now imported from shared types file

interface SessionCardProps {
  session: ForwardTestSession;
  onView: (sessionId: string) => void;
  onAction: (sessionId: string, action: 'pause' | 'resume' | 'stop' | 'delete') => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onView,
  onAction,
}) => {
  const sessionId = session.session_id; // Use session_id from standardized ForwardTestSession type
  
  // Guard against undefined values that cause toFixed() errors - use standardized field names
  const safePnlPercent = typeof session.total_return === 'number' ? session.total_return : 0;
  const safePnlDollar = typeof session.total_pnl === 'number' ? session.total_pnl : 0;
  const safeWinRate = typeof session.win_rate === 'number' ? session.win_rate : 0;
  const safeMaxDrawdown = typeof session.max_drawdown === 'number' ? session.max_drawdown : 0;
  
  // Debug logging to identify undefined sessionId issue
  if (!sessionId) {
    console.warn('SessionCard: sessionId is undefined', { session, session_id: session.session_id });
  }
  const sessionName = session.session_name || `${session.strategy_name} Test`;
  const runtime = session.status === 'RUNNING' || session.status === 'PAUSED'
    ? Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000)
    : (session.runtime || 0);

  // Utility functions now imported from utils

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg truncate">{sessionName}</CardTitle>
            <p className="text-sm text-muted-foreground truncate">
              {session.strategy_name}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => sessionId ? onView(sessionId) : console.warn('Cannot view session: sessionId is undefined')}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {session.status === 'RUNNING' && (
                <DropdownMenuItem onClick={() => sessionId && onAction(sessionId, 'pause')}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </DropdownMenuItem>
              )}
              {session.status === 'PAUSED' && (
                <DropdownMenuItem onClick={() => sessionId && onAction(sessionId, 'resume')}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </DropdownMenuItem>
              )}
              {session.status !== 'STOPPED' && (
                <DropdownMenuItem onClick={() => sessionId && onAction(sessionId, 'stop')}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => sessionId && onAction(sessionId, 'delete')}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status and Runtime */}
        <div className="flex items-center justify-between">
          <Badge className={getStatusColor(session.status)}>
            {session.status}
          </Badge>
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4 mr-1" />
            {formatRuntime(runtime)}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">P&L</p>
            <p className={`font-semibold ${getPnLColor(safePnlPercent)}`}>
              {safePnlPercent >= 0 ? '+' : ''}{safePnlPercent.toFixed(2)}%
            </p>
            <p className={`text-xs ${getPnLColor(safePnlDollar)}`}>
              {formatCurrency(safePnlDollar)}
            </p>
          </div>
          
          <div>
            <p className="text-muted-foreground">Trades</p>
            <p className="font-semibold">{session.total_trades}</p>
            <p className="text-xs text-muted-foreground">
              {safeWinRate.toFixed(1)}% wins
            </p>
          </div>
        </div>

        {/* Trading Pair and Portfolio */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Symbol</p>
            <p className="font-mono">{session.symbol} • {session.timeframe}</p>
          </div>
          
          <div>
            <p className="text-muted-foreground">Portfolio</p>
            <p className="font-semibold">{formatCurrency(session.current_portfolio_value || session.initial_balance || 10000)}</p>
            <p className="text-xs text-muted-foreground">
              Max DD: {safeMaxDrawdown.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            onClick={() => sessionId ? onView(sessionId) : console.warn('Cannot view session: sessionId is undefined')}
            disabled={!sessionId}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          
          {session.status === 'RUNNING' && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => sessionId && onAction(sessionId, 'pause')}
              disabled={!sessionId}
            >
              <Pause className="h-4 w-4" />
            </Button>
          )}
          
          {session.status === 'PAUSED' && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => sessionId && onAction(sessionId, 'resume')}
              disabled={!sessionId}
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
          
          {session.status !== 'STOPPED' && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => sessionId && onAction(sessionId, 'stop')}
              disabled={!sessionId}
            >
              <Square className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
