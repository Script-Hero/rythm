import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

const LoadingState = ({ ticker, fromDate, toDate, selectedStrategy }) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md mx-auto text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <AiOutlineLoading3Quarters className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <CardTitle>Running Backtest...</CardTitle>
          <CardDescription>
            Analyzing strategy performance on historical data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <div><strong>Symbol:</strong> {ticker}</div>
            <div><strong>Period:</strong> {fromDate} to {toDate}</div>
            <div><strong>Strategy:</strong> {selectedStrategy}</div>
          </div>
          <div className="mt-4 text-xs text-gray-500">
            This may take a few moments...
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoadingState;