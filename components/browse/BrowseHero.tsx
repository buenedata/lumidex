'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import BrowseTypeahead from './BrowseTypeahead'
import type { SearchMode, CardSearchResult, ArtistResult, BrowseProduct } from './types'

// ── Mode tab definitions ──────────────────────────────────────────────────────
const MODES: { value: SearchMode; icon: string; label: string }[] = [
  { value: 'cards',    icon: '🃏', label: 'Cards'    },
  { value: 'artists',  icon: '🎨', label: 'Artists'  },
  { value: 'products', icon: '📦', label: 'Products' },
]

const PLACEHOLDERS: Record<SearchMode, string> = {
  cards:    'Search by card name or number…',
  artists:  'Search artists…',
  products: 'Search products…',
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface BrowseHeroProps {
  mode:           SearchMode
  committedQuery: string        // current URL ?q= value (or ?artist= value)
  allProducts:    BrowseProduct[]
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BrowseHero({ mode, committedQuery, allProducts }: BrowseHeroProps) {
  const router     = useRouter()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const [inputValue,       setInputValue]       = useState(committedQuery)
  const [typeaheadVisible, setTypeaheadVisible] = useState(false)

  // Debounced input that drives the typeahead API calls (200ms)
  const [debouncedInput, setDebouncedInput] = useState(committedQuery)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedInput(inputValue), 200)
    return () => clearTimeout(t)
  }, [inputValue])

  // Sync input when the committed query changes (e.g. browser back/forward)
  useEffect(() => {
    setInputValue(committedQuery)
  }, [committedQuery])

  // Close typeahead when clicking outside the wrapper
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setTypeaheadVisible(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // ── URL helpers ─────────────────────────────────────────────────────────────

  /** Push a committed card/artist/product search URL */
  const commitQuery = useCallback((query: string) => {
    if (!query.trim()) return
    setTypeaheadVisible(false)
    router.push(`/browse?q=${encodeURIComponent(query.trim())}&mode=${mode}`)
  }, [router, mode])

  const handleModeChange = useCallback((newMode: SearchMode) => {
    const params = new URLSearchParams()
    if (committedQuery) params.set('q', committedQuery)
    params.set('mode', newMode)
    router.push(`/browse?${params.toString()}`)
  }, [router, committedQuery])

  // ── Typeahead selection callbacks ───────────────────────────────────────────

  const handleSelectCard = useCallback((card: CardSearchResult) => {
    router.push(`/set/${encodeURIComponent(card.set.id)}?card=${card.id}`)
    setTypeaheadVisible(false)
  }, [router])

  const handleSelectArtist = useCallback((artist: ArtistResult) => {
    setInputValue(artist.name)
    setTypeaheadVisible(false)
    router.push(`/browse?artist=${encodeURIComponent(artist.name)}`)
  }, [router])

  const handleSelectProduct = useCallback((product: BrowseProduct) => {
    router.push(`/products?series=${encodeURIComponent(product.series)}`)
    setTypeaheadVisible(false)
  }, [router])

  const handleSeeAll = useCallback(() => {
    commitQuery(inputValue)
  }, [commitQuery, inputValue])

  // ── Input event handlers ────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    setTypeaheadVisible(val.length >= 2)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeaheadVisible) {
      // Arrow keys / Enter / Escape are intercepted by BrowseTypeahead's
      // document listener. We only close on Escape here as an extra guard.
      if (e.key === 'Escape') setTypeaheadVisible(false)
      return
    }
    // Typeahead not visible — handle Enter ourselves
    if (e.key === 'Enter' && inputValue.trim()) {
      commitQuery(inputValue)
    }
  }

  const handleInputFocus = () => {
    if (inputValue.length >= 2) setTypeaheadVisible(true)
  }

  const clearInput = () => {
    setInputValue('')
    setTypeaheadVisible(false)
    inputRef.current?.focus()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative border-b border-subtle"
      style={{ backgroundColor: 'var(--color-bg-surface)' }}
    >
      {/* Radial accent glow — top centre */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(109,95,255,0.18) 0%, transparent 65%)',
        }}
      />
      {/* Subtle dot-grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative max-w-screen-2xl mx-auto px-6 py-10 sm:py-14">

        {/* Headline */}
        <h1
          className="text-2xl sm:text-3xl font-bold text-primary text-center mb-2"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Find any card, artist or product
        </h1>
        <p className="text-sm text-muted text-center mb-8">
          Search the complete Pokémon TCG catalogue
        </p>

        {/* Search input + typeahead (positioned relative wrapper) */}
        <div ref={wrapperRef} className="relative max-w-2xl mx-auto">

          {/* Input row */}
          <div className="relative">
            {/* Search icon */}
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={typeaheadVisible}
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-label="Search cards, artists or products"
              placeholder={PLACEHOLDERS[mode]}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onFocus={handleInputFocus}
              autoFocus
              className="w-full h-12 bg-elevated border border-subtle rounded-xl pl-12 pr-12 text-base text-primary placeholder:text-muted focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition-all shadow-sm"
            />

            {/* Clear button */}
            {inputValue && (
              <button
                onClick={clearInput}
                aria-label="Clear search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-muted hover:text-primary hover:bg-surface transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Typeahead dropdown */}
          <BrowseTypeahead
            query={debouncedInput}
            mode={mode}
            allProducts={allProducts}
            visible={typeaheadVisible}
            onSelectCard={handleSelectCard}
            onSelectArtist={handleSelectArtist}
            onSelectProduct={handleSelectProduct}
            onSeeAll={handleSeeAll}
            onClose={() => setTypeaheadVisible(false)}
          />
        </div>

        {/* Mode tabs */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {MODES.map(m => (
            <button
              key={m.value}
              onClick={() => handleModeChange(m.value)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all',
                mode === m.value
                  ? 'bg-accent/15 text-accent border-accent/40 shadow-sm'
                  : 'text-secondary border-subtle hover:text-primary hover:border-accent/20 hover:bg-surface',
              )}
            >
              <span aria-hidden>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
