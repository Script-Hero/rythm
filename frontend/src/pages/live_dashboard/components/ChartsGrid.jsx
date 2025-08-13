import React from "react"
import { MetricChart } from "@/components/charts/MetricChart"

/**
 * Constants for metric configuration
 */
export const METRIC_META = [
  { key: "price", label: "Price", precision: 2 },
  { key: "cash", label: "Cash", precision: 2 },
  { key: "holdings", label: "Holdings", precision: 5 },
  { key: "portfolio_value", label: "Portfolio Value", precision: 2 },
  { key: "fees_paid", label: "Fees Paid", precision: 2 }
]

/**
 * Charts grid component that displays metric charts in a responsive grid layout
 */
export function ChartsGrid({ history, domains }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <MetricChart
        data={history}
        metricKey="price"
        metricLabel="Price"
        domain={domains.price}
      />
      <MetricChart
        data={history}
        metricKey="cash"
        metricLabel="Cash"
        domain={domains.cash}
      />
      <MetricChart
        data={history}
        metricKey="holdings"
        metricLabel="Holdings"
        domain={domains.holdings}
      />
      <MetricChart
        data={history}
        metricKey="portfolio_value"
        metricLabel="Portfolio Value"
        domain={domains.portfolio_value}
      />
      <MetricChart
        data={history}
        metricKey="fees_paid"
        metricLabel="Fees Paid"
        domain={domains.fees_paid}
      />
    </div>
  )
}