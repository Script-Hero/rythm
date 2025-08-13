import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ModalPopup } from '@/components/feedback';

interface ValidatedDatePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  dateRange?: { 
    earliest_date: string; 
    latest_date: string; 
    available: boolean 
  } | null;
  symbol?: string;
  className?: string;
  disabled?: boolean;
}

const ValidatedDatePicker: React.FC<ValidatedDatePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  dateRange = null,
  symbol = '',
  className = "",
  disabled = false
}) => {
  const [validation, setValidation] = useState({ valid: true, errors: [] });
  const [isValidating, setIsValidating] = useState(false);
  const [startPopoverOpen, setStartPopoverOpen] = useState(false);
  const [endPopoverOpen, setEndPopoverOpen] = useState(false);
  const [lastAutoAdjustment, setLastAutoAdjustment] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  // Only show feedback for auto-adjustments, not regular selections
  // Remove automatic feedback to reduce UI noise

  // Auto-adjust dates when dateRange changes (new trading pair selected)
  useEffect(() => {
    if (dateRange?.available && startDate && endDate) {
      const earliestDate = new Date(dateRange.earliest_date);
      const latestDate = new Date(dateRange.latest_date);
      const currentStart = new Date(startDate);
      const currentEnd = new Date(endDate);
      
      let needsAdjustment = false;
      let newStartDate = startDate;
      let newEndDate = endDate;
      let adjustmentMessage = '';
      
      // Check if current dates are outside the available range
      if (currentStart < earliestDate) {
        newStartDate = dateRange.earliest_date;
        needsAdjustment = true;
        adjustmentMessage = 'Start date adjusted to earliest available';
      }
      
      if (currentEnd > latestDate) {
        newEndDate = dateRange.latest_date;
        needsAdjustment = true;
        adjustmentMessage = adjustmentMessage ? 'Dates adjusted to valid range' : 'End date adjusted to latest available';
      }
      
      // Apply adjustments if needed
      if (needsAdjustment) {
        console.log('Auto-adjusting dates for new trading pair:', { 
          symbol, 
          oldRange: { startDate, endDate },
          newRange: { newStartDate, newEndDate },
          availableRange: { earliest: dateRange.earliest_date, latest: dateRange.latest_date }
        });
        
        if (newStartDate !== startDate) {
          onStartDateChange(newStartDate);
        }
        if (newEndDate !== endDate) {
          onEndDateChange(newEndDate);
        }
        
        setLastAutoAdjustment(adjustmentMessage);
        setTimeout(() => setLastAutoAdjustment(null), 3000);
      }
    }
  }, [dateRange]); // Only trigger on dateRange changes

  // Validate dates when they change or when dateRange updates
  useEffect(() => {
    console.log('Validation check:', { 
      symbol, 
      startDate, 
      endDate, 
      dateRange: dateRange ? {available: dateRange.available, earliest: dateRange.earliest_date, latest: dateRange.latest_date} : null,
      willValidate: !!(symbol && startDate && endDate && dateRange)
    });
    if (symbol && startDate && endDate && dateRange) {
      console.log('Validation triggered!');
      validateDates();
    } else {
      console.log('Validation skipped due to missing conditions');
    }
  }, [startDate, endDate, dateRange, symbol]);
  
  // Manual validation trigger for when date picker opens
  const triggerValidation = () => {
    console.log('Manual validation triggered for:', symbol);
    if (symbol && startDate && endDate) {
      validateDates();
    } else {
      console.log('Manual validation skipped - missing symbol, startDate, or endDate');
    }
  };

  const validateDates = async () => {
    if (!symbol || !startDate || !endDate) {
      console.log('Validation skipped - missing data:', { symbol, startDate, endDate });
      return;
    }
    
    // Don't validate if we know the symbol has no data
    if (dateRange && !dateRange.available) {
      console.log('Validation skipped - symbol has no historical data');
      setValidation({
        valid: false,
        errors: [`No historical data available for ${symbol}`]
      });
      return;
    }
    
    console.log('Starting validation for:', { symbol, startDate, endDate });
    setIsValidating(true);
    
    try {
      const response = await fetch(`http://localhost:8000/api/market/validate`, {
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
      
      if (!response.ok) {
        throw new Error(`Validation API failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Validation result:', result);
      
      if (!result || typeof result.valid === 'undefined') {
        throw new Error('Invalid validation response format');
      }
      
      setValidation(result);
      
      // Auto-fix only dates that fall outside the valid range
      if (!result.valid && result.errors && result.errors.length > 0 && dateRange?.available) {
        console.log('Attempting auto-adjustment:', { errors: result.errors, dateRange });
        
        try {
          let needsAdjustment = false;
          let newStartDate = startDate;
          let newEndDate = endDate;
          let adjustmentMessage = '';
          
          // Validate dateRange has required fields
          if (!dateRange.earliest_date || !dateRange.latest_date) {
            console.error('Invalid date range data:', dateRange);
            throw new Error('Date range missing earliest or latest date');
          }
          
          const earliestDate = new Date(dateRange.earliest_date);
          const latestDate = new Date(dateRange.latest_date);
          const currentStart = new Date(startDate);
          const currentEnd = new Date(endDate);
          
          // Validate dates are valid
          if (isNaN(earliestDate.getTime()) || isNaN(latestDate.getTime()) || 
              isNaN(currentStart.getTime()) || isNaN(currentEnd.getTime())) {
            console.error('Invalid dates:', { earliestDate, latestDate, currentStart, currentEnd });
            throw new Error('One or more dates are invalid');
          }
        
        result.errors.forEach(error => {
          if (error.includes('before earliest') && currentStart < earliestDate) {
            newStartDate = dateRange.earliest_date;
            needsAdjustment = true;
            adjustmentMessage = 'Start date adjusted to earliest available';
          }
          if (error.includes('after latest') && currentEnd > latestDate) {
            newEndDate = dateRange.latest_date;
            needsAdjustment = true;
            adjustmentMessage = adjustmentMessage ? 'Dates adjusted to valid range' : 'End date adjusted to latest available';
          }
          if (error.includes('start date is after end date')) {
            // If start is after end, adjust the problematic one
            if (currentStart > latestDate) {
              newStartDate = dateRange.earliest_date;
              needsAdjustment = true;
              adjustmentMessage = 'Start date adjusted to valid range';
            }
            if (currentEnd < earliestDate) {
              newEndDate = dateRange.latest_date;
              needsAdjustment = true;
              adjustmentMessage = 'End date adjusted to valid range';
            }
          }
        });
        
          // Apply auto-adjustments
          if (needsAdjustment) {
            console.log('Applying date adjustments:', { newStartDate, newEndDate, adjustmentMessage });
            
            if (newStartDate !== startDate) {
              console.log('Updating start date:', startDate, '->', newStartDate);
              onStartDateChange(newStartDate);
            }
            if (newEndDate !== endDate) {
              console.log('Updating end date:', endDate, '->', newEndDate);
              onEndDateChange(newEndDate);
            }
            
            setLastAutoAdjustment(adjustmentMessage);
            setTimeout(() => setLastAutoAdjustment(null), 3000);
            return; // Don't show error modals for auto-fixed issues
          }
        } catch (adjustmentError) {
          console.error('Error during date adjustment:', adjustmentError);
          // Fall through to show error modal instead of crashing
        }
      }
      
      // Only show modals for critical errors that can't be auto-fixed
      const criticalErrors = result.errors ? result.errors.filter(error => 
        !error.includes('before earliest') && 
        !error.includes('after latest') &&
        !error.includes('start date is after end date')
      ) : [];
      
      if (criticalErrors.length > 0) {
        setModalState({
          isOpen: true,
          title: "Invalid Date Range",
          message: criticalErrors[0],
          type: 'error'
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

  // Create disabled function for calendar - fix the logic
  const getDisabledDates = (date: Date) => {
    // If no date range data, allow all dates (don't gray out everything)
    if (!dateRange || !dateRange.available) {
      return false; // Allow all dates when no restrictions
    }
    
    const earliestDate = new Date(dateRange.earliest_date);
    const latestDate = new Date(dateRange.latest_date);
    
    // Simple date comparison - just compare the date part
    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const minDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), earliestDate.getDate());
    const maxDate = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate());
    
    return checkDate < minDate || checkDate > maxDate;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Select date';
    try {
      return format(new Date(dateString), 'PPP');
    } catch {
      return 'Invalid date';
    }
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      onStartDateChange(dateStr);
      setStartPopoverOpen(false);
      
      // Auto-adjust end date if it's now before start date
      if (endDate && new Date(endDate) < date) {
        onEndDateChange(dateStr);
      }
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      onEndDateChange(dateStr);
      setEndPopoverOpen(false);
      
      // Auto-adjust start date if it's now after end date
      if (startDate && new Date(startDate) > date) {
        onStartDateChange(dateStr);
      }
    }
  };

  const getSelectedStartDate = () => {
    try {
      return startDate ? new Date(startDate) : undefined;
    } catch {
      return undefined;
    }
  };

  const getSelectedEndDate = () => {
    try {
      return endDate ? new Date(endDate) : undefined;
    } catch {
      return undefined;
    }
  };

  return (
    <>
      <div className={`space-y-4 ${className}`}>
        {/* Date Range Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Start Date
            </label>
            <Popover open={startPopoverOpen} onOpenChange={(open) => {
              setStartPopoverOpen(open);
              if (open) triggerValidation(); // Validate when opening
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground",
                    !validation.valid && "border-red-500 focus:ring-red-500",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={disabled}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {formatDate(startDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={getSelectedStartDate()}
                  onSelect={handleStartDateSelect}
                  disabled={getDisabledDates}
                  captionLayout="dropdown"
                  fromYear={dateRange?.available ? new Date(dateRange.earliest_date).getFullYear() : 2010}
                  toYear={dateRange?.available ? new Date(dateRange.latest_date).getFullYear() : new Date().getFullYear()}
                  defaultMonth={getSelectedStartDate() || (dateRange?.available ? new Date(dateRange.earliest_date) : new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              End Date
            </label>
            <Popover open={endPopoverOpen} onOpenChange={(open) => {
              setEndPopoverOpen(open);
              if (open) triggerValidation(); // Validate when opening
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground",
                    !validation.valid && "border-red-500 focus:ring-red-500",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={disabled}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {formatDate(endDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={getSelectedEndDate()}
                  onSelect={handleEndDateSelect}
                  disabled={getDisabledDates}
                  captionLayout="dropdown"
                  fromYear={dateRange?.available ? new Date(dateRange.earliest_date).getFullYear() : 2010}
                  toYear={dateRange?.available ? new Date(dateRange.latest_date).getFullYear() : new Date().getFullYear()}
                  defaultMonth={getSelectedEndDate() || (dateRange?.available ? new Date(dateRange.latest_date) : new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Compact Available Date Range Info */}
        {dateRange?.available && (
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Available: {formatDate(dateRange.earliest_date)} to {formatDate(dateRange.latest_date)}</span>
            </div>
          </div>
        )}

        {/* Show auto-adjustment feedback */}
        {lastAutoAdjustment && (
          <div className="flex items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded-md">
            <span className="text-sm text-blue-800">{lastAutoAdjustment}</span>
          </div>
        )}
        
        {/* Show loading indicator during validation */}
        {isValidating && (
          <div className="flex items-center justify-center p-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
            <span className="text-sm text-gray-700">Validating dates...</span>
          </div>
        )}

        {/* Quick Date Range Presets - Now handled by the pair picker */}
        {dateRange?.available && (
          <div className="flex flex-wrap gap-2">
            <div className="text-xs font-semibold text-gray-700 w-full mb-1">Quick Select:</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8 border-blue-300 text-blue-800 hover:bg-blue-50"
              onClick={() => {
                const earliestAvailable = new Date(dateRange.earliest_date);
                const latestAvailable = new Date(dateRange.latest_date);
                onStartDateChange(earliestAvailable.toISOString().split('T')[0]);
                onEndDateChange(latestAvailable.toISOString().split('T')[0]);
              }}
            >
              All Available Data
            </Button>
          </div>
        )}
      </div>

      <ModalPopup
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
    </>
  );
};

export default ValidatedDatePicker;