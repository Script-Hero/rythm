import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MainChart from "../../../../components/charts/backtest/MainChart.jsx";
import KeyStatistics from "../../../../components/charts/backtest/KeyStatistics.jsx";

const OverviewTab = ({ backtestResults, chartData }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Main Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Strategy Performance
          </CardTitle>
          <CardDescription>
            Portfolio value over time vs buy-and-hold benchmark
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MainChart 
            backtestResults={backtestResults}
            chartData={chartData}
          />
        </CardContent>
      </Card>

      {/* Key Statistics */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Key Performance Metrics</CardTitle>
          <CardDescription>
            Essential statistics for strategy evaluation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KeyStatistics 
            backtestResults={backtestResults}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewTab;