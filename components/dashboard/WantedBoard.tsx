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
  number: string | null
  rarity: string | null
  set_name: string | null
  set_logo_url: string | null
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
    <div className="w-9 h-9 rounded-full overflow-hidden bg-surface border border-subtle shrink-0 flex items-center justify-center">
      {user.avatar_url ? (
        <Image
          src={user.avatar_url}
          alt={user.display_name ?? 'User'}
          width={36}
          height={36}
          className="object-cover w-full h-full"
          unoptimized
        />
      ) : (
        <span className="text-sm font-bold text-accent">{initial}</span>
      )}
    </div>
  )
}

// ── Rarity abbreviation helper ────────────────────────────────────────────────
function rarityShort(rarity: string | null): string | null {
  if (!rarity) return null
  const map: Record<string, string> = {
    'Common': 'C',
    'Uncommon': 'U',
    'Rare': 'R',
    'Rare Holo': 'RH',
    'Rare Ultra': 'UR',
    'Rare Secret': 'SR',
    'Rare Rainbow': 'RR',
    'Amazing Rare': 'AR',
    'Radiant Rare': 'RaR',
    'Illustration Rare': 'IR',
    'Special Illustration Rare': 'SIR',
    'Hyper Rare': 'HR',
  }
  return map[rarity] ?? rarity.slice(0, 3)
}

// ── Single card thumbnail with metadata ───────────────────────────────────────
function CardThumb({ card }: { card: WBCard }) {
  const short = rarityShort(card.rarity)
  return (
    <div className="flex flex-col gap-1 shrink-0" style={{ width: 64 }}>
      {/* Image */}
      <div className="relative w-16 h-[90px] rounded-lg overflow-hidden bg-surface border border-subtle">
        <img
          src={card.image ?? '/pokemon_card_backside.png'}
          alt={card.name ?? ''}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Rarity badge */}
        {short && (
          <span className="absolute bottom-1 right-1 text-[9px] font-bold px-1 py-0.5 rounded bg-black/60 text-white leading-none">
            {short}
          </span>
        )}
      </div>

      {/* Card name */}
      <p className="text-[10px] font-medium text-primary leading-tight line-clamp-1">
        {card.name ?? '—'}
      </p>

      {/* Number · Set */}
      <p className="text-[9px] text-muted leading-tight line-clamp-1">
        {[card.number ? `#${card.number}` : null, card.set_name]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  )
}

// ── Card strip (with overflow counter) ───────────────────────────────────────
function CardStrip({ cards, max = 4 }: { cards: WBCard[]; max?: number }) {
  const visible = cards.slice(0, max)
  const overflow = cards.length - max
  return (
    <div className="flex gap-2 flex-wrap">
      {visible.map(card => <CardThumb key={card.id} card={card} />)}
      {overflow > 0 && (
        <div className="w-16 h-[90px] rounded-lg bg-surface border border-subtle shrink-0 flex items-center justify-center self-start">
          <span className="text-xs font-bold text-muted">+{overflow}</span>
        </div>
      )}
    </div>
  )
}

// ── Section header — always rendered ─────────────────────────────────────────
function SectionHeader({ matchCount }: { matchCount: number | null }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>🔄</span>
        <h2
          className="text-lg font-semibold text-primary"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Wanted Board
        </h2>
        {matchCount !== null && matchCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-price/10 border border-price/30 text-price font-medium">
            {matchCount} match{matchCount !== 1 ? 'es' : ''}
          </span>
        )}
      </div>
      <Link
        href="/wanted-board"
        className="text-sm text-accent hover:text-accent-light transition-colors font-medium"
      >
        View all →
      </Link>
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

  // ── Loading skeleton — full section shell always visible ──────────────────
  if (loading) {
    return (
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="skeleton h-5 w-5 rounded" />
            <div className="skeleton h-6 w-36 rounded" />
          </div>
          <div className="skeleton h-4 w-16 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <div key={i} className="skeleton h-52 rounded-xl" />)}
        </div>
      </section>
    )
  }

  // ── No matches — show promo / empty state ─────────────────────────────────
  if (matches.length === 0) {
    return (
      <section className="mb-6">
        <SectionHeader matchCount={null} />

        <div className="bg-elevated border border-subtle rounded-xl px-6 py-8 flex flex-col items-center text-center gap-4">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl shadow-sm">
            🔄
          </div>

          {/* Copy */}
          <div>
            <h3
              className="text-base font-semibold text-primary mb-1"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              No trade matches yet
            </h3>
            <p className="text-sm text-secondary max-w-sm mx-auto leading-relaxed">
              Star cards on your wanted list and connect with friends — when a friend owns a card
              you want (or vice‑versa), a trade match will appear here.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <Link
              href="/wanted"
              className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-light transition-colors"
            >
              ★ Add Wanted Cards
            </Link>
            <Link
              href="/wanted-board"
              className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-lg bg-surface border border-subtle text-secondary hover:text-primary hover:border-accent/40 transition-colors"
            >
              View Wanted Board →
            </Link>
          </div>
        </div>
      </section>
    )
  }

  // ── Has matches — card grid ───────────────────────────────────────────────
  const topMatches = matches.slice(0, 3)

  return (
    <section className="mb-6">
      <SectionHeader matchCount={matches.length} />

      {/* ── Match cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {topMatches.map(match => (
          <div
            key={match.user.id}
            className="relative bg-elevated border border-subtle rounded-xl p-5 flex flex-col gap-4 hover:border-accent/40 transition-colors duration-150"
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

            {/* Card strips */}
            <div className="flex flex-col gap-3">
              {match.isMutual ? (
                <>
                  {/* They want from me */}
                  {match.theyWant.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-2">
                        They want from you
                      </p>
                      <CardStrip cards={match.theyWant} max={3} />
                    </div>
                  )}
                  {/* I want from them */}
                  {match.iWant.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-price uppercase tracking-wide mb-2">
                        You want from them
                      </p>
                      <CardStrip cards={match.iWant} max={3} />
                    </div>
                  )}
                </>
              ) : (
                <CardStrip cards={match.theyWant.length > 0 ? match.theyWant : match.iWant} max={4} />
              )}
            </div>

            {/* CTA */}
            <Link
              href={buildTradeUrl(match)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-light transition-colors mt-auto"
            >
              🔄 Propose Trade
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
