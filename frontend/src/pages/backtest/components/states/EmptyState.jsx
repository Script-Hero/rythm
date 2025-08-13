import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, Target } from "lucide-react";

const EmptyState = () => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md mx-auto text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle>Ready to Backtest</CardTitle>
          <CardDescription>
            Configure your parameters above and run a backtest to see strategy performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <span>Historical performance analysis</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Target className="h-4 w-4 text-green-500" />
              <span>Risk and return metrics</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span>Interactive charts and visualizations</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmptyState;