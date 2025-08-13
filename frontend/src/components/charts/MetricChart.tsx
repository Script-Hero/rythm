import React, { memo, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveIndicator } from "@/components/dashboard";

interface MetricChartProps {
  data: any[];
  metricKey: string;
  metricLabel: string;
  domain?: [number, number];
}

const makeChartConfig = (label: string) => ({
  views: { label },
  metric: { label, color: "var(--chart-1)" },
});

export const MetricChart = memo(function MetricChart({
  data,
  metricKey,
  metricLabel,
  domain,
}: MetricChartProps) {
  const chartData = useMemo(
    () => data.map(d => ({ ...d, metric: d[metricKey] })).slice(-120),
    [data, metricKey]
  );
  
  const chartConfig = useMemo(() => makeChartConfig(metricLabel), [metricLabel]);

  return (
    <Card className="rounded-2xl bg-white/90 shadow-lg border-0 hover:shadow-2xl transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <div>
          <CardTitle className="text-lg font-semibold text-gray-700">
            {metricLabel}
          </CardTitle>
          <CardDescription className="text-xs text-gray-400">
            Last {chartData.length} updates
          </CardDescription>
        </div>
        <Badge variant="secondary" className="px-2 py-1 text-xs">
          <LiveIndicator />
        </Badge>
      </CardHeader>
      <CardContent className="pt-2">
        {chartData.length > 1 ? (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <LineChart
              data={chartData}
              margin={{ left: 12, right: 12, top: 8, bottom: 16 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                interval="preserveStartEnd"
                tickFormatter={v => v}
                fontSize={11}
                angle={-25}
                textAnchor="end"
              />
              <YAxis
                domain={domain || ["auto", "auto"]}
                axisLine={false}
                tickLine={false}
                fontSize={12}
                width={48}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[160px]"
                    nameKey="metric"
                    labelFormatter={v => `Time: ${v}`}
                  />
                }
              />
              <Line
                dataKey="metric"
                type="monotone"
                stroke="var(--chart-1)"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={true}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <Skeleton className="h-40 w-full rounded-xl" />
        )}
      </CardContent>
    </Card>
  );
});