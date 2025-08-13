import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Calendar, TrendingUp, TrendingDown, Target, Award } from 'lucide-react';

export default function AnnualReturns({
  annualReturns,
  averageAnnualReturn
}) {
  // Enhanced data validation with better empty state
  if (!annualReturns || Object.keys(annualReturns).length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex justify-center items-center bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border-2 border-dashed border-orange-200">
          <div className="text-center">
            <Calendar className="h-12 w-12 text-orange-400 mx-auto mb-3" />
            <div className="text-orange-600 font-medium">No annual returns data</div>
            <div className="text-xs text-orange-400 mt-1">Run a backtest to see yearly performance breakdown</div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced data processing with statistics
  const chartData = useMemo(() => {
    const years = Object.keys(annualReturns).sort((a, b) => +a - +b);
    const returns = years.map(y => +(annualReturns[y] * 100).toFixed(2));
    
    const data = years.map((y, i) => {
      const pct = returns[i];
      return {
        value: pct,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: pct >= 0 ? [
              { offset: 0, color: '#22c55e' },
              { offset: 1, color: '#10b981' }
            ] : [
              { offset: 0, color: '#ef4444' },
              { offset: 1, color: '#dc2626' }
            ]
          },
          borderRadius: [0, 4, 4, 0],
          shadowBlur: 4,
          shadowColor: pct >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
        }
      };
    });

    // Calculate statistics
    const positiveYears = returns.filter(r => r > 0).length;
    const negativeYears = returns.filter(r => r < 0).length;
    const bestYear = Math.max(...returns);
    const worstYear = Math.min(...returns);
    const avgReturn = +(averageAnnualReturn * 100).toFixed(2);
    const winRate = years.length > 0 ? (positiveYears / years.length * 100) : 0;
    const consistency = returns.length > 1 ? (1 - (Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length) / Math.abs(avgReturn))) * 100 : 0;

    return {
      years,
      data,
      returns,
      positiveYears,
      negativeYears,
      bestYear,
      worstYear,
      avgReturn,
      winRate,
      consistency: Math.max(0, consistency),
      totalYears: years.length
    };
  }, [annualReturns, averageAnnualReturn]);

  // Compute chart bounds
  const [min, max] = useMemo(() => {
    const vals = chartData.returns;
    const buffer = Math.abs(Math.max(...vals) - Math.min(...vals)) * 0.1;
    return [Math.min(...vals, chartData.avgReturn) - buffer, Math.max(...vals, chartData.avgReturn) + buffer];
  }, [chartData]);

  // Enhanced ECharts option with modern styling
  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(251, 146, 60, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { fontSize: 12, fontWeight: 'bold' },
      axisPointer: { 
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(251, 146, 60, 0.1)'
        }
      },
      formatter: (params) => {
        const { name, value } = params[0];
        const color = value >= 0 ? '#10b981' : '#ef4444';
        const bgColor = value >= 0 ? '#dcfce7' : '#fee2e2';
        return `
          <div class="p-4 text-center" style="background-color: ${bgColor}; border-radius: 12px; min-width: 100px;">
            <div class="font-bold text-lg mb-2 text-gray-800">${name}</div>
            <div class="font-bold text-2xl" style="color: ${color}">${value >= 0 ? '+' : ''}${value}%</div>
            <div class="text-xs text-gray-500 mt-1">Annual return</div>
          </div>
        `;
      }
    },
    grid: { 
      left: '8%', 
      right: '15%', 
      top: '10%', 
      bottom: '15%',
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      borderRadius: 8,
      shadowBlur: 4,
      shadowColor: 'rgba(0, 0, 0, 0.05)'
    },
    xAxis: {
      type: 'value',
      min,
      max,
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
      type: 'category',
      data: chartData.years,
      inverse: true,
      axisLabel: { 
        color: '#6b7280',
        fontSize: 12,
        fontWeight: 'bold'
      },
      axisLine: { 
        show: true,
        lineStyle: { color: '#e5e7eb', width: 2 }
      },
      axisTick: { 
        show: true,
        lineStyle: { color: '#d1d5db' }
      }
    },
    series: [
      {
        name: 'Annual Return',
        type: 'bar',
        data: chartData.data,
        barCategoryGap: '40%',
        label: {
          show: true,
          position: 'right',
          formatter: '{c}%',
          color: '#1f2937',
          fontSize: 12,
          fontWeight: 'bold',
          offset: [8, 0]
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: 'rgba(0, 0, 0, 0.3)'
          }
        },
        markLine: {
          data: [
            {
              name: 'Average',
              xAxis: chartData.avgReturn
            }
          ],
          lineStyle: {
            type: 'solid',
            color: '#f59e0b',
            width: 3,
            shadowBlur: 4,
            shadowColor: 'rgba(245, 158, 11, 0.3)'
          },
          symbol: ['none', 'arrow'],
          symbolSize: [0, 8],
          label: {
            formatter: 'Avg: {c}%',
            position: 'insideEndTop',
            color: '#f59e0b',
            fontSize: 12,
            fontWeight: 'bold',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: 6,
            padding: [4, 8],
            shadowBlur: 4,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
          }
        }
      }
    ]
  }), [chartData, min, max]);

  return (
    <div className="h-full space-y-4">
      {/* Annual Returns Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-white to-orange-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-3 w-3 text-orange-500" />
            <span className="text-xs font-semibold text-gray-700">Avg Annual</span>
          </div>
          <div className={`text-lg font-bold ${chartData.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {chartData.avgReturn >= 0 ? '+' : ''}{chartData.avgReturn.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Per year</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs font-semibold text-gray-700">Win Rate</span>
          </div>
          <div className="text-lg font-bold text-green-600">
            {chartData.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">{chartData.positiveYears} positive years</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-emerald-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Award className="h-3 w-3 text-emerald-500" />
            <span className="text-xs font-semibold text-gray-700">Best Year</span>
          </div>
          <div className="text-lg font-bold text-emerald-600">
            +{chartData.bestYear.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Highest annual return</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-red-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-3 w-3 text-red-500" />
            <span className="text-xs font-semibold text-gray-700">Worst Year</span>
          </div>
          <div className="text-lg font-bold text-red-600">
            {chartData.worstYear.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Lowest annual return</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-3 w-3 text-blue-500" />
            <span className="text-xs font-semibold text-gray-700">Consistency</span>
          </div>
          <div className="text-lg font-bold text-blue-600">
            {chartData.consistency.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-500">Return stability</div>
        </div>
      </div>

      {/* Enhanced Annual Returns Chart */}
      <div className="bg-gradient-to-br from-white to-orange-50/20 rounded-lg border shadow-sm">
        <ReactECharts
          option={option}
          style={{ height: '360px', width: '100%' }}
          opts={{ renderer: 'svg' }}
          className="transition-all duration-200"
        />
      </div>
    </div>
  );
}
