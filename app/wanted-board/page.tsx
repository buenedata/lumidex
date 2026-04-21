'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import TradeProposalCard, { type TradeProposal } from '@/components/trade/TradeProposalCard'

// ── Types ─────────────────────────────────────────────────────────────────────
interface WBUser {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

interface WBCard {
  id: string
  set_id: string
  name: string | null
  number: string | null
  image: string | null
  set_name: string | null
  set_logo_url: string | null
}

interface WBMatch {
  user: WBUser
  theyWant: WBCard[]
  iWant: WBCard[]
  isMutual: boolean
  matchScore: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildTradeUrl(match: WBMatch): string {
  const params = new URLSearchParams({ with: match.user.id })
  const offer   = match.theyWant.map(c => c.id).join(',')
  const request = match.iWant.map(c => c.id).join(',')
  if (offer)   params.set('offer',   offer)
  if (request) params.set('request', request)
  return `/trade?${params.toString()}`
}

// ── Avatar component ──────────────────────────────────────────────────────────
function FriendAvatar({ user, size = 10 }: { user: WBUser; size?: number }) {
  const initial = (user.display_name ?? user.username ?? '?')[0].toUpperCase()
  const px = size * 4
  return (
    <div
      className="rounded-full overflow-hidden bg-elevated border-2 border-subtle shrink-0 flex items-center justify-center ring-2 ring-accent/10"
      style={{ width: px, height: px }}
    >
      {user.avatar_url ? (
        <Image
          src={user.avatar_url}
          alt={user.display_name ?? 'User'}
          width={px}
          height={px}
          className="object-cover w-full h-full"
          unoptimized
        />
      ) : (
        <span className="font-bold text-accent" style={{ fontSize: px * 0.4 }}>{initial}</span>
      )}
    </div>
  )
}

// ── Card thumbnail ─────────────────────────────────────────────────────────────
function CardThumb({ card }: { card: WBCard }) {
  return (
    <Link
      href={`/set/${card.set_id}`}
      title={`${card.name ?? ''} · ${card.set_name ?? ''} #${card.number ?? '?'}`}
      className="group relative shrink-0"
      onClick={e => e.stopPropagation()}
    >
      <div className="w-[72px] h-[100px] rounded-xl overflow-hidden border border-subtle group-hover:border-accent/60 transition-all duration-200 bg-surface shadow-sm group-hover:shadow-md group-hover:scale-105">
        <img
          src={card.image ?? '/pokemon_card_backside.png'}
          alt={card.name ?? ''}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      {card.set_logo_url && (
        <img
          src={card.set_logo_url}
          alt=""
          className="absolute bottom-1 right-1 h-3 w-auto object-contain opacity-80"
        />
      )}
    </Link>
  )
}

// ── Match score badge ──────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface border border-subtle text-muted">
      ✦ {score}
    </span>
  )
}

// ── Match panel ───────────────────────────────────────────────────────────────
interface TradeProposalSummary {
  id: string
  status: string
  isProposer: boolean
}

