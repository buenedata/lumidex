'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, useCollectionStore } from '@/lib/store'
import CardGrid from '@/components/CardGrid'
import { Input } from '@/components/ui/Input'
import { PokemonCard } from '@/types'
import { cn } from '@/lib/utils'

export default function WantedPage() {
  const { user, isLoading: authLoading } = useAuthStore()
  const { userCards } = useCollectionStore()
  const router = useRouter()

  const [cards, setCards]     = useState<PokemonCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [search, setSearch]   = useState('')

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Fetch wanted cards
  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetch('/api/wanted-cards/cards')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load wanted cards')
        return res.json()
      })
      .then(data => {
        setCards(data.cards ?? [])
      })
      .catch(() => {
        setError('Could not load your wanted list. Please try again.')
      })
      .finally(() => setLoading(false))
  }, [user])

  // Client-side search filter
  const filteredCards = search.trim()
    ? cards.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.number?.toLowerCase().includes(search.toLowerCase()),
      )
    : cards

  if (authLoading) return null

  return (
    <div className="min-h-screen bg-[color:var(--color-bg-base)]">
      <div className="max-w-screen-2xl mx-auto px-4 py-8">

        {/* ── Page header ─────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">★</span>
            <h1
              className="text-3xl font-bold text-primary"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Wanted List
            </h1>
          </div>
          <p className="text-secondary ml-11">
            Cards you&apos;ve starred that you&apos;d like to acquire.
          </p>
        </div>

        {/* ── Search + count bar ──────────────────────────── */}
        {!loading && !error && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search wanted cards…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>
            <span className="text-sm text-muted shrink-0">
              {filteredCards.length === cards.length
                ? `${cards.length} card${cards.length !== 1 ? 's' : ''}`
                : `${filteredCards.length} of ${cards.length} cards`}
            </span>
          </div>
        )}

        {/* ── States ─────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-muted">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Loading your wanted list…</span>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-24">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-accent hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && cards.length === 0 && (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">☆</p>
            <h2 className="text-xl font-semibold text-primary mb-2">
              Your wanted list is empty
            </h2>
            <p className="text-secondary text-sm mb-6">
              Star a card from any set page or the browse view to add it here.
            </p>
            <a
              href="/browse"
              className={cn(
                'inline-flex items-center gap-2 h-10 px-5 text-sm font-medium rounded-lg',
                'bg-accent text-white hover:bg-accent-light transition-colors glow-accent-sm',
              )}
            >
              Browse cards
            </a>
          </div>
        )}

        {!loading && !error && filteredCards.length === 0 && cards.length > 0 && (
          <div className="text-center py-20 text-muted text-sm">
            No cards match &quot;{search}&quot;
          </div>
        )}

        {!loading && !error && filteredCards.length > 0 && (
          <CardGrid
            cards={filteredCards}
            userCards={userCards}
            setTotal={filteredCards.length}
            disableGreyOut
          />
        )}
      </div>
    </div>
  )
}
