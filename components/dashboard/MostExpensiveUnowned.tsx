'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/dashboard/MostExpensiveUnowned.tsx
//
// Dashboard card that shows the single most expensive Pokémon card the
// authenticated user does NOT currently own, sourced from
// GET /api/dashboard/most-expensive-unowned.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { fmtCardPrice } from '@/lib/currency'

interface UnownedCard {
  id: string
  name: string | null
  set_name: string | null
  image: string | null
  price_eur: number
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="bg-elevated border border-subtle rounded-xl overflow-hidden">
      <div className="flex gap-0 animate-pulse">
        {/* Image placeholder */}
        <div className="shrink-0 w-28 sm:w-36 bg-surface min-h-[152px]" />
        {/* Text placeholders */}
        <div className="flex-1 p-5 flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 bg-surface rounded w-28" />
            <div className="h-5 bg-surface rounded w-3/4" />
            <div className="h-4 bg-surface rounded w-1/2" />
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="h-3 bg-surface rounded w-16" />
              <div className="h-7 bg-surface rounded w-24" />
            </div>
            <div className="h-9 bg-surface rounded-lg w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="bg-elevated border border-subtle rounded-xl px-6 py-8 flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-price/10 border border-price/20 flex items-center justify-center text-xl">
        🎉
      </div>
      <div>
        <h3
          className="text-base font-semibold text-primary mb-1"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          You own all the valuable cards!
        </h3>
        <p className="text-sm text-secondary max-w-xs mx-auto leading-relaxed">
          No priced cards were found outside your collection.
        </p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MostExpensiveUnowned() {
  const { user, profile } = useAuthStore()
  const currency: string = (profile as Record<string, unknown> | null)?.preferred_currency as string ?? 'USD'

  // undefined = loading; null = loaded but no card; UnownedCard = data
  const [card, setCard] = useState<UnownedCard | null | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    fetch('/api/dashboard/most-expensive-unowned')
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json() as Promise<{ card: UnownedCard | null }>
      })
      .then((data) => {
        if (!cancelled) setCard(data.card ?? null)
      })
      .catch(() => {
        if (!cancelled) setCard(null)
      })

    return () => { cancelled = true }
  }, [user])

  return (
    <section className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>💎</span>
          <h2
            className="text-lg font-semibold text-primary"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Most Expensive Card You Don't Own
          </h2>
        </div>
      </div>

      {/* Loading */}
      {card === undefined && <LoadingSkeleton />}

      {/* No card found */}
      {card === null && <EmptyState />}

      {/* Card found */}
      {card != null && (
        <div className="bg-elevated border border-subtle rounded-xl overflow-hidden hover:border-accent/40 transition-colors duration-150">
          <div className="flex">
            {/* Card image */}
            <div className="shrink-0 w-28 sm:w-36 bg-surface self-stretch flex items-center justify-center">
              {card.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.image}
                  alt={card.name ?? 'Card'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-muted text-4xl select-none">?</span>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 p-5 flex flex-col justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">
                  Not in your collection
                </p>
                <h3
                  className="text-xl font-bold text-primary leading-tight mb-1"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {card.name ?? 'Unknown Card'}
                </h3>
                {card.set_name && (
                  <p className="text-sm text-secondary leading-tight">{card.set_name}</p>
                )}
              </div>

              <div className="flex items-end justify-between gap-4 flex-wrap">
                {/* Price */}
                <div>
                  <p className="text-[11px] text-muted uppercase tracking-wide mb-0.5">
                    Market Price
                  </p>
                  <p className="text-2xl font-bold text-price tabular-nums leading-none">
                    {fmtCardPrice({ eur: card.price_eur, usd: null }, currency) ?? '—'}
                  </p>
                </div>

                {/* CTA */}
                <Link
                  href={`/browse?q=${encodeURIComponent(card.name ?? '')}`}
                  className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-light transition-colors shadow-sm"
                >
                  Find it →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
