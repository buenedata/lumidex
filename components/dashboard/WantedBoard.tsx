'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'

// ── Minimal type for pending proposals ────────────────────────────────────────
interface PendingProposal {
  id: string
  proposer_id: string
  receiver_id: string
  isProposer: boolean
  status: string
  cash_offered: number
  cash_requested: number
  currency_code: string
  created_at: string
  otherUser: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null
  trade_proposal_items: Array<{
    id: string
    direction: string
    cards: { id: string; name: string | null; image: string | null } | null
  }>
}

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
          <span className="pill text-xs px-2 py-0.5 rounded-full bg-price/10 border border-price/30 text-price font-medium">
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

// ── Pending proposal compact card ─────────────────────────────────────────────
function PendingProposalBanner({ proposal }: { proposal: PendingProposal }) {
  const router = useRouter()
  const name = proposal.otherUser?.display_name ?? proposal.otherUser?.username ?? 'Trainer'
  const offeringCards = proposal.trade_proposal_items.filter(i => i.direction === 'offering')
  const hasCash = proposal.cash_offered > 0

  function relTime(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="flex items-center gap-3 bg-amber-500/8 border border-amber-500/30 rounded-xl px-4 py-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-surface border border-subtle shrink-0 flex items-center justify-center overflow-hidden">
        {proposal.otherUser?.avatar_url ? (
          <Image src={proposal.otherUser.avatar_url} alt={name} width={32} height={32} className="object-cover w-full h-full" unoptimized />
        ) : (
          <span className="text-xs font-bold text-accent">{name[0].toUpperCase()}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary leading-tight truncate">
          <span className="text-amber-400">📬</span> {name} proposed a trade
        </p>
        <p className="text-xs text-muted leading-tight">
          {offeringCards.length} card{offeringCards.length !== 1 ? 's' : ''}
          {hasCash ? ` + ${proposal.currency_code} cash` : ''}
          {' · '}{relTime(proposal.created_at)}
        </p>
      </div>

      {/* Card thumbnails (up to 3) */}
      <div className="hidden sm:flex gap-1 shrink-0">
        {offeringCards.slice(0, 3).map(item => item.cards && (
          <div key={item.id} className="w-8 h-11 rounded overflow-hidden border border-subtle bg-surface">
            <img src={item.cards.image ?? '/pokemon_card_backside.png'} alt={item.cards.name ?? ''} className="w-full h-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => router.push('/wanted-board')}
        className="shrink-0 h-8 px-3 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-400 transition-colors"
      >
        View →
      </button>
    </div>
  )
}

// ── Declined proposal compact card ────────────────────────────────────────────
function DeclinedProposalBanner({ proposal }: { proposal: PendingProposal }) {
  const router = useRouter()
  const name = proposal.otherUser?.display_name ?? proposal.otherUser?.username ?? 'Trainer'
  const offeringCards = proposal.trade_proposal_items.filter(i => i.direction === 'offering')

  function relTime(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="flex items-center gap-3 bg-red-500/8 border border-red-500/25 rounded-xl px-4 py-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-surface border border-subtle shrink-0 flex items-center justify-center overflow-hidden">
        {proposal.otherUser?.avatar_url ? (
          <Image src={proposal.otherUser.avatar_url} alt={name} width={32} height={32} className="object-cover w-full h-full" unoptimized />
        ) : (
          <span className="text-xs font-bold text-muted">{name[0].toUpperCase()}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary leading-tight truncate">
          <span className="text-red-400">❌</span> {name} declined your trade offer
        </p>
        <p className="text-xs text-muted leading-tight">
          {offeringCards.length} card{offeringCards.length !== 1 ? 's' : ''}
          {' · '}{relTime(proposal.created_at)}
        </p>
      </div>

      {/* Card thumbnails (up to 3) */}
      <div className="hidden sm:flex gap-1 shrink-0">
        {offeringCards.slice(0, 3).map(item => item.cards && (
          <div key={item.id} className="w-8 h-11 rounded overflow-hidden border border-subtle bg-surface opacity-50">
            <img src={item.cards.image ?? '/pokemon_card_backside.png'} alt={item.cards.name ?? ''} className="w-full h-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => router.push('/wanted-board')}
        className="shrink-0 h-8 px-3 rounded-lg bg-surface border border-subtle text-muted text-xs font-semibold hover:text-primary hover:border-accent/40 transition-colors"
      >
        View →
      </button>
    </div>
  )
}

export default function WantedBoard() {
  const { user } = useAuthStore()
  const [matches,          setMatches]          = useState<WBMatch[]>([])
  const [proposals,        setProposals]        = useState<PendingProposal[]>([])
  const [declinedProposals, setDeclinedProposals] = useState<PendingProposal[]>([])
  const [loading,          setLoading]          = useState(true)

  useEffect(() => {
    if (!user) return
    fetch('/api/wanted-board')
      .then(r => r.json())
      .then(d => setMatches(d.matches ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!user) return
    fetch('/api/trade-proposals')
      .then(r => r.json())
      .then(d => {
        const all = d.proposals ?? []
        // Pending proposals received from others — needs the user's action
        const received = all.filter(
          (p: PendingProposal) => p.status === 'pending' && !p.isProposer,
        )
        // Outgoing proposals the other party already declined
        const declined = all.filter(
          (p: PendingProposal) => p.status === 'declined' && p.isProposer,
        )
        setProposals(received)
        setDeclinedProposals(declined)
      })
      .catch(() => {})
  }, [user])

  // Received pending + declined outgoing banners
  const hasBanners = proposals.length > 0 || declinedProposals.length > 0
  const pendingBanner = hasBanners ? (
    <div className="mb-4 flex flex-col gap-2">
      {proposals.map(p => <PendingProposalBanner key={p.id} proposal={p} />)}
      {declinedProposals.map(p => <DeclinedProposalBanner key={p.id} proposal={p} />)}
    </div>
  ) : null

  // ── Loading skeleton — full section shell always visible ──────────────────
  if (loading) {
    return (
      <section className="mb-6">
        {pendingBanner}
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
        {pendingBanner}
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
      {pendingBanner}
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
              <span className="pill absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-price/15 border border-price/40 text-price leading-tight">
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
