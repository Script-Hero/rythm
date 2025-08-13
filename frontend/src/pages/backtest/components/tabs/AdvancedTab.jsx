import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import RollingBeta from "../../../../components/charts/backtest/RollingBeta.jsx";
import RollingSharpe from "../../../../components/charts/backtest/RollingSharpe.jsx";
import RollingVolatility from "../../../../components/charts/backtest/RollingVolatility.jsx";
import PerformanceAttribution from "../../../../components/charts/backtest/PerformanceAttribution.jsx";

const AdvancedTab = ({ backtestResults }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Rolling Sharpe */}
      <Card>
        <CardHeader>
          <CardTitle>Rolling Sharpe Ratio</CardTitle>
          <CardDescription>
            Risk-adjusted return over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RollingSharpe backtestResults={backtestResults} />
        </CardContent>
      </Card>

      {/* Rolling Volatility */}
      <Card>
        <CardHeader>
          <CardTitle>Rolling Volatility</CardTitle>
          <CardDescription>
            Portfolio volatility changes over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RollingVolatility backtestResults={backtestResults} />
        </CardContent>
      </Card>

      {/* Rolling Beta */}
      <Card>
        <CardHeader>
          <CardTitle>Rolling Beta</CardTitle>
          <CardDescription>
            Market correlation coefficient over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RollingBeta backtestResults={backtestResults} />
        </CardContent>
      </Card>

      {/* Performance Attribution */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Attribution</CardTitle>
          <CardDescription>
            Sources of portfolio performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PerformanceAttribution backtestResults={backtestResults} />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedTab;