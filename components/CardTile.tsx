'use client'

import { memo } from 'react'
import Link from 'next/link'
import { PokemonCard, QuickAddVariant } from '@/types'
import { getCardBack } from '@/lib/games'

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
  card:        PokemonCard
  /** Variant dot buttons rendered below the card image — one per official variant.
   *  `is_quick_add` on a variant controls which one is added on double-click;
   *  all items in this array are shown as colour-coded buttons regardless. */
  variantDots: QuickAddVariant[]
  isOwned:            boolean
  customVariantCount: number
  greyOutUnowned:     boolean
  /** Game slug used to select the correct card-back fallback image. Defaults to 'pokemon'. */
  game?:              string
  /** When true (masterset/grandmasterset goal), renders a diagonal grey overlay
   *  over the bottom-right half of the card to show partial variant ownership. */
  isPartiallyOwned?:  boolean
  // Stable callbacks — wrapped in useCallback + ref in CardGrid so React.memo works
  onCardBadgeClick:         (card: PokemonCard) => void
  onCardImageClick:         (card: PokemonCard) => void
  onCardImageDblClick:      (e: React.MouseEvent, card: PokemonCard) => void
  onCardContextMenu:        (card: PokemonCard) => void
  onVariantClick:           (e: React.MouseEvent, cardId: string, variantId: string) => void
  onVariantContextMenu:     (e: React.MouseEvent, cardId: string, variantId: string) => void
  onVariantGrayClick:       (card: PokemonCard) => void
  /** Mobile: tap the ⊕ button to open the variant bottom sheet */
  onMobileVariantOpen?:     () => void
}

