'use client'

import { memo } from 'react'
import Link from 'next/link'
import { PokemonCard, QuickAddVariant } from '@/types'
import { formatPrice } from '@/lib/pricing'

// ── Shared constants (mirrors CardGrid) ────────────────────────────────────
const COLOR_MAP = {
  green:  'bg-green-500',
  blue:   'bg-blue-500',
  purple: 'bg-purple-500',
  red:    'bg-red-500',
  pink:   'bg-pink-500',
  yellow: 'bg-yellow-500',
  gray:   'bg-gray-500',
  orange: 'bg-orange-500',
  teal:   'bg-teal-500',
} as const

function getTypeGlowClass(type: string | null | undefined): string {
  if (!type) return 'card-type-colorless'
  const key   = type.toLowerCase().replace(/\s+/g, '')
  const known = [
    'grass','fire','water','lightning','psychic','fighting',
    'darkness','metal','dragon','fairy','colorless','trainer',
  ]
  return known.includes(key) ? `card-type-${key}` : ''
}

// ── Props ──────────────────────────────────────────────────────────────────
export interface CardTileProps {
  card:               PokemonCard
  /** Per-card quick-add variants — only THIS card's array changes on click */
  quickVariants:      QuickAddVariant[]
  isOwned:            boolean
  customVariantCount: number
  greyOutUnowned:     boolean
  cardPricesUSD?:     Record<string, number>
  effectiveCurrency:  string
  // Stable callbacks — wrapped in useCallback + ref in CardGrid so React.memo works
  onCardBadgeClick:         (card: PokemonCard) => void
  onCardImageClick:         (card: PokemonCard) => void
  onCardImageDblClick:      (e: React.MouseEvent, card: PokemonCard) => void
  onCardContextMenu:        (card: PokemonCard) => void
  onVariantClick:           (e: React.MouseEvent, cardId: string, variantId: string) => void
  onVariantContextMenu:     (e: React.MouseEvent, cardId: string, variantId: string) => void
  onVariantGrayClick:       (card: PokemonCard) => void
}

// ── Inner component ─────────────────────────────────────────────────────────
function CardTileInner({
  card,
  quickVariants,
  isOwned,
  customVariantCount,
  greyOutUnowned,
  cardPricesUSD,
  effectiveCurrency,
  onCardBadgeClick,
  onCardImageClick,
  onCardImageDblClick,
  onCardContextMenu,
  onVariantClick,
  onVariantContextMenu,
  onVariantGrayClick,
}: CardTileProps) {
  const typeGlowClass   = getTypeGlowClass(card.type)
  const shouldGrey      = greyOutUnowned && !isOwned
  // Card-specific variants are never shown as dots — the +N badge handles them
  const buttonsToRender = quickVariants.filter(v => v.card_id == null)

  return (
    <div
      id={`card-${card.id}`}
      className="group relative cursor-pointer flex-shrink-0 flex flex-col"
      style={{ width: 220 }}
    >
      {/* +N badge — overlaps top-right corner */}
      {customVariantCount > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onCardBadgeClick(card) }}
          title={`${customVariantCount} card-specific variant${customVariantCount > 1 ? 's' : ''} — open to manage`}
          className="absolute -top-2.5 right-1.5 z-20 flex items-center justify-center bg-accent text-white text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full shadow-lg ring-1 ring-white/20 transition-all duration-200 hover:scale-110 hover:brightness-110 whitespace-nowrap"
        >
          +{customVariantCount} variant{customVariantCount > 1 ? 's' : ''}
        </button>
      )}

      {/* ── Image area ── */}
      <div
        className={`relative w-[220px] h-[308px] rounded-lg overflow-hidden border transition-all duration-200 cursor-pointer ${typeGlowClass} ${
          isOwned ? 'border-accent shadow-lg glow-accent-sm' : 'border-subtle'
        }`}
        onClick={() => onCardImageClick(card)}
        onDoubleClick={(e) => onCardImageDblClick(e, card)}
        onContextMenu={(e) => { e.preventDefault(); onCardContextMenu(card) }}
      >
        <img
          src={card.image_url ?? card.image ?? '/pokemon_card_backside.png'}
          alt={card.name ?? ''}
          className={`w-full h-full object-cover transition-all duration-300 pointer-events-none ${
            shouldGrey ? 'grayscale opacity-40' : ''
          }`}
          loading="lazy"
          onError={(e) => {
            const t = e.target as HTMLImageElement
            if (!t.src.endsWith('/pokemon_card_backside.png')) t.src = '/pokemon_card_backside.png'
          }}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 z-10" />
      </div>

      {/* ── Variant dots row — always rendered so text aligns consistently ── */}
      <div
        className="w-[220px] flex gap-1 flex-wrap justify-center px-2 pt-1.5 min-h-[28px]"
        onClick={e => e.stopPropagation()}
      >
        {buttonsToRender.map(variant => (
          <button
            key={variant.id}
            onClick={(e) => {
              e.stopPropagation()
              if (variant.color === 'gray' || variant.card_id != null) {
                onVariantGrayClick(card)
              } else {
                onVariantClick(e, card.id, variant.id)
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (variant.color === 'gray' || variant.card_id != null) {
                onVariantGrayClick(card)
              } else {
                onVariantContextMenu(e, card.id, variant.id)
              }
            }}
            title={`${variant.name} (${variant.quantity})`}
            className={`
              w-6 h-6 rounded flex items-center justify-center
              text-xs font-bold border border-black/30 shadow-sm
              ${variant.card_id != null ? 'bg-gray-500' : (COLOR_MAP[variant.color as keyof typeof COLOR_MAP] || 'bg-zinc-500')}
              ${variant.quantity > 0 ? '!text-black' : 'text-transparent'}
              hover:scale-110 transition-transform cursor-pointer
            `}
          >
            {variant.quantity > 0 ? variant.quantity : ''}
          </button>
        ))}
      </div>

      {/* ── Card info below variant dots ── */}
      <div className="w-[220px] flex flex-col gap-0.5 px-1 pt-1 pb-1">
        {/* Row 1: Card name */}
        <p className="text-sm font-semibold text-primary truncate leading-tight">
          {card.name}
        </p>
        {/* Row 2: Number · Price */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-secondary tabular-nums">#{card.number}</span>
          <span className="text-sm font-semibold text-price tabular-nums">
            {cardPricesUSD?.[card.id] != null
              ? formatPrice(cardPricesUSD[card.id], effectiveCurrency)
              : ''}
          </span>
        </div>
        {/* Row 3: Set name (browse/search only — cards from multiple sets) */}
        {card.set_name && (
          <Link
            href={`/set/${card.set_id}`}
            className="flex items-center gap-1 mt-0.5 hover:text-accent transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {card.set_logo_url && (
              <img
                src={card.set_logo_url}
                alt=""
                className="h-3 w-auto object-contain shrink-0"
              />
            )}
            <span className="text-xs text-muted truncate leading-tight">{card.set_name}</span>
          </Link>
        )}
      </div>
    </div>
  )
}

/**
 * React.memo wrapper with shallow-equality check.
 *
 * Because `quickVariants` is the SAME array reference for cards that were not
 * clicked (the cardQuickVariants Map reuses existing arrays via `new Map(prev)`),
 * and because the callback props are stabilised with `useCallback` + refs in
 * CardGrid, most tiles will be skipped on every variant click — only the
 * specific clicked card re-renders.
 */
export const CardTile = memo(CardTileInner)
