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

function FriendAvatar({ user, size = 10 }: { user: WBUser; size?: number }) {
  const initial = (user.display_name ?? user.username ?? '?')[0].toUpperCase()
  const px = size * 4
  return (
    <div
      className={`rounded-full overflow-hidden bg-surface border border-subtle shrink-0 flex items-center justify-center`}
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

function CardThumb({ card }: { card: WBCard }) {
  return (
    <Link
      href={`/set/${card.set_id}`}
      title={`${card.name ?? ''} · ${card.set_name ?? ''} #${card.number ?? '?'}`}
      className="group relative shrink-0"
      onClick={e => e.stopPropagation()}
    >
      <div className="w-[72px] h-[100px] rounded-lg overflow-hidden border border-subtle group-hover:border-accent/50 transition-colors bg-surface">
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
      'bg-elevated border rounded-2xl overflow-hidden transition-colors duration-150',
      pendingProposal ? 'border-accent/40' : 'border-subtle hover:border-accent/40',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-subtle gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <FriendAvatar user={match.user} size={10} />
          <div>
            <p className="font-semibold text-primary leading-tight">
              {match.user.display_name ?? match.user.username ?? 'Trainer'}
            </p>
            {match.user.username && match.user.display_name && (
              <p className="text-xs text-muted leading-tight">@{match.user.username}</p>
            )}
          </div>
          {match.isMutual && (
            <span className="pill text-[10px] font-bold px-2 py-0.5 rounded-full bg-price/15 border border-price/40 text-price">
              MUTUAL
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingProposal ? (
            <>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/30">
                ⏳ Proposal pending
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
              className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold rounded-xl bg-accent text-white hover:bg-accent-light transition-colors"
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
          <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
            They want from you ({match.theyWant.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {match.theyWant.map(c => <CardThumb key={c.id} card={c} />)}
          </div>
        </div>

        {/* I want from them */}
        {match.iWant.length > 0 && (
          <div className="p-5 sm:border-l border-t sm:border-t-0 border-subtle">
            <p className="text-xs font-semibold text-price uppercase tracking-wider mb-3">
              You want from them ({match.iWant.length})
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

// ── Page ──────────────────────────────────────────────────────────────────────
type PageTab = 'all' | 'mutual' | 'offers'

export default function WantedBoardPage() {
  const { user, isLoading: authLoading } = useAuthStore()
  const router = useRouter()

  const [matches,    setMatches]    = useState<WBMatch[]>([])
  const [proposals,  setProposals]  = useState<TradeProposal[]>([])
  const [loading,    setLoading]    = useState(true)
  const [propLoading,setPropLoading] = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [activeTab,  setActiveTab]  = useState<PageTab>('all')

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  // Fetch matches
  useEffect(() => {
    if (!user) return
    setLoading(true)
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
    // Remove proposals that have been declined/rejected/withdrawn so they vanish immediately
    if (newStatus === 'declined' || newStatus === 'rejected' || newStatus === 'withdrawn') {
      setProposals(prev => prev.filter(p => p.id !== id))
      return
    }
    setProposals(prev =>
      prev.map(p => p.id === id ? { ...p, status: newStatus as TradeProposal['status'] } : p)
    )
  }, [])

  if (authLoading) return null

  const mutualCount   = matches.filter(m => m.isMutual).length
  const pendingCount  = proposals.filter(p => p.status === 'pending').length
  const displayed     = activeTab === 'mutual' ? matches.filter(m => m.isMutual) : matches

  return (
    <div className="min-h-screen bg-[color:var(--color-bg-base)]">
      <div className="max-w-screen-xl mx-auto px-4 py-8">

        {/* ── Page header ── */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl" aria-hidden>🔄</span>
              <h1
                className="text-3xl font-bold text-primary"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Wanted Board
              </h1>
            </div>
            <p className="text-secondary ml-11">
              Friends who want cards you own — propose a trade.
            </p>
          </div>
          <Link
            href="/wanted"
            className="text-sm text-accent hover:text-accent-light transition-colors font-medium shrink-0"
          >
            ★ My Wanted List →
          </Link>
        </div>

        {/* ── Top-level tabs ── */}
        <div className="flex gap-1 mb-6 bg-elevated border border-subtle rounded-xl p-1 w-fit flex-wrap">
          {/* Matches tabs — always shown, count shows 0 while loading or on error */}
          {([['all', 'All Matches', loading ? '…' : matches.length], ['mutual', 'Mutual', loading ? '…' : mutualCount]] as [PageTab, string, number | string][]).map(([tab, label, count]) => (
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
                activeTab === tab ? 'bg-white/20 text-white' : 'bg-elevated border border-subtle text-muted',
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
                activeTab === 'offers' ? 'bg-white/20 text-white' : 'bg-amber-500/20 border border-amber-500/40 text-amber-400',
              )}>
                {pendingCount}
              </span>
            )}
            {pendingCount === 0 && !propLoading && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-bold',
                activeTab === 'offers' ? 'bg-white/20 text-white' : 'bg-elevated border border-subtle text-muted',
              )}>
                {proposals.length}
              </span>
            )}
          </button>
        </div>

        {/* ══════════════════ MATCHES VIEWS ══════════════════ */}
        {activeTab !== 'offers' && (
          <>
            {/* Loading */}
            {loading && (
              <div className="space-y-4">
                {[0, 1, 2].map(i => <div key={i} className="skeleton h-52 rounded-2xl" />)}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="text-center py-24">
                <p className="text-red-400 text-sm mb-4">{error}</p>
                <button onClick={() => window.location.reload()} className="text-sm text-accent hover:underline">
                  Try again
                </button>
              </div>
            )}

            {/* Empty: no friends */}
            {!loading && !error && matches.length === 0 && (
              <div className="text-center py-24">
                <p className="text-5xl mb-4">🔄</p>
                <h2 className="text-xl font-semibold text-primary mb-2">No matches yet</h2>
                <p className="text-secondary text-sm mb-6 max-w-sm mx-auto">
                  Add friends and make sure you&apos;ve both starred cards on your wanted lists.
                  When a friend wants a card you own, it&apos;ll appear here.
                </p>
                <div className="flex justify-center gap-3">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-light transition-colors"
                  >
                    Find friends
                  </Link>
                  <Link
                    href="/browse"
                    className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium rounded-lg bg-elevated border border-subtle text-secondary hover:text-primary hover:border-accent/50 transition-colors"
                  >
                    Browse cards
                  </Link>
                </div>
              </div>
            )}

            {/* Empty: mutual filter */}
            {!loading && !error && matches.length > 0 && displayed.length === 0 && (
              <div className="text-center py-20 text-muted text-sm">
                No mutual matches yet — these appear when you and a friend each have cards the other wants.
              </div>
            )}

            {/* Match list */}
            {!loading && !error && displayed.length > 0 && (
              <div className="space-y-4">
                {displayed.map(m => {
                  const pending = proposals.find(p =>
                    p.status === 'pending' && (
                      (p.isProposer  && p.receiver_id === m.user.id) ||
                      (!p.isProposer && p.proposer_id === m.user.id)
                    ),
                  ) ?? null
                  return (
                    <MatchPanel
                      key={m.user.id}
                      match={m}
                      pendingProposal={pending ? { id: pending.id, status: pending.status, isProposer: pending.isProposer } : null}
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
                {[0, 1, 2].map(i => <div key={i} className="skeleton h-48 rounded-2xl" />)}
              </div>
            )}

            {!propLoading && proposals.length === 0 && (
              <div className="text-center py-24">
                <p className="text-5xl mb-4">📬</p>
                <h2 className="text-xl font-semibold text-primary mb-2">No trade offers yet</h2>
                <p className="text-secondary text-sm mb-6 max-w-sm mx-auto">
                  Propose a trade from the Matches tab and it will appear here.
                </p>
              </div>
            )}

            {!propLoading && proposals.length > 0 && (
              <div className="space-y-4">
                {/* Pending first, then by newest */}
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
