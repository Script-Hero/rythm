import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';

export default function DailyReturns({ dailyReturns }) {
  // Enhanced data validation with better empty state
  if (!dailyReturns || !dailyReturns.dates || !dailyReturns.returns) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex justify-center items-center bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg border-2 border-dashed border-gray-200">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <div className="text-gray-600 font-medium">No daily returns data</div>
            <div className="text-xs text-gray-400 mt-1">Run a backtest to see daily performance distribution</div>
          </div>
        </div>
      </div>
    );
  }

  const { dates, returns: returnsArr } = dailyReturns;

  // Enhanced data processing with statistics
  const chartData = useMemo(() => {
    const pos = [];
    const neg = [];
    const zer = [];
    const returns = [];
    
    dates.forEach((d, i) => {
      const pct = +(returnsArr[i] * 100).toFixed(2);
      returns.push(pct);
      
      if (pct > 0) {
        pos.push([d, pct]); 
        neg.push([d, 0]);
        zer.push([d, 0]);
      } else if (pct < 0) {
        pos.push([d, 0]);
        neg.push([d, pct]);
        zer.push([d, 0]);
      } else {
        pos.push([d, 0]);
        neg.push([d, 0]);
        zer.push([d, pct]);
      }
    });

    // Calculate statistics
    const positiveDays = returns.filter(r => r > 0).length;
    const negativeDays = returns.filter(r => r < 0).length;
    const winRate = returns.length > 0 ? (positiveDays / returns.length * 100) : 0;
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const bestDay = Math.max(...returns);
    const worstDay = Math.min(...returns);
    
    return {
      positiveData: pos,
      negativeData: neg,
      zeroData: zer,
      winRate,
      avgReturn,
      bestDay,
      worstDay,
      positiveDays,
      negativeDays,
      totalDays: returns.length
    };
  }, [dates, returnsArr]);

  // Compute min/max for y-axis
  const [minY, maxY] = useMemo(() => {
    const all = [
      ...chartData.positiveData.map(([, v]) => v),
      ...chartData.negativeData.map(([, v]) => v),
      ...chartData.zeroData.map(([, v]) => v),
      0
    ];
    const buffer = (Math.max(...all) - Math.min(...all)) * 0.05;
    return [Math.min(...all) - buffer, Math.max(...all) + buffer];
  }, [chartData]);

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(107, 114, 128, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { fontSize: 12, fontWeight: 'bold' },
      axisPointer: { 
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(107, 114, 128, 0.1)'
        }
      },
      formatter: ([p]) => {
        const [time, val] = p.data;
        const date = new Date(time).toLocaleDateString('default', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        const sign = val > 0 ? '+' : '';
        const color = val > 0 ? '#22c55e' : val < 0 ? '#ef4444' : '#fbbf24';
        return `
          <div class="p-3 text-center">
            <div class="font-bold text-lg mb-2 text-gray-800">${date}</div>
            <div class="font-bold text-xl" style="color: ${color}">${sign}${val}%</div>
            <div class="text-xs text-gray-500 mt-1">Daily return</div>
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
        formatter: (v) => {
          const d = new Date(v);
          return d.toLocaleDateString('default', {
            year: 'numeric', month: 'short'
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
      min: minY,
      max: maxY,
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
        name: 'Positive',
        type: 'bar',
        data: chartData.positiveData,
        barWidth: 2,
        itemStyle: { 
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#10b981' },
              { offset: 1, color: '#22c55e' }
            ]
          },
          borderRadius: [2, 2, 0, 0],
          shadowBlur: 3,
          shadowColor: 'rgba(16, 185, 129, 0.2)'
        },
        markLine: {
          data: [{ yAxis: 0 }],
          symbol: 'none',
          lineStyle: { 
            color: '#6b7280', 
            width: 1, 
            type: 'solid',
            opacity: 0.8
          }
        }
      },
      {
        name: 'Negative',
        type: 'bar',
        data: chartData.negativeData,
        barWidth: 2,
        barGap: 0,
        itemStyle: { 
          color: {
            type: 'linear',
            x: 0, y: 1, x2: 0, y2: 0,
            colorStops: [
              { offset: 0, color: '#dc2626' },
              { offset: 1, color: '#ef4444' }
            ]
          },
          borderRadius: [0, 0, 2, 2],
          shadowBlur: 3,
          shadowColor: 'rgba(239, 68, 68, 0.2)'
        }
      },
      {
        name: 'Zero',
        type: 'bar',
        data: chartData.zeroData,
        barWidth: 2,
        barGap: 0,
        itemStyle: { 
          color: '#fbbf24',
          borderRadius: 2,
          shadowBlur: 2,
          shadowColor: 'rgba(251, 191, 36, 0.2)'
        }
      }
    ]
  }), [chartData, minY, maxY]);

  return (
    <div className="h-full space-y-4">
      {/* Daily Returns Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-3 w-3 text-gray-500" />
            <span className="text-xs font-semibold text-gray-700">Avg Daily</span>
          </div>
          <div className={`text-lg font-bold ${chartData.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {chartData.avgReturn >= 0 ? '+' : ''}{chartData.avgReturn.toFixed(3)}%
          </div>
          <div className="text-xs text-gray-500">Per day</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs font-semibold text-gray-700">Win Rate</span>
          </div>
          <div className="text-lg font-bold text-green-600">
            {chartData.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">{chartData.positiveDays} positive days</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-emerald-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-3 w-3 text-emerald-500" />
            <span className="text-xs font-semibold text-gray-700">Best Day</span>
          </div>
          <div className="text-lg font-bold text-emerald-600">
            +{chartData.bestDay.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">Highest daily return</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-red-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-3 w-3 text-red-500" />
            <span className="text-xs font-semibold text-gray-700">Worst Day</span>
          </div>
          <div className="text-lg font-bold text-red-600">
            {chartData.worstDay.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">Lowest daily return</div>
        </div>
      </div>

      {/* Enhanced Daily Returns Chart */}
      <div className="bg-gradient-to-br from-white to-gray-50/20 rounded-lg border shadow-sm">
        <ReactECharts
          option={option}
          style={{ height: '300px', width: '100%' }}
          opts={{ renderer: 'svg' }}
          className="transition-all duration-200"
        />
      </div>
    </div>
  );
}
