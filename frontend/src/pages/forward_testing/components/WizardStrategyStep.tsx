import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { StrategyBrowserDialog } from '@/components/strategies/StrategyBrowserDialog';
import type { Strategy } from '@/types/strategy';

interface WizardStrategyStepProps {
  selectedStrategy: Strategy | null;
  onStrategySelect: (strategy: Strategy) => void;
}

export const WizardStrategyStep: React.FC<WizardStrategyStepProps> = ({
  selectedStrategy,
  onStrategySelect,
}) => {
  const [showStrategyDialog, setShowStrategyDialog] = useState(false);

  const handleStrategySelect = (strategy: Strategy) => {
    onStrategySelect(strategy);
    setShowStrategyDialog(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Select Trading Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Choose a strategy that has been compiled and tested. The strategy will control when to buy/sell during forward testing.
            </AlertDescription>
          </Alert>

          {selectedStrategy ? (
            <div className="p-4 border rounded-lg bg-green-50 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-green-800">{selectedStrategy.name}</h3>
                  <p className="text-sm text-green-600">
                    Strategy selected and ready for forward testing
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStrategyDialog(true)}
                >
                  Change Strategy
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Strategy Selected</h3>
              <p className="text-gray-500 mb-4">
                Select a trading strategy to begin forward testing
              </p>
              <Button onClick={() => setShowStrategyDialog(true)}>
                Browse Strategies
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <StrategyBrowserDialog
        open={showStrategyDialog}
        onOpenChange={setShowStrategyDialog}
        onLoadStrategy={handleStrategySelect}
        mode="load"
      />
    </div>
  );
};