import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { LuPlay } from "react-icons/lu";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { Database, CalendarIcon, TrendingUp, Settings } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input"

import { getBasicTemplateList } from "../build_algorithm/basic-templates";
import { getTemplateList } from "../build_algorithm/complex-templates";
import { apiService } from "../../services/api";
import { toast } from "sonner";
import { CryptoSymbolSelector, ValidatedDatePickerNewNew } from "@/components/forms";

export default function Header({
  runBacktest, 
  selectedStrategy, 
  setSelectedStrategy, 
  loading, 
  clearChart, 
  ticker, 
  setTicker, 
  fromDate, 
  toDate, 
  setFromDate, 
  setToDate, 
  barInterval, 
  setBarInterval,
  symbolDateRange,
  setSymbolDateRange,
  validationErrors,
  isLoadingDateRange
}) {

    const [savedStrategies, setSavedStrategies] = useState([]);
    const [loadingStrategies, setLoadingStrategies] = useState(false);

    const basicTemplates = getBasicTemplateList();
    const complexTemplates = getTemplateList();
    const allTemplates = [...basicTemplates, ...complexTemplates];

    useEffect(() => {
        loadSavedStrategies();
    }, []);

    const loadSavedStrategies = async () => {
        setLoadingStrategies(true);
        try {
            const response = await apiService.listStrategies({ include_templates: false });
            setSavedStrategies(response.strategies);
        } catch (error) {
            console.error('Failed to load saved strategies:', error);
            toast.error('Failed to load saved strategies');
        } finally {
            setLoadingStrategies(false);
        }
    };

    const allBarIntervals = [
      "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"
    ];

    return (
        <div id='header' className="relative bg-white border-b shadow-sm">
          {/* Main Header Row */}
          <div className="flex flex-row lg:flex-row lg:items-center lg:justify-between px-4 lg:px-6 py-4 gap-4 w-9/10 m-auto">
            {/* Left Section - Title and Action */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6">
              <div className="flex items-center gap-10">
                <Button 
                  onClick={() => runBacktest()} 
                  disabled={loading}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 shadow-lg transition-all duration-200 hover:shadow-xl flex-1 sm:flex-none"
                >
                  {loading ? (
                    <>
                      <AiOutlineLoading3Quarters className="animate-spin h-5 w-5 mr-2" />
                      <span className="hidden sm:inline">Running Backtest...</span>
                      <span className="sm:hidden">Running...</span>
                    </>
                  ) : (
                    <>
                      <LuPlay className="h-5 w-5 mr-2" />
                      <span className="hidden sm:inline">Run Backtest</span>
                      <span className="sm:hidden">Run</span>
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={clearChart} size="lg" className="hidden sm:flex bg-gray-300 text-gray-900 text-bold">
                  Clear Results
                </Button>
                <Button variant="outline" onClick={clearChart} size="lg" className="sm:hidden bg-gray-300 text-gray-900 text-bold">
                  Clear
                </Button>
              </div>
            </div>

            {/* Right Section - Strategy Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ">
              <div className="text-left sm:text-right">
                <label className="text-sm font-medium text-gray-700">Strategy</label>
                <div className="text-xs text-gray-500 mt-1 hidden lg:block">
                  {savedStrategies.find(s => s.id === selectedStrategy)?.description ||
                   allTemplates.find(t => t.key === selectedStrategy)?.description ||
                   'Select a trading strategy'}
                </div>
              </div>
              <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                <SelectTrigger className="w-full sm:w-56 h-12 bg-gray-300 text-gray-900">
                  <SelectValue placeholder="Choose Strategy">
                    {selectedStrategy && (
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-gray-500" />
                        <span className="font-medium truncate ">
                          {savedStrategies.find(s => s.id === selectedStrategy)?.name ||
                           allTemplates.find(t => t.key === selectedStrategy)?.name}
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-64">
                  {savedStrategies.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        My Strategies
                      </div>
                      {savedStrategies.map((strategy) => (
                        <SelectItem key={strategy.id} value={strategy.id} className="py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{strategy.name}</span>
                            <span className="text-xs text-gray-500">{strategy.description || 'No description'}</span>
                          </div>
                        </SelectItem>
                      ))}
                      <Separator className="my-1" />
                    </>
                  )}
                  
                  <div className="px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50">
                    Template Strategies
                  </div>
                  {allTemplates.map((template) => (
                    <SelectItem key={template.key} value={template.key} className="py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{template.name}</span>
                        <span className="text-xs text-gray-500">{template.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Parameters Row */}
          <div className="bg-gray-50 border-t px-4 lg:px-6 py-3 items-center">
            <div className="flex flex-row justify-center gap-4">
              {/* Market Data Section */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Symbol Selector */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-between w-full sm:w-44 bg-white">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-600"  />
                          <span className="truncate font-medium">{ticker}</span>
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <div className="p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Select Trading Pair</h4>
                        <CryptoSymbolSelector
                          value={ticker}
                          onChange={setTicker}
                          onDateRangeChange={setSymbolDateRange}
                          disabled={loading || isLoadingDateRange}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Date Range */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-between w-full sm:w-64 bg-white">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-green-600" />
                          <span className="truncate">
                            {fromDate && toDate 
                              ? `${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`
                              : 'Select date range'
                            }
                          </span>
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96 p-0" align="start">
                      <div className="p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Backtest Period</h4>
                        <ValidatedDatePickerNew
                          startDate={fromDate}
                          endDate={toDate}
                          onStartDateChange={setFromDate}
                          onEndDateChange={setToDate}
                          dateRange={symbolDateRange}
                          symbol={ticker}
                          disabled={loading}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Interval Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 hidden sm:inline">Interval:</span>
                    <Select value={barInterval} onValueChange={setBarInterval}>
                      <SelectTrigger className="w-20 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allBarIntervals.map((intervalName) => (
                          <SelectItem key={intervalName} value={intervalName}>
                            {intervalName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Status and Settings */}
              <div className="flex items-center justify-between sm:justify-end gap-4">
                <div className="flex items-center gap-4">
                  {validationErrors.length > 0 && (
                    <div className="flex items-center gap-2 text-red-600">
                      <div className="h-2 w-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm hidden sm:inline">Configuration issues</span>
                      <span className="text-sm sm:hidden">Issues</span>
                    </div>
                  )}
                  
                  {isLoadingDateRange && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <AiOutlineLoading3Quarters className="animate-spin h-4 w-4" />
                      <span className="text-sm hidden sm:inline">Loading data range...</span>
                      <span className="text-sm sm:hidden">Loading...</span>
                    </div>
                  )}
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-white">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="end">
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-gray-900">Backtest Configuration</div>
                      <Separator />
                      <div className="text-sm text-gray-600 space-y-2">
                        <div className="flex justify-between">
                          <span>Symbol:</span>
                          <span className="font-medium">{ticker}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Interval:</span>
                          <span className="font-medium">{barInterval}</span>
                        </div>
                        {symbolDateRange?.available && (
                          <div className="pt-2 border-t">
                            <div className="text-xs text-gray-500 mb-1">Available Data Range:</div>
                            <div className="text-xs">
                              {new Date(symbolDateRange.earliest_date).toLocaleDateString()} - {new Date(symbolDateRange.latest_date).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>
    )
}