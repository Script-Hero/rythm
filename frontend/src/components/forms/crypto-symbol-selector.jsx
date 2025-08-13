import React, { useState, useEffect } from 'react';
import SearchableSelect from './searchable-select';
import { TrendingUp, DollarSign } from 'lucide-react';
import { ModalPopup } from '@/components/feedback';

const CryptoSymbolSelector = ({ 
  value, 
  onChange, 
  onDateRangeChange,
  className = "",
  disabled = false 
}) => {
  const [symbols, setSymbols] = useState([]);
  const [baseCurrencies, setBaseCurrencies] = useState([]);
  const [quoteCurrencies, setQuoteCurrencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBase, setSelectedBase] = useState('');
  const [selectedQuote, setSelectedQuote] = useState('');
  const [mode, setMode] = useState('symbol'); // 'symbol' or 'construct'
  // Load saved history filter from localStorage, default to 90 days
  const [historyFilter, setHistoryFilter] = useState(() => {
    const saved = localStorage.getItem('cryptoSymbolSelector_historyFilter');
    return saved ? parseInt(saved, 10) : 90; // Default to 90 days
  });
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  
  // Parse current value into base/quote
  useEffect(() => {
    if (value && value.includes('/')) {
      const [base, quote] = value.split('/');
      setSelectedBase(base);
      setSelectedQuote(quote);
    }
  }, [value]);
  
  // Load initial data and reload when history filter changes
  useEffect(() => {
    loadSymbols();
    loadCurrencies();
  }, [historyFilter]);
  
  // Save history filter to localStorage when it changes
  const handleHistoryFilterChange = (newFilter) => {
    setHistoryFilter(newFilter);
    localStorage.setItem('cryptoSymbolSelector_historyFilter', newFilter.toString());
  };
  
  const loadSymbols = async () => {
    try {
      setLoading(true);
      // Use the actual history filter to get properly filtered symbols from cache
      const response = await fetch(`http://localhost:8000/api/market/symbols?min_history_days=${historyFilter}`);
      const data = await response.json();
      
      if (data.symbols) {
        // Backend already filtered by history requirement, use as-is
        setSymbols(data.symbols);
        console.log(`Loaded ${data.symbols.length} symbols with ${historyFilter} days minimum history`);
      }
    } catch (error) {
      console.error('Failed to load symbols:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadCurrencies = async () => {
    try {
      // TODO: Backend doesn't have these endpoints yet - using placeholder data
      const [baseResponse, quoteResponse] = await Promise.all([
        fetch('http://localhost:8000/api/market/currencies/base'),
        fetch('http://localhost:8000/api/market/currencies/quote')
      ]);
      
      const [baseData, quoteData] = await Promise.all([
        baseResponse.json(),
        quoteResponse.json()
      ]);
      
      if (baseData.currencies) {
        setBaseCurrencies(baseData.currencies);
      }
      if (quoteData.currencies) {
        setQuoteCurrencies(quoteData.currencies);
      }
    } catch (error) {
      console.error('Failed to load currencies:', error);
    }
  };
  
  const searchSymbols = async (query) => {
    if (!query.trim()) return;
    
    try {
      // Use the actual history filter for consistent filtering
      const response = await fetch(`http://localhost:8000/api/market/symbols/search?q=${encodeURIComponent(query)}&min_history_days=${historyFilter}`);
      const data = await response.json();
      
      if (data.symbols) {
        setSymbols(data.symbols);
        console.log(`Found ${data.symbols.length} symbols matching "${query}" with ${historyFilter} days minimum history`);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };
  
  const handleSymbolSelect = async (symbol) => {
    onChange(symbol);
    
    // No success popups - only show errors if something goes wrong
    // Date range will be fetched by parent component (BacktestPage)
  };
  
  const handleConstructedSymbol = async () => {
    if (selectedBase && selectedQuote) {
      const symbol = `${selectedBase}/${selectedQuote}`;
      await handleSymbolSelect(symbol);
    }
  };
  
  // Update constructed symbol when base/quote changes
  useEffect(() => {
    if (mode === 'construct' && selectedBase && selectedQuote) {
      handleConstructedSymbol();
    }
  }, [selectedBase, selectedQuote, mode]);
  
  const renderSymbolOption = (option, index, { isSelected, isHighlighted, onSelect, onHighlight }) => {
    return (
      <div
        key={option.symbol}
        className={`px-3 py-2 cursor-pointer ${
          isHighlighted ? 'bg-blue-50' : ''
        } ${isSelected ? 'bg-blue-100' : ''} hover:bg-gray-50`}
        onClick={onSelect}
        onMouseEnter={onHighlight}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <div>
              <div className="font-medium text-gray-900">{option.symbol}</div>
              <div className="text-xs text-gray-500">
                {option.base_name} / {option.quote_name}
              </div>
            </div>
          </div>
          {isSelected && <div className="h-2 w-2 bg-blue-600 rounded-full" />}
        </div>
      </div>
    );
  };
  
  const renderCurrencyOption = (option, index, { isSelected, isHighlighted, onSelect, onHighlight }) => {
    return (
      <div
        key={option.code}
        className={`px-3 py-2 cursor-pointer ${
          isHighlighted ? 'bg-blue-50' : ''
        } ${isSelected ? 'bg-blue-100' : ''} hover:bg-gray-50`}
        onClick={onSelect}
        onMouseEnter={onHighlight}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <div>
              <div className="font-medium text-gray-900">{option.code}</div>
              <div className="text-xs text-gray-500">{option.name}</div>
            </div>
          </div>
          {isSelected && <div className="h-2 w-2 bg-blue-600 rounded-full" />}
        </div>
      </div>
    );
  };
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* History Length Filter */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-center font-medium text-blue-900 mb-3">Filter by Data History</div>
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { label: '90 Days', days: 90 },
            { label: '6 Months', days: 180 },
            { label: '1 Year', days: 365 },
            { label: '2 Years', days: 730 },
            { label: '5 Years', days: 1825 },
            { label: 'All Available', days: 1 },
          ].map(({ label, days }) => (
            <button
              key={label}
              type="button"
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                historyFilter === days
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-50'
              }`}
              onClick={() => handleHistoryFilterChange(days)}
              disabled={disabled}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 text-xs text-blue-700 text-center">
          Showing {symbols.length} pairs with at least {historyFilter === 1 ? 'minimal' : `${historyFilter} days`} of historical data
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
        <button
          type="button"
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'symbol' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setMode('symbol')}
        >
          Search Symbols
        </button>
        <button
          type="button"
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'construct' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setMode('construct')}
        >
          Construct Pair
        </button>
      </div>
      
      {mode === 'symbol' ? (
        // Direct symbol search
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Trading Pair
          </label>
          <SearchableSelect
            options={symbols}
            value={value}
            onChange={handleSymbolSelect}
            onSearch={searchSymbols}
            placeholder="Search for BTC/USD, ETH/USD, etc."
            loading={loading}
            disabled={disabled}
            renderOption={renderSymbolOption}
            renderValue={(val) => {
              const symbol = symbols.find(s => s.symbol === val);
              return symbol ? `${symbol.symbol} (${symbol.base_name}/${symbol.quote_name})` : val;
            }}
          />
        </div>
      ) : (
        // Construct symbol from base + quote
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Base Currency
            </label>
            <SearchableSelect
              options={baseCurrencies}
              value={selectedBase}
              onChange={setSelectedBase}
              placeholder="Select base (BTC, ETH, etc.)"
              disabled={disabled}
              renderOption={renderCurrencyOption}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quote Currency
            </label>
            <SearchableSelect
              options={quoteCurrencies}
              value={selectedQuote}
              onChange={setSelectedQuote}
              placeholder="Select quote (USD, EUR, etc.)"
              disabled={disabled}
              renderOption={renderCurrencyOption}
            />
          </div>
        </div>
      )}
      
      {/* Selected symbol display */}
      {value && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div>
              <div className="font-semibold text-blue-900">Selected: {value}</div>
              <div className="text-sm text-blue-800">
                {symbols.find(s => s.symbol === value)?.base_name || selectedBase} / {symbols.find(s => s.symbol === value)?.quote_name || selectedQuote}
              </div>
            </div>
          </div>
        </div>
      )}

      <ModalPopup
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
    </div>
  );
};

export default CryptoSymbolSelector;