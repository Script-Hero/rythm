import React from "react"
import { Activity } from "lucide-react"
import { LiveIndicator } from "@/components/dashboard"

/**
 * Main dashboard layout component that provides the overall structure
 * and header section of the live dashboard
 */
export function DashboardLayout({ children }) {
  return (
    <div
      className="w-full bg-gradient-to-br from-indigo-50 via-slate-50 to-white p-6 md:p-10 transition-colors"
      style={{ backgroundAttachment: "fixed" }}
    >
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
              <Activity className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                Trading Dashboard
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <LiveIndicator />
                <span className="text-sm text-gray-500">
                  {new Date().toLocaleString([], { hour12: false })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  )
}