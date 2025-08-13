import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ReturnsPerTrade from "../../../../components/charts/backtest/ReturnsPerTrade.jsx";
import TradeAnalysis from "../../../../components/charts/backtest/TradeAnalysis.jsx";

const TradingTab = ({ backtestResults }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Returns Per Trade */}
      <Card>
        <CardHeader>
          <CardTitle>Returns Per Trade</CardTitle>
          <CardDescription>
            Individual trade performance distribution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReturnsPerTrade backtestResults={backtestResults} />
        </CardContent>
      </Card>

      {/* Trade Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Trade Analysis</CardTitle>
          <CardDescription>
            Detailed breakdown of trading activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TradeAnalysis backtestResults={backtestResults} />
        </CardContent>
      </Card>
    </div>
  );
};

export default TradingTab;