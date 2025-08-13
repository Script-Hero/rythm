import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingDown, AlertTriangle, Clock, BarChart3, Calendar } from 'lucide-react';

export default function Drawdown({ drawdown }) {
  // Enhanced data validation with better empty state
  if (!drawdown || !drawdown.drawdown_series || !drawdown.drawdown_series.dates || !drawdown.drawdown_series.drawdowns) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex justify-center items-center bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border-2 border-dashed border-red-200">
          <div className="text-center">
            <TrendingDown className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <div className="text-red-600 font-medium">No drawdown data</div>
            <div className="text-xs text-red-400 mt-1">Run a backtest to see portfolio drawdown analysis</div>
          </div>
        </div>
      </div>
    );
  }

  const {
    drawdown_series: { dates, drawdowns },
    top_drawdowns: topDDs
  } = drawdown;

  // Enhanced data processing with statistics
  const chartData = useMemo(() => {
    const seriesData = dates.map((d, i) => [
      d,
      +(drawdowns[i] * 100).toFixed(2)
    ]);

    const minY = Math.min(...drawdowns) * 100;
    const maxDrawdown = Math.abs(minY);
    
    // Calculate recovery statistics
    let currentDrawdown = 0;
    let timeUnderwater = 0;
    let longestDrawdownPeriod = 0;
    let currentDrawdownPeriod = 0;
    
    drawdowns.forEach((dd, i) => {
      if (dd < 0) {
        currentDrawdownPeriod++;
        timeUnderwater++;
      } else {
        if (currentDrawdownPeriod > longestDrawdownPeriod) {
          longestDrawdownPeriod = currentDrawdownPeriod;
        }
        currentDrawdownPeriod = 0;
      }
    });

    // Calculate average drawdown
    const negativeDrawdowns = drawdowns.filter(dd => dd < 0);
    const avgDrawdown = negativeDrawdowns.length > 0 
      ? Math.abs(negativeDrawdowns.reduce((sum, dd) => sum + dd, 0) / negativeDrawdowns.length * 100)
      : 0;

    // Time underwater percentage
    const underwaterPercentage = dates.length > 0 ? (timeUnderwater / dates.length * 100) : 0;

    return {
      seriesData,
      minY,
      maxDrawdown,
      avgDrawdown,
      underwaterPercentage,
      longestDrawdownDays: longestDrawdownPeriod,
      topDrawdowns: topDDs || []
    };
  }, [dates, drawdowns, topDDs]);

  // Build enhanced markArea regions for top drawdowns
  const markAreas = useMemo(() => {
    const colors = [
      'rgba(239,68,68,0.15)',    // Red for worst
      'rgba(245,158,11,0.15)',   // Orange for 2nd
      'rgba(168,85,247,0.15)'    // Purple for 3rd
    ];
    const borderColors = ['#ef4444', '#f59e0b', '#a855f7'];
    const labels = ['Worst DD', '2nd DD', '3rd DD'];

    return chartData.topDrawdowns.map((dd, idx) => [
      {
        name: labels[idx] || `${idx + 1}th DD`,
        xAxis: dd.start,
        itemStyle: { 
          color: colors[idx],
          borderColor: borderColors[idx],
          borderWidth: 2,
          borderType: 'dashed'
        },
        label: {
          formatter: `${labels[idx]}: ${Math.abs(dd.drawdown * 100).toFixed(1)}%`,
          position: 'insideTop',
          color: borderColors[idx],
          fontSize: 11,
          fontWeight: 'bold',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: 4,
          padding: [2, 6]
        }
      },
      { xAxis: dd.end }
    ]);
  }, [chartData.topDrawdowns]);

  // Enhanced ECharts option with modern styling
  const option = useMemo(() => ({
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
      axisPointer: { 
        type: 'cross',
        crossStyle: {
          color: '#ef4444',
          width: 1,
          type: 'dashed',
          opacity: 0.6
        },
        lineStyle: {
          color: '#ef4444',
          width: 1,
          type: 'dashed',
          opacity: 0.4
        }
      },
      formatter: ([p]) => {
        const date = new Date(p.data[0]).toLocaleDateString('default', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        const value = p.data[1];
        const severity = Math.abs(value) > 10 ? 'Severe' : Math.abs(value) > 5 ? 'Moderate' : 'Minor';
        const severityColor = Math.abs(value) > 10 ? '#dc2626' : Math.abs(value) > 5 ? '#f59e0b' : '#22c55e';
        
        return `
          <div class="p-4 text-center">
            <div class="font-bold text-lg mb-2 text-gray-800">${date}</div>
            <div class="font-bold text-2xl text-red-600 mb-1">${value}%</div>
            <div class="text-sm px-2 py-1 rounded" style="color: ${severityColor}; background-color: ${severityColor}20">${severity} Drawdown</div>
          </div>
        `;
      }
    },
    grid: { 
      left: '8%', 
      right: '8%', 
      top: '15%', 
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
        formatter: (val) => {
          const d = new Date(val);
          return d.toLocaleDateString('default', {
            month: 'short',
            year: 'numeric'
          });
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
      min: chartData.minY * 1.1,
      max: 2,
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
        name: 'Drawdown',
        type: 'line',
        data: chartData.seriesData,
        showSymbol: false,
        smooth: true,
        smoothMonotone: 'x',
        lineStyle: { 
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#dc2626' },
              { offset: 0.5, color: '#ef4444' },
              { offset: 1, color: '#f87171' }
            ]
          },
          width: 3,
          shadowBlur: 6,
          shadowColor: 'rgba(239, 68, 68, 0.3)',
          cap: 'round'
        },
        areaStyle: { 
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.05)' }
            ]
          }
        },
        emphasis: {
          lineStyle: { width: 4 }
        },
        markArea: {
          silent: false,
          data: markAreas
        }
      }
    ]
  }), [chartData, markAreas]);

  return (
    <div className="h-full space-y-4">
      {/* Drawdown Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-white to-red-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-3 w-3 text-red-500" />
            <span className="text-xs font-semibold text-gray-700">Max Drawdown</span>
          </div>
          <div className="text-lg font-bold text-red-600">
            -{chartData.maxDrawdown.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Worst decline</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-orange-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-3 w-3 text-orange-500" />
            <span className="text-xs font-semibold text-gray-700">Avg Drawdown</span>
          </div>
          <div className="text-lg font-bold text-orange-600">
            -{chartData.avgDrawdown.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Average decline</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-amber-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3 w-3 text-amber-500" />
            <span className="text-xs font-semibold text-gray-700">Time Underwater</span>
          </div>
          <div className="text-lg font-bold text-amber-600">
            {chartData.underwaterPercentage.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Of total time</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-purple-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-3 w-3 text-purple-500" />
            <span className="text-xs font-semibold text-gray-700">Longest DD</span>
          </div>
          <div className="text-lg font-bold text-purple-600">
            {chartData.longestDrawdownDays}
          </div>
          <div className="text-xs text-gray-500">Days underwater</div>
        </div>
      </div>

      {/* Enhanced Drawdown Chart */}
      <div className="bg-gradient-to-br from-white to-red-50/20 rounded-lg border shadow-sm">
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
