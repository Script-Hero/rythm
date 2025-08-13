import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, Activity, AlertCircle } from 'lucide-react';

export default function RollingVolatility({ rollingVolatility }) {
  const chartData = useMemo(() => {
    if (!rollingVolatility || !rollingVolatility.dates || !rollingVolatility.volatility_3mo) {
      return null;
    }

    const { dates, volatility_3mo, volatility_6mo, volatility_12mo } = rollingVolatility;
    
    return {
      dates: dates.map(d => new Date(d)),
      vol3mo: volatility_3mo.map(v => v !== null ? (v * 100).toFixed(2) : null),
      vol6mo: volatility_6mo.map(v => v !== null ? (v * 100).toFixed(2) : null),
      vol12mo: volatility_12mo.map(v => v !== null ? (v * 100).toFixed(2) : null)
    };
  }, [rollingVolatility]);

  if (!chartData) {
    return (
      <div className="flex justify-center items-center h-[400px] bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-dashed border-blue-200">
        <div className="text-center">
          <Activity className="h-12 w-12 text-blue-400 mx-auto mb-3" />
          <div className="text-blue-600 font-medium">No volatility data</div>
          <div className="text-xs text-blue-400 mt-1">Run a backtest to see volatility analysis</div>
        </div>
      </div>
    );
  }

  // Calculate current volatility levels
  const currentVols = useMemo(() => {
    const latest3mo = chartData.vol3mo[chartData.vol3mo.length - 1];
    const latest6mo = chartData.vol6mo[chartData.vol6mo.length - 1];
    const latest12mo = chartData.vol12mo[chartData.vol12mo.length - 1];
    
    return {
      vol3mo: latest3mo ? parseFloat(latest3mo) : 0,
      vol6mo: latest6mo ? parseFloat(latest6mo) : 0,
      vol12mo: latest12mo ? parseFloat(latest12mo) : 0
    };
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
        }
      },
      formatter: (params) => {
        const date = new Date(params[0].axisValue).toLocaleDateString('default', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        let content = `
          <div class="p-4 text-sm">
            <div class="font-bold text-lg mb-3 text-gray-800 border-b border-gray-200 pb-2">${date}</div>
            <div class="space-y-2">
        `;
        
        params.forEach(param => {
          if (param.value !== null && param.value !== undefined) {
            const color = param.color;
            content += `
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
                  <span class="font-semibold" style="color: ${color}">${param.seriesName}</span>
                </div>
                <span class="font-bold px-3 py-1 rounded-full text-white" style="background-color: ${color}">${param.value}%</span>
              </div>
            `;
          }
        });
        
        content += `
            </div>
          </div>
        `;
        
        return content;
      }
    },
    legend: {
      data: [
        {
          name: '3-Month Volatility',
          icon: 'roundRect',
          textStyle: {
            color: '#3b82f6',
            fontSize: 13,
            fontWeight: 'bold'
          }
        },
        {
          name: '6-Month Volatility',
          icon: 'roundRect',
          textStyle: {
            color: '#8b5cf6',
            fontSize: 13,
            fontWeight: 'bold'
          }
        },
        {
          name: '12-Month Volatility',
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
        formatter: (value) => {
          const d = new Date(value);
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
      name: 'Volatility (%)',
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
        name: '3-Month Volatility',
        type: 'line',
        data: chartData.dates.map((date, i) => [date, chartData.vol3mo[i]]),
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 3,
          color: '#3b82f6',
          shadowBlur: 4,
          shadowColor: 'rgba(59, 130, 246, 0.3)'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.15)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.02)' }
            ]
          }
        },
        emphasis: {
          lineStyle: { width: 4 }
        }
      },
      {
        name: '6-Month Volatility',
        type: 'line',
        data: chartData.dates.map((date, i) => [date, chartData.vol6mo[i]]),
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 2.5,
          color: '#8b5cf6',
          shadowBlur: 4,
          shadowColor: 'rgba(139, 92, 246, 0.3)'
        },
        emphasis: {
          lineStyle: { width: 3.5 }
        }
      },
      {
        name: '12-Month Volatility',
        type: 'line',
        data: chartData.dates.map((date, i) => [date, chartData.vol12mo[i]]),
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 2,
          color: '#10b981',
          type: 'dashed',
          shadowBlur: 4,
          shadowColor: 'rgba(16, 185, 129, 0.3)'
        },
        emphasis: {
          lineStyle: { width: 3 }
        }
      }
    ]
  }), [chartData]);

  return (
    <div className="h-full space-y-4">
      {/* Current Volatility Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs font-semibold text-gray-700">3-Month</span>
          </div>
          <div className="text-xl font-bold text-blue-600">
            {currentVols.vol3mo.toFixed(1)}%
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-purple-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-xs font-semibold text-gray-700">6-Month</span>
          </div>
          <div className="text-xl font-bold text-purple-600">
            {currentVols.vol6mo.toFixed(1)}%
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-green-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs font-semibold text-gray-700">12-Month</span>
          </div>
          <div className="text-xl font-bold text-green-600">
            {currentVols.vol12mo.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Rolling Volatility Chart */}
      <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-lg p-4 shadow-sm border">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <h4 className="text-sm font-semibold text-gray-700">Rolling Volatility Over Time</h4>
        </div>
        <ReactECharts
          option={option}
          style={{ width: '100%', height: '350px' }}
          opts={{ renderer: 'svg' }}
          className="transition-all duration-200 hover:scale-[1.01]"
        />
      </div>

      {/* Volatility Insight */}
      <div className="bg-gradient-to-br from-white to-yellow-50/30 rounded-lg p-4 shadow-sm border">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-semibold text-gray-700">Volatility Analysis</span>
        </div>
        <div className="text-xs text-gray-600">
          {currentVols.vol3mo > currentVols.vol12mo 
            ? "Short-term volatility is elevated compared to long-term average, indicating increased recent market stress."
            : "Short-term volatility is below long-term average, suggesting relatively stable recent performance."
          }
        </div>
      </div>
    </div>
  );
}