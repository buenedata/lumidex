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
  onAdd: (card: FriendCard) => void
  onClose: () => void
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
  onAdd,
  onClose,
}: FriendCardPickerModalProps) {
  const name = otherUser.display_name ?? otherUser.username ?? 'them'

  const [search,  setSearch]  = useState('')
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

  // ── Grouped by set ────────────────────────────────────────────────────────
  const bySet = useMemo(() => {
    const groups = new Map<string, { setName: string; cards: FriendCard[] }>()
    for (const c of filtered) {
      const key = c.set_id ?? 'unknown'
      if (!groups.has(key)) groups.set(key, { setName: c.set_name ?? 'Unknown Set', cards: [] })
      groups.get(key)!.cards.push(c)
    }
    return Array.from(groups.values()).sort((a, b) => a.setName.localeCompare(b.setName))
  }, [filtered])

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
            <p className="text-[11px] text-muted mt-0.5">
              Select cards from {name}&apos;s collection to add to your trade request
            </p>
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
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${name}'s cards…`}
              className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-muted hover:text-primary transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
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

          {/* ── Cards — grouped by set ── */}
          {!loading && cards.length > 0 && (
            <div className="flex flex-col gap-6">
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">🔍</p>
                  <p className="text-sm text-secondary font-medium">No results for &ldquo;{search}&rdquo;</p>
                  <p className="text-xs text-muted mt-1">{name} doesn&apos;t own any matching cards</p>
                </div>
              ) : (
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
