import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, TrendingDown, BarChart3, Zap } from 'lucide-react';

export default function RollingSharpe({ rollingSharpe }) {
  // Enhanced data validation with better empty state
  if (!rollingSharpe || !rollingSharpe.dates || !rollingSharpe.sharpe_6mo || !rollingSharpe.sharpe_12mo) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex justify-center items-center bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg border-2 border-dashed border-purple-200">
          <div className="text-center">
            <Zap className="h-12 w-12 text-purple-400 mx-auto mb-3" />
            <div className="text-purple-600 font-medium">No rolling Sharpe data</div>
            <div className="text-xs text-purple-400 mt-1">Run a backtest to see risk-adjusted returns</div>
          </div>
        </div>
      </div>
    );
  }

  const { dates, sharpe_6mo: sharpe6, sharpe_12mo: sharpe12 } = rollingSharpe;

  // Enhanced data processing with statistics
  const chartData = useMemo(() => {
    const series6 = dates.map((d, i) => [
      d,
      sharpe6[i] != null ? +sharpe6[i].toFixed(3) : null
    ]);
    const series12 = dates.map((d, i) => [
      d,
      sharpe12[i] != null ? +sharpe12[i].toFixed(3) : null
    ]);

    // Calculate statistics
    const validSharpe6 = series6.map(([, v]) => v).filter(v => v != null);
    const validSharpe12 = series12.map(([, v]) => v).filter(v => v != null);
    
    const currentSharpe6 = validSharpe6[validSharpe6.length - 1] || 0;
    const currentSharpe12 = validSharpe12[validSharpe12.length - 1] || 0;
    const avgSharpe6 = validSharpe6.length > 0 ? validSharpe6.reduce((a, b) => a + b, 0) / validSharpe6.length : 0;
    const avgSharpe12 = validSharpe12.length > 0 ? validSharpe12.reduce((a, b) => a + b, 0) / validSharpe12.length : 0;
    const maxSharpe6 = validSharpe6.length > 0 ? Math.max(...validSharpe6) : 0;
    const maxSharpe12 = validSharpe12.length > 0 ? Math.max(...validSharpe12) : 0;

    return {
      series6,
      series12,
      currentSharpe6,
      currentSharpe12,
      avgSharpe6,
      avgSharpe12,
      maxSharpe6,
      maxSharpe12
    };
  }, [dates, sharpe6, sharpe12]);

  // Determine y-axis bounds with a small buffer
  const [minY, maxY] = useMemo(() => {
    const vals = [
      ...chartData.series6.map(([, v]) => v).filter((v) => v != null),
      ...chartData.series12.map(([, v]) => v).filter((v) => v != null)
    ];
    const buffer = 0.5;
    return [Math.min(...vals) - buffer, Math.max(...vals) + buffer];
  }, [chartData]);

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(168, 85, 247, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { fontSize: 12, fontWeight: 'bold' },
      axisPointer: { 
        type: 'cross',
        crossStyle: {
          color: '#a855f7',
          width: 1,
          type: 'dashed',
          opacity: 0.6
        },
        lineStyle: {
          color: '#a855f7',
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
              ${pts.map(p => {
                const quality = p.data[1] > 1 ? 'Excellent' : p.data[1] > 0.5 ? 'Good' : p.data[1] > 0 ? 'Fair' : 'Poor';
                const qualityColor = p.data[1] > 1 ? '#10b981' : p.data[1] > 0.5 ? '#22c55e' : p.data[1] > 0 ? '#f59e0b' : '#ef4444';
                return `
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-3 h-3 rounded-full" style="background-color: ${p.color}"></div>
                      <span class="font-semibold text-gray-600">${p.seriesName}</span>
                    </div>
                    <div class="text-right">
                      <div class="font-bold px-2 py-1 rounded text-sm" style="color: ${p.color}; background-color: ${p.color}15">${p.data[1].toFixed(3)}</div>
                      <div class="text-xs mt-1" style="color: ${qualityColor}">${quality}</div>
                    </div>
                  </div>
                `;
              }).join('')}
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
            color: '#a855f7',
            fontSize: 13,
            fontWeight: 'bold'
          }
        },
        {
          name: '12 mo.',
          icon: 'roundRect',
          textStyle: { 
            color: '#06b6d4',
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
        formatter: '{value}',
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
              { offset: 0, color: '#c084fc' },
              { offset: 0.5, color: '#a855f7' },
              { offset: 1, color: '#9333ea' }
            ]
          },
          shadowBlur: 6,
          shadowColor: 'rgba(168, 85, 247, 0.3)',
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
              { offset: 0, color: '#22d3ee' },
              { offset: 0.5, color: '#06b6d4' },
              { offset: 1, color: '#0891b2' }
            ]
          },
          shadowBlur: 6,
          shadowColor: 'rgba(6, 182, 212, 0.3)',
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
      {/* Sharpe Ratio Statistics Cards */}  
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-white to-purple-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-3 w-3 text-purple-500" />
            <span className="text-xs font-semibold text-gray-700">Current 6M</span>
          </div>
          <div className={`text-lg font-bold ${
            chartData.currentSharpe6 > 1 ? 'text-green-600' : chartData.currentSharpe6 > 0.5 ? 'text-blue-600' : chartData.currentSharpe6 > 0 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {chartData.currentSharpe6.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">Risk-adj return</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-cyan-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-3 w-3 text-cyan-500" />
            <span className="text-xs font-semibold text-gray-700">Current 12M</span>
          </div>
          <div className={`text-lg font-bold ${
            chartData.currentSharpe12 > 1 ? 'text-green-600' : chartData.currentSharpe12 > 0.5 ? 'text-blue-600' : chartData.currentSharpe12 > 0 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {chartData.currentSharpe12.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">Risk-adj return</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-indigo-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3 w-3 text-indigo-500" />
            <span className="text-xs font-semibold text-gray-700">Peak 6M</span>
          </div>
          <div className="text-lg font-bold text-indigo-600">
            {chartData.maxSharpe6.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">Best 6-month</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-teal-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-3 w-3 text-teal-500" />
            <span className="text-xs font-semibold text-gray-700">Peak 12M</span>
          </div>
          <div className="text-lg font-bold text-teal-600">
            {chartData.maxSharpe12.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">Best 12-month</div>
        </div>
      </div>

      {/* Enhanced Rolling Sharpe Chart */}
      <div className="bg-gradient-to-br from-white to-purple-50/20 rounded-lg border shadow-sm">
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
