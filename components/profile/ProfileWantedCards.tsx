'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface WantedCard {
  id: string
  name: string | null
  image: string | null
  set_id: string | null
  set_name: string | null
  number: string | null
}

interface ProfileWantedCardsProps {
  userId: string
  isOwnProfile: boolean
  displayName: string
}

export default function ProfileWantedCards({ userId, isOwnProfile, displayName }: ProfileWantedCardsProps) {
  const [cards, setCards]     = useState<WantedCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Track which cards are being un-starred (for button feedback)
  const [removing, setRemoving] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    setError(null)

    const url = isOwnProfile
      ? '/api/wanted-cards/cards'
      : `/api/wanted-cards/public/${userId}`

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(data => setCards(data.cards ?? []))
      .catch(() => setError('Could not load wanted cards.'))
      .finally(() => setLoading(false))
  }, [userId, isOwnProfile])

  async function handleUnstar(cardId: string) {
    // Optimistic removal
    setCards(prev => prev.filter(c => c.id !== cardId))
    setRemoving(prev => new Set(prev).add(cardId))

    try {
      await fetch('/api/wanted-cards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId }),
      })
    } catch {
      // If it fails, we silently accept — the user can refresh
    } finally {
      setRemoving(prev => {
        const next = new Set(prev)
        next.delete(cardId)
        return next
      })
    }
  }

  const sectionTitle = isOwnProfile ? 'Wanted Cards' : `${displayName}'s Wanted Cards`

  // Show nothing while loading if cards end up being empty (avoid flash)
  if (!loading && !error && cards.length === 0) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2
            className="text-xl font-bold text-primary"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {sectionTitle}
          </h2>
        </div>
        <div className="bg-surface border border-subtle rounded-xl p-8 flex flex-col items-center gap-3 text-center">
          <div className="text-3xl">☆</div>
          {isOwnProfile ? (
            <>
              <p className="text-secondary text-sm">You have no wanted cards yet.</p>
              <Link
                href="/browse"
                className="inline-flex items-center gap-2 h-8 px-4 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-light transition-all"
              >
                Browse Cards
              </Link>
            </>
          ) : (
            <p className="text-secondary text-sm">No wanted cards yet.</p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2
          className="text-xl font-bold text-primary"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {sectionTitle}
        </h2>

        {/* "View all" link — own profile only */}
        {isOwnProfile && !loading && cards.length > 0 && (
          <Link
            href="/wanted"
            className="text-xs text-accent hover:text-accent-light transition-colors shrink-0"
          >
            View all {cards.length} →
          </Link>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-10 text-muted">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading wanted cards…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-surface border border-subtle rounded-xl p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Card strip — show up to 12, rest collapsed behind "View all" link */}
      {!loading && !error && cards.length > 0 && (
        <div className="bg-surface border border-subtle rounded-xl p-4">
          <div className="flex flex-wrap gap-2">
            {cards.slice(0, 12).map(card => (
              <div key={card.id} className="group relative shrink-0">
                {/* Card thumbnail */}
                <Link
                  href={card.set_id ? `/set/${card.set_id}` : '#'}
                  title={`${card.name ?? ''} · ${card.set_name ?? ''} #${card.number ?? '?'}`}
                  className="block"
                >
                  <div className="w-[72px] h-[100px] rounded-lg overflow-hidden border border-subtle group-hover:border-accent/50 transition-colors bg-elevated">
                    <img
                      src={card.image ?? '/pokemon_card_backside.png'}
                      alt={card.name ?? ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </Link>

                {/* Un-star button — own profile only */}
                {isOwnProfile && (
                  <button
                    onClick={() => handleUnstar(card.id)}
                    disabled={removing.has(card.id)}
                    title="Remove from wanted"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-subtle flex items-center justify-center text-amber-400 hover:text-red-400 hover:border-red-400/50 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            {/* Overflow indicator */}
            {cards.length > 12 && (
              <Link
                href={isOwnProfile ? '/wanted' : '#'}
                className="shrink-0 w-[72px] h-[100px] rounded-lg border border-subtle bg-elevated flex flex-col items-center justify-center gap-1 text-muted hover:text-accent hover:border-accent/40 transition-all"
              >
                <span className="text-lg font-bold">+{cards.length - 12}</span>
                <span className="text-[10px]">more</span>
              </Link>
            )}
          </div>

          {/* Card count footer */}
          <p className="text-xs text-muted mt-3">
            {cards.length} card{cards.length !== 1 ? 's' : ''} wanted
            {cards.length > 12 && ` · showing 12 of ${cards.length}`}
          </p>
        </div>
      )}
    </section>
  )
}
