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
import { formatPrice } from '@/lib/currency'

// ── Variant display config ────────────────────────────────────────────────────
// Colors mirror the Lumidex variant system defined in types/index.ts

const VARIANT_CONFIG: Record<string, { label: string; color: string }> = {
  normal:       { label: 'Normal',       color: '#eab308' }, // yellow
  // DB stores reverse holo as 'reverse' (see cardMatcher.mapVariant).
  // 'reverse_holo' is kept as an alias for any legacy rows.
  reverse:      { label: 'Reverse Holo', color: '#3b82f6' }, // blue
  reverse_holo: { label: 'Reverse Holo', color: '#3b82f6' }, // blue (alias)
  holo:         { label: 'Holo Rare',    color: '#8b5cf6' }, // purple
  '1st_edition':{ label: '1st Edition',  color: '#f97316' }, // orange
  // Card-specific / unknown variants fall through to the '#6b7280' grey default
}

function variantLabel(key: string): string {
  return VARIANT_CONFIG[key]?.label ?? key
}
function variantColor(key: string): string {
  return VARIANT_CONFIG[key]?.color ?? '#6b7280'
}

// ── Time range ────────────────────────────────────────────────────────────────

export type PriceChartRange = '7d' | '14d' | '30d' | '3m' | '6m' | '1y'

/** Ranges that require a Pro subscription. */
const PRO_RANGES = new Set<PriceChartRange>(['14d', '30d', '3m', '6m', '1y'])

