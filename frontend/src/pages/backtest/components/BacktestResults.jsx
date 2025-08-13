import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, Target, Shield, Zap, Activity, TrendingDown, DollarSign } from "lucide-react";

// Import chart components
import MainChart from "../../../components/charts/backtest/MainChart.jsx";
import KeyStatistics from "../../../components/charts/backtest/KeyStatistics.jsx";
import MonthlyReturns from "../../../components/charts/backtest/MonthlyReturns.jsx";
import AnnualReturns from "../../../components/charts/backtest/AnnualReturns.jsx";
import ReturnsPerTrade from "../../../components/charts/backtest/ReturnsPerTrade.jsx";
import Drawdown from "../../../components/charts/backtest/Drawdown.jsx";
import DailyReturns from "../../../components/charts/backtest/DailyReturns.jsx";
import RollingBeta from "../../../components/charts/backtest/RollingBeta.jsx";
import RollingSharpe from "../../../components/charts/backtest/RollingSharpe.jsx";
import CumulativeReturns from "../../../components/charts/backtest/CumulativeReturns.jsx";
import RiskMetrics from "../../../components/charts/backtest/RiskMetrics.jsx";
import RollingVolatility from "../../../components/charts/backtest/RollingVolatility.jsx";
import UnderwaterCurve from "../../../components/charts/backtest/UnderwaterCurve.jsx";
import PerformanceAttribution from "../../../components/charts/backtest/PerformanceAttribution.jsx";
import TradeAnalysis from "../../../components/charts/backtest/TradeAnalysis.jsx";

// Import other components
import OVRDial from "../OVRDial.jsx";

