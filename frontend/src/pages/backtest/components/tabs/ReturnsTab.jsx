import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MonthlyReturns from "../../../../components/charts/backtest/MonthlyReturns.jsx";
import AnnualReturns from "../../../../components/charts/backtest/AnnualReturns.jsx";
import CumulativeReturns from "../../../../components/charts/backtest/CumulativeReturns.jsx";
import DailyReturns from "../../../../components/charts/backtest/DailyReturns.jsx";

const ReturnsTab = ({ backtestResults }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Cumulative Returns */}
      <Card>
        <CardHeader>
          <CardTitle>Cumulative Returns</CardTitle>
          <CardDescription>
            Growth of portfolio value over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CumulativeReturns backtestResults={backtestResults} />
        </CardContent>
      </Card>

      {/* Daily Returns */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Returns Distribution</CardTitle>
          <CardDescription>
            Histogram of daily return percentages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailyReturns backtestResults={backtestResults} />
        </CardContent>
      </Card>

      {/* Monthly Returns */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Returns</CardTitle>
          <CardDescription>
            Monthly performance breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyReturns backtestResults={backtestResults} />
        </CardContent>
      </Card>

      {/* Annual Returns */}
      <Card>
        <CardHeader>
          <CardTitle>Annual Returns</CardTitle>
          <CardDescription>
            Year-over-year performance comparison
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnnualReturns backtestResults={backtestResults} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ReturnsTab;