import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Play,
  Pause,
  Square,
  Settings
} from 'lucide-react';

interface SessionStatsCardsProps {
  runningCount: number;
  pausedCount: number;
  stoppedCount: number;
  totalCount: number;
}

export const SessionStatsCards: React.FC<SessionStatsCardsProps> = ({
  runningCount,
  pausedCount,
  stoppedCount,
  totalCount,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Running</p>
              <p className="text-2xl font-bold text-green-600">{runningCount}</p>
            </div>
            <Play className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Paused</p>
              <p className="text-2xl font-bold text-yellow-600">{pausedCount}</p>
            </div>
            <Pause className="h-8 w-8 text-yellow-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Stopped</p>
              <p className="text-2xl font-bold text-gray-600">{stoppedCount}</p>
            </div>
            <Square className="h-8 w-8 text-gray-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Sessions</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </div>
            <Settings className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};