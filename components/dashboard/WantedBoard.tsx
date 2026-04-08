'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'

interface WBUser {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

interface WBCard {
  id: string
  name: string | null
  image: string | null
}

interface WBMatch {
  user: WBUser
  theyWant: WBCard[]
  iWant: WBCard[]
  isMutual: boolean
  matchScore: number
}

function buildTradeUrl(match: WBMatch): string {
  const params = new URLSearchParams({ with: match.user.id })
  const offer   = match.theyWant.slice(0, 10).map(c => c.id).join(',')
  const request = match.iWant.slice(0, 10).map(c => c.id).join(',')
  if (offer)   params.set('offer',   offer)
  if (request) params.set('request', request)
  return `/trade?${params.toString()}`
}

function FriendAvatar({ user }: { user: WBUser }) {
  const initial = (user.display_name ?? user.username ?? '?')[0].toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-surface border border-subtle shrink-0 flex items-center justify-center">
      {user.avatar_url ? (
        <Image
          src={user.avatar_url}
          alt={user.display_name ?? 'User'}
          width={32}
          height={32}
          className="object-cover w-full h-full"
          unoptimized
        />
      ) : (
        <span className="text-sm font-bold text-accent">{initial}</span>
      )}
    </div>
  )
}

export default function WantedBoard() {
  const { user } = useAuthStore()
  const [matches,  setMatches]  = useState<WBMatch[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!user) return
    fetch('/api/wanted-board')
      .then(r => r.json())
      .then(d => setMatches(d.matches ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="skeleton h-6 w-44 rounded" />
          <div className="skeleton h-4 w-20 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <div key={i} className="skeleton h-36 rounded-xl" />)}
        </div>
      </section>
    )
  }

  // ── No matches — hide section ────────────────────────────────────────────
  if (matches.length === 0) return null

  const topMatches = matches.slice(0, 3)

  return (
    <section className="mb-6">
      {/* ── Section header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>🔄</span>
          <h2
            className="text-lg font-semibold text-primary"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Wanted Board
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-price/10 border border-price/30 text-price font-medium">
            {matches.length} match{matches.length !== 1 ? 'es' : ''}
          </span>
        </div>
        <Link
          href="/wanted-board"
          className="text-sm text-accent hover:text-accent-light transition-colors font-medium"
        >
          View all →
        </Link>
      </div>

      {/* ── Match cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {topMatches.map(match => (
          <div
            key={match.user.id}
            className="relative bg-elevated border border-subtle rounded-xl p-4 flex flex-col gap-3 hover:border-accent/40 transition-colors duration-150"
          >
            {/* Mutual badge */}
            {match.isMutual && (
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-price/15 border border-price/40 text-price leading-tight">
                MUTUAL
              </span>
            )}

            {/* Friend info */}
            <div className="flex items-center gap-2.5 pr-16">
              <FriendAvatar user={match.user} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary truncate leading-tight">
                  {match.user.display_name ?? match.user.username ?? 'Trainer'}
                </p>
                <p className="text-xs text-muted leading-tight">
                  Wants {match.theyWant.length} card{match.theyWant.length !== 1 ? 's' : ''} you own
                  {match.iWant.length > 0 && (
                    <span className="text-price"> · you want {match.iWant.length}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Card thumbnails (up to 4 visible) */}
            <div className="flex gap-1.5">
              {match.theyWant.slice(0, 4).map(card => (
                <div
                  key={card.id}
                  className="w-10 h-[56px] rounded overflow-hidden bg-surface border border-subtle shrink-0"
                >
                  <img
                    src={card.image ?? '/pokemon_card_backside.png'}
                    alt={card.name ?? ''}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
              {match.theyWant.length > 4 && (
                <div className="w-10 h-[56px] rounded bg-surface border border-subtle shrink-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-muted">+{match.theyWant.length - 4}</span>
                </div>
              )}
            </div>

            {/* CTA */}
            <Link
              href={buildTradeUrl(match)}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-light transition-colors"
            >
              🔄 Propose Trade
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
