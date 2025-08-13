import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Target, TrendingUp, TrendingDown, BarChart3, Activity, Zap } from 'lucide-react';

export default function PerformanceAttribution({ backtestResults }) {
  const attributionData = useMemo(() => {
    if (!backtestResults || !backtestResults.key_metrics) {
      return null;
    }

    const metrics = backtestResults.key_metrics;
    return {
      alpha: metrics.alpha || 0,
      beta: metrics.beta || 0,
      treynorRatio: metrics.treynor_ratio || 0,
      trackingError: metrics.tracking_error || 0,
      rSquared: metrics.r_squared || 0,
      upCapture: metrics.up_capture || 0,
      downCapture: metrics.down_capture || 0,
      sharpeRatio: metrics.sharpe_ratio || 0,
      informationRatio: metrics.information_ratio || 0
    };
  }, [backtestResults]);

  if (!attributionData) {
    return (
      <div className="flex justify-center items-center h-[400px] bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border-2 border-dashed border-indigo-200">
        <div className="text-center">
          <Target className="h-12 w-12 text-indigo-400 mx-auto mb-3" />
          <div className="text-indigo-600 font-medium">No attribution data</div>
          <div className="text-xs text-indigo-400 mt-1">Run a backtest to see performance attribution</div>
        </div>
      </div>
    );
  }

  // Enhanced Risk-Return Scatter Plot with better UX
  const scatterOption = useMemo(() => ({
    backgroundColor: 'transparent',
    title: {
      text: 'Risk-Return Position',
      subtext: 'Strategy performance vs risk level (Higher α = better, Lower σ = better)',
      left: 'center',
      top: '3%',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937'
      },
      subtextStyle: {
        fontSize: 11,
        color: '#6b7280',
        fontStyle: 'italic'
      }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(99, 102, 241, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { fontSize: 12, fontWeight: 'bold' },
      formatter: (params) => {
        const [risk, alpha] = params.value;
        const riskLevel = Math.abs(risk) > 15 ? 'High' : Math.abs(risk) > 5 ? 'Medium' : 'Low';
        const alphaPerf = alpha > 5 ? 'Excellent' : alpha > 0 ? 'Good' : alpha > -5 ? 'Fair' : 'Poor';
        const alphaColor = alpha > 5 ? '#10b981' : alpha > 0 ? '#22c55e' : alpha > -5 ? '#f59e0b' : '#ef4444';
        const riskColor = Math.abs(risk) > 15 ? '#ef4444' : Math.abs(risk) > 5 ? '#f59e0b' : '#22c55e';
        
        return `
          <div class="p-4 text-sm">
            <div class="font-bold text-lg mb-3 text-gray-800 border-b border-gray-200 pb-2">Risk-Return Position</div>
            <div class="space-y-3">
              <div class="bg-gray-50 p-3 rounded-lg">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-gray-600 font-medium">Alpha (Excess Return)</span>
                  <span class="font-bold px-2 py-1 rounded text-sm" style="color: ${alphaColor}; background-color: ${alphaColor}20">${alpha.toFixed(2)}%</span>
                </div>
                <div class="text-xs" style="color: ${alphaColor}">${alphaPerf} - ${alpha > 0 ? 'Beating' : 'Lagging'} benchmark</div>
              </div>
              <div class="bg-gray-50 p-3 rounded-lg">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-gray-600 font-medium">Tracking Error (Risk)</span>
                  <span class="font-bold px-2 py-1 rounded text-sm" style="color: ${riskColor}; background-color: ${riskColor}20">${Math.abs(risk).toFixed(2)}%</span>
                </div>
                <div class="text-xs" style="color: ${riskColor}">${riskLevel} volatility vs benchmark</div>
              </div>
              <div class="pt-2 border-t border-gray-200">
                <div class="text-xs text-gray-500 text-center">
                  <strong>Ideal position:</strong> High Alpha (↑), Low Risk (←)
                </div>
              </div>
            </div>
          </div>
        `;
      }
    },
    grid: {
      left: '15%',
      right: '15%',
      top: '25%',
      bottom: '25%',
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      borderRadius: 8,
      shadowBlur: 4,
      shadowColor: 'rgba(0, 0, 0, 0.05)'
    },
    xAxis: {
      type: 'value',
      name: 'Risk (Tracking Error)',
      nameTextStyle: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: 'bold'
      },
      axisLabel: {
        formatter: '{value}%',
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
    yAxis: {
      type: 'value',
      name: 'Alpha',
      nameTextStyle: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: 'bold'
      },
      axisLabel: {
        formatter: '{value}%',
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
        name: 'Strategy',
        type: 'scatter',
        data: [[attributionData.trackingError * 100, attributionData.alpha * 100]],
        symbolSize: 50,
        itemStyle: {
          color: {
            type: 'radial',
            x: 0.5, y: 0.5, r: 0.5,
            colorStops: [
              { offset: 0, color: '#6366f1' },
              { offset: 1, color: '#4f46e5' }
            ]
          },
          borderColor: '#ffffff',
          borderWidth: 3,
          shadowBlur: 10,
          shadowColor: 'rgba(99, 102, 241, 0.5)'
        },
        label: {
          show: true,
          position: 'top',
          formatter: 'Strategy',
          color: '#1f2937',
          fontSize: 12,
          fontWeight: 'bold'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 15,
            shadowColor: 'rgba(99, 102, 241, 0.7)'
          }
        },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          lineStyle: {
            color: '#9ca3af',
            width: 1,
            type: 'dashed',
            opacity: 0.8
          },
          data: [
            { xAxis: 0, label: { show: false } },
            { yAxis: 0, label: { show: false } }
          ]
        }
      }
    ],
    graphic: [
      {
        type: 'text',
        left: '75%',
        top: '20%',
        style: {
          text: 'High α\nHigh Risk',
          fontSize: 10,
          fontWeight: 'bold',
          fill: '#f59e0b',
          textAlign: 'center'
        }
      },
      {
        type: 'text',
        left: '25%',
        top: '20%',
        style: {
          text: 'High α\nLow Risk\n(IDEAL)',
          fontSize: 10,
          fontWeight: 'bold',
          fill: '#10b981',
          textAlign: 'center'
        }
      },
      {
        type: 'text',
        left: '25%',
        top: '70%',
        style: {
          text: 'Low α\nLow Risk',
          fontSize: 10,
          fontWeight: 'bold',
          fill: '#6b7280',
          textAlign: 'center'
        }
      },
      {
        type: 'text',
        left: '75%',
        top: '70%',
        style: {
          text: 'Low α\nHigh Risk\n(AVOID)',
          fontSize: 10,
          fontWeight: 'bold',
          fill: '#ef4444',
          textAlign: 'center'
        }
      }
    ]
  }), [attributionData]);

  // Capture Ratios Chart
  const captureOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(16, 185, 129, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { fontSize: 12, fontWeight: 'bold' },
      formatter: (params) => {
        const param = params[0];
        const value = (param.value * 100).toFixed(1);
        const color = param.value > 1 ? '#22c55e' : '#ef4444';
        const interpretation = param.value > 1 ? 'Outperformed' : 'Underperformed';
        
        return `
          <div class="p-4 text-sm">
            <div class="font-bold text-lg mb-3 text-gray-800 border-b border-gray-200 pb-2">${param.name}</div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-gray-600">Capture Ratio</span>
                <span class="font-bold text-2xl" style="color: ${color}">${value}%</span>
              </div>
              <div class="pt-2 border-t border-gray-100">
                <div class="text-xs" style="color: ${color}">${interpretation} benchmark in ${param.name.toLowerCase()} markets</div>
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
      data: ['Up Capture', 'Down Capture'],
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
      name: 'Capture Ratio',
      nameTextStyle: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: 'bold'
      },
      axisLabel: {
        formatter: '{value}%',
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
        name: 'Capture Ratios',
        type: 'bar',
        data: [
          attributionData.upCapture * 100,
          attributionData.downCapture * 100
        ],
        itemStyle: {
          color: (params) => {
            if (params.dataIndex === 0) {
              return params.value > 100 ? '#22c55e' : '#ef4444';
            } else {
              return params.value < 100 ? '#22c55e' : '#ef4444'; // Lower is better for down capture
            }
          },
          borderRadius: [4, 4, 0, 0],
          shadowBlur: 4,
          shadowColor: 'rgba(0, 0, 0, 0.1)'
        },
        label: {
          show: true,
          position: 'top',
          formatter: (params) => `${params.value.toFixed(1)}%`,
          color: '#1f2937',
          fontSize: 12,
          fontWeight: 'bold'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: 'rgba(34, 197, 94, 0.3)'
          }
        },
        markLine: {
          data: [
            {
              yAxis: 100,
              lineStyle: {
                color: '#6b7280',
                type: 'dashed',
                width: 2
              },
              label: {
                show: true,
                position: 'end',
                formatter: 'Benchmark (100%)',
                color: '#6b7280',
                fontSize: 10,
                fontWeight: 'bold'
              }
            }
          ]
        }
      }
    ]
  }), [attributionData]);

  return (
    <div className="h-full space-y-4">
      {/* Key Attribution Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-gradient-to-br from-white to-green-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs font-semibold text-gray-700">Alpha</span>
          </div>
          <div className="text-lg font-bold text-green-600">
            {(attributionData.alpha * 100).toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">Excess return</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-3 w-3 text-blue-500" />
            <span className="text-xs font-semibold text-gray-700">Beta</span>
          </div>
          <div className="text-lg font-bold text-blue-600">
            {attributionData.beta.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Market sensitivity</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-purple-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-3 w-3 text-purple-500" />
            <span className="text-xs font-semibold text-gray-700">Treynor</span>
          </div>
          <div className="text-lg font-bold text-purple-600">
            {attributionData.treynorRatio.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Risk-adj return</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-3 w-3 text-orange-500" />
            <span className="text-xs font-semibold text-gray-700">R²</span>
          </div>
          <div className="text-lg font-bold text-orange-600">
            {(attributionData.rSquared * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Correlation</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk-Return Scatter */}
        <div className="bg-gradient-to-br from-white to-indigo-50/30 rounded-lg p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            <h4 className="text-sm font-semibold text-gray-700">Risk-Return Position</h4>
          </div>
          <ReactECharts
            option={scatterOption}
            style={{ width: '100%', height: '300px' }}
            opts={{ renderer: 'svg' }}
            className="transition-all duration-200"
          />
        </div>

        {/* Capture Ratios */}
        <div className="bg-gradient-to-br from-white to-green-50/30 rounded-lg p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-green-500" />
            <h4 className="text-sm font-semibold text-gray-700">Market Capture Analysis</h4>
          </div>
          <ReactECharts
            option={captureOption}
            style={{ width: '100%', height: '300px' }}
            opts={{ renderer: 'svg' }}
            className="transition-all duration-200"
          />
        </div>
      </div>

      {/* Attribution Summary */}
      <div className="bg-gradient-to-br from-white to-yellow-50/30 rounded-lg p-4 shadow-sm border">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-semibold text-gray-700">Performance Attribution Summary</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs text-gray-600">
          <div>
            <strong>Alpha Analysis:</strong> {attributionData.alpha > 0 
              ? `Positive alpha of ${(attributionData.alpha * 100).toFixed(2)}% indicates strategy outperformed risk-adjusted benchmark.`
              : `Negative alpha suggests underperformance vs risk-adjusted expectations.`
            }
          </div>
          <div>
            <strong>Beta Profile:</strong> {attributionData.beta > 1 
              ? `High beta (${attributionData.beta.toFixed(2)}) indicates amplified market movements.`
              : attributionData.beta < 1 
                ? `Low beta (${attributionData.beta.toFixed(2)}) suggests defensive characteristics.`
                : `Market-neutral beta around 1.0.`
            }
          </div>
          <div>
            <strong>Capture Performance:</strong> {attributionData.upCapture > 1 && attributionData.downCapture < 1
              ? "Ideal capture profile - participates in upside while limiting downside."
              : attributionData.upCapture > 1 
                ? "Strong upside participation but review downside protection."
                : "Consider strategies to improve upside capture."
            }
          </div>
        </div>
      </div>
    </div>
  );
}