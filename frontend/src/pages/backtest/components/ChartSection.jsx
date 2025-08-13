import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ChartSection = ({ title, description, children, className = "" }) => {
  return (
    <Card className={`bg-white border border-gray-200 rounded-xl shadow-lg ${className}`}>
      <CardHeader className="px-4 py-3 border-b border-gray-100">
        <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
        {description && (
          <CardDescription className="text-sm text-gray-500">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-2">
        {children}
      </CardContent>
    </Card>
  );
};

export default ChartSection;