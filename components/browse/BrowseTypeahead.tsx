'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { SearchMode, CardSearchResult, ArtistResult, BrowseProduct } from './types'

// ── Union type for all suggestion rows ────────────────────────────────────────
type AnyItem =
  | { kind: 'card';    data: CardSearchResult }
  | { kind: 'artist';  data: ArtistResult     }
  | { kind: 'product'; data: BrowseProduct    }

// ── Props ─────────────────────────────────────────────────────────────────────
interface BrowseTypeaheadProps {
  query:           string           // 200ms-debounced input value from parent
  mode:            SearchMode
  allProducts:     BrowseProduct[]  // pre-loaded for client-side product filtering
  visible:         boolean
  onSelectCard:    (card:    CardSearchResult) => void
  onSelectArtist:  (artist:  ArtistResult)     => void
  onSelectProduct: (product: BrowseProduct)    => void
  onSeeAll:        () => void  // commit query → show full results
  onClose:         () => void  // hide dropdown
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BrowseTypeahead({
  query, mode, allProducts, visible,
  onSelectCard, onSelectArtist, onSelectProduct, onSeeAll, onClose,
}: BrowseTypeaheadProps) {
  const [cards,   setCards]   = useState<CardSearchResult[]>([])
  const [artists, setArtists] = useState<ArtistResult[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(-1)

  // Stable refs so the keyboard handler never has a stale closure
  const itemsRef     = useRef<AnyItem[]>([])
  const focusedRef   = useRef(-1)
  const cbRef = useRef({ onSelectCard, onSelectArtist, onSelectProduct, onSeeAll, onClose })

  // Keep refs up-to-date on every render
  focusedRef.current = focused
  cbRef.current = { onSelectCard, onSelectArtist, onSelectProduct, onSeeAll, onClose }

  // ── Fetch suggestions ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || query.length < 2) {
      setCards([])
      setArtists([])
      setFocused(-1)
      return
    }

    setLoading(true)
    const controller = new AbortController()
    const { signal } = controller

    async function doFetch() {
      try {
        if (mode === 'cards') {
          const res = await fetch(
            `/api/cards/search?q=${encodeURIComponent(query)}&limit=6`,
            { signal },
          )
          if (!res.ok) return
          const data = await res.json()
          if (!signal.aborted) { setCards(data.cards ?? []); setFocused(-1) }

        } else if (mode === 'artists') {
          const res = await fetch(
            `/api/artists/search?q=${encodeURIComponent(query)}&limit=5`,
            { signal },
          )
          if (!res.ok) return
          const data = await res.json()
          if (!signal.aborted) { setArtists(data.artists ?? []); setFocused(-1) }
        }
        // Products mode: client-side filter of allProducts — no HTTP call needed
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    }

    doFetch()
    return () => controller.abort()
  }, [query, mode, visible])

  // ── Build flat item list ───────────────────────────────────────────────────
  const items: AnyItem[] = []

  if (mode === 'cards') {
    cards.forEach(c => items.push({ kind: 'card', data: c }))
  } else if (mode === 'artists') {
    artists.forEach(a => items.push({ kind: 'artist', data: a }))
  } else if (mode === 'products') {
    const q = query.toLowerCase()
    allProducts
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.set_name.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .forEach(p => items.push({ kind: 'product', data: p }))
  }

  // Keep itemsRef current so the keyboard handler reads the latest list
  itemsRef.current = items

