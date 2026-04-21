'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { CardSearchResult } from './types'

// Colour dot CSS classes — mirrors the set-page CardTile colour map
const VARIANT_COLOR_MAP: Record<string, string> = {
  green:  'bg-green-500',
  blue:   'bg-blue-500',
  purple: 'bg-purple-500',
  red:    'bg-red-500',
  pink:   'bg-pink-500',
  yellow: 'bg-yellow-500',
  gray:   'bg-gray-500',
  orange: 'bg-orange-500',
  teal:   'bg-teal-500',
}

// ── Type → hover-glow CSS class (same as CardGrid) ───────────────────────────

function getTypeGlowClass(type: string | null | undefined): string {
  if (!type) return 'card-type-colorless'
  const key = type.toLowerCase().replace(/\s+/g, '')
  const known = [
    'grass', 'fire', 'water', 'lightning', 'psychic', 'fighting',
    'darkness', 'metal', 'dragon', 'fairy', 'colorless', 'trainer',
  ]
  return known.includes(key) ? `card-type-${key}` : 'card-type-colorless'
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CardResultsProps {
  cards:       CardSearchResult[]
  query:       string
  /** When provided, renders "Cards by {artistName}" header */
  artistName?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CardResults({ cards, query, artistName }: CardResultsProps) {

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (cards.length === 0) {
    return (
      <div className="max-w-screen-2xl mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg text-secondary mb-2">
          No cards found for &ldquo;{artistName ?? query}&rdquo;
        </p>
        <p className="text-sm text-muted mb-6">Try a different name, or check the spelling</p>
        <div className="flex flex-wrap justify-center gap-2">
          {['Pikachu', 'Charizard', 'Mewtwo', 'Eevee', 'Rayquaza'].map(s => (
            <Link
              key={s}
              href={`/browse?q=${encodeURIComponent(s)}`}
              className="px-3 py-1.5 rounded-full bg-elevated border border-subtle text-sm text-secondary hover:text-accent hover:border-accent/30 transition-all"
            >
              {s}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  const setCount = new Set(cards.map(c => c.set.id).filter(Boolean)).size

  // ── Results ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6">

      {/* Header */}
      <div className="mb-6">
        <h2
          className="text-xl font-bold text-primary"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {artistName
            ? <>Cards by <span className="text-accent">{artistName}</span></>
            : <>Results for <span className="text-accent">&ldquo;{query}&rdquo;</span></>
          }
        </h2>
        <p className="text-sm text-muted mt-1">
          {cards.length} card{cards.length !== 1 ? 's' : ''}{' '}
          across {setCount} set{setCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Flat card grid — ~220px cards matching the set detail pages.
          Fewer columns = larger cards = same visual weight as set page. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
        {cards.map(card => (
          <div key={card.id} className="group flex flex-col cursor-pointer">
            {/*
             * Image container: uses the same card-type-* CSS class as CardGrid.
             * On hover the CSS rule changes border-color and adds a coloured box-shadow
             * matching the card's Pokémon type — exactly as on the set detail page.
             */}
            {/* aspect-[5/7] = 2.5:3.5 — the exact Pokémon card image ratio */}
            <Link href={`/set/${encodeURIComponent(card.set.id)}?card=${card.id}`} className="block">
              <div
                className={cn(
                  'relative w-full aspect-[5/7] rounded-lg overflow-hidden border border-subtle',
                  'transition-all duration-200',
                  getTypeGlowClass(card.type),
                )}
              >
                {card.image_url ? (
                  <img
                    src={card.image_url}
                    alt={card.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = '/pokemon_card_backside.png'
                    }}
                  />
                ) : (
                  <img
                    src="/pokemon_card_backside.png"
                    alt={card.name}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                )}
              </div>
            </Link>

            {/* Variant colour dots — same visual language as the set-page CardTile.
                Shown only when the card has explicit variant overrides configured.
                Display-only: clicking anywhere on the tile navigates to the card modal. */}
            {card.variants.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap px-0.5">
                {card.variants
                  .filter(v => v.card_id == null) // global variants only (card-specific use +N badge)
                  .map(v => (
                    <div
                      key={v.id}
                      title={v.name}
                      className={cn(
                        'w-3 h-3 rounded-full shrink-0',
                        VARIANT_COLOR_MAP[v.color] ?? 'bg-zinc-500',
                      )}
                    />
                  ))
                }
              </div>
            )}

            {/* Card info below the image */}
            <div className="mt-1.5 px-0.5 space-y-0.5 min-w-0">
              <Link href={`/set/${encodeURIComponent(card.set.id)}?card=${card.id}`}>
                <p className="text-xs font-medium text-primary truncate leading-tight hover:text-accent transition-colors">
                  {card.name}
                </p>
              </Link>

              {/* Set name with tiny logo — links to the set page */}
              <Link
                href={`/set/${encodeURIComponent(card.set.id)}`}
                className="text-xs text-muted truncate leading-tight flex items-center gap-1 hover:text-accent transition-colors"
              >
                {card.set.logo_url && (
                  <img
                    src={card.set.logo_url}
                    alt=""
                    className="h-3 w-auto object-contain shrink-0 inline-block"
                    loading="lazy"
                  />
                )}
                <span className="truncate">{card.set.name}</span>
              </Link>

              {/* Card number */}
              {card.number && (
                <p className="text-xs text-muted leading-tight">#{card.number}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
