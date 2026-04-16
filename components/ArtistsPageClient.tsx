'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Artist {
  name:          string
  card_count:    number
  sample_images: string[]
}

// ── Artist Card ───────────────────────────────────────────────────────────────

function ArtistCard({ artist }: { artist: Artist }) {
  const encodedName = encodeURIComponent(artist.name)

  return (
    <Link
      href={`/artists/${encodedName}`}
      className="group text-left bg-elevated border border-subtle rounded-2xl overflow-hidden hover:border-accent/40 transition-all duration-200 hover:shadow-lg hover:shadow-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Sample card thumbnails ─ horizontal strip */}
      <div className="relative flex h-32 overflow-hidden bg-surface">
        {artist.sample_images.length > 0 ? (
          artist.sample_images.slice(0, 3).map((img, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 overflow-hidden',
                i < Math.min(artist.sample_images.length, 3) - 1
                  ? 'border-r border-subtle/40'
                  : '',
              )}
            >
              <img
                src={img}
                alt=""
                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center text-4xl text-muted">
            🎨
          </div>
        )}

        {/* Gradient fade at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-elevated to-transparent pointer-events-none" />

        {/* Palette icon badge */}
        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-xs leading-none">
          🎨
        </div>
      </div>

      {/* Artist info */}
      <div className="px-4 py-3.5">
        <p className="font-semibold text-base text-primary group-hover:text-accent transition-colors leading-tight truncate">
          {artist.name}
        </p>
        <p className="text-sm text-muted mt-0.5">
          {artist.card_count.toLocaleString()} card{artist.card_count !== 1 ? 's' : ''}
        </p>

        {/* Hover CTA */}
        <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          View all cards
          <svg
            className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ArtistsPageClient() {
  const [artists, setArtists]     = useState<Artist[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [searchQuery, setSearch]  = useState('')
  const [sortBy, setSortBy]       = useState<'count' | 'name'>('count')

  // ── Fetch all artists on mount ────────────────────────────────────────────
  const fetchArtists = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/artists?limit=1000')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setArtists(json.artists ?? [])
    } catch (err) {
      console.error('[ArtistsPageClient] fetch error:', err)
      setError('Failed to load artists. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchArtists()
  }, [fetchArtists])

  // ── Client-side filter + sort ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = artists

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(a => a.name.toLowerCase().includes(q))
    }

    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    }
    // 'count' is already the default sort from the API

    return list
  }, [artists, searchQuery, sortBy])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalCards = useMemo(
    () => artists.reduce((sum, a) => sum + a.card_count, 0),
    [artists],
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Stats banner ─────────────────────────────────────────────────── */}
      {!loading && artists.length > 0 && (
        <div className="flex flex-wrap gap-6 mb-8 p-4 bg-elevated border border-subtle rounded-2xl">
          <div className="text-center">
            <p className="text-2xl font-bold text-accent" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {artists.length.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-0.5">Artists</p>
          </div>
          <div className="w-px bg-subtle" />
          <div className="text-center">
            <p className="text-2xl font-bold text-primary" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {totalCards.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-0.5">Cards illustrated</p>
          </div>
          {searchQuery && (
            <>
              <div className="w-px bg-subtle" />
              <div className="text-center">
                <p className="text-2xl font-bold text-secondary" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                  {filtered.length.toLocaleString()}
                </p>
                <p className="text-xs text-muted mt-0.5">Matching</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Search + sort bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search artists…"
            value={searchQuery}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 bg-surface border border-subtle rounded-lg pl-9 pr-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort segmented control */}
        <div className="flex items-center bg-surface border border-subtle rounded-lg p-1 gap-1 shrink-0">
          <button
            onClick={() => setSortBy('count')}
            className={cn(
              'px-3 py-1 rounded text-sm font-medium transition-all duration-150 select-none',
              sortBy === 'count'
                ? 'bg-accent text-white shadow-sm'
                : 'text-secondary hover:text-primary',
            )}
          >
            Most cards
          </button>
          <button
            onClick={() => setSortBy('name')}
            className={cn(
              'px-3 py-1 rounded text-sm font-medium transition-all duration-150 select-none',
              sortBy === 'name'
                ? 'bg-accent text-white shadow-sm'
                : 'text-secondary hover:text-primary',
            )}
          >
            A → Z
          </button>
        </div>
      </div>

      {/* ── Loading state ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="skeleton rounded-2xl h-52" />
          ))}
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-secondary mb-4">{error}</p>
          <button
            onClick={fetchArtists}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">🎨</div>
          {searchQuery ? (
            <>
              <p className="text-lg text-secondary mb-2">
                No artists found for &ldquo;{searchQuery}&rdquo;
              </p>
              <p className="text-sm text-muted mb-4">
                Try a partial name — e.g. &ldquo;Arita&rdquo;, &ldquo;Naoki&rdquo;, or &ldquo;5ban&rdquo;
              </p>
              <button
                onClick={() => setSearch('')}
                className="text-sm text-accent hover:underline"
              >
                Clear search
              </button>
            </>
          ) : (
            <p className="text-secondary">No artists found in the database.</p>
          )}
        </div>
      )}

      {/* ── Artist grid ───────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(artist => (
            <ArtistCard key={artist.name} artist={artist} />
          ))}
        </div>
      )}

      {/* ── Result count footer ───────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <p className="mt-8 text-xs text-muted text-center">
          Showing {filtered.length.toLocaleString()} of {artists.length.toLocaleString()} artists
        </p>
      )}
    </div>
  )
}
