'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useMemo, useState } from 'react'
import type { PriceHistoryPoint } from '@/types'
import { formatPrice } from '@/lib/pricing'

// ── Variant display config ────────────────────────────────────────────────────
// Colors mirror the Lumidex variant system defined in types/index.ts

const VARIANT_CONFIG: Record<string, { label: string; color: string }> = {
  normal:       { label: 'Normal',       color: '#10b981' }, // green
  reverse_holo: { label: 'Reverse Holo', color: '#3b82f6' }, // blue
  holo:         { label: 'Holo Rare',    color: '#8b5cf6' }, // purple
  '1st_edition':{ label: '1st Edition',  color: '#f59e0b' }, // amber
}

function variantLabel(key: string): string {
  return VARIANT_CONFIG[key]?.label ?? key
}
function variantColor(key: string): string {
  return VARIANT_CONFIG[key]?.color ?? '#6b7280'
}

// ── Time range ────────────────────────────────────────────────────────────────

export type PriceChartRange = '30d' | '3m' | '6m' | '1y'

const RANGES: { label: string; value: PriceChartRange }[] = [
  { label: '30 Days',   value: '30d' },
  { label: '3 Months',  value: '3m'  },
  { label: '6 Months',  value: '6m'  },
  { label: '1 Year',    value: '1y'  },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface PriceChartProps {
  history:    PriceHistoryPoint[]
  currency:   string
  isLoading:  boolean
  range:      PriceChartRange
  onRangeChange: (r: PriceChartRange) => void
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  dataKey: string
  value:   number
  color:   string
}

function CustomTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?:  boolean
  payload?: TooltipPayloadEntry[]
  label?:   string
  currency: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-elevated border border-subtle rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-muted mb-1.5 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-secondary">{variantLabel(entry.dataKey)}</span>
          <span className="font-semibold ml-auto pl-4" style={{ color: entry.color }}>
            {formatPrice(entry.value, currency)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Custom legend ─────────────────────────────────────────────────────────────

function CustomLegend({ variantKeys }: { variantKeys: string[] }) {
  return (
    <div className="flex flex-wrap gap-3 justify-end px-2 pb-1">
      {variantKeys.map((key) => (
        <div key={key} className="flex items-center gap-1.5 text-xs text-secondary">
          <span
            className="w-3 h-0.5 rounded-full inline-block"
            style={{ backgroundColor: variantColor(key) }}
          />
          {variantLabel(key)}
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PriceChart({
  history,
  currency,
  isLoading,
  range,
  onRangeChange,
}: PriceChartProps) {
  // Pivot: date string → { [variantKey]: price }
  const { chartData, variantKeys } = useMemo(() => {
    if (!history.length) return { chartData: [], variantKeys: [] }

    const byDate = new Map<string, Record<string, number>>()
    const keys   = new Set<string>()

    for (const point of history) {
      // Format date label: "Mar 31"
      const date = new Date(point.recordedAt)
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      if (!byDate.has(label)) byDate.set(label, {})
      byDate.get(label)![point.variantKey] = point.priceUsd
      keys.add(point.variantKey)
    }

    // Sort dates chronologically (Map preserves insertion order from sorted history)
    const chartData = Array.from(byDate.entries()).map(([date, prices]) => ({
      date,
      ...prices,
    }))

    // Sort variant keys by preferred display order
    const ORDER = ['normal', 'reverse_holo', 'holo', '1st_edition']
    const variantKeys = Array.from(keys).sort(
      (a, b) => (ORDER.indexOf(a) - ORDER.indexOf(b)) || a.localeCompare(b),
    )

    return { chartData, variantKeys }
  }, [history])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {/* Range tab skeleton */}
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <div key={r.value} className="h-7 w-20 bg-elevated rounded animate-pulse" />
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="h-48 bg-elevated rounded-lg animate-pulse" />
      </div>
    )
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!history.length) {
    return (
      <div className="flex flex-col gap-3">
        {/* Range tabs — still rendered so the UI feels complete */}
        <RangeTabs range={range} onRangeChange={onRangeChange} />
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-elevated rounded-lg border border-subtle">
          <span className="text-3xl mb-3">📈</span>
          <p className="text-secondary text-sm font-medium">Price history is on its way</p>
          <p className="text-muted text-xs mt-1 max-w-xs">
            We'll start recording price data on the next sync — check back soon.
          </p>
        </div>
      </div>
    )
  }

  // ── Chart ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <RangeTabs range={range} onRangeChange={onRangeChange} />
        <CustomLegend variantKeys={variantKeys} />
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatPrice(v, currency)}
            width={58}
          />
          <Tooltip
            content={<CustomTooltip currency={currency} />}
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
          />
          {variantKeys.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={variantColor(key)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Range tab sub-component ───────────────────────────────────────────────────

function RangeTabs({
  range,
  onRangeChange,
}: {
  range: PriceChartRange
  onRangeChange: (r: PriceChartRange) => void
}) {
  return (
    <div className="flex gap-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onRangeChange(r.value)}
          className={`
            px-3 py-1 rounded text-xs font-medium transition-colors
            ${range === r.value
              ? 'bg-accent text-white'
              : 'text-muted hover:text-secondary hover:bg-elevated'
            }
          `}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
