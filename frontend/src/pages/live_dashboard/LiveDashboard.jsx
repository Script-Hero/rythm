"use client"

import React from "react"
import { 
  useLiveStockData, 
  DashboardLayout, 
  MetricsSection, 
  ChartsGrid 
} from "./components"
import "./LiveDashboard.css"

// ─────────────────────────────────────────────────────────────────────────────
// Page ▸ LiveDashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function LiveDashboard({ serverUrl = "http://localhost:5000" }) {
  const { snapshot, history, domains } = useLiveStockData(serverUrl)

  return (
    <DashboardLayout>
      {/* Summary Metrics */}
      <MetricsSection snapshot={snapshot} history={history} />

      {/* Charts */}
      <ChartsGrid history={history} domains={domains} />
    </DashboardLayout>
  )
}

// ----------------------------------------------------------------------------
// Design Notes (unchanged)
// ----------------------------------------------------------------------------

/**
 * ---------------------------------------------------------------------------
 * Design Notes
 * ---------------------------------------------------------------------------
 * 1. Data Layer Isolation
 *    All streaming concerns live in useLiveStockData(). This means swapping
 *    transports (e.g., SSE, GraphQL Subscriptions) is a one‑line change.
 *
 * 2. Pure Presentational Components (SummaryCard, MetricChart)
 *    They receive data exclusively via props and can be promoted to a shared
 *    UI library without modification.
 *
 * 3. Config‑Driven UI (METRIC_META)
 *    Adding/removing a metric now requires a single insertion to the meta
 *    array—no other code changes needed.
 *
 * 4. Memoisation & memo()
 *    Prevents unnecessary re‑renders (critical when ticks arrive multiple times
 *    per second).
 *
 * 5. Typing
 *    Convert to TypeScript by renaming files to .tsx and adding interfaces for
 *    Snapshot / History entries—no runtime code changes necessary.
 */
