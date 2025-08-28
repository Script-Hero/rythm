
import ReactECharts from 'echarts-for-react';

const formatDatetime = (value) => {
  const timestamp = Number(value);
  if (isNaN(timestamp)) return '';
  const date = new Date(timestamp > 1e12 ? timestamp : timestamp * 1000);
  return date.toLocaleDateString();
};

const formatSignificant = (value, sig = 4) => {
  if (typeof value !== 'number' || isNaN(value)) return '';
  return value.toLocaleString(undefined, { maximumSignificantDigits: sig });
};

const tooltipFormatter = (params) => {
  const dateStr = formatDatetime(params[0].axisValue);
  let html = `
    <div class='bg-gradient-to-br from-white to-slate-50 p-5 rounded-2xl shadow-2xl border border-gray-200/60 backdrop-blur-sm text-sm'>
      <div class='font-bold text-gray-900 mb-4 text-center text-base pb-2 border-b border-gray-200'>${dateStr}</div>
  `;
  params.forEach((p) => {
    if (Array.isArray(p.value)) {
      const [open, close, low, high] = p.value;
      const isUp = close >= open;
      const change = ((close - open) / open * 100).toFixed(2);
      const bgClass = isUp ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200';
      const colorClass = isUp ? 'text-green-700' : 'text-red-700';
      const changeClass = isUp ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
      html += `
        <div class='mb-4 p-3 rounded-lg ${bgClass} border'>
          <div class='flex items-center justify-between mb-3'>
            <div class='flex items-center space-x-2'>
              ${p.marker}
              <span class='font-semibold text-gray-800'>${p.seriesName}</span>
            </div>
            <span class='px-2 py-1 rounded-full text-xs font-medium ${changeClass}'>${isUp ? '+' : ''}${change}%</span>
          </div>
          <div class='grid grid-cols-4 gap-3 text-xs'>
            <div class='text-center p-2 bg-white/60 rounded-lg'><div class='font-bold text-gray-600 mb-1'>OPEN</div><div class='font-mono'>$${formatSignificant(open)}</div></div>
            <div class='text-center p-2 bg-white/60 rounded-lg'><div class='font-bold text-gray-600 mb-1'>HIGH</div><div class='font-mono text-green-600'>$${formatSignificant(high)}</div></div>
            <div class='text-center p-2 bg-white/60 rounded-lg'><div class='font-bold text-gray-600 mb-1'>LOW</div><div class='font-mono text-red-600'>$${formatSignificant(low)}</div></div>
            <div class='text-center p-2 bg-white/60 rounded-lg'><div class='font-bold text-gray-600 mb-1'>CLOSE</div><div class='font-mono font-bold ${colorClass}'>$${formatSignificant(close)}</div></div>
          </div>
        </div>
      `;
    } else {
      const formatted = formatSignificant(p.value);
      html += `
        <div class='flex justify-between items-center mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200'>
          <div class='flex items-center space-x-2'>
            ${p.marker}
            <span class='font-semibold text-blue-800'>${p.seriesName}</span>
          </div>
          <span class='font-bold text-blue-900 font-mono'>$${formatted}</span>
        </div>
      `;
    }
  });
  html += '</div>';
  return html;
};

