import React from "react"
import { SummaryCard } from "@/components/dashboard"

/**
 * Metrics section component that displays portfolio stats and metrics cards
 * Handles trend calculation and display for each metric
 */
export function MetricsSection({ snapshot, history }) {
  const getTrend = (key) => {
    if (history.length > 2 && typeof snapshot[key] === "number") {
      const prev = history[history.length - 2]?.[key]
      if (typeof prev === "number") {
        if (snapshot[key] > prev) {
          return <span className="text-green-500 text-xs font-bold ml-2">▲</span>
        } else if (snapshot[key] < prev) {
          return <span className="text-red-500 text-xs font-bold ml-2">▼</span>
        } else {
          return <span className="text-gray-400 text-xs font-bold ml-2">■</span>
        }
      }
    }
    return null
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
      <SummaryCard
        label="Current Price"
        value={snapshot.price}
        precision={2}
        trend={getTrend('price')}
      />
      <SummaryCard
        label="Cash Balance"
        value={snapshot.cash}
        precision={2}
        trend={getTrend('cash')}
      />
      <SummaryCard
        label="Holdings"
        value={snapshot.holdings}
        precision={5}
        trend={getTrend('holdings')}
      />
      <SummaryCard
        label="Portfolio Value"
        value={snapshot.portfolio_value}
        precision={2}
        trend={getTrend('portfolio_value')}
      />
      <SummaryCard
        label="Fees Paid"
        value={snapshot.fees_paid}
        precision={2}
        trend={getTrend('fees_paid')}
      />
    </div>
  )
}