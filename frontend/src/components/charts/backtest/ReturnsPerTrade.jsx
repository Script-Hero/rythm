import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { BarChart3, TrendingUp, TrendingDown, Target, Percent } from 'lucide-react';

export default function ReturnsPerTrade({ tradeReturnHistogram }) {
  // Enhanced data validation with better empty state
  if (!tradeReturnHistogram || (!tradeReturnHistogram.histogram_data && !tradeReturnHistogram.bin_edges)) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex justify-center items-center bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border-2 border-dashed border-indigo-200">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-indigo-400 mx-auto mb-3" />
            <div className="text-indigo-600 font-medium">No trade returns data</div>
            <div className="text-xs text-indigo-400 mt-1">Run a backtest to see trade return distribution</div>
          </div>
        </div>
      </div>
    );
  }

  // Use new histogram_data format if available, fallback to legacy format
  const histogramData = tradeReturnHistogram.histogram_data;
  const { bin_edges: edges, counts } = tradeReturnHistogram;

  // Enhanced data processing with statistics - handles both new and legacy formats
  const chartData = useMemo(() => {
    // Use new histogram_data format if available
    if (histogramData && histogramData.length > 0) {
      const totalTrades = histogramData.reduce((sum, bin) => sum + bin.frequency, 0);
      const maxCount = Math.max(...histogramData.map(bin => bin.frequency));
      
      // Calculate win/loss statistics
      let winningTrades = 0;
      let losingTrades = 0;
      let breakEvenTrades = 0;
      
      histogramData.forEach(bin => {
        if (bin.range_end <= 0) losingTrades += bin.frequency;
        else if (bin.range_start >= 0) winningTrades += bin.frequency;
        else breakEvenTrades += bin.frequency; // Bin spans zero
      });

      // Calculate weighted average
      const weightedAverage = histogramData.reduce((sum, bin) => {
        const midpoint = (bin.range_start + bin.range_end) / 2;
        return sum + (midpoint * bin.frequency);
      }, 0) / totalTrades;
      
      // Find most frequent bin
      const mostFrequentBin = histogramData.reduce((max, bin) => 
        bin.frequency > max.frequency ? bin : max
      );

      return {
        histogramData,
        totalTrades,
        maxCount,
        winningTrades,
        losingTrades,
        breakEvenTrades,
        winRate: totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0,
        avgReturn: weightedAverage * 100,
        mostFrequentRange: mostFrequentBin.range_label,
        useNewFormat: true
      };
    }

    // Fallback to legacy format
    if (!edges || !counts) return null;

    // Build human-readable labels and calculate statistics
    const categories = edges.slice(0, -1).map((low, i) => {
      const high = edges[i + 1];
      return `${(low * 100).toFixed(1)}%–${(high * 100).toFixed(1)}%`;
    });

    const totalTrades = counts.reduce((sum, count) => sum + count, 0);
    const maxCount = Math.max(...counts);
    
    // Calculate win/loss statistics
    let winningTrades = 0;
    let losingTrades = 0;
    let breakEvenTrades = 0;
    
    edges.slice(0, -1).forEach((low, i) => {
      const high = edges[i + 1];
      const count = counts[i];
      
      if (high <= 0) losingTrades += count;
      else if (low >= 0) winningTrades += count;
      else breakEvenTrades += count; // Bin spans zero
    });

    // Calculate average bin values for statistics
    const binMidpoints = edges.slice(0, -1).map((low, i) => (low + edges[i + 1]) / 2);
    const weightedAverage = binMidpoints.reduce((sum, mid, i) => sum + (mid * counts[i]), 0) / totalTrades;
    
    // Find most frequent bin
    const mostFrequentIndex = counts.indexOf(maxCount);
    const mostFrequentRange = categories[mostFrequentIndex];

    return {
      categories,
      counts,
      totalTrades,
      maxCount,
      winningTrades,
      losingTrades,
      breakEvenTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0,
      avgReturn: weightedAverage * 100,
      mostFrequentRange,
      useNewFormat: false
    };
  }, [histogramData, edges, counts]);

  if (!chartData) return null;

  const option = useMemo(() => {
    if (chartData.useNewFormat) {
      // Modern histogram visualization for new format
      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: 'rgba(99, 102, 241, 0.2)',
          borderWidth: 2,
          borderRadius: 12,
          shadowBlur: 20,
          shadowColor: 'rgba(0, 0, 0, 0.1)',
          textStyle: { fontSize: 12, fontWeight: 'bold' },
          formatter: (params) => {
            const bin = chartData.histogramData[params.dataIndex];
            const percentage = ((bin.frequency / chartData.totalTrades) * 100).toFixed(1);
            return `
              <div class="p-4 text-center">
                <div class="font-bold text-lg mb-2 text-gray-800">${bin.range_label}</div>
                <div class="font-bold text-2xl text-indigo-600 mb-1">${bin.frequency}</div>
                <div class="text-sm text-gray-600">trades (${percentage}%)</div>
              </div>
            `;
          }
        },
        grid: { 
          left: '8%', 
          right: '8%', 
          top: '10%', 
          bottom: '25%',
          backgroundColor: 'rgba(255, 255, 255, 0.4)',
          borderRadius: 8,
          shadowBlur: 4,
          shadowColor: 'rgba(0, 0, 0, 0.05)'
        },
        xAxis: {
          type: 'value',
          name: 'Return (%)',
          nameLocation: 'middle',
          nameGap: 40,
          nameTextStyle: {
            color: '#6b7280',
            fontSize: 12,
            fontWeight: 'bold'
          },
          min: Math.min(...chartData.histogramData.map(bin => bin.range_start)) * 1.1,
          max: Math.max(...chartData.histogramData.map(bin => bin.range_start)) * 1.1,
          axisLabel: { 
            color: '#6b7280', 
            fontSize: 11,
            fontWeight: 'bold',
            formatter: (value) => `${(value * 100).toFixed(0)}%`
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
          type: 'value',
          name: 'Frequency',
          nameLocation: 'middle',
          nameGap: 50,
          nameTextStyle: {
            color: '#6b7280',
            fontSize: 12,
            fontWeight: 'bold'
          },
          min: 0,
          max: chartData.maxCount * 1.1,
          axisLabel: { 
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
            name: 'Trade Returns Distribution',
            type: 'custom',
            renderItem: (params, api) => {
              const bin = chartData.histogramData[params.dataIndex];
              const x = api.coord([bin.range_start, 0])[0];
              const y1 = api.coord([0, 0])[1];
              const y2 = api.coord([0, 1])[1];
              
              const color = bin.range_start >= 0 ? '#10b981' : '#ef4444';

              return {
                type: 'rect',
                shape: {
                  x: x - 1,
                  y: y2,
                  width: 2,
                  height: y1 - y2
                },
                style: {
                  fill: color,
                  stroke: 'rgba(255, 255, 255, 0.8)',
                  lineWidth: 0.5
                }
              };
            },
            data: chartData.histogramData.map((bin, index) => index),
            barWidth: '100%'
          }
        ]
      };
    } else {
      // Legacy bar chart visualization
      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: 'rgba(99, 102, 241, 0.2)',
          borderWidth: 2,
          borderRadius: 12,
          shadowBlur: 20,
          shadowColor: 'rgba(0, 0, 0, 0.1)',
          textStyle: { fontSize: 12, fontWeight: 'bold' },
          axisPointer: { 
            type: 'shadow',
            shadowStyle: {
              color: 'rgba(99, 102, 241, 0.1)'
            }
          },
          formatter: ([{ dataIndex, value }]) => {
            const range = chartData.categories[dataIndex];
            const percentage = ((value / chartData.totalTrades) * 100).toFixed(1);
            return `
              <div class="p-4 text-center">
                <div class="font-bold text-lg mb-2 text-gray-800">${range}</div>
                <div class="font-bold text-2xl text-indigo-600 mb-1">${value}</div>
                <div class="text-sm text-gray-600">trades (${percentage}%)</div>
              </div>
            `;
          }
        },
        grid: { 
          left: '8%', 
          right: '8%', 
          top: '10%', 
          bottom: '25%',
          backgroundColor: 'rgba(255, 255, 255, 0.4)',
          borderRadius: 8,
          shadowBlur: 4,
          shadowColor: 'rgba(0, 0, 0, 0.05)'
        },
        xAxis: {
          type: 'category',
          data: chartData.categories,
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
          },
          splitLine: { show: false }
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: chartData.maxCount * 1.1,
          axisLabel: { 
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
            name: 'Trades',
            type: 'bar',
            data: chartData.counts.map((count, i) => ({
              value: count,
              itemStyle: {
                color: {
                  type: 'linear',
                  x: 0, y: 1, x2: 0, y2: 0,
                  colorStops: [
                    { offset: 0, color: '#6366f1' },
                    { offset: 1, color: '#8b5cf6' }
                  ]
                },
                borderRadius: [4, 4, 0, 0],
                shadowBlur: 4,
                shadowColor: 'rgba(99, 102, 241, 0.3)'
              }
            })),
            barWidth: '90%',
            label: {
              show: true,
              position: 'top',
              formatter: '{c}',
              color: '#1f2937',
              fontSize: 11,
              fontWeight: 'bold'
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 8,
                shadowColor: 'rgba(99, 102, 241, 0.5)'
              }
            }
          }
        ]
      };
    }
  }, [chartData]);

  return (
    <div className="h-full space-y-4">
      {/* Trade Returns Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-white to-indigo-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-3 w-3 text-indigo-500" />
            <span className="text-xs font-semibold text-gray-700">Total Trades</span>
          </div>
          <div className="text-lg font-bold text-indigo-600">
            {chartData.totalTrades.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Executed trades</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-green-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs font-semibold text-gray-700">Win Rate</span>
          </div>
          <div className="text-lg font-bold text-green-600">
            {chartData.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">{chartData.winningTrades} winning trades</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-purple-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Percent className="h-3 w-3 text-purple-500" />
            <span className="text-xs font-semibold text-gray-700">Avg Return</span>
          </div>
          <div className={`text-lg font-bold ${chartData.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {chartData.avgReturn >= 0 ? '+' : ''}{chartData.avgReturn.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">Per trade</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-amber-50/50 rounded-lg p-3 border shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-3 w-3 text-amber-500" />
            <span className="text-xs font-semibold text-gray-700">Most Common</span>
          </div>
          <div className="text-lg font-bold text-amber-600">
            {chartData.mostFrequentRange}
          </div>
          <div className="text-xs text-gray-500">Return range</div>
        </div>
      </div>

      {/* Enhanced Trade Returns Histogram */}
      <div className="bg-gradient-to-br from-white to-indigo-50/20 rounded-lg border shadow-sm">
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
