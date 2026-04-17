'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/analytics/TopValuableCards.tsx
//
// Ranked list of the user's top 10 most valuable owned cards.
// ─────────────────────────────────────────────────────────────────────────────

import type { TopCard } from './types'
import { fmtCardPrice } from '@/lib/currency'

interface TopValuableCardsProps {
  cards: TopCard[]
  currency: string
}

export default function TopValuableCards({ cards, currency }: TopValuableCardsProps) {
  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center py-14 text-gray-500 text-sm">
        No cards with price data yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {cards.map((card, index) => (
        <div
          key={card.card_id}
          className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 hover:border-gray-600 transition-colors duration-150"
        >
          {/* Rank number */}
          <span className="text-xs font-bold text-gray-500 w-5 text-center shrink-0 tabular-nums">
            {index + 1}
          </span>

          {/* Card thumbnail */}
          <div className="w-10 h-14 shrink-0 rounded-md overflow-hidden bg-gray-700 flex-shrink-0">
            {card.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.image_url}
                alt={card.card_name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                ?
              </div>
            )}
          </div>

          {/* Card details */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {card.card_name}
            </p>
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {card.set_name}
            </p>
            {card.variant_type && (
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-700/80 text-gray-300 border border-gray-600/50">
                {card.variant_type}
              </span>
            )}
          </div>

          {/* Value */}
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-violet-400 tabular-nums">
              {fmtCardPrice({ eur: card.value_eur, usd: null }, currency) ?? '—'}
            </p>
            {card.quantity > 1 && (
              <p className="text-[10px] text-gray-500 mt-0.5">
                ×{card.quantity}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
