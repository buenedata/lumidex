'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Exported type ─────────────────────────────────────────────────────────────
// Also imported by CardImageUploadModal — keep fields in sync.

export interface CardGridItem {
  id: string
  set_id: string
  name: string
  number: string
  rarity: string
  /**
   * The card's own uploaded image URL stored in cards.image.
   * null when no image has ever been uploaded for this specific card row.
   */
  image: string | null
  /**
   * Inherited image from source_card_id (Prize Pack / reprint link).
   * null when an own image exists or there is no source link.
   */
  source_image: string | null
  source_card_id: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  setId: string
  onCardSelect: (card: CardGridItem) => void
  onCardsLoaded?: (cards: CardGridItem[]) => void
  selectedCardId?: string | null
  refreshKey?: number
  /**
   * Map of cardId → cache-busted image URL supplied by the parent immediately
   * after a successful upload.  Overrides the stable DB URL so the admin sees
   * the new image straight away, even though the CDN may still serve the old
   * cached file at the stable URL.
   */
  imageOverrides?: Record<string, string>
}

export function CardImageGrid({
  setId,
  onCardSelect,
  onCardsLoaded,
  selectedCardId,
  refreshKey = 0,
  imageOverrides = {},
}: Props) {
  const [cards, setCards]               = useState<CardGridItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  // Uses the admin-only uncached endpoint so freshly-uploaded R2 images are
  // visible immediately instead of waiting for the 60 s unstable_cache TTL.
  const fetchCards = useCallback(async () => {
    if (!setId) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/admin/cards/${encodeURIComponent(setId)}?t=${Date.now()}`,
        { cache: 'no-store' },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Fetch failed (${res.status})`)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = await res.json()

      const sorted: CardGridItem[] = raw
        .map((c) => ({
          id:             c.id,
          set_id:         c.set_id,
          name:           c.name   ?? 'Unknown',
          number:         c.number ?? '',
          rarity:         c.rarity ?? '',
          image:          c.own_image     ?? null,
          source_image:   c.source_image  ?? null,
          source_card_id: c.source_card_id ?? null,
        }))
        .sort((a, b) => {
          const na = parseInt(a.number.split('/')[0], 10)
          const nb = parseInt(b.number.split('/')[0], 10)
          if (!isNaN(na) && !isNaN(nb)) return na - nb
          return a.number.localeCompare(b.number)
        })

      setCards(sorted)
      onCardsLoaded?.(sorted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cards')
    } finally {
      setLoading(false)
    }
  }, [setId, onCardsLoaded])

  useEffect(() => {
    setInternalSelectedId(null)
    fetchCards()
  // refreshKey intentionally triggers a re-fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, refreshKey])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const withOwnImage    = cards.filter((c) => !!c.image).length
  const withSourceImage = cards.filter((c) => !c.image && !!c.source_image).length
  const withImage       = withOwnImage + withSourceImage
  const total           = cards.length
  const progressPct     = total > 0 ? Math.round((withImage / total) * 100) : 0

  // Prefer externally-controlled selection; fall back to internal click tracking
  const selectedId = selectedCardId !== undefined ? selectedCardId : internalSelectedId

  const handleSelect = (card: CardGridItem) => {
    setInternalSelectedId(card.id)
    onCardSelect(card)
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) return <p className="text-red-400 text-sm">⚠️ {error}</p>

  if (cards.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-4 text-center">
        No cards found for set <code className="text-yellow-400">{setId}</code>.{' '}
        Check that the set ID matches cards in the database.
      </p>
    )
  }

  return (
    <div className="space-y-3">

      {/* ── Summary bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          <span className="text-green-400 font-semibold">{withOwnImage}</span>
          {withSourceImage > 0 && (
            <span className="text-teal-400 font-semibold"> +{withSourceImage}🔗</span>
          )}
          {' / '}
          <span className="text-white font-semibold">{total}</span>
          {' '}cards have images
        </span>
        {total > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-32 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-gray-500 text-xs">{progressPct}%</span>
          </div>
        )}
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-4 rounded bg-gray-700 border border-gray-600" />
          No image
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-4 rounded bg-green-900/50 border border-green-700" />
          Own image
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-4 rounded bg-teal-900/50 border border-teal-700" />
          Inherited 🔗
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-4 rounded bg-yellow-600/20 border border-yellow-500" />
          Selected
        </span>
      </div>

      {/* ── Card grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
        {cards.map((card) => {
          // Prefer the cache-busted URL injected by the parent on a fresh upload
          // so the new image is visible immediately even if the CDN still serves
          // the old cached file at the stable R2 URL.
          const overrideUrl    = imageOverrides[card.id] ?? null
          const hasOwnImage    = !!(overrideUrl ?? card.image)
          const hasSourceImage = !hasOwnImage && !!card.source_image
          const displayImage   = overrideUrl ?? card.image ?? card.source_image ?? null
          const isSelected     = card.id === selectedId

          const titleSuffix = hasOwnImage
            ? ' ✅ own image'
            : hasSourceImage
            ? ' 🔗 inherited image'
            : ' — no image'

          return (
            <button
              key={card.id}
              onClick={() => handleSelect(card)}
              title={`${card.name} #${card.number}${titleSuffix}`}
              className={`
                relative aspect-[2/3] rounded overflow-hidden transition-all duration-150
                focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400
                ${isSelected
                  ? 'ring-2 ring-yellow-400 scale-105 z-10'
                  : 'hover:ring-2 hover:ring-yellow-400/60 hover:scale-105 hover:z-10'}
              `}
            >
              {displayImage ? (
                /* Card thumbnail — own or inherited */
                <img
                  src={displayImage}
                  alt={card.name}
                  className={`w-full h-full object-cover ${hasSourceImage ? 'opacity-80' : ''}`}
                  loading="lazy"
                  onError={(e) => {
                    // Broken R2 URL — swap to grey placeholder without leaving a
                    // cracked-image icon.  A grey tile still shows the card number.
                    const img = e.currentTarget
                    img.style.display = 'none'
                    const el = img.parentElement
                    if (el) {
                      el.classList.add('bg-gray-800', 'border', 'border-red-800/50')
                      const span = document.createElement('span')
                      span.className = 'text-red-700 text-[9px] font-mono absolute bottom-0.5 left-0 right-0 text-center'
                      span.textContent = `#${card.number}`
                      el.appendChild(span)
                    }
                  }}
                />
              ) : (
                /* Grey placeholder */
                <div className="w-full h-full bg-gray-800 border border-gray-700 flex flex-col items-center justify-center">
                  <span className="text-gray-600 text-[9px] font-mono leading-none">
                    #{card.number}
                  </span>
                </div>
              )}

              {/* Own-image green dot */}
              {hasOwnImage && !isSelected && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-400 shadow" />
              )}
              {/* Inherited-image chain icon */}
              {hasSourceImage && !isSelected && (
                <span className="absolute top-0.5 right-0.5 text-[8px] leading-none">🔗</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
