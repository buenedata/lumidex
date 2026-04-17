'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/analytics/RarityBreakdown.tsx
//
// Horizontal bar chart (layout="vertical" in recharts) showing card count and
// total EUR value grouped by rarity bucket. Bars are coloured per rarity tier.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import type { RarityBucket } from './types'

// ── Rarity colour mapping ─────────────────────────────────────────────────────

function getRarityColor(rarity: string): string {
  const r = rarity.toLowerCase()
  if (r === 'common')                                    return '#6b7280' // gray
  if (r === 'uncommon')                                  return '#22c55e' // green
  if (r.includes('secret') || r.includes('special'))    return '#eab308' // gold/yellow
  if (r.includes('ultra') || r.includes('holo'))        return '#a78bfa' // purple
  if (r.includes('rare'))                               return '#3b82f6' // blue
  return '#6366f1'                                                        // indigo fallback
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

interface TooltipData {
  rarity: string
  card_count: number
  total_value_eur: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: TooltipData }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-white mb-1.5">{d.rarity}</p>
      <p className="text-gray-400">{d.card_count.toLocaleString()} cards</p>
      <p className="text-violet-400 font-medium">€{d.total_value_eur.toFixed(2)}</p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface RarityBreakdownProps {
  data: RarityBucket[]
}

export default function RarityBreakdown({ data }: RarityBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-14 text-gray-500 text-sm">
        No data available.
      </div>
    )
  }

  const chartHeight = Math.max(data.length * 48 + 24, 80)

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
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
            tickFormatter={(v: number) => `€${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
          />
          <YAxis
            type="category"
            dataKey="rarity"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={100}
            tickFormatter={(v: string) => truncate(v, 14)}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar dataKey="total_value_eur" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getRarityColor(entry.rarity)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
