import { useState, useCallback } from 'react';
import { toast } from "sonner";

export const useBacktestParams = () => {
  const [ticker, setTicker] = useState("BTC/USD");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [barInterval, setBarInterval] = useState("1d");
  const [selectedStrategy, setSelectedStrategy] = useState("rsi");
  const [symbolDateRange, setSymbolDateRange] = useState(null);
  const [isLoadingDateRange, setIsLoadingDateRange] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [OVRPercent, setOVRPercent] = useState(0.0);
  
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const validateParams = useCallback(async () => {
    setValidationErrors([]);
    
    try {
      const validationResponse = await fetch('http://localhost:8000/api/market/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: ticker,
          start_date: fromDate,
          end_date: toDate,
        }),
      });
      
      const validation = await validationResponse.json();
      
      if (!validation.valid) {
        const errors = validation.errors || ['Invalid symbol or date range'];
        setValidationErrors(errors);
        
        setModalState({
          isOpen: true,
          title: "Cannot run backtest",
          message: errors.join('. '),
          type: 'error'
        });
        
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate parameters');
      return false;
    }
  }, [ticker, fromDate, toDate]);

  const updateTicker = useCallback((newTicker) => {
    setTicker(newTicker);
    setSymbolDateRange(null); // Reset date range when symbol changes
  }, []);

  const updateDateRange = useCallback((start, end) => {
    setFromDate(start);
    setToDate(end);
  }, []);

  const resetParams = useCallback(() => {
    setTicker("BTC/USD");
    setFromDate("");
    setToDate("");
    setBarInterval("1d");
    setSelectedStrategy("rsi");
    setSymbolDateRange(null);
    setValidationErrors([]);
    setOVRPercent(0.0);
    setModalState({
      isOpen: false,
      title: '',
      message: '',
      type: 'info'
    });
  }, []);

  return {
    // State
    ticker,
    fromDate,
    toDate,
    barInterval,
    selectedStrategy,
    symbolDateRange,
    isLoadingDateRange,
    validationErrors,
    OVRPercent,
    modalState,
    
    // Setters
    setTicker: updateTicker,
    setFromDate,
    setToDate,
    setBarInterval,
    setSelectedStrategy,
    setSymbolDateRange,
    setIsLoadingDateRange,
    setValidationErrors,
    setOVRPercent,
    setModalState,
    
    // Actions
    validateParams,
    updateDateRange,
    resetParams,
  };
};