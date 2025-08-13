import { useEffect, useRef } from 'react';
import { useSearchParams } from "react-router-dom";
import { getBasicTemplateList } from "../../build_algorithm/basic-templates";
import { getTemplateList } from "../../build_algorithm/complex-templates";

export const useUrlStrategy = (setSelectedStrategy, runBacktest) => {
  const [searchParams] = useSearchParams();
  const hasInitialized = useRef(false);

  const basicTemplates = getBasicTemplateList();
  const complexTemplates = getTemplateList();
  const allTemplates = [...basicTemplates, ...complexTemplates];

  useEffect(() => {
    if (hasInitialized.current) return;

    const strategy = searchParams.get('strategy');
    const autoRun = searchParams.get('autoRun') === 'true';

    console.log('URL Parameters:', { strategy, autoRun });

    if (strategy) {
      // Check if the strategy exists in our templates
      const template = allTemplates.find(t => t.key === strategy);
      
      if (template) {
        console.log('Found template:', template);
        setSelectedStrategy(strategy);
        
        if (autoRun) {
          console.log('Auto-running backtest for strategy:', strategy);
          // Small delay to ensure state is updated
          setTimeout(() => runBacktest(strategy), 100);
        }
      } else {
        // It might be a UUID for a saved strategy
        console.log('Assuming saved strategy UUID:', strategy);
        setSelectedStrategy(strategy);
        
        if (autoRun) {
          console.log('Auto-running backtest for saved strategy:', strategy);
          setTimeout(() => runBacktest(strategy), 100);
        }
      }
    }

    hasInitialized.current = true;
  }, [searchParams, allTemplates, setSelectedStrategy, runBacktest]);

  return {
    allTemplates,
    basicTemplates,
    complexTemplates,
  };
};