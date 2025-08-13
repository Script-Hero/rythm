import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Square, Settings, Zap } from 'lucide-react';
import type { Strategy } from '@/types/strategy';

interface StrategyControlPanelProps {
  selectedStrategy: Strategy | null;
  isRunning: boolean;
  isPaused: boolean;
  onSelectStrategy: () => void;
  onPlay: () => void;
  onPauseResume: () => void;
  onStop: () => void;
}

export const StrategyControlPanel = ({
  selectedStrategy,
  isRunning,
  isPaused,
  onSelectStrategy,
  onPlay,
  onPauseResume,
  onStop,
}: StrategyControlPanelProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Strategy Control
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Strategy Selection */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Selected Strategy</div>
              {selectedStrategy ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedStrategy.category}</Badge>
                  <span className="font-medium">{selectedStrategy.name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSelectStrategy}
                    disabled={isRunning}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <Button onClick={onSelectStrategy} variant="outline">
                  Select Strategy
                </Button>
              )}
            </div>

            {/* Status Indicator */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Status</div>
              <div className="flex items-center gap-2">
                <div 
                  className={`w-3 h-3 rounded-full ${
                    isRunning && !isPaused ? 'bg-green-500 animate-pulse' : 
                    isPaused ? 'bg-yellow-500' : 'bg-gray-300'
                  }`} 
                />
                <span className="text-sm">
                  {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Stopped'}
                </span>
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <Button 
                onClick={onPlay}
                disabled={!selectedStrategy}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Test
              </Button>
            ) : (
              <>
                <Button 
                  onClick={onPauseResume}
                  variant="outline"
                  className={isPaused ? "bg-green-50 hover:bg-green-100 border-green-300" : ""}
                >
                  {isPaused ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  )}
                </Button>
                <Button 
                  onClick={onStop}
                  variant="destructive"
                  size="sm"
                >
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Strategy Details */}
        {selectedStrategy && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">
              {selectedStrategy.description || 'No description available'}
            </div>
            {selectedStrategy.tags && selectedStrategy.tags.length > 0 && (
              <div className="flex gap-1 mt-2">
                {selectedStrategy.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};