export default function MainChart({ chartData, ranBacktest }) {
  const getOption = () => {
    // Handle empty chart data with loading state
    if (!chartData || chartData.length === 0) {
      return {
        backgroundColor: 'transparent',
        title: {
          text: 'Loading Chart Data...',
          subtext: 'Processing backtest results and generating chart data',
          left: 'center',
          top: 'center',
          textStyle: {
            fontSize: 18,
            color: '#6366f1',
            fontWeight: 'bold'
          },
          subtextStyle: {
            fontSize: 14,
            color: '#94a3b8',
            lineHeight: 22
          }
        },
        series: []
      };
    }

    const dates = chartData.map((d) => d.Datetime);
    const ohlc = chartData.map((d) => [d.Open, d.Close, d.Low, d.High]);
    const portfolio = chartData.map((d) => d.PortfolioValue);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: tooltipFormatter,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(229, 231, 235, 0.6)',
        borderWidth: 1,
        borderRadius: 16,
        shadowBlur: 20,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: '#6366f1',
            width: 2,
            type: 'dashed',
            opacity: 0.8
          },
          label: {
            show: false
          }
        },
      },

      axisPointer: {
        link: [{ xAxisIndex: [0, 1] }],
        triggerTooltip: true,
        z: 999,
        lineStyle: {
          color: '#6366f1',
          width: 2,
          type: 'dashed',
          opacity: 0.8
        },
      },

      legend: { 
        data: [
          {
            name: 'Portfolio Value',
            icon: 'roundRect',
            textStyle: { 
              color: '#1e293b',
              fontSize: 13,
              fontWeight: 'bold'
            }
          },
          {
            name: 'Price Action',
            icon: 'roundRect', 
            textStyle: { 
              color: '#1e293b',
              fontSize: 13,
              fontWeight: 'bold'
            }
          }
        ], 
        bottom: 35, 
        show: ranBacktest,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 12,
        padding: [8, 16],
        shadowBlur: 8,
        shadowColor: 'rgba(0, 0, 0, 0.1)'
      },

      xAxis: [
        {
          gridIndex: 0,
          type: 'category',
          data: dates,
          axisLabel: { 
            formatter: (v) => formatDatetime(v),
            color: '#64748b',
            fontSize: 11,
            fontWeight: 'bold'
          },
          axisLine: {
            lineStyle: { color: '#e2e8f0', width: 2 }
          },
          axisTick: {
            lineStyle: { color: '#cbd5e1' }
          },
          splitLine: {
            show: false
          }
        },
        {
          gridIndex: 1,
          type: 'category',
          data: dates,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false }
        },
      ],

      yAxis: [
        {
          gridIndex: 0,
          type: 'value',
          scale: true,
          name: 'Asset Price',
          position: 'left',
          nameLocation: 'middle',
          nameGap: 45,
          nameTextStyle: { 
            color: '#475569', 
            fontSize: 13,
            fontWeight: 'bold'
          },
          show: ranBacktest,
          axisLabel: { 
            formatter: (v) => `$${formatSignificant(v)}`,
            color: '#64748b',
            fontSize: 11,
            fontWeight: 'bold',
            margin: 8,
            show: ranBacktest
          },
          axisLine: {
            lineStyle: { color: '#e2e8f0', width: 2 }
          },
          splitLine: {
            lineStyle: { 
              color: '#f1f5f9',
              width: 1,
              type: 'dashed'
            }
          }
        },
        {
          gridIndex: 1,
          type: 'value',
          scale: true,
          name: 'Portfolio Value',
          position: 'right',
          nameLocation: 'middle',
          nameGap: 50,
          nameTextStyle: { 
            color: '#475569', 
            fontSize: 13,
            fontWeight: 'bold'
          },
          show: ranBacktest,
          axisLabel: { 
            formatter: (v) => `$${formatSignificant(v)}`,
            color: '#64748b',
            fontSize: 11,
            fontWeight: 'bold',
            margin: 8
          },
          axisLine: {
            lineStyle: { color: '#e2e8f0', width: 2 }
          },
          splitLine: {
            lineStyle: { 
              color: '#f1f5f9',
              width: 1,
              type: 'dashed'
            }
          }
        },
      ],

      dataZoom: [
        { 
          type: 'inside', 
          xAxisIndex: [0, 1], 
          filterMode: 'filter',
          throttle: 50
        },
        {
          type: 'slider',
          xAxisIndex: [0, 1],
          startValue: 0,
          endValue: Math.max(0, dates.length - 1),
          bottom: 8,
          height: 24,
          left: '8%',
          right: '8%',
          handleSize: '100%',
          show: ranBacktest,
          backgroundColor: 'rgba(248, 250, 252, 0.8)',
          borderColor: '#e2e8f0',
          borderRadius: 12,
          handleStyle: {
            color: '#6366f1',
            borderColor: '#4f46e5',
            borderWidth: 2,
            shadowBlur: 4,
            shadowColor: 'rgba(99, 102, 241, 0.3)'
          },
          fillerColor: 'rgba(99, 102, 241, 0.15)',
          selectedDataBackground: {
            lineStyle: { color: '#6366f1' },
            areaStyle: { color: 'rgba(99, 102, 241, 0.1)' }
          },
          labelFormatter: (idx) => {
            const i = parseInt(idx, 10);
            return formatDatetime(dates[i]);
          },
          textStyle: {
            color: '#64748b',
            fontSize: 10,
            fontWeight: 'bold'
          }
        },
      ],

      grid: [
        { 
          left: 65, 
          right: 70, 
          top: '55%', 
          height: '32%',
          backgroundColor: 'rgba(255, 255, 255, 0.4)',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          borderRadius: 12,
          shadowBlur: 8,
          shadowColor: 'rgba(0, 0, 0, 0.05)'
        },
        { 
          left: 65, 
          right: 70, 
          top: '12%', 
          height: '32%',
          backgroundColor: 'rgba(255, 255, 255, 0.4)',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          borderRadius: 12,
          shadowBlur: 8,
          shadowColor: 'rgba(0, 0, 0, 0.05)'
        },
      ],

      series: [
        {
          name: 'Portfolio Value',
          type: 'line',
          data: portfolio,
          xAxisIndex: 1,
          yAxisIndex: 1,
          gridIndex: 1,
          smooth: true,
          smoothMonotone: 'x',
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 6,
          z: 5,
          lineStyle: { 
            width: 3,
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#3b82f6' },
                { offset: 0.5, color: '#6366f1' },
                { offset: 1, color: '#8b5cf6' }
              ]
            },
            shadowBlur: 8,
            shadowColor: 'rgba(99, 102, 241, 0.3)',
            cap: 'round'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(99, 102, 241, 0.15)' },
                { offset: 1, color: 'rgba(99, 102, 241, 0.02)' }
              ]
            }
          },
          emphasis: {
            lineStyle: { width: 4 }
          }
        },
        {
          name: 'Price Action',
          type: 'candlestick',
          data: ohlc,
          xAxisIndex: 0,
          yAxisIndex: 0,
          gridIndex: 0,
          z: 3,
          itemStyle: {
            color: '#10b981',
            color0: '#ef4444',
            borderColor: '#059669',
            borderColor0: '#dc2626',
            borderWidth: 1.5,
            borderRadius: 2,
            shadowBlur: 4,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(0, 0, 0, 0.2)'
            }
          }
        },
      ],
    };
  };

  return (
    <div className="p-6 h-full w-full bg-gradient-to-br from-slate-50/50 via-blue-50/30 to-indigo-50/30">
      <ReactECharts
        style={{ width: '100%', height: '100%' }}
        option={getOption()}
        className="cursor-crosshair transition-all duration-200 hover:scale-[1.001]"
        notMerge={true}
        lazyUpdate={true}
        theme="light"
      />
    </div>
  );
}

