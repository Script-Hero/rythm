import React from "react";

/**
 * KeyStatistics
 * ------------------------------------------------------------------
 * Displays a table of back-test metrics. Accepts a plain JS object in
 * `data`, where each property comes directly from PerformanceAnalyzer
 * (see backtest_metrics.py). Any metric that is `-1`, `null`, or
 * `undefined` is rendered as an em-dash (—).
 */
export default function KeyStatistics({ data = {}, ovrPercent }) {
  const isMissing = (v) => v == null || v === -1;

  const metrics = [
    //  Returns & risk-adjusted efficiency 
    {
      label: "CAGR",
      key: "cagr",
      format: (v) => `${(v * 100).toFixed(2)} %`,
    },
    {
      label: "Sharpe Ratio",
      key: "sharpe_ratio",
      format: (v) => v.toFixed(2),
    },
    {
      label: "Sortino Ratio",
      key: "sortino_ratio",
      format: (v) => v.toFixed(2),
    },
    {
      label: "Information Ratio",
      key: "information_ratio",
      format: (v) => v.toFixed(2),
    },

    //  Risk 
    {
      label: "Max Drawdown",
      key: "max_drawdown",
      format: (v) => `${(v * 100).toFixed(2)} %`,
    },

    //  Trading style 
    {
      label: "Turnover Ratio",
      key: "turnover_ratio",
      format: (v) => `${(v * 100).toFixed(1)} %`,
    },
    {
      label: "Trades per Day",
      key: "trades_per_day",
      format: (v) => v.toFixed(2),
    },
    {
      label: "Win Rate",
      key: "win_rate",
      format: (v) => `${(v * 100).toFixed(1)} %`,
    },

    //  Capacity / scalability 
    {
      label: "Capacity (est.)",
      key: "capacity",
      format: (v) => `$${v.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })}`,
    },

    //  Runtime info 
    {
      label: "Runtime (days)",
      key: "runtime_days",
      format: (v) => v.toFixed(0),
    },
    {
      label: "Runtime (years)",
      key: "runtime_years",
      format: (v) => v.toFixed(2),
    },
  ];

  const getMetricCategory = (key) => {
    const returns = ['cagr', 'sharpe_ratio', 'sortino_ratio', 'information_ratio'];
    const risk = ['max_drawdown'];
    const trading = ['turnover_ratio', 'trades_per_day', 'win_rate'];
    const capacity = ['capacity'];
    const runtime = ['runtime_days', 'runtime_years'];

    if (returns.includes(key)) return 'returns';
    if (risk.includes(key)) return 'risk';
    if (trading.includes(key)) return 'trading';
    if (capacity.includes(key)) return 'capacity';
    if (runtime.includes(key)) return 'runtime';
    return 'other';
  };

  const getCategoryStyle = (category) => {
    const styles = {
      returns: 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-400',
      risk: 'bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-400',
      trading: 'bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-400',
      capacity: 'bg-gradient-to-r from-purple-50 to-violet-50 border-l-4 border-purple-400',
      runtime: 'bg-gradient-to-r from-gray-50 to-slate-50 border-l-4 border-gray-400',
      other: 'bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-400'
    };
    return styles[category] || styles.other;
  };

  const getValueStyle = (key, value) => {
    if (isMissing(value)) return 'text-gray-400';
    
    const category = getMetricCategory(key);
    const styleMap = {
      returns: 'text-green-700 font-bold',
      risk: 'text-red-700 font-bold',
      trading: 'text-blue-700 font-bold',
      capacity: 'text-purple-700 font-bold',
      runtime: 'text-gray-700 font-bold',
      other: 'text-orange-700 font-bold'
    };
    return styleMap[category];
  };

  return (
    <div id="keyStatisticsChart" className="h-full">
      <div className="h-full overflow-y-auto rounded-2xl shadow-xl bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 backdrop-blur-sm border border-gray-200/60">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-700 via-blue-700 to-indigo-700 text-white rounded-t-2xl">
          <div className="px-6 py-4">
            <h3 className="text-lg font-bold text-center">Performance Metrics</h3>
            <p className="text-xs text-center text-blue-100 mt-1">Strategy key performance indicators</p>
          </div>
        </div>

        {/* Overall Win Rate - Prominent at top */}
        {ovrPercent !== undefined && (
          <div className="p-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white border-b-2 border-indigo-200">
            <div className="text-center">
              <div className="text-xs font-medium uppercase tracking-wider text-indigo-100 mb-1">Overall Strategy Performance</div>
              <div className="flex items-center justify-center gap-3">
                <div className="text-4xl font-bold text-white drop-shadow-lg">
                  {ovrPercent}%
                </div>
                <div className="text-sm font-medium text-indigo-100">
                  Win Rate
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${ovrPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 space-y-2 max-h-[calc(100%-80px)] overflow-y-auto">
          {metrics.map(({ key, label, format }) => {
            const category = getMetricCategory(key);
            const value = data[key];
            return (
              <div key={key} className={`${getCategoryStyle(category)} rounded-lg p-3 transition-all duration-200 hover:shadow-md hover:scale-[1.02]`}>
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800">{label}</div>
                  </div>
                  <div className={`text-right font-mono text-sm ${getValueStyle(key, value)}`}>
                    {isMissing(value) ? (
                      <span className="text-gray-400 text-lg">—</span>
                    ) : (
                      <span className="bg-white/60 px-3 py-1 rounded-full shadow-sm">
                        {format(value)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-gradient-to-r from-slate-100 to-blue-100 p-3 rounded-b-2xl border-t border-gray-200/60">
          <div className="text-xs text-center text-gray-600">
            <div className="flex justify-center space-x-4">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                Returns
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                Risk
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                Trading
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}