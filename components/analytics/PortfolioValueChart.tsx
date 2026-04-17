'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/analytics/PortfolioValueChart.tsx
//
// Line chart showing the user's total portfolio value over a selected time range.
// Pattern mirrors PriceChart.tsx — uses the same Recharts primitives and dark
// theme conventions already established in the codebase.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { PortfolioHistoryPoint } from './types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortfolioValueChartProps {
  data: PortfolioHistoryPoint[]
  range: '7d' | '30d' | '90d' | '1y'
  onRangeChange: (r: string) => void
  isLoading?: boolean
}

const RANGES: { label: string; value: '7d' | '30d' | '90d' | '1y' }[] = [
  { label: '7d',  value: '7d'  },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: '1y',  value: '1y'  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(value: number): string {
  return `€${value.toFixed(2)}`
}

function formatDateLabel(isoDate: string): string {
  // isoDate is "YYYY-MM-DD"
  const [year, month, day] = isoDate.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

interface TooltipEntry {
  value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="font-semibold text-violet-400">{fmtEur(payload[0].value)}</p>
    </div>
  )
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="animate-pulse bg-gray-700 rounded h-7 w-28 mb-1.5" />
          <div className="animate-pulse bg-gray-700 rounded h-4 w-40" />
        </div>
        <div className="flex gap-1.5">
          {RANGES.map(r => (
            <div key={r.value} className="animate-pulse bg-gray-700 rounded h-7 w-10" />
          ))}
        </div>
      </div>
      <div className="animate-pulse bg-gray-700 rounded h-52 w-full" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PortfolioValueChart({
  data,
  range,
  onRangeChange,
  isLoading,
}: PortfolioValueChartProps) {
  if (isLoading) return <LoadingSkeleton />

  // Compute summary stats
  const currentValue = data.length > 0 ? data[data.length - 1].total_value_eur : 0
  const startValue   = data.length > 0 ? data[0].total_value_eur : 0
  const delta        = currentValue - startValue
  const deltaPercent = startValue > 0 ? (delta / startValue) * 100 : 0
  const isPositive   = delta >= 0

  // Build chart data
  const chartData = data.map(point => ({
    date:  formatDateLabel(point.date),
    value: point.total_value_eur,
  }))

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">

      {/* ── Header: summary stat + range selector ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">

        {/* Summary */}
        <div>
          {data.length > 0 ? (
            <>
              <p className="text-2xl font-bold text-white">{fmtEur(currentValue)}</p>
              {data.length >= 2 && (
                <p className={`text-sm mt-0.5 font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{fmtEur(delta)}&nbsp;
                  ({isPositive ? '+' : ''}{deltaPercent.toFixed(1)}%) this period
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">No portfolio data yet</p>
          )}
        </div>

        {/* Range buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => onRangeChange(r.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors duration-150 ${
                range === r.value
                  ? 'bg-violet-600 text-white shadow-[0_0_8px_rgba(139,92,246,0.3)]'
                  : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart or empty state ── */}
      {data.length < 2 ? (
        <div className="flex items-center justify-center h-48 text-gray-500 text-sm text-center px-4">
          Not enough data yet — check back tomorrow!
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 8, bottom: 5, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `€${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
              width={56}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#a78bfa', stroke: '#1f2937', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
