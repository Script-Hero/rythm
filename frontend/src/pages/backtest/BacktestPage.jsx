import React from "react";
import { TrendingUp } from "lucide-react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { ModalPopup } from "@/components/feedback";

// Import new components
import {
  BacktestProvider,
  useBacktest,
  BacktestControls,
  BacktestResults,
  EmptyState,
  LoadingState
} from "./components";

// Main component that uses the backtest context
const BacktestPageContent = () => {
  const {
    chartData,
    backtestResults,
    loading,
    ranBacktest,
    ticker,
    isLoadingDateRange,
    barInterval,
    fromDate,
    toDate,
    selectedStrategy,
    symbolDateRange,
    validationErrors,
    modalState,
    OVRPercent,
    setTicker,
    setFromDate,
    setToDate,
    setBarInterval,
    setSelectedStrategy,
    setSymbolDateRange,
    setModalState,
    runBacktest,
    clearChart
  } = useBacktest();

  return (
    <div id="contentContainer" className='flex flex-col h-full w-full absolute top-0 left-0 m-0 p-0'>
      <BacktestControls
        onRunBacktest={() => runBacktest()}
        onClearChart={clearChart}
        ticker={ticker}
        setTicker={setTicker}
        fromDate={fromDate}
        toDate={toDate}
        setFromDate={setFromDate}
        setToDate={setToDate}
        barInterval={barInterval}
        setBarInterval={setBarInterval}
        selectedStrategy={selectedStrategy}
        setSelectedStrategy={setSelectedStrategy}
        symbolDateRange={symbolDateRange}
        setSymbolDateRange={setSymbolDateRange}
        validationErrors={validationErrors}
        isLoadingDateRange={isLoadingDateRange}
        loading={loading}
      />

      <ModalPopup
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
      
      <div id="chartContentContainer" className="w-full bg-gray-50">
        {!ranBacktest ? (
          loading ? (
            <LoadingState 
              ticker={ticker}
              fromDate={fromDate}
              toDate={toDate}
              selectedStrategy={selectedStrategy}
            />
          ) : (
            <EmptyState />
          )
        ) : (
          <BacktestResults
            chartData={chartData}
            backtestResults={backtestResults}
            OVRPercent={OVRPercent}
            fromDate={fromDate}
            toDate={toDate}
            ranBacktest={ranBacktest}
          />
        )}
      </div>
    </div>
  );
};

// Main exported component that wraps everything in the provider
export default function BacktestPage() {
  return (
    <BacktestProvider>
      <BacktestPageContent />
    </BacktestProvider>
  );
}