function MatchPanel({ match, pendingProposal, onViewOffers }: {
  match: WBMatch
  pendingProposal: TradeProposalSummary | null
  onViewOffers: () => void
}) {
  return (
    <div className={cn(
      'bg-elevated border rounded-2xl overflow-hidden transition-all duration-200 group',
      pendingProposal
        ? 'border-accent/40 shadow-[0_0_0_1px_rgba(var(--color-accent-rgb),0.15)]'
        : 'border-subtle hover:border-accent/30 hover:shadow-lg',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-subtle gap-3 flex-wrap bg-surface/40">
        <div className="flex items-center gap-3">
          <FriendAvatar user={match.user} size={11} />
          <div>
            <p className="font-semibold text-primary leading-tight">
              {match.user.display_name ?? match.user.username ?? 'Trainer'}
            </p>
            {match.user.username && match.user.display_name && (
              <p className="text-xs text-muted leading-tight">@{match.user.username}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {match.isMutual && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-price/15 border border-price/40 text-price uppercase tracking-wide">
                ⇄ Mutual
              </span>
            )}
            <ScoreBadge score={match.matchScore} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingProposal ? (
            <>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">
                ⏳ Pending
              </span>
              <button
                onClick={onViewOffers}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-xl bg-surface border border-accent/40 text-accent hover:bg-elevated transition-colors"
              >
                View offer →
              </button>
            </>
          ) : (
            <Link
              href={buildTradeUrl(match)}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-xl bg-accent text-white hover:bg-accent-light transition-colors shadow-sm"
            >
              🔄 Propose Trade
            </Link>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={cn('grid gap-0', match.iWant.length > 0 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
        {/* They want from me */}
        <div className="p-5">
          <p className="text-[11px] font-semibold text-secondary uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary/60" />
            They want from you
            <span className="text-muted font-normal normal-case tracking-normal">({match.theyWant.length})</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {match.theyWant.map(c => <CardThumb key={c.id} card={c} />)}
          </div>
        </div>

        {/* I want from them */}
        {match.iWant.length > 0 && (
          <div className="p-5 sm:border-l border-t sm:border-t-0 border-subtle">
            <p className="text-[11px] font-semibold text-price uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-price/60" />
              You want from them
              <span className="text-muted font-normal normal-case tracking-normal">({match.iWant.length})</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {match.iWant.map(c => <CardThumb key={c.id} card={c} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function MatchSkeleton() {
  return (
    <div className="bg-elevated border border-subtle rounded-2xl overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-subtle bg-surface/40">
        <div className="w-11 h-11 rounded-full bg-surface" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 w-28 bg-surface rounded-full" />
          <div className="h-2.5 w-20 bg-surface rounded-full" />
        </div>
        <div className="h-9 w-32 bg-surface rounded-xl" />
      </div>
      <div className="p-5 flex gap-2">
        {[0, 1, 2, 3].map(i => <div key={i} className="w-[72px] h-[100px] bg-surface rounded-xl" />)}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyMatches() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Illustration */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
          <span className="text-4xl">🔄</span>
        </div>
        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-elevated border border-subtle flex items-center justify-center text-sm">
          ✦
        </div>
      </div>
      <h2 className="text-xl font-bold text-primary mb-2" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
        No trade matches yet
      </h2>
      <p className="text-secondary text-sm mb-8 max-w-xs mx-auto leading-relaxed">
        Add friends and star cards on your wanted list. When a friend wants a card you own — or vice versa — it&apos;ll appear here.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-semibold rounded-xl bg-accent text-white hover:bg-accent-light transition-colors shadow-sm"
        >
          👥 Find friends
        </Link>
        <Link
          href="/wanted"
          className="inline-flex items-center justify-center gap-2 h-10 px-5 text-sm font-semibold rounded-xl bg-elevated border border-subtle text-secondary hover:text-primary hover:border-accent/40 transition-colors"
        >
          ★ My Wanted List
        </Link>
      </div>
    </div>
  )
}

function EmptyMutual() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-price/10 border border-price/20 flex items-center justify-center mb-4">
        <span className="text-2xl">⇄</span>
      </div>
      <p className="text-secondary text-sm max-w-xs mx-auto leading-relaxed">
        No mutual matches yet. These appear when both you and a friend each have cards the other wants.
      </p>
    </div>
  )
}

function EmptyOffers() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-elevated border border-subtle flex items-center justify-center">
          <span className="text-4xl">📬</span>
        </div>
      </div>
      <h2 className="text-xl font-bold text-primary mb-2" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
        No trade offers yet
      </h2>
      <p className="text-secondary text-sm max-w-xs mx-auto leading-relaxed">
        Propose a trade from the Matches tab and it will appear here.
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
type PageTab = 'all' | 'mutual' | 'offers'

export default function WantedBoardPage() {
  const { user, isLoading: authLoading } = useAuthStore()
  const router = useRouter()

  const [matches,     setMatches]     = useState<WBMatch[]>([])
  const [proposals,   setProposals]   = useState<TradeProposal[]>([])
  const [loading,     setLoading]     = useState(true)
  const [propLoading, setPropLoading] = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [activeTab,   setActiveTab]   = useState<PageTab>('all')

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  // Fetch matches
  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    fetch('/api/wanted-board')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load wanted board')
        return r.json()
      })
      .then(d => setMatches(d.matches ?? []))
      .catch(() => setError('Could not load the Wanted Board. Please try again.'))
      .finally(() => setLoading(false))
  }, [user])

  // Fetch trade proposals — declined/rejected are never shown on the board
  useEffect(() => {
    if (!user) return
    setPropLoading(true)
    fetch('/api/trade-proposals')
      .then(r => r.json())
      .then(d => {
        const all: TradeProposal[] = d.proposals ?? []
        setProposals(all.filter(p => (p.status as string) !== 'declined' && (p.status as string) !== 'rejected'))
      })
      .catch(() => {})
      .finally(() => setPropLoading(false))
  }, [user])

  const handleStatusChange = useCallback((id: string, newStatus: string) => {
    if (newStatus === 'declined' || newStatus === 'rejected' || newStatus === 'withdrawn') {
      setProposals(prev => prev.filter(p => p.id !== id))
      return
    }
    setProposals(prev =>
      prev.map(p => p.id === id ? { ...p, status: newStatus as TradeProposal['status'] } : p)
    )
  }, [])

  if (authLoading) return null

  const mutualCount  = matches.filter(m => m.isMutual).length
  const pendingCount = proposals.filter(p => p.status === 'pending').length
  const displayed    = activeTab === 'mutual' ? matches.filter(m => m.isMutual) : matches

  return (
    <div className="min-h-screen bg-[color:var(--color-bg-base)]">

      {/* ── Hero / Page header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-subtle bg-elevated">
        {/* Decorative glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {/* Icon badge */}
              <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0">
                <span className="text-xl" aria-hidden>🔄</span>
              </div>
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-bold text-primary leading-tight"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  Wanted Board
                </h1>
                <p className="text-secondary text-sm mt-0.5">
                  Friends who want cards you own — propose a trade.
                </p>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/browse"
                className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-xl bg-surface border border-subtle text-secondary hover:text-primary hover:border-accent/40 transition-colors"
              >
                Browse cards
              </Link>
              <Link
                href="/wanted"
                className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-xl bg-accent text-white hover:bg-accent-light transition-colors shadow-sm"
              >
                ★ My Wanted List
              </Link>
            </div>
          </div>

          {/* Stats row */}
          {!loading && !error && matches.length > 0 && (
            <div className="flex gap-4 mt-6 pt-5 border-t border-subtle">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{matches.length}</p>
                <p className="text-xs text-muted mt-0.5">Total matches</p>
              </div>
              <div className="w-px bg-subtle" />
              <div className="text-center">
                <p className="text-2xl font-bold text-price">{mutualCount}</p>
                <p className="text-xs text-muted mt-0.5">Mutual</p>
              </div>
              <div className="w-px bg-subtle" />
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
                <p className="text-xs text-muted mt-0.5">Pending offers</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-6 bg-elevated border border-subtle rounded-xl p-1 w-fit flex-wrap">
          {([
            ['all',    'All Matches', loading ? '…' : matches.length],
            ['mutual', 'Mutual',      loading ? '…' : mutualCount],
          ] as [PageTab, string, number | string][]).map(([tab, label, count]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as PageTab)}
              disabled={!!error}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                activeTab === tab
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-secondary hover:text-primary disabled:opacity-50',
              )}
            >
              {label}
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-bold',
                activeTab === tab ? 'bg-white/20 text-white' : 'bg-surface border border-subtle text-muted',
              )}>
                {count}
              </span>
            </button>
          ))}

          {/* Trade Offers tab */}
          <button
            onClick={() => setActiveTab('offers')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              activeTab === 'offers'
                ? 'bg-accent text-white shadow-sm'
                : 'text-secondary hover:text-primary',
            )}
          >
            Trade Offers
            {pendingCount > 0 && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-bold',
                activeTab === 'offers'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-500/20 border border-amber-500/40 text-amber-400',
              )}>
                {pendingCount}
              </span>
            )}
            {pendingCount === 0 && !propLoading && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-bold',
                activeTab === 'offers'
                  ? 'bg-white/20 text-white'
                  : 'bg-surface border border-subtle text-muted',
              )}>
                {proposals.length}
              </span>
            )}
          </button>
        </div>

        {/* ══════════════════ MATCHES VIEWS ══════════════════ */}
        {activeTab !== 'offers' && (
          <>
            {/* Loading skeletons */}
            {loading && (
              <div className="space-y-4">
                {[0, 1, 2].map(i => <MatchSkeleton key={i} />)}
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-red-400 text-sm mb-4 font-medium">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 h-9 px-4 text-sm font-semibold rounded-xl bg-elevated border border-subtle text-secondary hover:text-primary hover:border-accent/40 transition-colors"
                >
                  ↺ Try again
                </button>
              </div>
            )}

            {/* Empty: no matches at all */}
            {!loading && !error && matches.length === 0 && <EmptyMatches />}

            {/* Empty: mutual filter but has matches */}
            {!loading && !error && matches.length > 0 && displayed.length === 0 && <EmptyMutual />}

            {/* Match list */}
            {!loading && !error && displayed.length > 0 && (
              <div className="space-y-4">
                {displayed.map(m => {
                  const pending = proposals.find(p =>
                    p.status === 'pending' && (
                      (p.isProposer  && p.receiver_id  === m.user.id) ||
                      (!p.isProposer && p.proposer_id  === m.user.id)
                    ),
                  ) ?? null
                  return (
                    <MatchPanel
                      key={m.user.id}
                      match={m}
                      pendingProposal={pending
                        ? { id: pending.id, status: pending.status, isProposer: pending.isProposer }
                        : null}
                      onViewOffers={() => setActiveTab('offers')}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════════ TRADE OFFERS VIEW ══════════════════ */}
        {activeTab === 'offers' && (
          <>
            {propLoading && (
              <div className="space-y-4">
                {[0, 1, 2].map(i => <MatchSkeleton key={i} />)}
              </div>
            )}

            {!propLoading && proposals.length === 0 && <EmptyOffers />}

            {!propLoading && proposals.length > 0 && (
              <div className="space-y-4">
                {[...proposals]
                  .sort((a, b) => {
                    if (a.status === 'pending' && b.status !== 'pending') return -1
                    if (b.status === 'pending' && a.status !== 'pending') return  1
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  })
                  .map(p => (
                    <TradeProposalCard
                      key={p.id}
                      proposal={p}
                      onStatusChange={handleStatusChange}
                    />
                  ))
                }
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
