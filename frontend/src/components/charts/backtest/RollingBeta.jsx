import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';

export default function RollingBeta({ rollingBeta }) {
  // Enhanced data validation with better empty state
  if (!rollingBeta || !rollingBeta.dates || !rollingBeta.beta_6mo || !rollingBeta.beta_12mo) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex justify-center items-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-200">
          <div className="text-center">
            <Activity className="h-12 w-12 text-blue-400 mx-auto mb-3" />
            <div className="text-blue-600 font-medium">No rolling beta data</div>
            <div className="text-xs text-blue-400 mt-1">Run a backtest to see portfolio beta analysis</div>
          </div>
        </div>
      </div>
    );
  }

  const { dates, beta_6mo: beta6, beta_12mo: beta12 } = rollingBeta;

  // Enhanced data processing with statistics
  const chartData = useMemo(() => {
    const series6 = dates.map((d, i) => [
      d,
      beta6[i] != null ? +beta6[i].toFixed(3) : null
    ]);
    const series12 = dates.map((d, i) => [
      d,
      beta12[i] != null ? +beta12[i].toFixed(3) : null
    ]);

    // Calculate statistics
    const validBeta6 = series6.map(([, v]) => v).filter(v => v != null);
    const validBeta12 = series12.map(([, v]) => v).filter(v => v != null);
    
    const currentBeta6 = validBeta6[validBeta6.length - 1] || 0;
    const currentBeta12 = validBeta12[validBeta12.length - 1] || 0;
    const avgBeta6 = validBeta6.length > 0 ? validBeta6.reduce((a, b) => a + b, 0) / validBeta6.length : 0;
    const avgBeta12 = validBeta12.length > 0 ? validBeta12.reduce((a, b) => a + b, 0) / validBeta12.length : 0;

    return {
      series6,
      series12,
      currentBeta6,
      currentBeta12,
      avgBeta6,
      avgBeta12
    };
  }, [dates, beta6, beta12]);

  // Determine Y-axis bounds
  const [minY, maxY] = useMemo(() => {
    const vals = [
      ...chartData.series6.map(([, v]) => v).filter((v) => v != null),
      ...chartData.series12.map(([, v]) => v).filter((v) => v != null)
    ];
    const buffer = 0.1;
    const min = Math.min(...vals) - buffer;
    const max = Math.max(...vals) + buffer;
    return [min, max];
  }, [chartData]);

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(59, 130, 246, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { fontSize: 12, fontWeight: 'bold' },
      axisPointer: { 
        type: 'cross',
        crossStyle: {
          color: '#3b82f6',
          width: 1,
          type: 'dashed',
          opacity: 0.6
        },
        lineStyle: {
          color: '#3b82f6',
          width: 1,
          type: 'dashed',
          opacity: 0.4
        }
      },
      formatter: (pts) => {
        const date = new Date(pts[0].data[0]).toLocaleDateString('default', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        return `
          <div class="p-4 text-sm">
            <div class="font-bold text-lg mb-3 text-gray-800 border-b border-gray-200 pb-2">${date}</div>
            <div class="space-y-2">
              ${pts.map(p => `
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full" style="background-color: ${p.color}"></div>
                    <span class="font-semibold text-gray-600">${p.seriesName}</span>
                  </div>
                  <span class="font-bold px-2 py-1 rounded text-sm" style="color: ${p.color}; background-color: ${p.color}15">${p.data[1].toFixed(3)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    },
    legend: {
      data: [
        {
          name: '6 mo.',
          icon: 'roundRect',
          textStyle: { 
            color: '#3b82f6',
            fontSize: 13,
            fontWeight: 'bold'
          }
        },
        {
          name: '12 mo.',
          icon: 'roundRect',
          textStyle: { 
            color: '#10b981',
            fontSize: 13,
            fontWeight: 'bold'
          }
        }
      ],
      top: '8%',
      left: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: 8,
      padding: [6, 12],
      shadowBlur: 4,
      shadowColor: 'rgba(0, 0, 0, 0.1)'
    },
    grid: { 
      left: '10%', 
      right: '8%', 
      top: '25%', 
      bottom: '15%',
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      borderRadius: 8,
      shadowBlur: 4,
      shadowColor: 'rgba(0, 0, 0, 0.05)'
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        color: '#6b7280',
        fontSize: 11,
        fontWeight: 'bold',
        formatter: (v) => {
          const d = new Date(v);
          return d.toLocaleDateString('default', { year: 'numeric', month: 'short' });
        }
      },
      axisLine: {
        lineStyle: { color: '#e5e7eb', width: 2 }
      },
      axisTick: {
        lineStyle: { color: '#d1d5db' }
      },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      min: minY,
      max: maxY,
      axisLabel: { 
        color: '#6b7280',
        fontSize: 11,
        fontWeight: 'bold',
        formatter: '{value}'
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
        name: '6 mo.',
        type: 'line',
        data: chartData.series6,
        showSymbol: false,
        smooth: true,
        smoothMonotone: 'x',
        lineStyle: { 
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#60a5fa' },
              { offset: 0.5, color: '#3b82f6' },
              { offset: 1, color: '#2563eb' }
            ]
          },
          shadowBlur: 6,
          shadowColor: 'rgba(59, 130, 246, 0.3)',
          cap: 'round'
        },
        emphasis: {
          lineStyle: { width: 4 }
        }
      },
      {
        name: '12 mo.',
        type: 'line',
        data: chartData.series12,
        showSymbol: false,
        smooth: true,
        smoothMonotone: 'x',
        lineStyle: { 
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#34d399' },
              { offset: 0.5, color: '#10b981' },
              { offset: 1, color: '#059669' }
            ]
          },
          shadowBlur: 6,
          shadowColor: 'rgba(16, 185, 129, 0.3)',
          cap: 'round'
        },
        emphasis: {
          lineStyle: { width: 4 }
        }
      }
    ]
  }), [chartData, minY, maxY]);

  return (
    <div className="h-full space-y-4">
      {/* Beta Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-3 w-3 text-blue-500" />
            <span className="text-xs font-semibold text-gray-700">Current 6M</span>
          </div>
          <div className={`text-lg font-bold ${
            chartData.currentBeta6 > 1 ? 'text-orange-600' : chartData.currentBeta6 < 1 ? 'text-green-600' : 'text-gray-600'
          }`}>
            {chartData.currentBeta6.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">Market sensitivity</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-emerald-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-3 w-3 text-emerald-500" />
            <span className="text-xs font-semibold text-gray-700">Current 12M</span>
          </div>
          <div className={`text-lg font-bold ${
            chartData.currentBeta12 > 1 ? 'text-orange-600' : chartData.currentBeta12 < 1 ? 'text-green-600' : 'text-gray-600'
          }`}>
            {chartData.currentBeta12.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">Market sensitivity</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-indigo-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3 w-3 text-indigo-500" />
            <span className="text-xs font-semibold text-gray-700">Avg 6M</span>
          </div>
          <div className={`text-lg font-bold ${
            chartData.avgBeta6 > 1 ? 'text-orange-600' : chartData.avgBeta6 < 1 ? 'text-green-600' : 'text-gray-600'
          }`}>
            {chartData.avgBeta6.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">Average beta</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-teal-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-3 w-3 text-teal-500" />
            <span className="text-xs font-semibold text-gray-700">Avg 12M</span>
          </div>
          <div className={`text-lg font-bold ${
            chartData.avgBeta12 > 1 ? 'text-orange-600' : chartData.avgBeta12 < 1 ? 'text-green-600' : 'text-gray-600'
          }`}>
            {chartData.avgBeta12.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">Average beta</div>
        </div>
      </div>

      {/* Enhanced Rolling Beta Chart */}
      <div className="bg-gradient-to-br from-white to-blue-50/20 rounded-lg border shadow-sm">
        <ReactECharts
          option={option}
          style={{ height: '320px', width: '100%' }}
          opts={{ renderer: 'svg' }}
          className="transition-all duration-200"
        />
      </div>
    </div>
  );
}
