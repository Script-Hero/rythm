import React, { memo, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCardProps {
  label: string;
  value: number | string | null;
  precision?: number;
  trend?: React.ReactNode;
}

export const SummaryCard = memo(function SummaryCard({ 
  label, 
  value, 
  precision = 2, 
  trend 
}: SummaryCardProps) {
  const formatted = useMemo(() => {
    if (value == null) return <Skeleton className="h-6 w-16" />;
    if (typeof value === "number") return `$${value.toFixed(precision)}`;
    return value;
  }, [value, precision]);

  return (
    <Card className="rounded-2xl bg-background shadow-xl border-0 hover:shadow-2xl transition-all duration-200 group">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-gray-600 text-sm font-medium tracking-wide group-hover:text-primary transition">
          {label}
        </CardTitle>
        {trend}
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl font-bold text-gray-900 group-hover:text-primary transition">
          {formatted}
        </p>
      </CardContent>
    </Card>
  );
});