const BacktestResults = ({ 
  chartData, 
  backtestResults, 
  OVRPercent, 
  fromDate, 
  toDate,
  ranBacktest 
}) => {
  if (!ranBacktest) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 border-t border-gray-200 h-screen">
      <div className="pt-1">
        <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col">
          <div className="flex justify-center pb-3 pt-2">
            <TabsList className="grid grid-cols-5 w-full max-w-5xl shadow-lg transition-all duration-200 hover:shadow-xl rounded-xl relative h-14 gap-2 bg-white/80 backdrop-blur-sm p-1 border border-gray-200">
              <TabsTrigger value="overview" className="flex items-center justify-center gap-2 py-2 px-4 transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md bg-transparent hover:bg-gray-50 text-gray-700 data-[state=active]:font-semibold rounded-lg">
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm font-medium">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="returns" className="flex items-center justify-center gap-2 py-2 px-4 transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md bg-transparent hover:bg-gray-50 text-gray-700 data-[state=active]:font-semibold rounded-lg">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Returns</span>
              </TabsTrigger>
              <TabsTrigger value="trading" className="flex items-center justify-center gap-2 py-2 px-4 transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-md bg-transparent hover:bg-gray-50 text-gray-700 data-[state=active]:font-semibold rounded-lg">
                <Target className="h-4 w-4" />
                <span className="text-sm font-medium">Trading</span>
              </TabsTrigger>
              <TabsTrigger value="risk" className="flex items-center justify-center gap-2 py-2 px-4 transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-md bg-transparent hover:bg-gray-50 text-gray-700 data-[state=active]:font-semibold rounded-lg">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Risk</span>
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center justify-center gap-2 py-2 px-4 transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md bg-transparent hover:bg-gray-50 text-gray-700 data-[state=active]:font-semibold rounded-lg">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">Advanced</span>
              </TabsTrigger>
          </TabsList>
          </div>

          {/* Overview Tab - Main Chart with Statistics */}
          <TabsContent value="overview" className="flex-1 animate-in fade-in-50 slide-in-from-bottom-4 duration-500  relative">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
              {/* Main Chart Area - Takes more space */}
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col overflow-hidden flex-1 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Performance Chart</h3>
                      <p className="text-sm text-gray-500 hidden sm:block">Portfolio value and price movements over time</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="hidden sm:inline">Period:</span>
                      <span className="font-medium">{fromDate && toDate && `${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`}</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 p-2">
                  <MainChart chartData={chartData} ranBacktest={ranBacktest} />
                </div>
              </div>
              
              {/* Statistics Sidebar */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col overflow-y-visible min-h-[500px] relative">
                <div className="flex-1 p-4 overflow-y-visible">
                  {/* Floating Win Rate Dial - Positioned absolutely */}
                  <div className="absolute -top-17 right-2 z-10">
                    <div className="relative">
                      {/* Glowing background effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 rounded-full blur-xl opacity-30 animate-pulse scale-110"></div>
                      
                      {/* Main dial container */}
                      <div className="relative bg-gradient-to-br from-white via-blue-50 to-indigo-100 rounded-full p-6 shadow-2xl border-4 border-white backdrop-blur-sm">
                        <div className="w-24 h-24 flex items-center justify-center">
                          <OVRDial percent={OVRPercent}/>
                        </div>
                        
                        {/* Floating label */}
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                          <div className="bg-gradient-to-r from-indigo-400 to-purple-400 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                            Win Rate
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Key Statistics - Takes all available space */}
                  <KeyStatistics data={{...(backtestResults['key_metrics'] || {}), runtime_days : backtestResults['runtime_days'] || 0, runtime_years : backtestResults['runtime_years'] || 0}} />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Returns Tab */}
          <TabsContent value="returns" className="flex-1 animate-in fade-in-50 slide-in-from-bottom-4 duration-500 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 h-full">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-green-50/30 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[350px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-green-800 text-lg">
                    <TrendingUp className="h-5 w-5" />
                    Cumulative Returns
                  </CardTitle>
                  <CardDescription className="text-sm">Portfolio growth over time vs benchmark</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <CumulativeReturns cumulativeReturns={backtestResults.cumulative_returns || {}} />
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[350px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-blue-800 text-lg">
                    <BarChart3 className="h-5 w-5" />
                    Monthly Returns
                  </CardTitle>
                  <CardDescription className="text-sm">Monthly performance breakdown</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <MonthlyReturns monthlyReturns={backtestResults['monthly_returns'] || {}} />
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-purple-50/30 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[350px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-purple-800 text-lg">
                    <Activity className="h-5 w-5" />
                    Annual Returns
                  </CardTitle>
                  <CardDescription className="text-sm">Year-over-year performance</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <AnnualReturns annualReturns={backtestResults.annual_returns || {}} averageAnnualReturn={backtestResults.average_annual_return || 0} />
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30 backdrop-blur-sm md:col-span-2 xl:col-span-1 transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[350px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-gray-800 text-lg">
                    <Activity className="h-5 w-5" />
                    Daily Returns
                  </CardTitle>
                  <CardDescription className="text-sm">Daily performance distribution analysis</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <DailyReturns dailyReturns={backtestResults.daily_returns || {}} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Trading Tab */}
          <TabsContent value="trading" className="flex-1 animate-in fade-in-50 slide-in-from-bottom-4 duration-500 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-emerald-50/30 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[400px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-emerald-800 text-lg">
                    <Target className="h-5 w-5" />
                    Trade Analysis Dashboard
                  </CardTitle>
                  <CardDescription className="text-sm">Comprehensive trade-level performance metrics</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <TradeAnalysis backtestResults={backtestResults} />
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-indigo-50/30 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[400px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-indigo-800 text-lg">
                    <BarChart3 className="h-5 w-5" />
                    Trade Return Distribution
                  </CardTitle>
                  <CardDescription className="text-sm">Histogram of individual trade performance</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ReturnsPerTrade tradeReturnHistogram={backtestResults.trade_return_histogram || {}} />
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-red-50/30 backdrop-blur-sm lg:col-span-2 transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[400px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-red-800 text-lg">
                    <TrendingDown className="h-5 w-5" />
                    Drawdown Analysis
                  </CardTitle>
                  <CardDescription className="text-sm">Portfolio decline periods and recovery times</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <Drawdown drawdown={backtestResults.drawdown || {}} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Risk Tab */}
          <TabsContent value="risk" className="flex-1 animate-in fade-in-50 slide-in-from-bottom-4 duration-500 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-red-50/30 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[400px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-red-800 text-lg">
                    <Shield className="h-5 w-5" />
                    Risk Metrics Dashboard
                  </CardTitle>
                  <CardDescription className="text-sm">VaR, CVaR, and advanced risk measures</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <RiskMetrics backtestResults={backtestResults} />
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[400px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-blue-800 text-lg">
                    <Activity className="h-5 w-5" />
                    Rolling Volatility
                  </CardTitle>
                  <CardDescription className="text-sm">Volatility analysis across time windows</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <RollingVolatility rollingVolatility={backtestResults.rolling_volatility || {}} />
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-cyan-50/30 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[400px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-cyan-800 text-lg">
                    <TrendingDown className="h-5 w-5" />
                    Underwater Curve
                  </CardTitle>
                  <CardDescription className="text-sm">Drawdown duration and depth analysis</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <UnderwaterCurve underwaterCurve={backtestResults.underwater_curve || {}} />
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-orange-50/30 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[400px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-orange-800 text-lg">
                    <Zap className="h-5 w-5" />
                    Rolling Metrics
                  </CardTitle>
                  <CardDescription className="text-sm">Beta and Sharpe evolution over time</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="grid grid-rows-2 gap-4 h-full">
                    <div className="min-h-0">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">Rolling Sharpe Ratio</h5>
                      <RollingSharpe rollingSharpe={backtestResults.rolling_sharpe || {}} />
                    </div>
                    <div className="min-h-0">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">Rolling Beta</h5>
                      <RollingBeta rollingBeta={backtestResults.rolling_beta || {}} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="flex-1 animate-in fade-in-50 slide-in-from-bottom-4 duration-500 overflow-hidden">
            <div className="grid grid-cols-1 gap-4 h-full">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-indigo-50/30 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[500px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-indigo-800 text-lg">
                    <Target className="h-5 w-5" />
                    Performance Attribution
                  </CardTitle>
                  <CardDescription className="text-sm">Alpha, beta, and market capture analysis</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <PerformanceAttribution backtestResults={backtestResults} />
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30 backdrop-blur-sm transition-all duration-200 hover:shadow-xl hover:scale-[1.01] min-h-[300px]">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-gray-700 text-lg">
                    <Zap className="h-5 w-5" />
                    Advanced Metrics Summary
                  </CardTitle>
                  <CardDescription className="text-sm">Enhanced performance statistics and ratios</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-white to-purple-50/50 rounded-lg p-4 border shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-semibold text-gray-700">Calmar Ratio</span>
                      </div>
                      <div className="text-xl font-bold text-purple-600">
                        {backtestResults?.key_metrics?.calmar_ratio ? backtestResults.key_metrics.calmar_ratio.toFixed(2) : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">CAGR / Max Drawdown</div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-white to-orange-50/50 rounded-lg p-4 border shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-semibold text-gray-700">Sterling Ratio</span>
                      </div>
                      <div className="text-xl font-bold text-orange-600">
                        {backtestResults?.key_metrics?.sterling_ratio ? backtestResults.key_metrics.sterling_ratio.toFixed(2) : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">CAGR / Avg Drawdown</div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-lg p-4 border shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-semibold text-gray-700">Ulcer Index</span>
                      </div>
                      <div className="text-xl font-bold text-blue-600">
                        {backtestResults?.key_metrics?.ulcer_index ? backtestResults.key_metrics.ulcer_index.toFixed(2) : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">Drawdown severity</div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-white to-green-50/50 rounded-lg p-4 border shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-semibold text-gray-700">Kelly %</span>
                      </div>
                      <div className="text-xl font-bold text-green-600">
                        {backtestResults?.key_metrics?.kelly_criterion ? (backtestResults.key_metrics.kelly_criterion * 100).toFixed(1) + '%' : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">Optimal position size</div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-gray-700">Strategy Insights</span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>• <strong>Calmar Ratio:</strong> Higher values indicate better risk-adjusted returns relative to maximum drawdown</p>
                      <p>• <strong>Sterling Ratio:</strong> Similar to Calmar but uses average drawdown, providing a more balanced risk measure</p>
                      <p>• <strong>Ulcer Index:</strong> Measures depth and duration of drawdowns; lower values are better</p>
                      <p>• <strong>Kelly Criterion:</strong> Suggests optimal position sizing based on win rate and win/loss ratio</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BacktestResults;