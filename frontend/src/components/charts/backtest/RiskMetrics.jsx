import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingDown, AlertTriangle, Shield, Activity } from 'lucide-react';

export default function RiskMetrics({ backtestResults }) {
  const riskData = useMemo(() => {
    if (!backtestResults || !backtestResults.key_metrics) {
      return null;
    }

    const metrics = backtestResults.key_metrics;
    return {
      var95: metrics.var_95 || 0,
      var99: metrics.var_99 || 0,
      cvar95: metrics.cvar_95 || 0,
      cvar99: metrics.cvar_99 || 0,
      maxDrawdown: metrics.max_drawdown || 0,
      ulcerIndex: metrics.ulcer_index || 0,
      skewness: metrics.skewness || 0,
      kurtosis: metrics.kurtosis || 0
    };
  }, [backtestResults]);

  if (!riskData) {
    return (
      <div className="flex justify-center items-center h-[400px] bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border-2 border-dashed border-red-200">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <div className="text-red-600 font-medium">No risk metrics data</div>
          <div className="text-xs text-red-400 mt-1">Run a backtest to see risk analysis</div>
        </div>
      </div>
    );
  }

  // Risk metrics gauge chart
  const gaugeOption = useMemo(() => ({
    backgroundColor: 'transparent',
    title: {
      text: 'Risk Profile Overview',
      left: 'center',
      top: '5%',
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937'
      }
    },
    tooltip: {
      formatter: (params) => {
        const value = (params.value * 100).toFixed(2);
        return `
          <div class="p-3 bg-white rounded-lg shadow-lg border">
            <div class="font-bold text-lg mb-2">${params.name}</div>
            <div class="text-2xl font-bold text-red-600">${value}%</div>
            <div class="text-xs text-gray-500 mt-1">Daily risk measure</div>
          </div>
        `;
      }
    },
    series: [
      {
        name: 'VaR 95%',
        type: 'gauge',
        min: -0.15,
        max: 0,
        radius: '35%',
        center: ['25%', '60%'],
        startAngle: 180,
        endAngle: 0,
        axisLine: {
          lineStyle: {
            width: 8,
            color: [
              [0.3, '#22c55e'],
              [0.7, '#f59e0b'],
              [1, '#ef4444']
            ]
          }
        },
        pointer: {
          itemStyle: {
            color: '#ef4444',
            shadowBlur: 10,
            shadowColor: 'rgba(239, 68, 68, 0.5)'
          }
        },
        axisTick: {
          distance: -15,
          length: 6,
          lineStyle: {
            color: '#fff',
            width: 2
          }
        },
        splitLine: {
          distance: -20,
          length: 12,
          lineStyle: {
            color: '#fff',
            width: 3
          }
        },
        axisLabel: {
          color: '#374151',
          fontSize: 10,
          distance: -35,
          formatter: (value) => `${(value * 100).toFixed(0)}%`
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          color: '#ef4444',
          fontSize: 14,
          fontWeight: 'bold',
          offsetCenter: [0, '70%']
        },
        data: [
          {
            value: riskData.var95,
            name: 'VaR 95%'
          }
        ]
      },
      {
        name: 'CVaR 95%',
        type: 'gauge',
        min: -0.2,
        max: 0,
        radius: '35%',
        center: ['75%', '60%'],
        startAngle: 180,
        endAngle: 0,
        axisLine: {
          lineStyle: {
            width: 8,
            color: [
              [0.3, '#22c55e'],
              [0.7, '#f59e0b'],
              [1, '#dc2626']
            ]
          }
        },
        pointer: {
          itemStyle: {
            color: '#dc2626',
            shadowBlur: 10,
            shadowColor: 'rgba(220, 38, 38, 0.5)'
          }
        },
        axisTick: {
          distance: -15,
          length: 6,
          lineStyle: {
            color: '#fff',
            width: 2
          }
        },
        splitLine: {
          distance: -20,
          length: 12,
          lineStyle: {
            color: '#fff',
            width: 3
          }
        },
        axisLabel: {
          color: '#374151',
          fontSize: 10,
          distance: -35,
          formatter: (value) => `${(value * 100).toFixed(0)}%`
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          color: '#dc2626',
          fontSize: 14,
          fontWeight: 'bold',
          offsetCenter: [0, '70%']
        },
        data: [
          {
            value: riskData.cvar95,
            name: 'CVaR 95%'
          }
        ]
      }
    ]
  }), [riskData]);

  // Risk metrics comparison chart
  const comparisonOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(239, 68, 68, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { fontSize: 12, fontWeight: 'bold' },
      formatter: (params) => {
        const param = params[0];
        const value = (param.value * 100).toFixed(2);
        const color = param.value < 0 ? '#ef4444' : '#22c55e';
        
        return `
          <div class="p-3">
            <div class="font-bold text-lg mb-2 text-gray-800">${param.name}</div>
            <div class="text-2xl font-bold" style="color: ${color}">${value}%</div>
            <div class="text-xs text-gray-500 mt-1">Risk metric value</div>
          </div>
        `;
      }
    },
    grid: {
      left: '15%',
      right: '10%',
      top: '15%',
      bottom: '25%',
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      borderRadius: 8,
      shadowBlur: 4,
      shadowColor: 'rgba(0, 0, 0, 0.05)'
    },
    xAxis: {
      type: 'category',
      data: ['VaR 95%', 'VaR 99%', 'CVaR 95%', 'CVaR 99%', 'Max DD', 'Ulcer Index'],
      axisLabel: {
        rotate: 45,
        color: '#6b7280',
        fontSize: 11,
        fontWeight: 'bold',
        margin: 8
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
        name: 'Risk Metrics',
        type: 'bar',
        data: [
          riskData.var95 * 100,
          riskData.var99 * 100,
          riskData.cvar95 * 100,
          riskData.cvar99 * 100,
          riskData.maxDrawdown * 100,
          riskData.ulcerIndex
        ],
        itemStyle: {
          color: (params) => {
            const colors = [
              '#ef4444', '#dc2626', '#fca5a5', '#f87171', '#b91c1c', '#991b1b'
            ];
            return colors[params.dataIndex] || '#ef4444';
          },
          borderRadius: [4, 4, 0, 0],
          shadowBlur: 4,
          shadowColor: 'rgba(0, 0, 0, 0.1)'
        },
        label: {
          show: true,
          position: 'top',
          formatter: (params) => `${params.value.toFixed(2)}%`,
          color: '#1f2937',
          fontSize: 11,
          fontWeight: 'bold'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: 'rgba(239, 68, 68, 0.3)'
          }
        },
        animationDelay: (idx) => idx * 100
      }
    ]
  }), [riskData]);

  return (
    <div className="h-full space-y-4">
      {/* Risk Gauges */}
      <div className="bg-gradient-to-br from-white to-red-50/30 rounded-lg p-4 shadow-sm border">
        <ReactECharts
          option={gaugeOption}
          style={{ width: '100%', height: '250px' }}
          opts={{ renderer: 'svg' }}
          className="transition-all duration-200"
        />
      </div>

      {/* Risk Comparison Chart */}
      <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-lg p-4 shadow-sm border">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-red-500" />
          Risk Metrics Comparison
        </h4>
        <ReactECharts
          option={comparisonOption}
          style={{ width: '100%', height: '280px' }}
          opts={{ renderer: 'svg' }}
          className="transition-all duration-200"
        />
      </div>

      {/* Distribution Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-lg p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-700">Skewness</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {riskData.skewness.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {riskData.skewness > 0 ? 'Right-tailed' : 'Left-tailed'} distribution
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-purple-50/30 rounded-lg p-4 shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-semibold text-gray-700">Kurtosis</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {riskData.kurtosis.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {riskData.kurtosis > 3 ? 'Fat-tailed' : 'Thin-tailed'} distribution
          </div>
        </div>
      </div>
    </div>
  );
}