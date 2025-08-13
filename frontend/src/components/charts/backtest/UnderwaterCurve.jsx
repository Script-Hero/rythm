import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { TrendingDown, Waves, AlertTriangle, Clock } from 'lucide-react';

export default function UnderwaterCurve({ underwaterCurve }) {
  const chartData = useMemo(() => {
    if (!underwaterCurve || !underwaterCurve.dates || !underwaterCurve.underwater) {
      return null;
    }

    const { dates, underwater } = underwaterCurve;
    
    return {
      dates: dates.map(d => new Date(d)),
      underwater: underwater.map(u => (u * 100).toFixed(2)) // Convert to percentage
    };
  }, [underwaterCurve]);

  const drawdownStats = useMemo(() => {
    if (!chartData) return null;
    
    const underwater = chartData.underwater.map(u => parseFloat(u));
    const minDrawdown = Math.min(...underwater);
    const maxDrawdown = Math.max(...underwater);
    
    // Calculate time underwater (periods below 0)
    const underWaterPeriods = underwater.filter(u => u < 0).length;
    const totalPeriods = underwater.length;
    const timeUnderwater = (underWaterPeriods / totalPeriods * 100).toFixed(1);
    
    // Calculate average drawdown when underwater
    const avgDrawdownWhenUnder = underWaterPeriods > 0 
      ? (underwater.filter(u => u < 0).reduce((sum, u) => sum + u, 0) / underWaterPeriods).toFixed(2)
      : "0.00";
    
    return {
      minDrawdown: minDrawdown.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2),
      timeUnderwater,
      avgDrawdownWhenUnder
    };
  }, [chartData]);

  if (!chartData) {
    return (
      <div className="flex justify-center items-center h-[400px] bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border-2 border-dashed border-cyan-200">
        <div className="text-center">
          <Waves className="h-12 w-12 text-cyan-400 mx-auto mb-3" />
          <div className="text-cyan-600 font-medium">No underwater curve data</div>
          <div className="text-xs text-cyan-400 mt-1">Run a backtest to see drawdown duration analysis</div>
        </div>
      </div>
    );
  }

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(14, 165, 233, 0.2)',
      borderWidth: 2,
      borderRadius: 12,
      shadowBlur: 20,
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      textStyle: { fontSize: 12, fontWeight: 'bold' },
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: '#0ea5e9',
          width: 1,
          type: 'dashed',
          opacity: 0.6
        }
      },
      formatter: (params) => {
        const param = params[0];
        const date = new Date(param.axisValue).toLocaleDateString('default', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        const value = parseFloat(param.value);
        const color = value < 0 ? '#ef4444' : '#22c55e';
        const status = value < 0 ? 'Underwater' : 'At Peak';
        
        return `
          <div class="p-4 text-sm">
            <div class="font-bold text-lg mb-3 text-gray-800 border-b border-gray-200 pb-2">${date}</div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
                  <span class="font-semibold text-gray-700">Status</span>
                </div>
                <span class="font-bold px-3 py-1 rounded-full text-white" style="background-color: ${color}">${status}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-600">Drawdown</span>
                <span class="font-bold text-xl" style="color: ${color}">${value.toFixed(2)}%</span>
              </div>
              ${value < 0 ? `
                <div class="pt-2 border-t border-gray-100">
                  <div class="text-xs text-gray-500">Portfolio is ${Math.abs(value).toFixed(2)}% below its previous peak</div>
                </div>
              ` : `
                <div class="pt-2 border-t border-gray-100">
                  <div class="text-xs text-gray-500">Portfolio is at a new high</div>
                </div>
              `}
            </div>
          </div>
        `;
      }
    },
    title: {
      text: 'Underwater Curve - Drawdown Duration & Depth',
      left: 'center',
      top: '5%',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937'
      }
    },
    grid: {
      left: '12%',
      right: '8%',
      top: '20%',
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
      name: 'Drawdown (%)',
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
        name: 'Underwater Curve',
        type: 'line',
        data: chartData.dates.map((date, i) => [date, chartData.underwater[i]]),
        showSymbol: false,
        smooth: false, // Keep it non-smooth to show exact drawdown periods
        lineStyle: {
          width: 2,
          color: '#0ea5e9'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(14, 165, 233, 0.8)' },
              { offset: 0.5, color: 'rgba(239, 68, 68, 0.6)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.3)' }
            ]
          }
        },
        markLine: {
          data: [
            {
              yAxis: 0,
              lineStyle: {
                color: '#374151',
                type: 'solid',
                width: 2
              },
              label: {
                show: true,
                position: 'end',
                formatter: 'Waterline (0%)',
                color: '#374151',
                fontSize: 11,
                fontWeight: 'bold'
              }
            }
          ]
        },
        emphasis: {
          lineStyle: { width: 3 }
        }
      }
    ]
  }), [chartData]);

  return (
    <div className="h-full space-y-4">
      {/* Drawdown Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-gradient-to-br from-white to-red-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-3 w-3 text-red-500" />
            <span className="text-xs font-semibold text-gray-700">Max Drawdown</span>
          </div>
          <div className="text-lg font-bold text-red-600">
            {drawdownStats?.minDrawdown}%
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <Waves className="h-3 w-3 text-blue-500" />
            <span className="text-xs font-semibold text-gray-700">Avg When Under</span>
          </div>
          <div className="text-lg font-bold text-blue-600">
            {drawdownStats?.avgDrawdownWhenUnder}%
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3 w-3 text-orange-500" />
            <span className="text-xs font-semibold text-gray-700">Time Underwater</span>
          </div>
          <div className="text-lg font-bold text-orange-600">
            {drawdownStats?.timeUnderwater}%
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-green-50/30 rounded-lg p-3 shadow-sm border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs font-semibold text-gray-700">Peak Level</span>
          </div>
          <div className="text-lg font-bold text-green-600">
            {drawdownStats?.maxDrawdown}%
          </div>
        </div>
      </div>

      {/* Underwater Curve Chart */}
      <div className="bg-gradient-to-br from-white to-cyan-50/30 rounded-lg p-4 shadow-sm border">
        <ReactECharts
          option={option}
          style={{ width: '100%', height: '400px' }}
          opts={{ renderer: 'svg' }}
          className="transition-all duration-200 hover:scale-[1.01]"
        />
      </div>

      {/* Insight Box */}
      <div className="bg-gradient-to-br from-white to-yellow-50/30 rounded-lg p-4 shadow-sm border">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-semibold text-gray-700">Drawdown Analysis</span>
        </div>
        <div className="text-xs text-gray-600">
          The underwater curve shows how long and how deep your strategy spent in drawdown periods. 
          The filled area represents time spent below previous peaks. 
          Shorter, shallower underwater periods indicate better risk management.
        </div>
      </div>
    </div>
  );
}