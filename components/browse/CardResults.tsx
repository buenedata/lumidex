'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { CardSearchResult } from './types'

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
          <Link
            key={card.id}
            href={`/set/${card.set.id}?card=${card.id}`}
            className="group flex flex-col cursor-pointer"
          >
            {/*
             * Image container: uses the same card-type-* CSS class as CardGrid.
             * On hover the CSS rule changes border-color and adds a coloured box-shadow
             * matching the card's Pokémon type — exactly as on the set detail page.
             */}
            <div
              className={cn(
                'relative w-full aspect-[2/3] rounded-lg overflow-hidden border border-subtle',
                'transition-all duration-200',
                getTypeGlowClass(card.type),
              )}
            >
              {card.image_url ? (
                <img
                  src={card.image_url}
                  alt={card.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-muted">
                  🎴
                </div>
              )}
            </div>

            {/* Card info below the image */}
            <div className="mt-1.5 px-0.5 space-y-0.5 min-w-0">
              <p className="text-xs font-medium text-primary truncate leading-tight">
                {card.name}
              </p>

              {/* Set name with tiny logo */}
              <p className="text-xs text-muted truncate leading-tight flex items-center gap-1">
                {card.set.logo_url && (
                  <img
                    src={card.set.logo_url}
                    alt=""
                    className="h-3 w-auto object-contain shrink-0 inline-block"
                    loading="lazy"
                  />
                )}
                <span className="truncate">{card.set.name}</span>
              </p>

              {/* Card number */}
              {card.number && (
                <p className="text-xs text-muted leading-tight">#{card.number}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