// ── Inner component ─────────────────────────────────────────────────────────
function CardTileInner({
  card,
  variantDots,
  isOwned,
  customVariantCount,
  greyOutUnowned,
  isPartiallyOwned = false,
  game = 'pokemon',
  onCardBadgeClick,
  onCardImageClick,
  onCardImageDblClick,
  onCardContextMenu,
  onVariantClick,
  onVariantContextMenu,
  onVariantGrayClick,
  onMobileVariantOpen,
}: CardTileProps) {
  const cardBackUrl = getCardBack(game)
  // Show as dot if: globally-scoped (card_id == null) OR explicitly configured by admin
  // via the ⚙️ Variant Dot Display panel (is_configured_as_dot === true).
  // Card-specific variants that were NOT explicitly configured remain hidden here;
  // the +N badge on the card tile handles them instead.
  const buttonsToRender = variantDots.filter(v => v.card_id == null || v.is_configured_as_dot === true)

  const typeGlowClass   = getTypeGlowClass(card.type)
  // Full grayscale for fully unowned cards only — partially owned cards skip this
  // and instead get the diagonal overlay (rendered below the image).
  const shouldGrey      = greyOutUnowned && !isOwned && !isPartiallyOwned

  return (
    <div
      id={`card-${card.id}`}
      className="group relative cursor-pointer flex flex-col w-full"
    >
      {/* +N badge — overlaps top-right corner */}
      {customVariantCount > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onCardBadgeClick(card) }}
          title={`${customVariantCount} card-specific variant${customVariantCount > 1 ? 's' : ''} — open to manage`}
          className="pill absolute -top-2.5 right-1.5 z-20 flex items-center justify-center bg-accent text-white text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full shadow-lg ring-1 ring-white/20 transition-all duration-200 hover:scale-110 hover:brightness-110 whitespace-nowrap"
        >
          +{customVariantCount} variant{customVariantCount > 1 ? 's' : ''}
        </button>
      )}

      {/* ── Image area ── */}
      <div
        className={`relative w-full aspect-[5/7] rounded-lg overflow-hidden border transition-all duration-200 cursor-pointer ${typeGlowClass} ${
          isOwned ? 'border-accent shadow-lg glow-accent-sm' : 'border-subtle'
        }`}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
        onClick={() => onCardImageClick(card)}
        onDoubleClick={(e) => onCardImageDblClick(e, card)}
        onContextMenu={(e) => { e.preventDefault(); onCardContextMenu(card) }}
      >
        <img
          src={card.image_url ?? card.image ?? cardBackUrl}
          alt={card.name ?? ''}
          className={`w-full h-full object-cover transition-all duration-300 pointer-events-none ${
            shouldGrey ? 'grayscale opacity-40' : ''
          }`}
          loading="lazy"
          onError={(e) => {
            const img = e.target as HTMLImageElement
            if (img.src !== cardBackUrl) img.src = cardBackUrl
          }}
        />
        {/* Diagonal partial-ownership overlay — shown in masterset/grandmasterset
            mode when some but not all required variants are owned. A 135° hard-
            stop gradient covers the bottom-right triangle of the card.
            Respects the user's grey_out_unowned setting — no overlay if disabled. */}
        {isPartiallyOwned && greyOutUnowned && (
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.65) 50%)',
            }}
          />
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 z-10" />

        {/* ── Mobile variant picker button ─────────────────────────────────
            Tapping this opens the variant bottom sheet in CardGrid.
            Hidden on desktop (md:hidden) — only visible on touch/mobile.   */}
        {onMobileVariantOpen && (
          <button
            onClick={(e) => { e.stopPropagation(); onMobileVariantOpen() }}
            aria-label="Pick variant to add"
            className="absolute bottom-1 right-1 z-20 w-8 h-8 rounded-full bg-indigo-600/90 text-white text-lg font-bold flex items-center justify-center shadow-lg leading-none md:hidden"
          >
            +
          </button>
        )}
      </div>

      {/* ── Variant dots row — always rendered so text aligns consistently ── */}
      <div
        className="w-full flex gap-1 flex-wrap justify-center px-2 pt-1.5 min-h-[28px]"
      >
        {buttonsToRender.map(variant => (
          <button
            key={variant.id}
            onClick={(e) => {
              e.stopPropagation()
              if (variant.color === 'gray') {
                onVariantGrayClick(card)
              } else {
                onVariantClick(e, card.id, variant.id)
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (variant.color === 'gray') {
                onVariantGrayClick(card)
              } else {
                onVariantContextMenu(e, card.id, variant.id)
              }
            }}
            title={`${variant.name} (${variant.quantity})`}
            className={`
              w-6 h-6 rounded flex items-center justify-center
              text-xs font-bold border border-black/30 shadow-sm
              ${COLOR_MAP[variant.color as keyof typeof COLOR_MAP] || 'bg-zinc-500'}
              ${variant.quantity > 0 ? '!text-black' : 'text-transparent'}
              hover:scale-110 transition-transform cursor-pointer
            `}
          >
            {variant.quantity > 0 ? variant.quantity : ''}
          </button>
        ))}
      </div>

      {/* ── Card info below variant dots ── */}
      <div className="w-full flex flex-col gap-0.5 px-1 pt-1 pb-1">
        {/* Row 1: Card name */}
        <p className="text-sm font-semibold text-primary truncate leading-tight">
          {card.name}
        </p>
        {/* Row 2: Card number */}
        <div className="flex items-center">
          <span className="text-xs font-medium text-secondary tabular-nums">#{card.number}</span>
        </div>
        {/* Row 4: Set name (browse/search only — cards from multiple sets) */}
        {card.set_name && (
          <Link
            href={`/set/${encodeURIComponent(card.set_id)}`}
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
 * Because `variantDots` is the SAME array reference for cards that were not
 * clicked (the cardVariantDots Map reuses existing arrays via `new Map(prev)`),
 * and because the callback props are stabilised with `useCallback` + refs in
 * CardGrid, most tiles will be skipped on every variant click — only the
 * specific clicked card re-renders.
 */
export const CardTile = memo(CardTileInner)