const RANGES: { label: string; value: PriceChartRange }[] = [
  { label: '7 Days',    value: '7d'  },
  { label: '14 Days',   value: '14d' },
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
  /** Whether the current user is on the Pro plan. Controls blur overlay + lock icons. */
  isPro: boolean
  /**
   * User's preferred price source ('tcgplayer' | 'cardmarket').
   * When provided, history is filtered to that source before charting.
   * Falls back to all sources when no data exists for the preferred source
   * (e.g. a CardMarket-only set shown to a TCGPlayer user).
   */
  priceSource?: string
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
  isPro,
  priceSource,
}: PriceChartProps) {
  // Per-variant source filtering:
  // For each variant_key present in the history, prefer the user's chosen
  // priceSource.  If that source has no data for a given variant (e.g. CardMarket
  // never records reverse-holo prices separately), fall back to whatever source
  // has data for that variant.  This means:
  //   - CM user: sees CM 'normal' data + TCGPlayer 'reverse' data (blue line)
  //   - TCGPlayer user: sees TCGPlayer 'normal' + 'reverse' data
  //   - Sets where only one source exists: always show all data
  const filteredHistory = useMemo(() => {
    if (!priceSource || !history.length) return history

    // Group by variant_key
    const byVariant = new Map<string, PriceHistoryPoint[]>()
    for (const point of history) {
      const list = byVariant.get(point.variantKey) ?? []
      list.push(point)
      byVariant.set(point.variantKey, list)
    }

    // For each variant prefer the chosen source; fall back to all sources for
    // variants not covered by the preferred source.
    const result: PriceHistoryPoint[] = []
    for (const [, points] of byVariant) {
      const fromPreferred = points.filter(p => p.source === priceSource)
      result.push(...(fromPreferred.length > 0 ? fromPreferred : points))
    }
    return result
  }, [history, priceSource])

  // Pivot: date string → { [variantKey]: price }
  const { chartData, variantKeys } = useMemo(() => {
    if (!filteredHistory.length) return { chartData: [], variantKeys: [] }

    const byDate = new Map<string, Record<string, number>>()
    const keys   = new Set<string>()

    for (const point of filteredHistory) {
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
  }, [filteredHistory])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {/* Range tab skeleton */}
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <div key={r.value} className="h-7 w-16 bg-elevated rounded animate-pulse" />
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="h-48 bg-elevated rounded-lg animate-pulse" />
      </div>
    )
  }

  // Determine if the current range is gated for this user
  const isBlurred = !isPro && PRO_RANGES.has(range)

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!filteredHistory.length && !isBlurred) {
    return (
      <div className="flex flex-col gap-3">
        {/* Range tabs — still rendered so the UI feels complete */}
        <RangeTabs range={range} onRangeChange={onRangeChange} isPro={isPro} />
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-elevated rounded-lg border border-subtle">
          <span className="text-3xl mb-3">📈</span>
          <p className="text-secondary text-sm font-medium">Price history is on its way</p>
          <p className="text-muted text-xs mt-1 max-w-xs">
            We&apos;ll start recording price data on the next sync — check back soon.
          </p>
        </div>
      </div>
    )
  }

  // ── Range label for upgrade overlay ───────────────────────────────────────
  const rangeLabel = RANGES.find(r => r.value === range)?.label ?? range

  // ── Chart ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <RangeTabs range={range} onRangeChange={onRangeChange} isPro={isPro} />
        {!isBlurred && <CustomLegend variantKeys={variantKeys} />}
      </div>

      {/* Wrap chart in a relative container so the upgrade overlay can be positioned over it */}
      <div className="relative">
        {/* Chart — always rendered; blurred when free user selects a Pro range */}
        <div className={isBlurred ? 'blur-sm pointer-events-none select-none' : undefined}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={isBlurred ? BLURRED_PLACEHOLDER_DATA : chartData}
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
                domain={[
                  // Lower bound: dataMin minus 20% of the range (or 10% of dataMin when
                  // all prices are the same), floored at 0 to avoid negative values.
                  (dataMin: number) => {
                    const pad = Math.max(dataMin * 0.1, 0.01)
                    return Math.max(0, Math.round((dataMin - pad) * 100) / 100)
                  },
                  // Upper bound: dataMax plus 20% of dataMin so there is breathing room above.
                  (dataMax: number) => {
                    const pad = Math.max(dataMax * 0.1, 0.01)
                    return Math.round((dataMax + pad) * 100) / 100
                  },
                ]}
              />
              {!isBlurred && (
                <Tooltip
                  content={<CustomTooltip currency={currency} />}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
              )}
              {(isBlurred ? ['normal', 'reverse_holo'] : variantKeys).map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={variantColor(key)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={isBlurred ? undefined : { r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Upgrade overlay — only shown for free users on Pro ranges */}
        {isBlurred && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-center px-4">
              <span className="text-2xl">🔒</span>
              <p className="text-sm font-semibold text-primary">
                {rangeLabel} history requires Pro
              </p>
              <p className="text-xs text-muted max-w-[220px]">
                Upgrade to unlock full price history and see where this card is heading.
              </p>
              <a
                href="/upgrade"
                className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors shadow-[0_0_12px_rgba(109,95,255,0.35)]"
              >
                💎 Upgrade to Pro
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Placeholder data rendered behind the blur overlay ────────────────────────
// Gives a convincing "there is data here" impression without revealing real prices.

const BLURRED_PLACEHOLDER_DATA = Array.from({ length: 20 }, (_, i) => ({
  date:         `Day ${i + 1}`,
  normal:       80 + Math.sin(i * 0.6) * 18 + i * 0.8,
  reverse_holo: 55 + Math.cos(i * 0.5) * 12 + i * 0.5,
}))

// ── Range tab sub-component ───────────────────────────────────────────────────

function RangeTabs({
  range,
  onRangeChange,
  isPro,
}: {
  range: PriceChartRange
  onRangeChange: (r: PriceChartRange) => void
  isPro: boolean
}) {
  return (
    <div className="flex gap-1 overflow-x-auto">
      {RANGES.map((r) => {
        const isLocked = !isPro && PRO_RANGES.has(r.value)
        const isActive = range === r.value
        return (
          <button
            key={r.value}
            onClick={() => onRangeChange(r.value)}
            title={isLocked ? `${r.label} — Pro only` : r.label}
            className={`
              inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors
              ${isActive
                ? 'bg-accent text-white'
                : isLocked
                  ? 'text-muted/60 hover:text-muted hover:bg-elevated'
                  : 'text-muted hover:text-secondary hover:bg-elevated'
              }
            `}
          >
            {r.label}
            {isLocked && (
              <svg
                className="w-2.5 h-2.5 opacity-60 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-label="Pro only"
              >
                <path d="M12 1C8.676 1 6 3.676 6 7v1H4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v1H8V7c0-2.276 1.724-4 4-4zm0 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}
