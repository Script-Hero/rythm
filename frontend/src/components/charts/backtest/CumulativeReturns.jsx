import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, TrendingDown, Award, BarChart3 } from 'lucide-react';

export default function CumulativeReturns({ cumulativeReturns }) {
  // Enhanced data validation with better empty state
  if (!cumulativeReturns || !cumulativeReturns.dates || !cumulativeReturns.backtest || !cumulativeReturns.benchmark) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex justify-center items-center bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-dashed border-green-200">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <div className="text-green-600 font-medium">No cumulative returns data</div>
            <div className="text-xs text-green-400 mt-1">Run a backtest to see portfolio growth analysis</div>
          </div>
        </div>
      </div>
    );
  }

  const { dates, backtest, benchmark } = cumulativeReturns;

  // Enhanced data processing with statistics
  const chartData = useMemo(() => {
    const seriesBacktest = dates.map((d, i) => [d, +(backtest[i] * 100).toFixed(2)]);
    const seriesBenchmark = dates.map((d, i) => [d, +(benchmark[i] * 100).toFixed(2)]);
    
    // Calculate performance statistics
    const finalBacktest = backtest[backtest.length - 1] * 100;
    const finalBenchmark = benchmark[benchmark.length - 1] * 100;
    const outperformance = finalBacktest - finalBenchmark;
    
    // Calculate Y-axis bounds
    const all = [...seriesBacktest.map(([, v]) => v), ...seriesBenchmark.map(([, v]) => v)];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const buffer = (max - min) * 0.05;
    
    return {
      seriesBacktest,
      seriesBenchmark,
      minY: min - buffer,
      maxY: max + buffer,
      finalBacktest,
      finalBenchmark,
      outperformance,
      isOutperforming: outperformance > 0
    };
  }, [dates, backtest, benchmark]);

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(34, 197, 94, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { fontSize: 12, fontWeight: 'bold' },
      axisPointer: { 
        type: 'cross',
        crossStyle: {
          color: '#10b981',
          width: 1,
          type: 'dashed',
          opacity: 0.6
        },
        lineStyle: {
          color: '#10b981',
          width: 1,
          type: 'dashed',
          opacity: 0.4
        }
      },
      formatter: (pts) => {
        const date = new Date(pts[0].data[0]).toLocaleDateString('default', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        const backtestValue = pts[0].data[1];
        const benchmarkValue = pts[1].data[1];
        const outperformance = (backtestValue - benchmarkValue).toFixed(2);
        const outperformanceColor = outperformance >= 0 ? '#10b981' : '#ef4444';
        
        return `
          <div class="p-4 text-sm">
            <div class="font-bold text-lg mb-3 text-gray-800 border-b border-gray-200 pb-2">${date}</div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500"></div>
                  <span class="font-semibold text-green-700">Strategy</span>
                </div>
                <span class="font-bold text-green-800 bg-green-50 px-3 py-1 rounded-full">${backtestValue.toFixed(2)}%</span>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full bg-gradient-to-r from-gray-300 to-gray-400"></div>
                  <span class="font-semibold text-gray-600">Benchmark</span>
                </div>
                <span class="font-bold text-gray-700 bg-gray-50 px-3 py-1 rounded-full">${benchmarkValue.toFixed(2)}%</span>
              </div>
              <div class="pt-2 border-t border-gray-100">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-medium text-gray-600">Outperformance</span>
                  <span class="font-bold px-2 py-1 rounded text-xs" style="color: ${outperformanceColor}; background-color: ${outperformanceColor}15">${outperformance >= 0 ? '+' : ''}${outperformance}%</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    },
    legend: {
      data: [
        {
          name: 'Strategy',
          icon: 'roundRect',
          textStyle: { 
            color: '#065f46',
            fontSize: 13,
            fontWeight: 'bold'
          }
        },
        {
          name: 'Benchmark',
          icon: 'roundRect',
          textStyle: { 
            color: '#6b7280',
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
      left: '12%', 
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
      min: chartData.minY,
      max: chartData.maxY,
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
        type: 'line',
        data: chartData.seriesBacktest,
        showSymbol: false,
        smooth: true,
        smoothMonotone: 'x',
        lineStyle: { 
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#22c55e' },
              { offset: 0.5, color: '#10b981' },
              { offset: 1, color: '#059669' }
            ]
          },
          shadowBlur: 6,
          shadowColor: 'rgba(16, 185, 129, 0.3)',
          cap: 'round'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.15)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.02)' }
            ]
          }
        },
        emphasis: {
          lineStyle: { width: 4 }
        }
      },
      {
        name: 'Benchmark',
        type: 'line',
        data: chartData.seriesBenchmark,
        showSymbol: false,
        smooth: true,
        smoothMonotone: 'x',
        lineStyle: { 
          width: 2,
          color: '#9ca3af',
          type: 'dashed',
          dashOffset: 5,
          cap: 'round'
        },
        emphasis: {
          lineStyle: { width: 3 }
        }
      }
    ]
  }), [chartData]);

  return (
    <div className="h-full space-y-4">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs font-semibold text-gray-700">Strategy</span>
          </div>
          <div className="text-lg font-bold text-green-600">
            {chartData.finalBacktest.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Total return</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-3 w-3 text-gray-500" />
            <span className="text-xs font-semibold text-gray-700">Benchmark</span>
          </div>
          <div className="text-lg font-bold text-gray-600">
            {chartData.finalBenchmark.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Total return</div>
        </div>
        
        <div className={`bg-gradient-to-br from-white rounded-lg p-3 border shadow-sm ${
          chartData.isOutperforming ? 'to-green-50/50' : 'to-red-50/50'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {chartData.isOutperforming ? (
              <Award className="h-3 w-3 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className="text-xs font-semibold text-gray-700">Alpha</span>
          </div>
          <div className={`text-lg font-bold ${
            chartData.isOutperforming ? 'text-green-600' : 'text-red-600'
          }`}>
            {chartData.outperformance > 0 ? '+' : ''}{chartData.outperformance.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Outperformance</div>
        </div>
      </div>

      {/* Enhanced Chart */}
      <div className="bg-gradient-to-br from-white to-green-50/20 rounded-lg border shadow-sm">
        <ReactECharts
          option={option}
          style={{ width: '100%', height: '280px' }}
          opts={{ renderer: 'svg' }}
          className="transition-all duration-200"
        />
      </div>
    </div>
  );
}
