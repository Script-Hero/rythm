import { useCallback } from 'react';

export const useBacktestValidation = () => {
  const validateParams = useCallback(async (ticker, fromDate, toDate) => {
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
      return validation;
    } catch (error) {
      console.error('Validation error:', error);
      return { valid: false, errors: ['Validation failed'] };
    }
  }, []);

  return { validateParams };
};