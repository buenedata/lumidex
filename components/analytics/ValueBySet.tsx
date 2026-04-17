'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/analytics/ValueBySet.tsx
//
// Horizontal bar chart of total collection value grouped by set.
// Sorted descending by total_value_eur, top 10 sets shown.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { SetValueEntry } from './types'
import { fmtCardPrice } from '@/lib/currency'

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(s: string, n = 20): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

interface TooltipData extends SetValueEntry {
  display_name: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: TooltipData }>
  currency: string
}

function CustomTooltip({ active, payload, currency }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg text-xs max-w-[200px]">
      <p className="font-semibold text-white mb-1.5 leading-snug">{d.set_name}</p>
      <p className="text-gray-400">{d.card_count.toLocaleString()} cards</p>
      <p className="text-indigo-400 font-medium">{fmtCardPrice({ eur: d.total_value_eur, usd: null }, currency) ?? '—'}</p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ValueBySetProps {
  data: SetValueEntry[]
  currency: string
}

export default function ValueBySet({ data, currency }: ValueBySetProps) {
  const sorted = [...data]
    .sort((a, b) => b.total_value_eur - a.total_value_eur)
    .slice(0, 10)
    .map(entry => ({
      ...entry,
      display_name: truncate(entry.set_name),
    }))

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-14 text-gray-500 text-sm">
        No data available.
      </div>
    )
  }

  const chartHeight = Math.max(sorted.length * 48 + 24, 80)

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
          barCategoryGap="25%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#374151"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
            tickFormatter={(v: number) => {
              const fmt = fmtCardPrice({ eur: v, usd: null }, currency) ?? ''
              if (v >= 1000) {
                // Keep the 'k' abbreviation but use the correct currency symbol
                const sym = fmt.replace(/[\d.,\s]/g, '').trim() || '€'
                return `${sym}${(v / 1000).toFixed(1)}k`
              }
              return fmt
            }}
          />
          <YAxis
            type="category"
            dataKey="display_name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip
            content={<CustomTooltip currency={currency} />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar
            dataKey="total_value_eur"
            fill="#6366f1"
            radius={[0, 4, 4, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
