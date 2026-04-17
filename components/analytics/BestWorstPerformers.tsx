'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/analytics/BestWorstPerformers.tsx
//
// Two-column layout showing top gainers and biggest losers over the last 30d.
// ─────────────────────────────────────────────────────────────────────────────

import type { PerformerCard } from './types'

// ── Single row ────────────────────────────────────────────────────────────────

interface PerformerRowProps {
  card: PerformerCard
  isGainer: boolean
}

function PerformerRow({ card, isGainer }: PerformerRowProps) {
  const arrow      = isGainer ? '▲' : '▼'
  const pctColor   = isGainer ? 'text-green-400' : 'text-red-400'
  const borderAccent = isGainer
    ? 'border-green-800/40 hover:border-green-700/60'
    : 'border-red-800/40 hover:border-red-700/60'

  const pctText = (() => {
    const abs = Math.abs(card.price_change_pct)
    const sign = isGainer ? '+' : '-'
    return `${sign}${abs.toFixed(1)}%`
  })()

  return (
    <div
      className={`flex items-center gap-3 bg-gray-900 border ${borderAccent} rounded-lg px-3 py-2.5 transition-colors duration-150`}
    >
      {/* Card thumbnail */}
      <div className="w-9 h-12 shrink-0 rounded overflow-hidden bg-gray-700">
        {card.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image_url}
            alt={card.card_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
            ?
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate leading-tight">
          {card.card_name}
        </p>
        {card.variant_type && (
          <p className="text-[10px] text-gray-500 truncate mt-0.5">
            {card.variant_type}
          </p>
        )}
      </div>

      {/* % change */}
      <div className={`text-xs font-bold ${pctColor} shrink-0 tabular-nums`}>
        {arrow} {pctText}
      </div>
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

interface ColumnProps {
  title: string
  titleColor: string
  arrow: string
  cards: PerformerCard[]
  isGainer: boolean
}

function PerformerColumn({ title, titleColor, arrow, cards, isGainer }: ColumnProps) {
  return (
    <div>
      <h4 className={`text-sm font-semibold ${titleColor} mb-3 flex items-center gap-1.5`}>
        <span>{arrow}</span>
        <span>{title}</span>
      </h4>
      {cards.length === 0 ? (
        <div className="flex items-center justify-center py-8 bg-gray-900/50 border border-gray-700 rounded-lg">
          <p className="text-gray-500 text-sm">No data yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map(card => (
            <PerformerRow key={card.card_id} card={card} isGainer={isGainer} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface BestWorstPerformersProps {
  bestPerformers: PerformerCard[]
  worstPerformers: PerformerCard[]
}

export default function BestWorstPerformers({
  bestPerformers,
  worstPerformers,
}: BestWorstPerformersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <PerformerColumn
        title="Top Gainers"
        titleColor="text-green-400"
        arrow="▲"
        cards={bestPerformers}
        isGainer={true}
      />
      <PerformerColumn
        title="Biggest Drops"
        titleColor="text-red-400"
        arrow="▼"
        cards={worstPerformers}
        isGainer={false}
      />
    </div>
  )
}
