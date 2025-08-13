import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Calendar, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

const MONTH_ORDER = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function MonthlyReturns({ monthlyReturns }) {
  // Enhanced data processing with validation
  const chartData = useMemo(() => {
    if (!monthlyReturns || Object.keys(monthlyReturns).length === 0) {
      return null;
    }

    // Derive sorted list of years
    const s = new Set();
    Object.values(monthlyReturns).forEach(mObj =>
      Object.keys(mObj).forEach(y => s.add(y))
    );
    const years = Array.from(s).sort();

    // Build data array [monthIndex, yearIndex, valuePct]
    const data = [];
    MONTH_ORDER.forEach((m, i) => {
      years.forEach((y, j) => {
        const v = monthlyReturns[m]?.[y];
        data.push([i, j, v != null ? +(v * 100).toFixed(2) : null]);
      });
    });

    // Compute statistics
    const vals = data.map(d => d[2]).filter(v => v != null);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avgReturn = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const positiveMonths = vals.filter(v => v > 0).length;
    const negativeMonths = vals.filter(v => v < 0).length;
    const winRate = vals.length > 0 ? (positiveMonths / vals.length * 100) : 0;

    return {
      years,
      data,
      min,
      max,
      avgReturn,
      positiveMonths,
      negativeMonths,
      winRate,
      totalMonths: vals.length
    };
  }, [monthlyReturns]);

  if (!chartData) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex justify-center items-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-200">
          <div className="text-center">
            <Calendar className="h-12 w-12 text-blue-400 mx-auto mb-3" />
            <div className="text-blue-600 font-medium">No monthly returns data</div>
            <div className="text-xs text-blue-400 mt-1">Run a backtest to see monthly performance breakdown</div>
          </div>
        </div>
      </div>
    );
  }

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(59, 130, 246, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { color: '#1f2937', fontSize: 12, fontWeight: 'bold' },
      formatter: ({ value }) => {
        const [mi, yi, pct] = value;
        const m = MONTH_ORDER[mi];
        const y = chartData.years[yi];
        
        // Use the same color mapping as the heatmap
        let bgColor, textColor;
        if (pct == null) {
          bgColor = '#f3f4f6';
          textColor = '#6b7280';
        } else {
          const ratio = (pct - chartData.min) / (chartData.max - chartData.min);
          if (pct < 0) {
            // Negative: red spectrum
            if (ratio < 0.15) bgColor = '#fecaca', textColor = '#991b1b'; // dc2626
            else if (ratio < 0.3) bgColor = '#fed7d7', textColor = '#991b1b'; // ef4444
            else bgColor = '#fed7d7', textColor = '#ea580c'; // f97316
          } else {
            // Positive: green spectrum  
            if (ratio > 0.85) bgColor = '#d1fae5', textColor = '#065f46'; // 10b981
            else if (ratio > 0.7) bgColor = '#dcfce7', textColor = '#166534'; // 22c55e
            else if (ratio > 0.55) bgColor = '#ecfccb', textColor = '#365314'; // 84cc16
            else bgColor = '#fef3c7', textColor = '#92400e'; // eab308
          }
        }
        
        return `
          <div class="p-4 text-center" style="background-color: ${bgColor}; border-radius: 12px; min-width: 120px;">
            <div class="font-bold text-lg mb-2" style="color: ${textColor}">${m} ${y}</div>
            ${pct == null 
              ? '<div class="text-gray-500 text-sm">No trading data</div>'
              : `<div class="font-bold text-2xl" style="color: ${textColor}">${pct >= 0 ? '+' : ''}${pct}%</div>`
            }
          </div>
        `;
      }
    },
    grid: { 
      height: '65%', 
      top: '15%', 
      left: '8%', 
      right: '8%',
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      borderRadius: 8,
      shadowBlur: 4,
      shadowColor: 'rgba(0, 0, 0, 0.05)'
    },
    xAxis: {
      type: 'category',
      data: MONTH_ORDER,
      splitArea: { 
        show: true,
        areaStyle: {
          color: ['rgba(248, 250, 252, 0.6)', 'rgba(241, 245, 249, 0.6)']
        }
      },
      axisLabel: { 
        rotate: 45, 
        color: '#475569',
        fontSize: 11,
        fontWeight: 'bold',
        margin: 8
      },
      axisLine: {
        lineStyle: { color: '#e2e8f0', width: 2 }
      },
      axisTick: {
        lineStyle: { color: '#cbd5e1' }
      }
    },
    yAxis: {
      type: 'category',
      data: chartData.years,
      splitArea: { 
        show: true,
        areaStyle: {
          color: ['rgba(248, 250, 252, 0.6)', 'rgba(241, 245, 249, 0.6)']
        }
      },
      axisLabel: { 
        color: '#475569',
        fontSize: 11,
        fontWeight: 'bold'
      },
      axisLine: {
        lineStyle: { color: '#e2e8f0', width: 2 }
      },
      axisTick: {
        lineStyle: { color: '#cbd5e1' }
      }
    },
    visualMap: {
      min: chartData.min,
      max: chartData.max,
      calculable: true,
      orient: 'horizontal',
      left: '10%',
      right: '10%',
      bottom: '2%',
      inRange: {
        color: [
          '#dc2626', // deep red for losses
          '#ef4444', // red
          '#f97316', // orange  
          '#eab308', // yellow
          '#84cc16', // lime
          '#22c55e', // green
          '#10b981'  // emerald for gains
        ]
      },
      itemWidth: 40,
      itemHeight: 14,
      textStyle: { 
        color: '#4b5563',
        fontSize: 12,
        fontWeight: 'bold'
      },
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: 10,
      padding: [8, 16],
      shadowBlur: 6,
      shadowColor: 'rgba(0, 0, 0, 0.15)'
    },
    series: [{
      name: 'Monthly Returns',
      type: 'heatmap',
      data: chartData.data,
      label: {
        show: true,
        formatter: ({ value }) =>
          value[2] != null ? `${value[2] >= 0 ? '+' : ''}${value[2]}%` : '',
        color: '#1f2937',
        fontSize: 13,
        fontWeight: 'bold',
        overflow: 'truncate'
      },
      itemStyle: {
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)'
      },
      emphasis: {
        itemStyle: {
          borderColor: '#3b82f6',
          borderWidth: 2,
          shadowBlur: 8,
          shadowColor: 'rgba(59, 130, 246, 0.3)'
        }
      },
      progressive: 1000,
      animationDuration: 1200,
      animationEasing: 'cubicOut'
    }]
  }), [chartData]);

  return (
    <div className="h-full space-y-4">
      {/* Monthly Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-3 w-3 text-blue-500" />
            <span className="text-xs font-semibold text-gray-700">Avg Return</span>
          </div>
          <div className={`text-lg font-bold ${chartData.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {chartData.avgReturn >= 0 ? '+' : ''}{chartData.avgReturn.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">Per month</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs font-semibold text-gray-700">Win Rate</span>
          </div>
          <div className="text-lg font-bold text-green-600">
            {chartData.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Positive months</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-emerald-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-3 w-3 text-emerald-500" />
            <span className="text-xs font-semibold text-gray-700">Best Month</span>
          </div>
          <div className="text-lg font-bold text-emerald-600">
            +{chartData.max.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Highest return</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-red-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-3 w-3 text-red-500" />
            <span className="text-xs font-semibold text-gray-700">Worst Month</span>
          </div>
          <div className="text-lg font-bold text-red-600">
            {chartData.min.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Lowest return</div>
        </div>
      </div>

      {/* Enhanced Heatmap */}
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