  // ── Keyboard navigation (stable document listener) ────────────────────────
  useEffect(() => {
    if (!visible) return

    function handleKey(e: KeyboardEvent) {
      const its  = itemsRef.current
      const fi   = focusedRef.current
      const cbs  = cbRef.current

      if (e.key === 'Escape') { cbs.onClose(); return }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocused(prev => (prev < its.length - 1 ? prev + 1 : 0))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocused(prev => (prev > 0 ? prev - 1 : its.length - 1))
        return
      }

      if (e.key === 'Enter') {
        if (fi >= 0 && fi < its.length) {
          e.preventDefault()
          const item = its[fi]
          if (item.kind === 'card')    cbs.onSelectCard(item.data)
          if (item.kind === 'artist')  cbs.onSelectArtist(item.data)
          if (item.kind === 'product') cbs.onSelectProduct(item.data)
        } else {
          cbs.onSeeAll()
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [visible]) // only re-register when visibility toggles; refs handle the rest

  // ── Nothing to show ───────────────────────────────────────────────────────
  if (!visible || query.length < 2) return null

  return (
    <div
      className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-subtle shadow-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-elevated)' }}
      role="listbox"
      aria-label="Search suggestions"
    >
      {/* Loading skeleton */}
      {loading ? (
        <div className="p-2 space-y-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
              <div className="w-8 h-11 rounded bg-surface shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-surface rounded w-3/5" />
                <div className="h-2.5 bg-surface rounded w-2/5" />
              </div>
            </div>
          ))}
        </div>

      ) : items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted">
          No results for &ldquo;{query}&rdquo;
        </div>

      ) : (
        <ul className="py-1 max-h-80 overflow-y-auto">
          {items.map((item, i) => {
            const isFocused = i === focused

            // ── Card row ────────────────────────────────────────────────────
            if (item.kind === 'card') {
              const c = item.data
              return (
                <li key={c.id}>
                  <button
                    role="option"
                    aria-selected={isFocused}
                    onClick={() => onSelectCard(c)}
                    onMouseEnter={() => setFocused(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer transition-colors',
                      isFocused ? 'bg-accent/10' : 'hover:bg-surface',
                    )}
                  >
                    <div className="w-8 h-11 shrink-0 rounded overflow-hidden bg-surface border border-subtle/50">
                      {c.image_url && (
                        <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', isFocused ? 'text-accent' : 'text-primary')}>
                        {c.name}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {c.set.name}&nbsp;·&nbsp;#{c.number}
                      </p>
                    </div>
                    {c.rarity && (
                      <span className="text-xs text-muted shrink-0 hidden sm:block">{c.rarity}</span>
                    )}
                  </button>
                </li>
              )
            }

            // ── Artist row ──────────────────────────────────────────────────
            if (item.kind === 'artist') {
              const a = item.data
              return (
                <li key={a.name}>
                  <button
                    role="option"
                    aria-selected={isFocused}
                    onClick={() => onSelectArtist(a)}
                    onMouseEnter={() => setFocused(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors',
                      isFocused ? 'bg-accent/10' : 'hover:bg-surface',
                    )}
                  >
                    {/* Sample thumbnails */}
                    <div className="flex -space-x-2 shrink-0">
                      {a.sample_images.slice(0, 3).map((img, idx) => (
                        <div key={idx} className="w-7 h-10 rounded overflow-hidden bg-surface border border-subtle">
                          <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ))}
                      {a.sample_images.length === 0 && (
                        <div className="w-9 h-9 rounded-full bg-surface border border-subtle flex items-center justify-center">
                          🎨
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', isFocused ? 'text-accent' : 'text-primary')}>
                        {a.name}
                      </p>
                      <p className="text-xs text-muted">
                        {a.card_count.toLocaleString()} cards
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              )
            }

            // ── Product row ─────────────────────────────────────────────────
            if (item.kind === 'product') {
              const p = item.data
              return (
                <li key={p.id}>
                  <button
                    role="option"
                    aria-selected={isFocused}
                    onClick={() => onSelectProduct(p)}
                    onMouseEnter={() => setFocused(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors',
                      isFocused ? 'bg-accent/10' : 'hover:bg-surface',
                    )}
                  >
                    {p.image_url ? (
                      <div className="w-9 h-9 rounded overflow-hidden bg-surface shrink-0 border border-subtle/50">
                        <img src={p.image_url} alt="" className="w-full h-full object-contain" loading="lazy" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded bg-surface shrink-0 border border-subtle flex items-center justify-center">
                        📦
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', isFocused ? 'text-accent' : 'text-primary')}>
                        {p.name}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {p.set_name}&nbsp;·&nbsp;{p.product_type ?? 'Product'}
                      </p>
                    </div>
                    {p.tcgp_market != null && (
                      <span className="text-sm font-medium text-price shrink-0">
                        ${p.tcgp_market.toFixed(2)}
                      </span>
                    )}
                  </button>
                </li>
              )
            }

            return null
          })}
        </ul>
      )}

      {/* See all footer */}
      {!loading && items.length > 0 && (
        <button
          onClick={onSeeAll}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-accent hover:bg-surface border-t border-subtle transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          See all results for &ldquo;{query}&rdquo;
        </button>
      )}
    </div>
  )
}
