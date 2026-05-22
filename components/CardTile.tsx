'use client'

import { memo, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { PokemonCard, QuickAddVariant } from '@/types'
import { useItemPrice } from '@/hooks/useItemPrice'
import { fmtCardPrice } from '@/lib/currency'

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
  /** When true (masterset/grandmasterset goal), renders a diagonal grey overlay
   *  over the bottom-right half of the card to show partial variant ownership. */
  isPartiallyOwned?:  boolean
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
  /** Mobile long-press: add one copy of the quick-add variant */
  onTouchAdd?:              (card: PokemonCard) => void
  /** Mobile long-press: remove one copy of the quick-add variant */
  onTouchRemove?:           (card: PokemonCard) => void
}

// Long-press threshold in milliseconds
const LONG_PRESS_MS = 500
// Movement threshold in pixels — cancel long-press if the finger drifts this far
const MOVE_THRESHOLD_PX = 8

// ── Inner component ─────────────────────────────────────────────────────────
function CardTileInner({
  card,
  variantDots,
  isOwned,
  customVariantCount,
  greyOutUnowned,
  isPartiallyOwned = false,
  cardPricesUSD,
  effectiveCurrency,
  onCardBadgeClick,
  onCardImageClick,
  onCardImageDblClick,
  onCardContextMenu,
  onVariantClick,
  onVariantContextMenu,
  onVariantGrayClick,
  onTouchAdd,
  onTouchRemove,
}: CardTileProps) {
  // Fetch CardMarket EUR price via item_prices — only when tcggo_id is present.
  // The hook returns { price: null, loading: false } when itemId is null/undefined,
  // so cards without a tcggo_id never trigger a network request.
  const { price: cmPrice, loading: cmLoading } = useItemPrice(
    card.tcggo_id != null ? String(card.tcggo_id) : null,
    'single',
    'normal',
  )

  // ── Long-press touch state ────────────────────────────────────────────────
  const [showTouchMenu, setShowTouchMenu] = useState(false)
  const pressTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartXRef  = useRef(0)
  const touchStartYRef  = useRef(0)

  const cancelLongPress = useCallback(() => {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartXRef.current = touch.clientX
    touchStartYRef.current = touch.clientY
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null
      setShowTouchMenu(true)
    }, LONG_PRESS_MS)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (pressTimerRef.current === null) return
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartXRef.current)
    const dy = Math.abs(touch.clientY - touchStartYRef.current)
    if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) {
      cancelLongPress()
    }
  }, [cancelLongPress])

  const totalQuantity = variantDots.reduce((sum, v) => sum + v.quantity, 0)

  const typeGlowClass   = getTypeGlowClass(card.type)
  // Full grayscale for fully unowned cards only — partially owned cards skip this
  // and instead get the diagonal overlay (rendered below the image).
  const shouldGrey      = greyOutUnowned && !isOwned && !isPartiallyOwned
  // Show as dot if: globally-scoped (card_id == null) OR explicitly configured by admin
  // via the ⚙️ Variant Dot Display panel (is_configured_as_dot === true).
  // Card-specific variants that were NOT explicitly configured remain hidden here;
  // the +N badge on the card tile handles them instead.
  const buttonsToRender = variantDots.filter(v => v.card_id == null || v.is_configured_as_dot === true)

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
        onClick={() => onCardImageClick(card)}
        onDoubleClick={(e) => onCardImageDblClick(e, card)}
        onContextMenu={(e) => { e.preventDefault(); onCardContextMenu(card) }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
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
      </div>

      {/* ── Long-press touch action sheet overlay ─────────────────────────── */}
      {/* Shown on mobile when the user holds down on the card image for ≥ 500 ms.
          Presents +/− controls and the current total quantity.
          Desktop double-click / right-click behaviour is unchanged. */}
      {showTouchMenu && (
        <>
          {/* Fixed transparent backdrop — closes the sheet on outside tap */}
          <div
            className="fixed inset-0 z-30"
            onTouchEnd={(e) => { e.preventDefault(); setShowTouchMenu(false) }}
            onClick={() => setShowTouchMenu(false)}
            aria-hidden="true"
          />
          {/* Action sheet — absolutely positioned over this card tile */}
          <div
            className="absolute inset-x-0 top-0 z-40 w-full aspect-[5/7] rounded-lg flex flex-col items-center justify-center gap-3 bg-black/75"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Current total quantity */}
            <span className="text-3xl font-bold text-white tabular-nums leading-none">
              {totalQuantity}
            </span>

            {/* +/− row */}
            <div className="flex items-center gap-5">
              {/* Remove button — disabled at 0 */}
              <button
                onTouchEnd={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (onTouchRemove && totalQuantity > 0) {
                    onTouchRemove(card)
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (onTouchRemove && totalQuantity > 0) {
                    onTouchRemove(card)
                  }
                }}
                disabled={totalQuantity === 0}
                aria-label="Remove one from collection"
                className="w-14 h-14 rounded-full bg-white/20 active:bg-white/40 disabled:opacity-30 flex items-center justify-center text-white text-3xl font-bold transition-colors select-none"
              >
                −
              </button>

              {/* Add button */}
              <button
                onTouchEnd={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (onTouchAdd) onTouchAdd(card)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (onTouchAdd) onTouchAdd(card)
                }}
                aria-label="Add one to collection"
                className="w-14 h-14 rounded-full bg-white/20 active:bg-white/40 flex items-center justify-center text-white text-3xl font-bold transition-colors select-none"
              >
                +
              </button>
            </div>

            {/* Dismiss hint */}
            <p className="text-white/50 text-xs select-none">Tap outside to close</p>
          </div>
        </>
      )}

      {/* ── Variant dots row — always rendered so text aligns consistently ── */}
      <div
        className="w-full flex gap-1 flex-wrap justify-center px-2 pt-1.5 min-h-[28px]"
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
        {/* Row 2: Price badge — prominent, shown for any card with a tcggo_id.
            Displays '...' while loading, formatted price on success, '—' when unavailable.
            Uses the user's preferred currency via effectiveCurrency prop. */}
        {card.tcggo_id != null && (
          <div className="flex items-center mt-0.5">
            <span className="text-sm font-bold tabular-nums bg-green-900/40 text-green-300 border border-green-500/30 rounded-md px-2 py-0.5 leading-tight">
              {cmLoading
                ? '...'
                : cmPrice !== null
                  ? (fmtCardPrice({ eur: cmPrice, usd: null }, effectiveCurrency) ?? '—')
                  : '—'}
            </span>
          </div>
        )}
        {/* Row 3: Card number */}
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
