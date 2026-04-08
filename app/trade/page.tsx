'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ── Normalise cards from different API shapes into TradeCard ──────────────────
// /api/my-collection  → { image, set_name, set_logo_url, set_id }
// /api/cards/search   → { image_url, set: { name, logo_url }, set_id comes via set.id }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCard(raw: any): TradeCard {
  const set = raw.set as Record<string, unknown> | undefined
  return {
    id:           raw.id,
    set_id:       raw.set_id ?? set?.id ?? '',
    name:         raw.name   ?? null,
    number:       raw.number ?? null,
    image:        raw.image  ?? raw.image_url ?? null,
    set_name:     raw.set_name   ?? set?.name     ?? null,
    set_logo_url: raw.set_logo_url ?? set?.logo_url ?? null,
    quantity:     raw.quantity ?? undefined,
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface TradeUser {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

interface TradeCard {
  id: string
  set_id: string
  name: string | null
  number: string | null
  image: string | null
  set_name: string | null
  set_logo_url: string | null
  quantity?: number
}

// ── Small reusable pieces ─────────────────────────────────────────────────────
function UserAvatar({ user, size = 10 }: { user: TradeUser; size?: number }) {
  const initial = (user.display_name ?? user.username ?? '?')[0].toUpperCase()
  const px = size * 4
  return (
    <div
      className="rounded-full overflow-hidden bg-surface border border-subtle shrink-0 flex items-center justify-center"
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
        <span className="font-bold text-accent" style={{ fontSize: px * 0.38 }}>{initial}</span>
      )}
    </div>
  )
}

function CardItem({ card, onRemove }: { card: TradeCard; onRemove: () => void }) {
  return (
    <div className="relative group shrink-0">
      <div className="w-[72px] h-[100px] rounded-lg overflow-hidden border border-subtle bg-surface">
        <img
          src={card.image ?? '/pokemon_card_backside.png'}
          alt={card.name ?? ''}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
        title="Remove"
      >
        ×
      </button>
      <p className="text-[9px] text-center text-muted truncate w-[72px] mt-0.5 leading-tight">
        {card.name}
      </p>
    </div>
  )
}

// ── Card search result row ─────────────────────────────────────────────────────
function SearchResult({ card, onAdd, added }: { card: TradeCard; onAdd: () => void; added: boolean }) {
  return (
    <button
      onClick={onAdd}
      disabled={added}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
        added
          ? 'opacity-40 cursor-default'
          : 'hover:bg-surface cursor-pointer',
      )}
    >
      <div className="w-8 h-11 rounded overflow-hidden bg-surface border border-subtle shrink-0">
        <img src={card.image ?? '/pokemon_card_backside.png'} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary truncate leading-tight">{card.name}</p>
        <p className="text-xs text-muted leading-tight">
          {card.set_name ?? ''}{card.number ? ` · #${card.number}` : ''}
          {card.quantity != null ? ` · You own: ${card.quantity}` : ''}
        </p>
      </div>
      {!added && <span className="text-accent text-xl leading-none shrink-0">+</span>}
      {added  && <span className="text-muted text-xs shrink-0">Added</span>}
    </button>
  )
}

