'use client'

import { cn } from '@/lib/utils'
import type { ArtistResult } from './types'

interface ArtistResultsProps {
  artists:        ArtistResult[]
  query:          string
  onArtistSelect: (artist: ArtistResult) => void
}

export default function ArtistResults({ artists, query, onArtistSelect }: ArtistResultsProps) {

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (artists.length === 0) {
    return (
      <div className="max-w-screen-2xl mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4">🎨</div>
        <p className="text-lg text-secondary mb-2">
          No artists found for &ldquo;{query}&rdquo;
        </p>
        <p className="text-sm text-muted">
          Try a partial name — e.g. &ldquo;Arita&rdquo;, &ldquo;Naoki&rdquo;, or &ldquo;5ban&rdquo;
        </p>
      </div>
    )
  }

  // ── Results ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6">

      {/* Header */}
      <div className="mb-6">
        <h2
          className="text-xl font-bold text-primary"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Artists matching{' '}
          <span className="text-accent">&ldquo;{query}&rdquo;</span>
        </h2>
        <p className="text-sm text-muted mt-1">
          {artists.length} artist{artists.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Artist card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {artists.map(artist => (
          <button
            key={artist.name}
            onClick={() => onArtistSelect(artist)}
            className="group text-left bg-elevated border border-subtle rounded-2xl overflow-hidden hover:border-accent/40 transition-all hover:shadow-lg hover:shadow-accent/10 focus-visible:ring-2 focus-visible:ring-accent"
          >
            {/* Sample card thumbnails (up to 3 in a horizontal strip) */}
            <div className="relative flex h-32 overflow-hidden bg-surface">
              {artist.sample_images.length > 0
                ? artist.sample_images.slice(0, 3).map((img, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex-1 overflow-hidden',
                        i < artist.sample_images.slice(0, 3).length - 1
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
                : (
                  <div className="flex-1 flex items-center justify-center text-4xl text-muted">
                    🎨
                  </div>
                )
              }

              {/* Gradient overlay at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-elevated to-transparent pointer-events-none" />
            </div>

            {/* Artist info */}
            <div className="px-4 py-3.5">
              <p className="font-semibold text-base text-primary group-hover:text-accent transition-colors leading-tight truncate">
                {artist.name}
              </p>
              <p className="text-sm text-muted mt-0.5">
                {artist.card_count.toLocaleString()} card{artist.card_count !== 1 ? 's' : ''}
              </p>

              {/* CTA */}
              <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                View all cards
                <svg className="w-3.5 h-3.5 translate-x-0 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
