'use client'

import Link from 'next/link'
import type { DiscoveryData, ArtistResult } from './types'

// ── Curated popular search terms ─────────────────────────────────────────────
const POPULAR_SEARCHES = [
  'Pikachu', 'Charizard', 'Mewtwo', 'Eevee', 'Rayquaza',
  'Lugia', 'Gengar', 'Snorlax', 'Mew', 'Bulbasaur',
]

// ── Component ─────────────────────────────────────────────────────────────────

interface BrowseDiscoveryProps {
  data:           DiscoveryData
  onSearch:       (query: string) => void
  onArtistSelect: (artist: ArtistResult) => void
}

export default function BrowseDiscovery({ data, onSearch, onArtistSelect }: BrowseDiscoveryProps) {
  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-10 space-y-14">

      {/* ── Popular searches ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
          Popular Searches
        </h2>
        <div className="flex flex-wrap gap-2">
          {POPULAR_SEARCHES.map(q => (
            <button
              key={q}
              onClick={() => onSearch(q)}
              className="px-4 py-2 rounded-full bg-elevated border border-subtle text-sm text-secondary hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      {/* ── Featured artists ────────────────────────────────────────────── */}
      {data.featuredArtists.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">
              Featured Artists
            </h2>
            <Link href="/artists" className="text-xs text-accent hover:underline">
              Browse all artists →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.featuredArtists.map(artist => (
              <button
                key={artist.name}
                onClick={() => onArtistSelect(artist)}
                className="group text-left bg-elevated border border-subtle rounded-2xl overflow-hidden hover:border-accent/40 transition-all hover:shadow-md hover:shadow-accent/10 focus-visible:ring-2 focus-visible:ring-accent"
              >
                {/* Card thumbnails */}
                <div className="flex h-24 overflow-hidden bg-surface">
                  {artist.sample_images.slice(0, 3).map((img, i) => (
                    <div
                      key={i}
                      className="flex-1 overflow-hidden border-r border-subtle/40 last:border-r-0"
                    >
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  ))}
                  {artist.sample_images.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-3xl text-muted">🎨</div>
                  )}
                </div>

                {/* Info */}
                <div className="px-3 py-2.5">
                  <p className="text-sm font-semibold text-primary group-hover:text-accent transition-colors truncate">
                    {artist.name}
                  </p>
                  <p className="text-xs text-muted">
                    {artist.card_count.toLocaleString()} cards
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent sets ─────────────────────────────────────────────────── */}
      {data.recentSets.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">
              Recent Sets
            </h2>
            <Link href="/sets" className="text-xs text-accent hover:underline">
              Browse all sets →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.recentSets.map(set => (
              <Link
                key={set.id}
                href={`/set/${set.id}`}
                className="group flex flex-col items-center bg-elevated border border-subtle rounded-2xl p-5 hover:border-accent/40 transition-all hover:shadow-md hover:shadow-accent/10"
              >
                {set.logo_url
                  ? (
                    <img
                      src={set.logo_url}
                      alt={set.name}
                      className="h-12 w-auto object-contain mb-3 group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  )
                  : (
                    <div className="h-12 flex items-center justify-center text-3xl mb-3">🃏</div>
                  )
                }

                <p className="text-sm font-semibold text-primary group-hover:text-accent transition-colors text-center leading-snug">
                  {set.name}
                </p>
                {set.series && (
                  <p className="text-xs text-muted mt-0.5">{set.series}</p>
                )}
                {set.total != null && (
                  <p className="text-xs text-muted">{set.total} cards</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 justify-center pt-4 border-t border-subtle">
        <Link
          href="/sets"
          className="px-5 py-2.5 rounded-xl bg-elevated border border-subtle text-sm text-secondary hover:text-primary hover:border-accent/30 transition-all"
        >
          📚 Browse Sets
        </Link>
        <Link
          href="/artists"
          className="px-5 py-2.5 rounded-xl bg-elevated border border-subtle text-sm text-secondary hover:text-primary hover:border-accent/30 transition-all"
        >
          🎨 Browse Artists
        </Link>
        <Link
          href="/products"
          className="px-5 py-2.5 rounded-xl bg-elevated border border-subtle text-sm text-secondary hover:text-primary hover:border-accent/30 transition-all"
        >
          📦 Browse Products
        </Link>
        <Link
          href="/collection"
          className="px-5 py-2.5 rounded-xl bg-elevated border border-subtle text-sm text-secondary hover:text-primary hover:border-accent/30 transition-all"
        >
          ✨ My Collection
        </Link>
      </div>
    </div>
  )
}
