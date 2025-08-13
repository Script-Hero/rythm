// Node templates for the toolbar
export const nodeTemplates = [
  // Data Nodes
  {
    type: 'priceNode',
    label: 'Price Data',
    category: 'data',
  },
  {
    type: 'timeNode',
    label: 'Time Filter',
    category: 'data',
  },
  {
    type: 'spreadNode',
    label: 'Spread Data',
    category: 'data',
  },
  // Indicator Nodes
  {
    type: 'smaNode',
    label: 'SMA',
    category: 'indicators',
  },
  {
    type: 'emaNode',
    label: 'EMA',
    category: 'indicators',
  },
  {
    type: 'rsiNode',
    label: 'RSI',
    category: 'indicators',
  },
  {
    type: 'atrNode',
    label: 'ATR',
    category: 'indicators',
  },
  {
    type: 'williamsRNode',
    label: 'Williams R',
    category: 'indicators',
  },
  {
    type: 'cciNode',
    label: 'CCI',
    category: 'indicators',
  },
  {
    type: 'adxNode',
    label: 'ADX',
    category: 'indicators',
  },
  {
    type: 'macdNode',
    label: 'MACD',
    category: 'indicators',
  },
  {
    type: 'bollingerBandsNode',
    label: 'Bollinger Bands',
    category: 'indicators',
  },
  {
    type: 'stochasticNode',
    label: 'Stochastic',
    category: 'indicators',
  },
  {
    type: 'volumeNode',
    label: 'Volume',
    category: 'indicators',
  },
  // Logic Nodes
  {
    type: 'compareNode',
    label: 'Compare',
    category: 'logic',
  },
  {
    type: 'thresholdNode',
    label: 'Threshold',
    category: 'logic',
  },
  {
    type: 'divergenceNode',
    label: 'Divergence',
    category: 'logic',
  },
  {
    type: 'patternNode',
    label: 'Pattern',
    category: 'logic',
  },
  {
    type: 'crossoverNode',
    label: 'Crossover',
    category: 'logic',
  },
  {
    type: 'andNode',
    label: 'AND',
    category: 'logic',
  },
  {
    type: 'orNode',
    label: 'OR',
    category: 'logic',
  },
  {
    type: 'notNode',
    label: 'NOT',
    category: 'logic',
  },
  // Action Nodes
  {
    type: 'buyNode',
    label: 'Buy Order',
    category: 'actions',
  },
  {
    type: 'sellNode',
    label: 'Sell Order',
    category: 'actions',
  },
  {
    type: 'stopLossNode',
    label: 'Stop Loss',
    category: 'actions',
  },
  {
    type: 'takeProfitNode',
    label: 'Take Profit',
    category: 'actions',
  },
  {
    type: 'positionSizeNode',
    label: 'Position Size',
    category: 'actions',
  },
  {
    type: 'holdNode',
    label: 'Hold',
    category: 'actions',
  },
  // Other Nodes
  {
    type: 'labelNode',
    label: 'Label',
    category: 'other',
  },
];

export const nodeCategories = [
  { id: 'data', label: 'Data', icon: 'Database' },
  { id: 'indicators', label: 'Indicators', icon: 'BarChart3' },
  { id: 'logic', label: 'Logic', icon: 'Settings' },
  { id: 'actions', label: 'Actions', icon: 'Zap' },
  { id: 'other', label: 'Other', icon: 'Hash' },
];