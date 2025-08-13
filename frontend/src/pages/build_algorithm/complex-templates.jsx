// Strategy Templates for Algorithmic Trading
// Each template contains initialNodes, initialEdges, name, and description

export const STRATEGY_TEMPLATES = {
  goldenCross: {
    name: "Golden Cross",
    description: "Buy when 50 EMA crosses above 200 EMA with RSI filter",
    initialNodes: [
      // Price Data Source
      {
        id: 'price-1',
        position: { x: 10, y: 150 },
        type: 'priceNode',
        data: { 
          priceType: 'close',
          symbol: 'SPY'
        },
      },
      
      // Fast EMA (50 period)
      {
        id: 'ema-fast',
        position: { x: 250, y: 75 },
        type: 'emaNode',
        data: { 
          period: 50
        },
      },
      
      // Slow EMA (200 period)
      {
        id: 'ema-slow',
        position: { x: 250, y: 200 },
        type: 'emaNode',
        data: { 
          period: 200
        },
      },
      
      // RSI for additional filter
      {
        id: 'rsi-1',
        position: { x: 250, y: 425 },
        type: 'rsiNode',
        data: { 
          period: 14
        },
      },
      
      // Golden Cross Detection (Fast EMA crosses above Slow EMA)
      {
        id: 'golden-cross',
        position: { x: 450, y: 50 },
        type: 'crossoverNode',
        data: { 
          crossType: 'above'
        },
      },
      
      // Death Cross Detection (Fast EMA crosses below Slow EMA)
      {
        id: 'death-cross',
        position: { x: 450, y: 200 },
        type: 'crossoverNode',
        data: { 
          crossType: 'below'
        },
      },
      
      // RSI not oversold (> 30)
      {
        id: 'rsi-filter-buy',
        position: { x: 450, y: 400 },
        type: 'compareNode',
        data: { 
          operator: '>',
          value: 30
        },
      },
      
      // RSI overbought (> 70)
      {
        id: 'rsi-overbought',
        position: { x: 450, y: 600 },
        type: 'compareNode',
        data: { 
          operator: '>',
          value: 70
        },
      },
      
      // AND gate for buy conditions (Golden Cross AND RSI > 30)
      {
        id: 'buy-conditions',
        position: { x: 700, y: 200 },
        type: 'andNode',
        data: {},
      },
      
      // OR gate for sell conditions (Death Cross OR RSI > 70)
      {
        id: 'sell-conditions',
        position: { x: 700, y: 350 },
        type: 'orNode',
        data: {},
      },
      
      // Buy Order
      {
        id: 'buy-order',
        position: { x: 900, y: 200 },
        type: 'buyNode',
        data: { 
          quantity: 100,
          orderType: 'market'
        },
      },
      
      // Sell Order
      {
        id: 'sell-order',
        position: { x: 900, y: 400 },
        type: 'sellNode',
        data: { 
          quantity: 100,
          orderType: 'market',
          sellType: 'all'
        },
      },
    ],
    initialEdges: [
      // Price to EMAs and RSI
      { id: 'price-to-fast-ema', source: 'price-1', target: 'ema-fast', sourceHandle: 'price-out', targetHandle: 'price-in' },
      { id: 'price-to-slow-ema', source: 'price-1', target: 'ema-slow', sourceHandle: 'price-out', targetHandle: 'price-in' },
      { id: 'price-to-rsi', source: 'price-1', target: 'rsi-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      
      // EMAs to crossover detectors
      { id: 'fast-to-golden', source: 'ema-fast', target: 'golden-cross', sourceHandle: 'ema-out', targetHandle: 'fast-in' },
      { id: 'slow-to-golden', source: 'ema-slow', target: 'golden-cross', sourceHandle: 'ema-out', targetHandle: 'slow-in' },
      { id: 'fast-to-death', source: 'ema-fast', target: 'death-cross', sourceHandle: 'ema-out', targetHandle: 'fast-in' },
      { id: 'slow-to-death', source: 'ema-slow', target: 'death-cross', sourceHandle: 'ema-out', targetHandle: 'slow-in' },
      
      // RSI to comparators
      { id: 'rsi-to-buy-filter', source: 'rsi-1', target: 'rsi-filter-buy', sourceHandle: 'rsi-out', targetHandle: 'value-in' },
      { id: 'rsi-to-overbought', source: 'rsi-1', target: 'rsi-overbought', sourceHandle: 'rsi-out', targetHandle: 'value-in' },
      
      // Buy conditions (Golden Cross AND RSI > 30)
      { id: 'golden-to-buy-and', source: 'golden-cross', target: 'buy-conditions', sourceHandle: 'cross-out', targetHandle: 'input-a' },
      { id: 'rsi-filter-to-buy-and', source: 'rsi-filter-buy', target: 'buy-conditions', sourceHandle: 'result-out', targetHandle: 'input-b' },
      
      // Sell conditions (Death Cross OR RSI > 70)
      { id: 'death-to-sell-or', source: 'death-cross', target: 'sell-conditions', sourceHandle: 'cross-out', targetHandle: 'input-a' },
      { id: 'overbought-to-sell-or', source: 'rsi-overbought', target: 'sell-conditions', sourceHandle: 'result-out', targetHandle: 'input-b' },
      
      // Conditions to orders
      { id: 'buy-conditions-to-order', source: 'buy-conditions', target: 'buy-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
      { id: 'sell-conditions-to-order', source: 'sell-conditions', target: 'sell-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
    ]
  },

  rsiMeanReversion: {
    name: "RSI Mean Reversion",
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

  bollingerBandsBounce: {
    name: "Bollinger Bands Bounce",
    description: "Buy at lower band, sell at upper band with mean reversion strategy",
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
      
      // Price below lower band (buy signal)
      {
        id: 'price-below-lower',
        position: { x: 550, y: 100 },
        type: 'compareNode',
        data: { 
          operator: '<',
          value: 0
        },
      },
      
      // Price above upper band (sell signal)
      {
        id: 'price-above-upper',
        position: { x: 550, y: 300 },
        type: 'compareNode',
        data: { 
          operator: '>',
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
      
      // Bollinger Bands to comparators
      { id: 'bb-lower-to-compare', source: 'bb-1', target: 'price-below-lower', sourceHandle: 'lower-out', targetHandle: 'value-in' },
      { id: 'bb-upper-to-compare', source: 'bb-1', target: 'price-above-upper', sourceHandle: 'upper-out', targetHandle: 'value-in' },
      
      // Conditions to orders
      { id: 'below-lower-to-buy', source: 'price-below-lower', target: 'buy-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
      { id: 'above-upper-to-sell', source: 'price-above-upper', target: 'sell-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
    ]
  },

  macdMomentum: {
    name: "MACD Momentum",
    description: "Buy on MACD bullish crossover, sell on bearish crossover",
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

  stochasticOscillator: {
    name: "Stochastic Oscillator",
    description: "Buy when %K crosses above %D in oversold region, sell when overbought",
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
      
      // Stochastic indicator
      {
        id: 'stoch-1',
        position: { x: 300, y: 200 },
        type: 'stochasticNode',
        data: { 
          kPeriod: 14,
          dPeriod: 3
        },
      },
      
      // %K crosses above %D
      {
        id: 'stoch-bullish-cross',
        position: { x: 550, y: 150 },
        type: 'crossoverNode',
        data: { 
          crossType: 'above'
        },
      },
      
      // %K is oversold (< 20)
      {
        id: 'stoch-oversold',
        position: { x: 550, y: 50 },
        type: 'compareNode',
        data: { 
          operator: '<',
          value: 20
        },
      },
      
      // %K is overbought (> 80)
      {
        id: 'stoch-overbought',
        position: { x: 550, y: 350 },
        type: 'compareNode',
        data: { 
          operator: '>',
          value: 80
        },
      },
      
      // Buy conditions: oversold AND bullish crossover
      {
        id: 'buy-conditions',
        position: { x: 750, y: 100 },
        type: 'andNode',
        data: {},
      },
      
      // Buy Order
      {
        id: 'buy-order',
        position: { x: 950, y: 100 },
        type: 'buyNode',
        data: { 
          quantity: 100,
          orderType: 'market'
        },
      },
      
      // Sell Order
      {
        id: 'sell-order',
        position: { x: 800, y: 350 },
        type: 'sellNode',
        data: { 
          quantity: 100,
          orderType: 'market',
          sellType: 'all'
        },
      },
    ],
    initialEdges: [
      // Price to Stochastic
      { id: 'price-to-stoch', source: 'price-1', target: 'stoch-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      
      // Stochastic to crossover and comparators
      { id: 'k-to-cross', source: 'stoch-1', target: 'stoch-bullish-cross', sourceHandle: 'k-out', targetHandle: 'fast-in' },
      { id: 'd-to-cross', source: 'stoch-1', target: 'stoch-bullish-cross', sourceHandle: 'd-out', targetHandle: 'slow-in' },
      { id: 'k-to-oversold', source: 'stoch-1', target: 'stoch-oversold', sourceHandle: 'k-out', targetHandle: 'value-in' },
      { id: 'k-to-overbought', source: 'stoch-1', target: 'stoch-overbought', sourceHandle: 'k-out', targetHandle: 'value-in' },
      
      // Buy conditions
      { id: 'oversold-to-and', source: 'stoch-oversold', target: 'buy-conditions', sourceHandle: 'result-out', targetHandle: 'input-a' },
      { id: 'cross-to-and', source: 'stoch-bullish-cross', target: 'buy-conditions', sourceHandle: 'cross-out', targetHandle: 'input-b' },
      
      // Orders
      { id: 'buy-conditions-to-order', source: 'buy-conditions', target: 'buy-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
      { id: 'overbought-to-sell', source: 'stoch-overbought', target: 'sell-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
    ]
  },

  volumeBreakout: {
    name: "Volume Breakout",
    description: "Buy on high volume price breakouts above resistance levels",
    initialNodes: [
      // Price Data Source
      {
        id: 'price-1',
        position: { x: 50, y: 150 },
        type: 'priceNode',
        data: { 
          priceType: 'close',
          symbol: 'SPY'
        },
      },
      
      // Volume Data
      {
        id: 'volume-1',
        position: { x: 50, y: 300 },
        type: 'volumeNode',
        data: { 
          period: 20
        },
      },
      
      // 20-period SMA for resistance level
      {
        id: 'sma-resistance',
        position: { x: 300, y: 100 },
        type: 'smaNode',
        data: { 
          period: 20
        },
      },
      
      // Price breaks above SMA
      {
        id: 'price-breakout',
        position: { x: 550, y: 100 },
        type: 'compareNode',
        data: { 
          operator: '>',
          value: 0
        },
      },
      
      // Volume above average
      {
        id: 'volume-surge',
        position: { x: 550, y: 300 },
        type: 'compareNode',
        data: { 
          operator: '>',
          value: 1.5
        },
      },
      
      // Combined breakout conditions
      {
        id: 'breakout-conditions',
        position: { x: 750, y: 200 },
        type: 'andNode',
        data: {},
      },
      
      // Buy Order
      {
        id: 'buy-order',
        position: { x: 950, y: 200 },
        type: 'buyNode',
        data: { 
          quantity: 100,
          orderType: 'market'
        },
      },
      
      // Stop loss at SMA level
      {
        id: 'stop-loss',
        position: { x: 550, y: 450 },
        type: 'compareNode',
        data: { 
          operator: '<',
          value: 0
        },
      },
      
      // Sell Order
      {
        id: 'sell-order',
        position: { x: 800, y: 450 },
        type: 'sellNode',
        data: { 
          quantity: 100,
          orderType: 'market',
          sellType: 'all'
        },
      },
    ],
    initialEdges: [
      // Price to SMA and comparison
      { id: 'price-to-sma', source: 'price-1', target: 'sma-resistance', sourceHandle: 'price-out', targetHandle: 'price-in' },
      { id: 'price-to-breakout', source: 'price-1', target: 'price-breakout', sourceHandle: 'price-out', targetHandle: 'value-in' },
      { id: 'sma-to-breakout', source: 'sma-resistance', target: 'price-breakout', sourceHandle: 'sma-out', targetHandle: 'compare-in' },
      
      // Volume analysis
      { id: 'volume-to-surge', source: 'volume-1', target: 'volume-surge', sourceHandle: 'volume-out', targetHandle: 'value-in' },
      
      // Breakout conditions
      { id: 'breakout-to-and', source: 'price-breakout', target: 'breakout-conditions', sourceHandle: 'result-out', targetHandle: 'input-a' },
      { id: 'volume-to-and', source: 'volume-surge', target: 'breakout-conditions', sourceHandle: 'result-out', targetHandle: 'input-b' },
      
      // Stop loss
      { id: 'price-to-stop', source: 'price-1', target: 'stop-loss', sourceHandle: 'price-out', targetHandle: 'value-in' },
      { id: 'sma-to-stop', source: 'sma-resistance', target: 'stop-loss', sourceHandle: 'sma-out', targetHandle: 'compare-in' },
      
      // Orders
      { id: 'conditions-to-buy', source: 'breakout-conditions', target: 'buy-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
      { id: 'stop-to-sell', source: 'stop-loss', target: 'sell-order', sourceHandle: 'result-out', targetHandle: 'trigger-in' },
    ]
  },

  atrTrendFollowing: {
    name: "ATR Trend Following",
    description: "Professional trend following strategy with ATR-based position sizing and risk management",
    initialNodes: [
      // Price Data
      {
        id: 'price-1',
        position: { x: 50, y: 200 },
        type: 'priceNode',
        data: { 
          priceType: 'close',
          symbol: 'BTC'
        },
      },
      
      // ATR for volatility measurement
      {
        id: 'atr-1',
        position: { x: 250, y: 300 },
        type: 'atrNode',
        data: { 
          period: 14
        },
      },
      
      // ADX for trend strength
      {
        id: 'adx-1',
        position: { x: 250, y: 100 },
        type: 'adxNode',
        data: { 
          period: 14
        },
      },
      
      // Strong trend filter (ADX > 25)
      {
        id: 'trend-strength',
        position: { x: 450, y: 100 },
        type: 'compareNode',
        data: { 
          operator: '>',
          value: 25
        },
      },
      
      // DI+ > DI- for uptrend
      {
        id: 'uptrend-signal',
        position: { x: 450, y: 200 },
        type: 'compareNode',
        data: { 
          operator: '>',
          value: 0
        },
      },
      
      // Buy conditions (Strong trend AND Uptrend)
      {
        id: 'buy-conditions',
        position: { x: 650, y: 150 },
        type: 'andNode',
        data: {},
      },
      
      // Position sizing based on ATR
      {
        id: 'position-sizer',
        position: { x: 850, y: 200 },
        type: 'positionSizeNode',
        data: { 
          sizingMethod: 'volatility_adjusted',
          riskPercent: 2,
          maxPosition: 10000
        },
      },
      
      // Buy Order
      {
        id: 'buy-order',
        position: { x: 1050, y: 150 },
        type: 'buyNode',
        data: { 
          orderType: 'market'
        },
      },
      
      // ATR-based stop loss
      {
        id: 'stop-loss',
        position: { x: 850, y: 400 },
        type: 'stopLossNode',
        data: { 
          stopType: 'atr_multiple',
          stopValue: 2,
          trailingEnabled: true,
          trailingDistance: 1.5
        },
      },
      
      // Take profit at 3x ATR
      {
        id: 'take-profit',
        position: { x: 850, y: 50 },
        type: 'takeProfitNode',
        data: { 
          profitType: 'rr_ratio',
          profitValue: 3,
          partialProfits: true,
          firstTarget: 2,
          secondTarget: 4
        },
      },
    ],
    initialEdges: [
      // Price connections
      { id: 'price-to-atr', source: 'price-1', target: 'atr-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      { id: 'price-to-adx', source: 'price-1', target: 'adx-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      
      // Trend analysis
      { id: 'adx-to-strength', source: 'adx-1', target: 'trend-strength', sourceHandle: 'adx-out', targetHandle: 'value-in' },
      { id: 'di-plus-to-uptrend', source: 'adx-1', target: 'uptrend-signal', sourceHandle: 'di-plus-out', targetHandle: 'value-in' },
      { id: 'di-minus-to-uptrend', source: 'adx-1', target: 'uptrend-signal', sourceHandle: 'di-minus-out', targetHandle: 'compare-in' },
      
      // Buy conditions
      { id: 'strength-to-buy', source: 'trend-strength', target: 'buy-conditions', sourceHandle: 'result-out', targetHandle: 'input-a' },
      { id: 'uptrend-to-buy', source: 'uptrend-signal', target: 'buy-conditions', sourceHandle: 'result-out', targetHandle: 'input-b' },
      
      // Position sizing and orders
      { id: 'buy-to-sizer', source: 'buy-conditions', target: 'position-sizer', sourceHandle: 'result-out', targetHandle: 'signal-in' },
      { id: 'atr-to-sizer', source: 'atr-1', target: 'position-sizer', sourceHandle: 'atr-out', targetHandle: 'volatility-in' },
      { id: 'sizer-to-buy', source: 'position-sizer', target: 'buy-order', sourceHandle: 'position-size-out', targetHandle: 'trigger-in' },
      
      // Risk management
      { id: 'buy-to-stop', source: 'buy-order', target: 'stop-loss', sourceHandle: 'order-out', targetHandle: 'trigger-in' },
      { id: 'price-to-stop', source: 'price-1', target: 'stop-loss', sourceHandle: 'price-out', targetHandle: 'price-in' },
      { id: 'atr-to-stop', source: 'atr-1', target: 'stop-loss', sourceHandle: 'atr-out', targetHandle: 'atr-in' },
      
      { id: 'buy-to-profit', source: 'buy-order', target: 'take-profit', sourceHandle: 'order-out', targetHandle: 'trigger-in' },
      { id: 'price-to-profit', source: 'price-1', target: 'take-profit', sourceHandle: 'price-out', targetHandle: 'price-in' },
    ]
  },

  divergenceStrategy: {
    name: "RSI Divergence",
    description: "Advanced strategy using RSI divergence signals with multiple confirmations",
    initialNodes: [
      // Price Data
      {
        id: 'price-1',
        position: { x: 50, y: 200 },
        type: 'priceNode',
        data: { 
          priceType: 'close',
          symbol: 'ETH'
        },
      },
      
      // RSI for divergence analysis
      {
        id: 'rsi-1',
        position: { x: 250, y: 300 },
        type: 'rsiNode',
        data: { 
          period: 14
        },
      },
      
      // Williams %R for additional confirmation
      {
        id: 'williams-1',
        position: { x: 250, y: 100 },
        type: 'williamsRNode',
        data: { 
          period: 14
        },
      },
      
      // Divergence detector
      {
        id: 'divergence-1',
        position: { x: 450, y: 250 },
        type: 'divergenceNode',
        data: { 
          lookbackPeriod: 20,
          divergenceType: 'regular',
          sensitivity: 0.7
        },
      },
      
      // RSI threshold filter
      {
        id: 'rsi-threshold',
        position: { x: 450, y: 400 },
        type: 'thresholdNode',
        data: { 
          upperThreshold: 70,
          lowerThreshold: 30,
          hysteresis: 5
        },
      },
      
      // Williams %R confirmation
      {
        id: 'williams-oversold',
        position: { x: 450, y: 50 },
        type: 'compareNode',
        data: { 
          operator: '<',
          value: -80
        },
      },
      
      // Bullish setup (divergence + oversold)
      {
        id: 'bullish-setup',
        position: { x: 700, y: 150 },
        type: 'andNode',
        data: {},
      },
      
      // Pattern confirmation
      {
        id: 'pattern-confirm',
        position: { x: 700, y: 350 },
        type: 'patternNode',
        data: { 
          patternType: 'double_bottom',
          confidence: 0.75,
          lookbackBars: 50
        },
      },
      
      // Final buy conditions
      {
        id: 'final-buy-conditions',
        position: { x: 900, y: 250 },
        type: 'andNode',
        data: {},
      },
      
      // Buy Order with position sizing
      {
        id: 'position-sizer',
        position: { x: 1100, y: 200 },
        type: 'positionSizeNode',
        data: { 
          sizingMethod: 'fixed_percent',
          riskPercent: 1.5,
          maxPosition: 5000
        },
      },
      
      {
        id: 'buy-order',
        position: { x: 1300, y: 200 },
        type: 'buyNode',
        data: { 
          orderType: 'limit'
        },
      },
      
      // Stop loss below recent low
      {
        id: 'stop-loss',
        position: { x: 1100, y: 400 },
        type: 'stopLossNode',
        data: { 
          stopType: 'support_resistance',
          stopValue: 2,
          trailingEnabled: false
        },
      },
      
      // Take profit at resistance
      {
        id: 'take-profit',
        position: { x: 1100, y: 50 },
        type: 'takeProfitNode',
        data: { 
          profitType: 'resistance_level',
          profitValue: 5,
          partialProfits: true,
          firstTarget: 3,
          secondTarget: 6
        },
      },
    ],
    initialEdges: [
      // Data flow
      { id: 'price-to-rsi', source: 'price-1', target: 'rsi-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      { id: 'price-to-williams', source: 'price-1', target: 'williams-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      
      // Divergence analysis
      { id: 'price-to-div', source: 'price-1', target: 'divergence-1', sourceHandle: 'price-out', targetHandle: 'price-in' },
      { id: 'rsi-to-div', source: 'rsi-1', target: 'divergence-1', sourceHandle: 'rsi-out', targetHandle: 'indicator-in' },
      
      // Threshold and confirmation filters
      { id: 'rsi-to-threshold', source: 'rsi-1', target: 'rsi-threshold', sourceHandle: 'rsi-out', targetHandle: 'value-in' },
      { id: 'williams-to-oversold', source: 'williams-1', target: 'williams-oversold', sourceHandle: 'williams-out', targetHandle: 'value-in' },
      
      // Pattern recognition
      { id: 'price-to-pattern', source: 'price-1', target: 'pattern-confirm', sourceHandle: 'price-out', targetHandle: 'price-in' },
      
      // Signal combination
      { id: 'div-bullish-to-setup', source: 'divergence-1', target: 'bullish-setup', sourceHandle: 'bullish-div-out', targetHandle: 'input-a' },
      { id: 'rsi-oversold-to-setup', source: 'rsi-threshold', target: 'bullish-setup', sourceHandle: 'oversold-out', targetHandle: 'input-b' },
      
      { id: 'bullish-to-final', source: 'bullish-setup', target: 'final-buy-conditions', sourceHandle: 'result-out', targetHandle: 'input-a' },
      { id: 'pattern-to-final', source: 'pattern-confirm', target: 'final-buy-conditions', sourceHandle: 'pattern-out', targetHandle: 'input-b' },
      
      // Order execution
      { id: 'final-to-sizer', source: 'final-buy-conditions', target: 'position-sizer', sourceHandle: 'result-out', targetHandle: 'signal-in' },
      { id: 'sizer-to-buy', source: 'position-sizer', target: 'buy-order', sourceHandle: 'position-size-out', targetHandle: 'trigger-in' },
      
      // Risk management
      { id: 'buy-to-stop', source: 'buy-order', target: 'stop-loss', sourceHandle: 'order-out', targetHandle: 'trigger-in' },
      { id: 'buy-to-profit', source: 'buy-order', target: 'take-profit', sourceHandle: 'order-out', targetHandle: 'trigger-in' },
      { id: 'price-to-stop-price', source: 'price-1', target: 'stop-loss', sourceHandle: 'price-out', targetHandle: 'price-in' },
      { id: 'price-to-profit-price', source: 'price-1', target: 'take-profit', sourceHandle: 'price-out', targetHandle: 'price-in' },
    ]
  }
};

export const getTemplateList = () => {
  return Object.entries(STRATEGY_TEMPLATES).map(([key, template]) => ({
    key,
    name: template.name,
    description: template.description
  }));
};

export const getTemplate = (key) => {
  return STRATEGY_TEMPLATES[key];
};