// ── Panel component ───────────────────────────────────────────────────────────
function TradePanel({
  label,
  accentClass,
  cards,
  onRemove,
  searchEndpoint,
  searchPlaceholder,
  panelKey,
  activePanel,
  setActivePanel,
  addedIds,
  onAdd,
}: {
  label: string
  accentClass: string
  cards: TradeCard[]
  onRemove: (id: string) => void
  searchEndpoint: (q: string) => string
  searchPlaceholder: string
  panelKey: 'offer' | 'request'
  activePanel: 'offer' | 'request' | null
  setActivePanel: (p: 'offer' | 'request' | null) => void
  addedIds: Set<string>
  onAdd: (card: TradeCard) => void
}) {
  const isOpen = activePanel === panelKey
  const [q, setQ]                         = useState('')
  const [results, setResults]             = useState<TradeCard[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isOpen) { setQ(''); setResults([]) }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (!q.trim()) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchLoading(true)
      fetch(searchEndpoint(q))
        .then(r => r.json())
        .then(d => setResults((d.cards ?? []).map(normalizeCard)))
        .catch(() => {})
        .finally(() => setSearchLoading(false))
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, isOpen, searchEndpoint])

  return (
    <div className="flex flex-col gap-3">
      <p className={cn('text-xs font-semibold uppercase tracking-wider', accentClass)}>
        {label} ({cards.length})
      </p>

      {/* Card tiles */}
      {cards.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {cards.map(card => (
            <CardItem key={card.id} card={card} onRemove={() => onRemove(card.id)} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted italic">No cards added yet</p>
      )}

      {/* Add button */}
      {!isOpen ? (
        <button
          onClick={() => setActivePanel(panelKey)}
          className="self-start flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-light transition-colors"
        >
          <span className="w-5 h-5 rounded-full border border-accent/50 flex items-center justify-center text-sm leading-none">+</span>
          Add cards
        </button>
      ) : (
        <div className="border border-subtle rounded-xl overflow-hidden bg-surface">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-subtle">
            <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted outline-none"
            />
            <button
              onClick={() => setActivePanel(null)}
              className="text-muted hover:text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Results */}
          <div className="max-h-52 overflow-y-auto py-1">
            {searchLoading && (
              <p className="text-xs text-muted text-center py-4">Searching…</p>
            )}
            {!searchLoading && q.trim() && results.length === 0 && (
              <p className="text-xs text-muted text-center py-4">No results for &ldquo;{q}&rdquo;</p>
            )}
            {!searchLoading && !q.trim() && (
              <p className="text-xs text-muted text-center py-4">Start typing to search</p>
            )}
            {!searchLoading && results.map(card => (
              <SearchResult
                key={card.id}
                card={card}
                added={addedIds.has(card.id)}
                onAdd={() => onAdd(card)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Landing page (no partner selected) ───────────────────────────────────────
function TradeHubLanding() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <div className="w-24 h-24 rounded-3xl bg-accent/10 border border-accent/30 flex items-center justify-center mb-6 mx-auto shadow-xl">
          <span className="text-5xl">🔄</span>
        </div>
        <h1
          className="text-4xl font-bold text-primary mb-3"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Trade Hub
        </h1>
        <p className="text-secondary mb-8 leading-relaxed">
          Propose trades with your friends based on cards you both want.
          Start by checking your Wanted Board for matches.
        </p>
        <Link
          href="/wanted-board"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-light transition-colors"
        >
          🔄 Check Wanted Board
        </Link>
      </div>
    </div>
  )
}

// ── Success state ─────────────────────────────────────────────────────────────
function TradeSuccess({ otherUser }: { otherUser: TradeUser | null }) {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="max-w-sm mx-auto px-6 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-price/10 border border-price/30 flex items-center justify-center mb-6 mx-auto">
          <span className="text-4xl">✅</span>
        </div>
        <h2
          className="text-2xl font-bold text-primary mb-2"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Proposal sent!
        </h2>
        <p className="text-secondary text-sm mb-8">
          Your trade proposal has been sent to{' '}
          <span className="text-primary font-semibold">
            {otherUser?.display_name ?? otherUser?.username ?? 'your friend'}
          </span>
          . They&apos;ll be able to accept or decline it.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/wanted-board"
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-light transition-colors"
          >
            Back to Wanted Board
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-elevated border border-subtle text-secondary text-sm hover:text-primary hover:border-accent/40 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Main trade content (requires useSearchParams) ──────────────────────────────
function TradeHubContent() {
  const { user, isLoading: authLoading } = useAuthStore()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const withId      = searchParams.get('with')     ?? ''
  const offerParam  = searchParams.get('offer')    ?? ''
  const requestParam= searchParams.get('request')  ?? ''
  const offerIds    = offerParam.split(',').filter(Boolean)
  const requestIds  = requestParam.split(',').filter(Boolean)

  const [otherUser,     setOtherUser]     = useState<TradeUser | null>(null)
  const [offering,      setOffering]      = useState<TradeCard[]>([])
  const [requesting,    setRequesting]    = useState<TradeCard[]>([])
  const [notes,         setNotes]         = useState('')
  const [loadingInit,   setLoadingInit]   = useState(true)
  const [submitError,   setSubmitError]   = useState<string | null>(null)
  const [submitting,    setSubmitting]    = useState(false)
  const [success,       setSuccess]       = useState(false)
  const [activePanel,   setActivePanel]   = useState<'offer' | 'request' | null>(null)

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  // Load pre-fill data
  useEffect(() => {
    if (!user || !withId) { setLoadingInit(false); return }

    const allIds = [...offerIds, ...requestIds]
    const fetchUser  = fetch(`/api/users/${withId}`).then(r => r.json())
    const fetchCards = allIds.length > 0
      ? fetch(`/api/cards/batch?ids=${allIds.join(',')}`).then(r => r.json())
      : Promise.resolve({ cards: [] })

    Promise.all([fetchUser, fetchCards])
      .then(([ud, cd]) => {
        if (ud?.user) setOtherUser(ud.user)
        const cardMap = new Map<string, TradeCard>(
          (cd.cards ?? []).map((c: TradeCard) => [c.id, c]),
        )
        setOffering(offerIds.map(id => cardMap.get(id)).filter(Boolean) as TradeCard[])
        setRequesting(requestIds.map(id => cardMap.get(id)).filter(Boolean) as TradeCard[])
      })
      .catch(() => {})
      .finally(() => setLoadingInit(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, withId])

  // Collection search endpoint (offering panel)
  const offerSearchUrl = useCallback((q: string) => `/api/my-collection?q=${encodeURIComponent(q)}&limit=20`, [])
  // Card catalog search endpoint (requesting panel)
  const requestSearchUrl = useCallback((q: string) => `/api/cards/search?q=${encodeURIComponent(q)}&limit=20`, [])

  const addedOfferIds   = new Set(offering.map(c => c.id))
  const addedRequestIds = new Set(requesting.map(c => c.id))

  const handleSubmit = async () => {
    if (!withId || offering.length === 0) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/trade-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: withId,
          notes:      notes.trim() || undefined,
          offering:   offering.map(c => ({ cardId: c.id, quantity: 1 })),
          requesting: requesting.map(c => ({ cardId: c.id, quantity: 1 })),
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        setSubmitError(d.error ?? 'Failed to send proposal. Please try again.')
        return
      }

      setSuccess(true)
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) return null
  if (!withId) return <TradeHubLanding />
  if (success)  return <TradeSuccess otherUser={otherUser} />

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loadingInit) {
    return (
      <div className="min-h-screen bg-base">
        <div className="max-w-screen-lg mx-auto px-4 py-8">
          <div className="skeleton h-10 w-64 rounded mb-6" />
          <div className="skeleton h-12 w-72 rounded-xl mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="skeleton h-64 rounded-2xl" />
            <div className="skeleton h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="max-w-screen-lg mx-auto px-4 py-8">

        {/* ── Page header ── */}
        <div className="mb-6">
          <Link href="/wanted-board" className="text-sm text-muted hover:text-secondary transition-colors flex items-center gap-1 mb-4">
            ← Back to Wanted Board
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>🔄</span>
            <h1
              className="text-2xl font-bold text-primary"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Trade Hub
            </h1>
          </div>
        </div>

        {/* ── Trading with ── */}
        <div className="flex items-center gap-3 mb-8 px-5 py-3 bg-elevated border border-subtle rounded-xl w-fit">
          <span className="text-sm text-muted font-medium">Trading with</span>
          {otherUser ? (
            <>
              <UserAvatar user={otherUser} size={8} />
              <span className="font-semibold text-primary">
                {otherUser.display_name ?? otherUser.username ?? 'Trainer'}
              </span>
            </>
          ) : (
            <span className="text-primary font-semibold">Loading…</span>
          )}
        </div>

        {/* ── Two-panel layout ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          {/* You Offer */}
          <div className="bg-elevated border border-subtle rounded-2xl p-5">
            <TradePanel
              label="You Offer"
              accentClass="text-accent"
              cards={offering}
              onRemove={id => setOffering(prev => prev.filter(c => c.id !== id))}
              searchEndpoint={offerSearchUrl}
              searchPlaceholder="Search your collection…"
              panelKey="offer"
              activePanel={activePanel}
              setActivePanel={setActivePanel}
              addedIds={addedOfferIds}
              onAdd={card => {
                if (!addedOfferIds.has(card.id)) setOffering(prev => [...prev, card])
              }}
            />
          </div>

          {/* You Request */}
          <div className="bg-elevated border border-subtle rounded-2xl p-5">
            <TradePanel
              label="You Request"
              accentClass="text-price"
              cards={requesting}
              onRemove={id => setRequesting(prev => prev.filter(c => c.id !== id))}
              searchEndpoint={requestSearchUrl}
              searchPlaceholder="Search any card…"
              panelKey="request"
              activePanel={activePanel}
              setActivePanel={setActivePanel}
              addedIds={addedRequestIds}
              onAdd={card => {
                if (!addedRequestIds.has(card.id)) setRequesting(prev => [...prev, card])
              }}
            />
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="bg-elevated border border-subtle rounded-2xl p-5 mb-6">
          <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Add a message to your trade proposal…"
            className="w-full bg-surface rounded-lg border border-subtle px-3 py-2 text-sm text-primary placeholder:text-muted resize-none outline-none focus:border-accent/60 transition-colors"
          />
          {notes.length > 400 && (
            <p className="text-xs text-muted text-right mt-1">{500 - notes.length} chars left</p>
          )}
        </div>

        {/* ── Submit ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            {offering.length === 0 && (
              <p className="text-xs text-amber-400">Add at least one card to offer before sending.</p>
            )}
            {submitError && (
              <p className="text-xs text-red-400">{submitError}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/wanted-board"
              className="h-10 px-5 rounded-xl border border-subtle text-secondary text-sm font-medium hover:text-primary hover:border-accent/40 transition-colors inline-flex items-center"
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={submitting || offering.length === 0 || !otherUser}
              className={cn(
                'h-10 px-6 rounded-xl text-sm font-semibold transition-all',
                submitting || offering.length === 0 || !otherUser
                  ? 'bg-accent/30 text-white/50 cursor-not-allowed'
                  : 'bg-accent text-white hover:bg-accent-light',
              )}
            >
              {submitting ? 'Sending…' : '🔄 Send Proposal'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Page export wraps content in Suspense (required for useSearchParams) ──────
export default function TradePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-muted text-sm">Loading…</div>
      </div>
    }>
      <TradeHubContent />
    </Suspense>
  )
}
