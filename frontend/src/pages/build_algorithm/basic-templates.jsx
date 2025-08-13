// Basic Single-Indicator Strategy Templates
// Each template uses a single indicator for buy/sell signals

export const BASIC_STRATEGY_TEMPLATES = {
  rsi: {
    name: "RSI",
    description: "Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)",
    initialNodes: [
      // Price Data Source
      {
        id: 'price-1',
        position: { x: 50, y: 200 },
        type: 'priceNode',
        data: { 
          priceType: 'close',
          symbol: 'SPY'
        },
      },
      
      // RSI indicator
      {
        id: 'rsi-1',
        position: { x: 300, y: 200 },
        type: 'rsiNode',
        data: { 
          period: 14
        },
      },
      
      // RSI oversold condition (< 30)
      {
        id: 'rsi-oversold',
        position: { x: 550, y: 100 },
        type: 'compareNode',
        data: { 
          operator: '<',
          value: 30
        },
      },
      
      // RSI overbought condition (> 70)
      {
        id: 'rsi-overbought',
        position: { x: 550, y: 300 },
        type: 'compareNode',
        data: { 
          operator: '>',
          value: 70
        },
      },
      
      // Buy Order
      {
        id: 'buy-order',
        position: { x: 800, y: 100 },
        type: 'buyNode',
        data: { 
          quantity: 100,
          orderType: 'market'
        },
      },
      
      // Sell Order
      {
        id: 'sell-order',
        position: { x: 800, y: 300 },
        type: 'sellNode',
        data: { 
          quantity: 100,
          orderType: 'market',
          sellType: 'all'
        },
      },
    ],
    initialEdges: [
      // Price to RSI
      { id: 'price-to-rsi', source: 'price-1', target: 'rsi-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      
      // RSI to comparators
      { id: 'rsi-to-oversold', source: 'rsi-1', target: 'rsi-oversold', sourceHandle: 'rsi-out', targetHandle: 'value-in' },
      { id: 'rsi-to-overbought', source: 'rsi-1', target: 'rsi-overbought', sourceHandle: 'rsi-out', targetHandle: 'value-in' },
      
      // Conditions to orders
      { id: 'oversold-to-buy', source: 'rsi-oversold', target: 'buy-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
      { id: 'overbought-to-sell', source: 'rsi-overbought', target: 'sell-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
    ]
  },

  sma: {
    name: "SMA",
    description: "Buy when price crosses above SMA, sell when price crosses below SMA",
    initialNodes: [
      // Price Data Source
      {
        id: 'price-1',
        position: { x: 50, y: 200 },
        type: 'priceNode',
        data: { 
          priceType: 'close',
          symbol: 'SPY'
        },
      },
      
      // SMA indicator
      {
        id: 'sma-1',
        position: { x: 300, y: 200 },
        type: 'smaNode',
        data: { 
          period: 20
        },
      },
      
      // Price crosses above SMA
      {
        id: 'price-above-sma',
        position: { x: 550, y: 100 },
        type: 'crossoverNode',
        data: { 
          crossType: 'above'
        },
      },
      
      // Price crosses below SMA
      {
        id: 'price-below-sma',
        position: { x: 550, y: 300 },
        type: 'crossoverNode',
        data: { 
          crossType: 'below'
        },
      },
      
      // Buy Order
      {
        id: 'buy-order',
        position: { x: 800, y: 100 },
        type: 'buyNode',
        data: { 
          quantity: 100,
          orderType: 'market'
        },
      },
      
      // Sell Order
      {
        id: 'sell-order',
        position: { x: 800, y: 300 },
        type: 'sellNode',
        data: { 
          quantity: 100,
          orderType: 'market',
          sellType: 'all'
        },
      },
    ],
    initialEdges: [
      // Price to SMA
      { id: 'price-to-sma', source: 'price-1', target: 'sma-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      
      // Price and SMA to crossover detectors
      { id: 'price-to-above-cross', source: 'price-1', target: 'price-above-sma', sourceHandle: 'price-out', targetHandle: 'fast-in' },
      { id: 'sma-to-above-cross', source: 'sma-1', target: 'price-above-sma', sourceHandle: 'sma-out', targetHandle: 'slow-in' },
      { id: 'price-to-below-cross', source: 'price-1', target: 'price-below-sma', sourceHandle: 'price-out', targetHandle: 'fast-in' },
      { id: 'sma-to-below-cross', source: 'sma-1', target: 'price-below-sma', sourceHandle: 'sma-out', targetHandle: 'slow-in' },
      
      // Crossovers to orders
      { id: 'above-cross-to-buy', source: 'price-above-sma', target: 'buy-order', sourceHandle: 'cross-out', targetHandle: 'trigger-in' },
      { id: 'below-cross-to-sell', source: 'price-below-sma', target: 'sell-order', sourceHandle: 'cross-out', targetHandle: 'trigger-in' },
    ]
  },

  ema: {
    name: "EMA",
    description: "Buy when price crosses above EMA, sell when price crosses below EMA",
    initialNodes: [
      // Price Data Source
      {
        id: 'price-1',
        position: { x: 50, y: 200 },
        type: 'priceNode',
        data: { 
          priceType: 'close',
          symbol: 'SPY'
        },
      },
      
      // EMA indicator
      {
        id: 'ema-1',
        position: { x: 300, y: 200 },
        type: 'emaNode',
        data: { 
          period: 20
        },
      },
      
      // Price crosses above EMA
      {
        id: 'price-above-ema',
        position: { x: 550, y: 100 },
        type: 'crossoverNode',
        data: { 
          crossType: 'above'
        },
      },
      
      // Price crosses below EMA
      {
        id: 'price-below-ema',
        position: { x: 550, y: 300 },
        type: 'crossoverNode',
        data: { 
          crossType: 'below'
        },
      },
      
      // Buy Order
      {
        id: 'buy-order',
        position: { x: 800, y: 100 },
        type: 'buyNode',
        data: { 
          quantity: 100,
          orderType: 'market'
        },
      },
      
      // Sell Order
      {
        id: 'sell-order',
        position: { x: 800, y: 300 },
        type: 'sellNode',
        data: { 
          quantity: 100,
          orderType: 'market',
          sellType: 'all'
        },
      },
    ],
    initialEdges: [
      // Price to EMA
      { id: 'price-to-ema', source: 'price-1', target: 'ema-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      
      // Price and EMA to crossover detectors
      { id: 'price-to-above-cross', source: 'price-1', target: 'price-above-ema', sourceHandle: 'price-out', targetHandle: 'fast-in' },
      { id: 'ema-to-above-cross', source: 'ema-1', target: 'price-above-ema', sourceHandle: 'ema-out', targetHandle: 'slow-in' },
      { id: 'price-to-below-cross', source: 'price-1', target: 'price-below-ema', sourceHandle: 'price-out', targetHandle: 'fast-in' },
      { id: 'ema-to-below-cross', source: 'ema-1', target: 'price-below-ema', sourceHandle: 'ema-out', targetHandle: 'slow-in' },
      
      // Crossovers to orders
      { id: 'above-cross-to-buy', source: 'price-above-ema', target: 'buy-order', sourceHandle: 'cross-out', targetHandle: 'trigger-in' },
      { id: 'below-cross-to-sell', source: 'price-below-ema', target: 'sell-order', sourceHandle: 'cross-out', targetHandle: 'trigger-in' },
    ]
  },

  macd: {
    name: "MACD",
    description: "Buy when MACD line crosses above signal line, sell when MACD line crosses below signal line",
    initialNodes: [
      // Price Data Source
      {
        id: 'price-1',
        position: { x: 50, y: 200 },
        type: 'priceNode',
        data: { 
          priceType: 'close',
          symbol: 'SPY'
        },
      },
      
      // MACD indicator
      {
        id: 'macd-1',
        position: { x: 300, y: 200 },
        type: 'macdNode',
        data: { 
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9
        },
      },
      
      // MACD line crosses above signal (bullish)
      {
        id: 'macd-bullish-cross',
        position: { x: 550, y: 100 },
        type: 'crossoverNode',
        data: { 
          crossType: 'above'
        },
      },
      
      // MACD line crosses below signal (bearish)
      {
        id: 'macd-bearish-cross',
        position: { x: 550, y: 300 },
        type: 'crossoverNode',
        data: { 
          crossType: 'below'
        },
      },
      
      // Buy Order
      {
        id: 'buy-order',
        position: { x: 800, y: 100 },
        type: 'buyNode',
        data: { 
          quantity: 100,
          orderType: 'market'
        },
      },
      
      // Sell Order
      {
        id: 'sell-order',
        position: { x: 800, y: 300 },
        type: 'sellNode',
        data: { 
          quantity: 100,
          orderType: 'market',
          sellType: 'all'
        },
      },
    ],
    initialEdges: [
      // Price to MACD
      { id: 'price-to-macd', source: 'price-1', target: 'macd-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      
      // MACD to crossover detectors
      { id: 'macd-line-to-bullish', source: 'macd-1', target: 'macd-bullish-cross', sourceHandle: 'macd-out', targetHandle: 'fast-in' },
      { id: 'signal-to-bullish', source: 'macd-1', target: 'macd-bullish-cross', sourceHandle: 'signal-out', targetHandle: 'slow-in' },
      { id: 'macd-line-to-bearish', source: 'macd-1', target: 'macd-bearish-cross', sourceHandle: 'macd-out', targetHandle: 'fast-in' },
      { id: 'signal-to-bearish', source: 'macd-1', target: 'macd-bearish-cross', sourceHandle: 'signal-out', targetHandle: 'slow-in' },
      
      // Crossovers to orders
      { id: 'bullish-cross-to-buy', source: 'macd-bullish-cross', target: 'buy-order', sourceHandle: 'cross-out', targetHandle: 'trigger-in' },
      { id: 'bearish-cross-to-sell', source: 'macd-bearish-cross', target: 'sell-order', sourceHandle: 'cross-out', targetHandle: 'trigger-in' },
    ]
  },

  bollingerBands: {
    name: "Bollinger Bands",
    description: "Buy when price touches lower band, sell when price touches upper band",
    initialNodes: [
      // Price Data Source
      {
        id: 'price-1',
        position: { x: 50, y: 200 },
        type: 'priceNode',
        data: { 
          priceType: 'close',
          symbol: 'SPY'
        },
      },
      
      // Bollinger Bands
      {
        id: 'bb-1',
        position: { x: 300, y: 200 },
        type: 'bollingerBandsNode',
        data: { 
          period: 20,
          stdDev: 2
        },
      },
      
      // Price at or below lower band (buy signal)
      {
        id: 'price-at-lower',
        position: { x: 550, y: 100 },
        type: 'compareNode',
        data: { 
          operator: '<=',
          value: 0
        },
      },
      
      // Price at or above upper band (sell signal)
      {
        id: 'price-at-upper',
        position: { x: 550, y: 300 },
        type: 'compareNode',
        data: { 
          operator: '>=',
          value: 0
        },
      },
      
      // Buy Order
      {
        id: 'buy-order',
        position: { x: 800, y: 100 },
        type: 'buyNode',
        data: { 
          quantity: 100,
          orderType: 'market'
        },
      },
      
      // Sell Order
      {
        id: 'sell-order',
        position: { x: 800, y: 300 },
        type: 'sellNode',
        data: { 
          quantity: 100,
          orderType: 'market',
          sellType: 'all'
        },
      },
    ],
    initialEdges: [
      // Price to Bollinger Bands
      { id: 'price-to-bb', source: 'price-1', target: 'bb-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      
      // Price and Bollinger Bands to comparators
      { id: 'price-to-lower-compare', source: 'price-1', target: 'price-at-lower', sourceHandle: 'price-out', targetHandle: 'value-in' },
      { id: 'bb-lower-to-compare', source: 'bb-1', target: 'price-at-lower', sourceHandle: 'lower-out', targetHandle: 'compare-in' },
      { id: 'price-to-upper-compare', source: 'price-1', target: 'price-at-upper', sourceHandle: 'price-out', targetHandle: 'value-in' },
      { id: 'bb-upper-to-compare', source: 'bb-1', target: 'price-at-upper', sourceHandle: 'upper-out', targetHandle: 'compare-in' },
      
      // Conditions to orders
      { id: 'at-lower-to-buy', source: 'price-at-lower', target: 'buy-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
      { id: 'at-upper-to-sell', source: 'price-at-upper', target: 'sell-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
    ]
  },
};

export const getBasicTemplateList = () => {
  return Object.entries(BASIC_STRATEGY_TEMPLATES).map(([key, template]) => ({
    key,
    name: template.name,
    description: template.description
  }));
};

export const getBasicTemplate = (key) => {
  return BASIC_STRATEGY_TEMPLATES[key];
};