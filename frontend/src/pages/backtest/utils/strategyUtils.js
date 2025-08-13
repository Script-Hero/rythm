export const detectStrategyType = (strategy, basicTemplates, complexTemplates, typeParam) => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strategy);
  const templateKeys = [...basicTemplates.map(t => t.key), ...complexTemplates.map(t => t.key)];
  const isKnownTemplate = templateKeys.includes(strategy);
  
  console.log('Strategy detection:', {
    strategy,
    isUuid,
    typeParam,
    isKnownTemplate,
    templateKeys,
  });
  
  return { isUuid, isKnownTemplate };
};

export const buildBacktestRequest = (ticker, fromDate, toDate, barInterval, strategy, basicTemplates, complexTemplates, typeParam) => {
  const { isUuid, isKnownTemplate } = detectStrategyType(strategy, basicTemplates, complexTemplates, typeParam);
  
  let backtestRequestBody = {
    ticker,
    fromDate: new Date(fromDate + "T05:00:00.000Z"),
    toDate: new Date(toDate + "T05:00:00.000Z"),
    interval: barInterval
  };
  
  if (isKnownTemplate) {
    backtestRequestBody.strategy = strategy;
    backtestRequestBody.type = 'template';
  } else if (isUuid || typeParam === 'custom') {
    backtestRequestBody.strategy_id = strategy;
    backtestRequestBody.type = 'custom';
  } else {
    backtestRequestBody.strategy = strategy;
    backtestRequestBody.type = 'template';
  }
  
  return backtestRequestBody;
};