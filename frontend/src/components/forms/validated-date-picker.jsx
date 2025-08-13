import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const ValidatedDatePicker = ({ 
  startDate, 
  endDate, 
  onStartDateChange, 
  onEndDateChange,
  dateRange = null, // { earliest_date, latest_date, available }
  symbol = '',
  className = "",
  disabled = false 
}) => {
  const [validation, setValidation] = useState({ valid: true, errors: [] });
  const [isValidating, setIsValidating] = useState(false);
  
  // Validate dates when they change or when dateRange updates
  useEffect(() => {
    if (symbol && startDate && endDate) {
      validateDates();
    }
  }, [startDate, endDate, dateRange, symbol]);
  
  const validateDates = async () => {
    if (!symbol || !startDate || !endDate) return;
    
    setIsValidating(true);
    
    try {
      const response = await fetch('http://localhost:8000/api/market/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          start_date: startDate,
          end_date: endDate,
        }),
      });
      
      const result = await response.json();
      setValidation(result);
      
      // Show toast notifications for validation results
      if (result.valid) {
        const startFormatted = new Date(startDate).toLocaleDateString();
        const endFormatted = new Date(endDate).toLocaleDateString();
        const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
        
        toast.success("Valid Date Range", {
          description: `${daysDiff} days selected: ${startFormatted} to ${endFormatted}`,
          duration: 3000,
        });
      } else if (result.errors && result.errors.length > 0) {
        toast.error("Invalid Date Range", {
          description: result.errors[0], // Show first error
          duration: 4000,
        });
      }
    } catch (error) {
      console.error('Date validation failed:', error);
      setValidation({
        valid: false,
        errors: ['Failed to validate dates']
      });
    } finally {
      setIsValidating(false);
    }
  };
  
  const getInputClassName = () => {
    return `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      !validation.valid ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500'
    } ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}`;
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  const getValidationIcon = () => {
    if (isValidating) {
      return <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />;
    }
    
    if (!validation.valid) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    
    if (startDate && endDate && validation.valid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    return null;
  };
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Date Range Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start Date
          </label>
          <input
            type="date"
            className={getInputClassName()}
            value={startDate || ''}
            onChange={(e) => onStartDateChange(e.target.value)}
            disabled={disabled}
            {...(dateRange?.available && dateRange.earliest_date ? { min: dateRange.earliest_date } : {})}
            {...(dateRange?.available && dateRange.latest_date ? { max: dateRange.latest_date } : {})}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End Date
          </label>
          <input
            type="date"
            className={getInputClassName()}
            value={endDate || ''}
            onChange={(e) => onEndDateChange(e.target.value)}
            disabled={disabled}
            {...(dateRange?.available && dateRange.earliest_date ? { min: dateRange.earliest_date } : {})}
            {...(dateRange?.available && dateRange.latest_date ? { max: dateRange.latest_date } : {})}
          />
        </div>
      </div>
      
      {/* Available Date Range Info */}
      {dateRange && (
        <div className={`p-3 rounded-lg border ${
          dateRange.available 
            ? 'bg-blue-50 border-blue-200' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-start space-x-2">
            <Calendar className={`h-4 w-4 mt-0.5 ${
              dateRange.available ? 'text-blue-600' : 'text-gray-400'
            }`} />
            <div className="flex-1">
              <div className={`text-sm font-medium ${
                dateRange.available ? 'text-blue-900' : 'text-gray-600'
              }`}>
                {dateRange.available ? 'Available Date Range' : 'No Data Available'}
              </div>
              {dateRange.available ? (
                <div className="text-xs text-blue-700 mt-1">
                  From {formatDate(dateRange.earliest_date)} to {formatDate(dateRange.latest_date)}
                </div>
              ) : (
                <div className="text-xs text-gray-500 mt-1">
                  No historical data found for {symbol}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Show loading indicator during validation */}
      {isValidating && (
        <div className="flex items-center justify-center p-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
          <span className="text-sm text-gray-600">Validating dates...</span>
        </div>
      )}
      
      {/* Quick Date Range Presets */}
      {dateRange?.available && (
        <div className="flex flex-wrap gap-2">
          <div className="text-xs font-medium text-gray-500 w-full mb-1">Quick Select:</div>
          {[
            { label: 'Last 30 Days', days: 30 },
            { label: 'Last 90 Days', days: 90 },
            { label: 'Last 6 Months', days: 180 },
            { label: 'Last Year', days: 365 },
            { label: 'Last 2 Years', days: 730 },
            { label: 'Last 5 Years', days: 1825 },
            { label: 'Last 10 Years', days: 3650 },
            { label: 'All Available', days: null }, // Special case for max range
          ].map(({ label, days }) => {
            const endDate = new Date();
            const earliestAvailable = new Date(dateRange.earliest_date);
            const latestAvailable = new Date(dateRange.latest_date);
            
            let startDate, isValid;
            
            if (days === null) {
              // "All Available" case - use the full available range
              startDate = earliestAvailable;
              isValid = true;
            } else {
              startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
              // Check if this preset is valid for the available range
              isValid = startDate >= earliestAvailable && endDate <= latestAvailable;
            }
            
            return (
              <button
                key={label}
                type="button"
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isValid 
                    ? 'border-blue-300 text-blue-700 hover:bg-blue-50' 
                    : 'border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                disabled={!isValid}
                onClick={() => {
                  if (isValid) {
                    if (days === null) {
                      // "All Available" case
                      onStartDateChange(earliestAvailable.toISOString().split('T')[0]);
                      onEndDateChange(latestAvailable.toISOString().split('T')[0]);
                    } else {
                      // Regular preset case
                      onStartDateChange(Math.max(startDate, earliestAvailable).toISOString().split('T')[0]);
                      onEndDateChange(Math.min(endDate, latestAvailable).toISOString().split('T')[0]);
                    }
                  }
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ValidatedDatePicker;