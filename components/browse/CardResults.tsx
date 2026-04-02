'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { CardSearchResult } from './types'

// ── Rarity badge colour helper ────────────────────────────────────────────────

function rarityBadge(rarity: string): string {
  const r = rarity.toLowerCase()
  if (r.includes('hyper') || r.includes('secret'))   return 'bg-yellow-400/15 text-yellow-300'
  if (r.includes('special illustration'))             return 'bg-orange-400/15  text-orange-200'
  if (r.includes('illustration'))                     return 'bg-orange-400/15  text-orange-300'
  if (r.includes('ace spec'))                         return 'bg-red-400/15     text-red-300'
  if (r.includes('ultra') || r.includes('amazing'))  return 'bg-indigo-400/15  text-indigo-300'
  if (r.includes('double') || r.includes('holo'))    return 'bg-purple-400/15  text-purple-300'
  if (r.includes('promo'))                            return 'bg-pink-400/15    text-pink-300'
  if (r.includes('rare'))                             return 'bg-blue-400/15    text-blue-300'
  if (r.includes('uncommon'))                         return 'bg-green-400/15   text-green-300'
  return 'bg-surface text-muted'
}

function shortRarity(rarity: string): string {
  if (rarity.length <= 12) return rarity
  const map: Record<string, string> = {
    'Special Illustration Rare': 'SIR',
    'Illustration Rare':         'IR',
    'ACE SPEC Rare':             'ACE SPEC',
    'Hyper Rare':                'Hyper',
    'Double Rare':               'Double R',
    'Radiant Rare':              'Radiant',
    'Amazing Rare':              'Amazing',
  }
  return map[rarity] ?? rarity.slice(0, 10) + '…'
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SetGroup {
  set:   CardSearchResult['set']
  cards: CardSearchResult[]
}

interface CardResultsProps {
  cards:       CardSearchResult[]
  query:       string
  /** When provided, renders "Cards by {artistName}" header instead of query header */
  artistName?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CardResults({ cards, query, artistName }: CardResultsProps) {
  // Group by set, sorted newest first
  const groups = useMemo<SetGroup[]>(() => {
    const map = new Map<string, SetGroup>()
    for (const card of cards) {
      const key = card.set.id || '__unknown__'
      if (!map.has(key)) map.set(key, { set: card.set, cards: [] })
      map.get(key)!.cards.push(card)
    }
    return Array.from(map.values()).sort((a, b) =>
      (b.set.release_date || '').localeCompare(a.set.release_date || '')
    )
  }, [cards])

  const setCount = groups.length

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

      {/* Set groups */}
      <div className="space-y-10">
        {groups.map(group => (
          <section key={group.set.id}>

            {/* Set header row */}
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-subtle">
              {group.set.logo_url
                ? <img src={group.set.logo_url} alt={group.set.name} className="h-6 w-auto object-contain shrink-0" loading="lazy" />
                : <span className="text-base shrink-0">🃏</span>
              }
              <div className="flex-1 min-w-0">
                <Link
                  href={`/set/${group.set.id}`}
                  className="text-sm font-semibold text-primary hover:text-accent transition-colors"
                >
                  {group.set.name}
                </Link>
                {group.set.series && (
                  <span className="text-xs text-muted ml-2">{group.set.series}</span>
                )}
              </div>
              <span className="text-xs text-muted shrink-0">
                {group.cards.length} card{group.cards.length !== 1 ? 's' : ''}
              </span>
              <Link
                href={`/set/${group.set.id}`}
                className="text-xs text-accent hover:underline shrink-0"
              >
                View set →
              </Link>
            </div>

            {/* Card grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 gap-3">
              {group.cards.map(card => (
                <Link
                  key={card.id}
                  href={`/set/${card.set.id}?card=${card.id}`}
                  className="group flex flex-col items-center"
                >
                  {/* Card image */}
                  <div className="w-full aspect-[2/3] overflow-hidden rounded-lg bg-surface border border-subtle group-hover:border-accent/40 transition-all shadow-sm group-hover:shadow-md group-hover:shadow-accent/10 group-hover:-translate-y-0.5">
                    {card.image_url
                      ? <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center text-xl text-muted">🃏</div>
                    }
                  </div>

                  {/* Card info */}
                  <div className="w-full mt-1.5 space-y-0.5 px-0.5">
                    <p className="text-xs font-medium text-primary truncate leading-tight">
                      {card.name}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {card.number && (
                        <span className="text-xs text-muted">#{card.number}</span>
                      )}
                      {card.rarity && (
                        <span className={cn(
                          'text-xs px-1 py-px rounded font-medium leading-none',
                          rarityBadge(card.rarity),
                        )}>
                          {shortRarity(card.rarity)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
