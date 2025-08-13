import { useState } from "react"
import { MetricChart } from "@/components/charts/MetricChart"
import { LiveIndicator } from "@/components/dashboard"
import { AccountOverview } from "@/components/accounts/NewAccountOverview"
import { PortfolioPieChart } from "@/components/portfolio/PortfolioPieChart"
import { AllocationTable } from "@/components/portfolio/AllocationTable"
import { StrategyMonitor } from "@/components/strategies/StrategyMonitor"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Activity, 
  Wallet, 
  PieChart as PieChartIcon, 
  BarChart3,
  Zap,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react"
import { useLiveStockData } from "./components/useLiveStockData";

interface EnhancedLiveDashboardProps {
  serverUrl?: string
}

export default function EnhancedLiveDashboard({ 
  serverUrl = "http://localhost:5000" 
}: EnhancedLiveDashboardProps) {
  const { snapshot, history, domains } = useLiveStockData(serverUrl)
  const [selectedAllocationMode, setSelectedAllocationMode] = useState<'accounts' | 'assets' | 'sectors'>('accounts')
  const [showLegacyCharts, setShowLegacyCharts] = useState(false)


  // Mock handlers for demo purposes
  const handleAddAccount = (provider: string, credentials: any) => {
    console.log('Adding account:', provider, credentials)
  }

  const handleViewAccount = (accountId: string) => {
    console.log('Viewing account:', accountId)
  }

  const handleAccountSettings = (accountId: string) => {
    console.log('Account settings:', accountId)
  }

  const handleDisconnectAccount = (accountId: string) => {
    console.log('Disconnecting account:', accountId)
  }

  const handleBuyPosition = (symbol: string) => {
    console.log('Buying:', symbol)
  }

  const handleSellPosition = (symbol: string) => {
    console.log('Selling:', symbol)
  }

  const handleViewPositionDetails = (position: any) => {
    console.log('View position details:', position)
  }

  const handlePauseStrategy = (strategyId: string) => {
    console.log('Pausing strategy:', strategyId)
  }

  const handleResumeStrategy = (strategyId: string) => {
    console.log('Resuming strategy:', strategyId)
  }

  const handleStopStrategy = (strategyId: string) => {
    console.log('Stopping strategy:', strategyId)
  }

  const handleConfigureStrategy = (strategyId: string) => {
    console.log('Configuring strategy:', strategyId)
  }

  const handleViewStrategyDetails = (strategyId: string) => {
    console.log('View strategy details:', strategyId)
  }

  const handleApplyStrategy = (templateId: string, symbol: string, account: string, params: any) => {
    console.log('Applying strategy:', { templateId, symbol, account, params })
  }

  return (
    <div
      className="w-full bg-gradient-to-br from-indigo-50 via-slate-50 to-white p-6 md:p-10 transition-colors"
      style={{ backgroundAttachment: "fixed" }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
              <Activity className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Trading Dashboard
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <LiveIndicator />
                <span className="text-sm text-gray-500">
                  {new Date().toLocaleString([], { hour12: false })}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLegacyCharts(!showLegacyCharts)}
              className="text-gray-600"
            >
              {showLegacyCharts ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showLegacyCharts ? 'Hide' : 'Show'} Legacy Charts
            </Button>
            <Button variant="outline" size="sm" className="text-gray-600">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>


        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Account Management */}
          <div className="xl:col-span-1 space-y-6">
            <AccountOverview
              onAddAccount={handleAddAccount}
              onViewAccount={handleViewAccount}
              onSettingsAccount={handleAccountSettings}
              onDisconnectAccount={handleDisconnectAccount}
            />
          </div>

          {/* Right Columns - Portfolio & Strategy Overview */}
          <div className="xl:col-span-2 space-y-6">
            {/* Portfolio Allocation */}
            <PortfolioPieChart
              data={[]}
              mode={selectedAllocationMode}
              onModeChange={setSelectedAllocationMode}
              showLegend={true}
              interactive={true}
            />

            {/* Strategy Monitor */}
            <StrategyMonitor
              onPauseStrategy={handlePauseStrategy}
              onResumeStrategy={handleResumeStrategy}
              onStopStrategy={handleStopStrategy}
              onConfigureStrategy={handleConfigureStrategy}
              onViewStrategyDetails={handleViewStrategyDetails}
              onApplyStrategy={handleApplyStrategy}
            />
          </div>
        </div>

        {/* Portfolio Positions Table */}
        <AllocationTable
          onBuy={handleBuyPosition}
          onSell={handleSellPosition}
          onViewDetails={handleViewPositionDetails}
        />

        {/* Legacy Charts - Collapsible */}
        {showLegacyCharts && (
          <Card className="border-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-gray-500 to-slate-600 rounded-lg shadow-sm">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-lg">Real-time Metrics Charts</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <MetricChart
                  data={history}
                  metricKey="price"
                  metricLabel="Price"
                  domain={domains.price}
                />
                <MetricChart
                  data={history}
                  metricKey="cash"
                  metricLabel="Cash"
                  domain={domains.cash}
                />
                <MetricChart
                  data={history}
                  metricKey="holdings"
                  metricLabel="Holdings"
                  domain={domains.holdings}
                />
                <MetricChart
                  data={history}
                  metricKey="portfolio_value"
                  metricLabel="Portfolio Value"
                  domain={domains.portfolio_value}
                />
                <MetricChart
                  data={history}
                  metricKey="fees_paid"
                  metricLabel="Fees Paid"
                  domain={domains.fees_paid}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions Panel */}
        <Card className="border-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-sm">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button 
                variant="outline" 
                className="h-20 flex-col space-y-2"
                onClick={() => console.log('Navigate to strategy builder')}
              >
                <Zap className="h-6 w-6" />
                <span className="text-sm">Build Strategy</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-20 flex-col space-y-2"
                onClick={() => console.log('Navigate to backtest')}
              >
                <BarChart3 className="h-6 w-6" />
                <span className="text-sm">Backtest</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-20 flex-col space-y-2"
                onClick={() => console.log('Open portfolio analysis')}
              >
                <PieChartIcon className="h-6 w-6" />
                <span className="text-sm">Portfolio Analysis</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-20 flex-col space-y-2"
                onClick={() => console.log('Open account settings')}
              >
                <Wallet className="h-6 w-6" />
                <span className="text-sm">Account Settings</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}