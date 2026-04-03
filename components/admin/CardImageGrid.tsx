'use client'

import { useState, useEffect } from 'react'

export interface CardGridItem {
  id: string
  set_id: string
  name: string
  number: string
  rarity: string
  /** Own uploaded image — null if this card has never had an image uploaded directly. */
  image: string | null
  /** Image inherited from source_card_id (Prize Pack / reprint link). null when own image exists or no source set. */
  source_image: string | null
  /** FK to the original card row this reprint is linked to. */
  source_card_id: string | null
  image_url: string
}

interface Props {
  setId: string
  onCardSelect: (card: CardGridItem) => void
  onCardsLoaded?: (cards: CardGridItem[]) => void
  selectedCardId?: string | null
  refreshKey?: number
}

export function CardImageGrid({ setId, onCardSelect, onCardsLoaded, selectedCardId, refreshKey = 0 }: Props) {
  const [cards, setCards] = useState<CardGridItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!setId) return

    setLoading(true)
    setError(null)
    setInternalSelectedId(null)

    async function fetchCards() {
      try {
        const res = await fetch(`/api/cards/${encodeURIComponent(setId)}?_t=${refreshKey}`)
        if (!res.ok) throw new Error(`Failed to fetch cards: ${res.status}`)
        const data: CardGridItem[] = await res.json()
        const sorted = [...data].sort((a, b) => {
          const numA = parseInt(a.number.split('/')[0], 10)
          const numB = parseInt(b.number.split('/')[0], 10)
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB
          return a.number.localeCompare(b.number)
        })
        setCards(sorted)
        onCardsLoaded?.(sorted)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cards')
      } finally {
        setLoading(false)
      }
    }

    fetchCards()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, refreshKey])

  if (loading) {
    return (
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[2/3] rounded bg-gray-800 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-red-400 text-sm">⚠️ {error}</p>
  }

  if (cards.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-4 text-center">
        No cards found for set <code className="text-yellow-400">{setId}</code>. Check that the set ID matches cards in the database.
      </p>
    )
  }

  const withOwnImage    = cards.filter((c) => !!c.image).length
  const withSourceImage = cards.filter((c) => !c.image && !!c.source_image).length
  const withImage       = withOwnImage + withSourceImage
  const total           = cards.length

  // Prefer externally-controlled selection; fall back to internal click tracking
  const selectedId = selectedCardId !== undefined ? selectedCardId : internalSelectedId

  const handleSelect = (card: CardGridItem) => {
    setInternalSelectedId(card.id)
    onCardSelect(card)
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
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
                style={{ width: `${(withImage / total) * 100}%` }}
              />
            </div>
            <span className="text-gray-500 text-xs">
              {Math.round((withImage / total) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
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

      {/* Card grid */}
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
        {cards.map((card) => {
          const hasOwnImage    = !!card.image
          const hasSourceImage = !card.image && !!card.source_image
          const displayImage   = card.image ?? card.source_image
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
                /* Thumbnail — own or inherited */
                <img
                  src={displayImage}
                  alt={card.name}
                  className={`w-full h-full object-cover ${hasSourceImage ? 'opacity-80' : ''}`}
                  loading="lazy"
                />
              ) : (
                /* Grey placeholder */
                <div className="w-full h-full bg-gray-800 border border-gray-700 flex flex-col items-center justify-center gap-0.5">
                  <span className="text-gray-600 text-[9px] font-mono leading-none">
                    #{card.number}
                  </span>
                </div>
              )}

              {/* Green dot = own image; teal chain = inherited */}
              {hasOwnImage && !isSelected && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-400 shadow" />
              )}
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
