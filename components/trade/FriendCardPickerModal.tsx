'use client'

import { useState, useEffect, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FriendCard {
  id: string
  set_id: string
  name: string | null
  number: string | null
  image: string | null
  set_name: string | null
  set_logo_url: string | null
  quantity: number
  price_eur: number | null
  price_usd: number | null
}

interface TradeUser {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

interface FriendCardPickerModalProps {
  otherUser: TradeUser
  alreadyAdded: Set<string>
  /** Total EUR value of cards you are currently offering */
  offerValueEur: number
  /** Total EUR value of cards you have already requested */
  requestedValueEur: number
  onAdd: (card: FriendCard) => void
  onClose: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const EUR_TO_USD = 1.09

function fmtEur(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)
}

function cardPrice(card: FriendCard): string | null {
  if (card.price_eur != null) return fmtEur(card.price_eur)
  if (card.price_usd != null)
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(card.price_usd)
  return null
}

/** Normalise card price to EUR for sorting/comparison */
function toEur(card: FriendCard): number | null {
  if (card.price_eur != null) return card.price_eur
  if (card.price_usd != null) return card.price_usd / EUR_TO_USD
  return null
}

// ── Card tile ─────────────────────────────────────────────────────────────────
function CardTile({
  card,
  added,
  onAdd,
}: {
  card: FriendCard
  added: boolean
  onAdd: () => void
}) {
  const price = cardPrice(card)
  return (
    <button
      onClick={onAdd}
      disabled={added}
      title={card.name ?? undefined}
      className={[
        'group flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-left w-full',
        added
          ? 'border-accent/60 bg-accent/10 cursor-default'
          : 'border-subtle bg-surface hover:border-accent/50 hover:bg-elevated cursor-pointer',
      ].join(' ')}
    >
      {/* Card image */}
      <div className="w-full aspect-[2.5/3.5] rounded-lg overflow-hidden border border-subtle bg-elevated">
        <img
          src={card.image ?? '/pokemon_card_backside.png'}
          alt={card.name ?? ''}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Name */}
      <p className="text-[10px] text-center font-medium text-primary truncate w-full leading-tight px-0.5">
        {card.name}
      </p>

      {/* Price */}
      {price ? (
        <p className="text-[10px] font-bold text-price leading-none">{price}</p>
      ) : (
        <p className="text-[10px] text-muted leading-none">–</p>
      )}

      {/* Add / Added state */}
      {added ? (
        <span className="text-[9px] text-accent font-semibold leading-none">✓ Added</span>
      ) : (
        <span className="text-[9px] text-muted group-hover:text-accent transition-colors leading-none">
          + Add
        </span>
      )}
    </button>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function FriendCardPickerModal({
  otherUser,
  alreadyAdded,
  offerValueEur,
  requestedValueEur,
  onAdd,
  onClose,
}: FriendCardPickerModalProps) {
  const name = otherUser.display_name ?? otherUser.username ?? 'them'

  const [tab,     setTab]     = useState<'suggested' | 'all'>('suggested')
  const [search,  setSearch]  = useState('')
  const [sort,    setSort]    = useState<'set' | 'price-desc' | 'price-asc'>('set')
  const [cards,   setCards]   = useState<FriendCard[]>([])
  const [loading, setLoading] = useState(true)

  // Load the friend's full collection once
  useEffect(() => {
    setLoading(true)
    fetch(`/api/users/${otherUser.id}/collection`)
      .then(r => r.json())
      .then(d => setCards(d.cards ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [otherUser.id])

  // How much value still needs to be covered on the request side
  const remainingEur = Math.max(0, offerValueEur - requestedValueEur)

  // ── Suggested: cards sorted by proximity to remaining trade gap ───────────
  const suggested = useMemo(() => {
    const target = remainingEur > 0
      ? remainingEur
      : offerValueEur > 0
        ? offerValueEur
        : 10  // sensible fallback when no offer value yet

    return [...cards]
      .filter(c => toEur(c) != null)
      .sort((a, b) => {
        const pa = toEur(a)!
        const pb = toEur(b)!
        return Math.abs(pa - target) - Math.abs(pb - target)
      })
      .slice(0, 24)
  }, [cards, remainingEur, offerValueEur])

  // ── All cards filtered ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return cards
    const q = search.toLowerCase()
    return cards.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.set_name?.toLowerCase().includes(q) ||
      c.number?.toLowerCase().includes(q),
    )
  }, [cards, search])

  // ── Sorted flat list (for price sorts) ────────────────────────────────────
  const sortedFlat = useMemo(() => {
    if (sort === 'set') return filtered
    return [...filtered].sort((a, b) => {
      const pa = toEur(a) ?? (sort === 'price-desc' ? -Infinity : Infinity)
      const pb = toEur(b) ?? (sort === 'price-desc' ? -Infinity : Infinity)
      return sort === 'price-desc' ? pb - pa : pa - pb
    })
  }, [filtered, sort])

  // ── Grouped by set (only used when sort === 'set') ────────────────────────
  const bySet = useMemo(() => {
    const groups = new Map<string, { setName: string; cards: FriendCard[] }>()
    for (const c of filtered) {
      const key = c.set_id ?? 'unknown'
      if (!groups.has(key)) groups.set(key, { setName: c.set_name ?? 'Unknown Set', cards: [] })
      groups.get(key)!.cards.push(c)
    }
    return Array.from(groups.values()).sort((a, b) => a.setName.localeCompare(b.setName))
  }, [filtered])

  const unpricedCount = cards.filter(c => toEur(c) == null).length

  // Switch to "all" when user starts typing
  function handleSearch(v: string) {
    setSearch(v)
    if (v.trim()) setTab('all')
  }

  const sortLabel: Record<typeof sort, string> = {
    'set':        '🗂️ By Set',
    'price-desc': '💰 Price ↓',
    'price-asc':  '💰 Price ↑',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-2xl max-h-[92dvh] bg-base border border-subtle rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-subtle shrink-0">
          <div className="min-w-0 flex-1 pr-3">
            <h3 className="font-bold text-primary text-base leading-tight truncate">
              Browse {name}&apos;s Collection
            </h3>
            {offerValueEur > 0 ? (
              <p className="text-[11px] text-muted mt-0.5 leading-snug">
                Your offer is worth&nbsp;
                <span className="text-accent font-semibold">{fmtEur(offerValueEur)}</span>
                {remainingEur > 0
                  ? <> — pick&nbsp;<span className="text-price font-semibold">~{fmtEur(remainingEur)}</span>&nbsp;more to balance</>
                  : ' — trade is currently balanced or in your favour'
                }
              </p>
            ) : (
              <p className="text-[11px] text-muted mt-0.5">
                Add cards to your offer first to get price suggestions
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-primary hover:bg-surface transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Search bar ── */}
        <div className="px-5 py-3 border-b border-subtle shrink-0">
          <div className="flex items-center gap-2 bg-surface border border-subtle rounded-xl px-3 py-2 focus-within:border-accent/50 transition-colors">
            <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder={`Search ${name}'s cards…`}
              className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted outline-none"
            />
            {search && (
              <button onClick={() => handleSearch('')} className="text-muted hover:text-primary transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs + sort controls ── */}
        <div className="flex items-center justify-between gap-2 px-5 pt-3 pb-1 shrink-0">
          {/* Tabs */}
          {!search && (
            <div className="flex gap-1">
              <button
                onClick={() => setTab('suggested')}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  tab === 'suggested'
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-primary hover:bg-surface',
                ].join(' ')}
              >
                <span>💡</span> Suggested
              </button>
              <button
                onClick={() => setTab('all')}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  tab === 'all'
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-primary hover:bg-surface',
                ].join(' ')}
              >
                <span>🗂️</span> All Cards
                {!loading && <span className="opacity-70">({cards.length})</span>}
              </button>
            </div>
          )}
          {search && <div />}

          {/* Sort control — only shown in All Cards / search mode */}
          {(tab === 'all' || search) && !loading && cards.length > 0 && (
            <div className="flex gap-1 ml-auto">
              {(['set', 'price-desc', 'price-asc'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={[
                    'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap',
                    sort === s
                      ? 'bg-surface border border-accent/50 text-accent'
                      : 'text-muted hover:text-primary hover:bg-surface border border-transparent',
                  ].join(' ')}
                >
                  {sortLabel[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <p className="text-sm text-muted">Loading {name}&apos;s collection…</p>
            </div>
          )}

          {/* Empty collection */}
          {!loading && cards.length === 0 && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-secondary font-semibold">{name} has no cards yet</p>
              <p className="text-sm text-muted mt-1">
                They haven&apos;t added any cards to their collection
              </p>
            </div>
          )}

          {/* ── Suggested tab ── */}
          {!loading && cards.length > 0 && !search && tab === 'suggested' && (
            <div>
              {offerValueEur > 0 && (
                <p className="text-xs text-muted mb-4 leading-relaxed">
                  {remainingEur > 0
                    ? <>Cards closest to the <span className="text-price font-semibold">{fmtEur(remainingEur)}</span> you still need to make this a fair trade.</>
                    : <>Your request already matches your offer — these are the closest-valued cards {name} owns.</>
                  }
                </p>
              )}

              {suggested.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">🏷️</p>
                  <p className="text-sm text-secondary font-medium">No priced cards to suggest</p>
                  <p className="text-xs text-muted mt-1">
                    Switch to All Cards to browse {name}&apos;s collection
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3">
                  {suggested.map(card => (
                    <CardTile
                      key={card.id}
                      card={card}
                      added={alreadyAdded.has(card.id)}
                      onAdd={() => onAdd(card)}
                    />
                  ))}
                </div>
              )}

              {unpricedCount > 0 && (
                <p className="text-xs text-muted mt-5 text-center">
                  {name} also has{' '}
                  <button
                    onClick={() => setTab('all')}
                    className="text-accent hover:underline font-medium"
                  >
                    {unpricedCount} card{unpricedCount !== 1 ? 's' : ''} without price data
                  </button>
                  {' '}— browse All Cards to see them
                </p>
              )}
            </div>
          )}

          {/* ── All Cards / Search tab ── */}
          {!loading && cards.length > 0 && (tab === 'all' || search) && (
            <div className="flex flex-col gap-6">
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">🔍</p>
                  <p className="text-sm text-secondary font-medium">No results for &ldquo;{search}&rdquo;</p>
                  <p className="text-xs text-muted mt-1">{name} doesn&apos;t own any matching cards</p>
                </div>
              ) : sort !== 'set' ? (
                /* Price-sorted flat grid */
                <div>
                  <p className="text-xs text-muted mb-3">
                    {sortedFlat.length} card{sortedFlat.length !== 1 ? 's' : ''}
                    {sortedFlat.filter(c => toEur(c) == null).length > 0 && (
                      <> · {sortedFlat.filter(c => toEur(c) == null).length} unpriced</>
                    )}
                  </p>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3">
                    {sortedFlat.map(card => (
                      <CardTile
                        key={card.id}
                        card={card}
                        added={alreadyAdded.has(card.id)}
                        onAdd={() => onAdd(card)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                /* Grouped by set */
                bySet.map(group => (
                  <div key={group.setName}>
                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                      {group.setName}
                      <span className="text-muted font-normal normal-case tracking-normal">
                        · {group.cards.length} card{group.cards.length !== 1 ? 's' : ''}
                      </span>
                    </p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3">
                      {group.cards.map(card => (
                        <CardTile
                          key={card.id}
                          card={card}
                          added={alreadyAdded.has(card.id)}
                          onAdd={() => onAdd(card)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-subtle flex items-center justify-between shrink-0">
          <p className="text-xs text-muted">
            {alreadyAdded.size > 0
              ? <><span className="text-accent font-semibold">{alreadyAdded.size}</span> card{alreadyAdded.size !== 1 ? 's' : ''} added to trade</>
              : 'No cards selected yet'
            }
          </p>
          <button
            onClick={onClose}
            className="h-9 px-5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-light transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  )
}
