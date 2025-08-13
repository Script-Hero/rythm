import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Drawdown from "../../../../components/charts/backtest/Drawdown.jsx";
import RiskMetrics from "../../../../components/charts/backtest/RiskMetrics.jsx";
import UnderwaterCurve from "../../../../components/charts/backtest/UnderwaterCurve.jsx";

const RiskTab = ({ backtestResults }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Drawdown */}
      <Card>
        <CardHeader>
          <CardTitle>Drawdown Analysis</CardTitle>
          <CardDescription>
            Peak-to-trough portfolio decline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Drawdown backtestResults={backtestResults} />
        </CardContent>
      </Card>

      {/* Underwater Curve */}
      <Card>
        <CardHeader>
          <CardTitle>Underwater Curve</CardTitle>
          <CardDescription>
            Drawdown periods and recovery times
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UnderwaterCurve backtestResults={backtestResults} />
        </CardContent>
      </Card>

      {/* Risk Metrics */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Risk Metrics</CardTitle>
          <CardDescription>
            Comprehensive risk assessment indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RiskMetrics backtestResults={backtestResults} />
        </CardContent>
      </Card>
    </div>
  );
};

export default RiskTab;