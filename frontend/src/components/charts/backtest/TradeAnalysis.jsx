import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, TrendingDown, Target, Zap, DollarSign, Award, AlertTriangle } from 'lucide-react';

export default function TradeAnalysis({ backtestResults }) {
  const tradeData = useMemo(() => {
    if (!backtestResults || !backtestResults.key_metrics) {
      return null;
    }

    const metrics = backtestResults.key_metrics;
    return {
      avgWin: metrics.avg_win || 0,
      avgLoss: metrics.avg_loss || 0,
      winLossRatio: metrics.win_loss_ratio || 0,
      profitFactor: metrics.profit_factor || 0,
      expectancy: metrics.expectancy || 0,
      largestWin: metrics.largest_win || 0,
      largestLoss: metrics.largest_loss || 0,
      consecutiveWins: metrics.consecutive_wins || 0,
      consecutiveLosses: metrics.consecutive_losses || 0,
      kellyCriterion: metrics.kelly_criterion || 0,
      totalTrades: metrics.total_trades || 0,
      winRate: metrics.win_rate || 0
    };
  }, [backtestResults]);

  if (!tradeData) {
    return (
      <div className="flex justify-center items-center h-[400px] bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border-2 border-dashed border-emerald-200">
        <div className="text-center">
          <Target className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <div className="text-emerald-600 font-medium">No trade analysis data</div>
          <div className="text-xs text-emerald-400 mt-1">Run a backtest to see trade-level metrics</div>
        </div>
      </div>
    );
  }

  // Win vs Loss Analysis Chart
  const winLossOption = useMemo(() => ({
    backgroundColor: 'transparent',
    title: {
      text: 'Win vs Loss Analysis',
      left: 'center',
      top: '5%',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937'
      }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(34, 197, 94, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { fontSize: 12, fontWeight: 'bold' },
      formatter: (params) => {
        const value = (params.value * 100).toFixed(2);
        const color = params.name === 'Average Win' ? '#22c55e' : '#ef4444';
        return `
          <div class="p-4 text-sm">
            <div class="font-bold text-lg mb-3 text-gray-800 border-b border-gray-200 pb-2">${params.name}</div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-gray-600">Average Return</span>
                <span class="font-bold text-2xl" style="color: ${color}">${value}%</span>
              </div>
              <div class="pt-2 border-t border-gray-100">
                <div class="text-xs text-gray-500">Per trade when ${params.name.toLowerCase()}</div>
              </div>
            </div>
          </div>
        `;
      }
    },
    series: [
      {
        name: 'Win/Loss',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '60%'],
        data: [
          { 
            value: Math.abs(tradeData.avgWin), 
            name: 'Average Win',
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 1,
                colorStops: [
                  { offset: 0, color: '#22c55e' },
                  { offset: 1, color: '#16a34a' }
                ]
              }
            }
          },
          { 
            value: Math.abs(tradeData.avgLoss), 
            name: 'Average Loss',
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 1,
                colorStops: [
                  { offset: 0, color: '#ef4444' },
                  { offset: 1, color: '#dc2626' }
                ]
              }
            }
          }
        ],
        label: {
          show: true,
          position: 'outside',
          formatter: '{b}\n{d}%',
          fontSize: 12,
          fontWeight: 'bold',
          color: '#1f2937'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  }), [tradeData]);

  // Performance Metrics Radar Chart
  const radarOption = useMemo(() => {
    // Normalize metrics for radar chart (0-100 scale)
    const normalizeMetric = (value, max = 1, min = 0) => {
      return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    };

    return {
      backgroundColor: 'transparent',
      title: {
        text: 'Trade Performance Profile',
        left: 'center',
        top: '5%',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#1f2937'
        }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(139, 92, 246, 0.2)',
        borderWidth: 2,
        borderRadius: 12,
        shadowBlur: 20,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        textStyle: { fontSize: 12, fontWeight: 'bold' }
      },
      radar: {
        center: ['50%', '60%'],
        radius: '70%',
        indicator: [
          { name: 'Win Rate', max: 100 },
          { name: 'Profit Factor', max: 100 },
          { name: 'Win/Loss Ratio', max: 100 },
          { name: 'Expectancy', max: 100 },
          { name: 'Kelly %', max: 100 },
          { name: 'Consistency', max: 100 }
        ],
        axisName: {
          color: '#6b7280',
          fontSize: 11,
          fontWeight: 'bold'
        },
        splitArea: {
          areaStyle: {
            color: [
              'rgba(16, 185, 129, 0.05)',
              'rgba(16, 185, 129, 0.1)',
              'rgba(16, 185, 129, 0.15)',
              'rgba(16, 185, 129, 0.2)',
              'rgba(16, 185, 129, 0.25)'
            ]
          }
        },
        axisLine: {
          lineStyle: { color: '#e5e7eb' }
        },
        splitLine: {
          lineStyle: { color: '#e5e7eb' }
        }
      },
      series: [
        {
          name: 'Performance Metrics',
          type: 'radar',
          data: [
            {
              value: [
                tradeData.winRate * 100,
                normalizeMetric(tradeData.profitFactor, 3),
                normalizeMetric(tradeData.winLossRatio, 3),
                normalizeMetric(tradeData.expectancy * 100, 5, -5),
                tradeData.kellyCriterion * 100,
                100 - (tradeData.consecutiveLosses / tradeData.totalTrades * 100) // Consistency measure
              ],
              name: 'Strategy Performance',
              itemStyle: {
                color: '#8b5cf6'
              },
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0, y: 0, x2: 1, y2: 1,
                  colorStops: [
                    { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
                    { offset: 1, color: 'rgba(139, 92, 246, 0.1)' }
                  ]
                }
              }
            }
          ]
        }
      ]
    };
  }, [tradeData]);

  // Consecutive Trades Analysis
  const consecutiveOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(245, 158, 11, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { fontSize: 12, fontWeight: 'bold' },
      formatter: (params) => {
        const param = params[0];
        const isWin = param.name === 'Consecutive Wins';
        const color = isWin ? '#22c55e' : '#ef4444';
        
        return `
          <div class="p-4 text-sm">
            <div class="font-bold text-lg mb-3 text-gray-800 border-b border-gray-200 pb-2">${param.name}</div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-gray-600">Max Streak</span>
                <span class="font-bold text-2xl" style="color: ${color}">${param.value}</span>
              </div>
              <div class="pt-2 border-t border-gray-100">
                <div class="text-xs text-gray-500">Maximum consecutive ${isWin ? 'winning' : 'losing'} trades</div>
              </div>
            </div>
          </div>
        `;
      }
    },
    grid: {
      left: '15%',
      right: '10%',
      top: '15%',
      bottom: '20%',
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      borderRadius: 8,
      shadowBlur: 4,
      shadowColor: 'rgba(0, 0, 0, 0.05)'
    },
    xAxis: {
      type: 'category',
      data: ['Consecutive Wins', 'Consecutive Losses'],
      axisLabel: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: 'bold'
      },
      axisLine: {
        lineStyle: { color: '#e5e7eb', width: 2 }
      },
      axisTick: {
        lineStyle: { color: '#d1d5db' }
      }
    },
    yAxis: {
      type: 'value',
      name: 'Number of Trades',
      nameTextStyle: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: 'bold'
      },
      axisLabel: {
        color: '#6b7280',
        fontSize: 11,
        fontWeight: 'bold'
      },
      axisLine: {
        lineStyle: { color: '#e5e7eb', width: 2 }
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
          color: '#f3f4f6',
          width: 1
        }
      }
    },
    series: [
      {
        name: 'Consecutive Trades',
        type: 'bar',
        data: [
          tradeData.consecutiveWins,
          tradeData.consecutiveLosses
        ],
        itemStyle: {
          color: (params) => {
            return params.dataIndex === 0 ? '#22c55e' : '#ef4444';
          },
          borderRadius: [4, 4, 0, 0],
          shadowBlur: 4,
          shadowColor: 'rgba(0, 0, 0, 0.1)'
        },
        label: {
          show: true,
          position: 'top',
          formatter: (params) => `${params.value}`,
          color: '#1f2937',
          fontSize: 14,
          fontWeight: 'bold'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8
          }
        }
      }
    ]
  }), [tradeData]);

  return (
    <div className="h-full space-y-4">
      {/* Key Trade Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div className="bg-gradient-to-br from-white to-green-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <Award className="h-3 w-3 text-green-500" />
            <span className="text-xs font-semibold text-gray-700">Profit Factor</span>
          </div>
          <div className="text-lg font-bold text-green-600">
            {tradeData.profitFactor.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Gross profit/loss</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3 w-3 text-blue-500" />
            <span className="text-xs font-semibold text-gray-700">W/L Ratio</span>
          </div>
          <div className="text-lg font-bold text-blue-600">
            {tradeData.winLossRatio.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Avg win/avg loss</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-purple-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-3 w-3 text-purple-500" />
            <span className="text-xs font-semibold text-gray-700">Expectancy</span>
          </div>
          <div className="text-lg font-bold text-purple-600">
            {(tradeData.expectancy * 100).toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">Expected per trade</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-3 w-3 text-orange-500" />
            <span className="text-xs font-semibold text-gray-700">Kelly %</span>
          </div>
          <div className="text-lg font-bold text-orange-600">
            {(tradeData.kellyCriterion * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Optimal position</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-red-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-3 w-3 text-red-500" />
            <span className="text-xs font-semibold text-gray-700">Max Loss</span>
          </div>
          <div className="text-lg font-bold text-red-600">
            {(tradeData.largestLoss * 100).toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">Worst single trade</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Win/Loss Pie Chart */}
        <div className="bg-gradient-to-br from-white to-emerald-50/30 rounded-lg p-4 shadow-sm border">
          <ReactECharts
            option={winLossOption}
            style={{ width: '100%', height: '300px' }}
            opts={{ renderer: 'svg' }}
            className="transition-all duration-200"
          />
        </div>

        {/* Performance Radar */}
        <div className="bg-gradient-to-br from-white to-purple-50/30 rounded-lg p-4 shadow-sm border">
          <ReactECharts
            option={radarOption}
            style={{ width: '100%', height: '300px' }}
            opts={{ renderer: 'svg' }}
            className="transition-all duration-200"
          />
        </div>

        {/* Consecutive Trades */}
        <div className="bg-gradient-to-br from-white to-yellow-50/30 rounded-lg p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-yellow-600" />
            <h4 className="text-sm font-semibold text-gray-700">Streak Analysis</h4>
          </div>
          <ReactECharts
            option={consecutiveOption}
            style={{ width: '100%', height: '250px' }}
            opts={{ renderer: 'svg' }}
            className="transition-all duration-200"
          />
        </div>
      </div>

      {/* Trade Insights */}
      <div className="bg-gradient-to-br from-white to-gray-50/30 rounded-lg p-4 shadow-sm border">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-semibold text-gray-700">Trade Analysis Insights</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs text-gray-600">
          <div>
            <strong>Profit Factor:</strong> {tradeData.profitFactor > 1.5 
              ? `Excellent (${tradeData.profitFactor.toFixed(2)}) - Gross profits significantly exceed losses.`
              : tradeData.profitFactor > 1.0 
                ? `Acceptable (${tradeData.profitFactor.toFixed(2)}) - Strategy is profitable but could be optimized.`
                : `Poor (${tradeData.profitFactor.toFixed(2)}) - Losses exceed profits, strategy needs revision.`
            }
          </div>
          <div>
            <strong>Kelly Criterion:</strong> {tradeData.kellyCriterion > 0.25 
              ? "High confidence - Consider position sizing at suggested level."
              : tradeData.kellyCriterion > 0.1 
                ? "Moderate confidence - Conservative position sizing recommended."
                : "Low confidence - Use minimal position sizes or avoid trading."
            }
          </div>
          <div>
            <strong>Streak Risk:</strong> {tradeData.consecutiveLosses > 5 
              ? `High (${tradeData.consecutiveLosses} max losses) - Review risk management.`
              : tradeData.consecutiveLosses > 3 
                ? `Moderate (${tradeData.consecutiveLosses} max losses) - Acceptable drawdown periods.`
                : `Low (${tradeData.consecutiveLosses} max losses) - Well-controlled losing streaks.`
            }
          </div>
        </div>
      </div>
    </div>
  );
}