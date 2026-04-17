'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ArtistCard {
  id:      string
  name:    string
  image:   string | null
  set_id:  string | null
  sets:    { name: string }[] | null
  number:  string | null
  rarity:  string | null
}

interface ArtistDetailClientProps {
  artistName:   string
  initialCards: ArtistCard[]
}

// ── Rarity badge colours ───────────────────────────────────────────────────────

function rarityColour(rarity: string | null): string {
  if (!rarity) return 'bg-gray-700 text-gray-300'
  const r = rarity.toLowerCase()
  if (r.includes('secret'))        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
  if (r.includes('ultra'))         return 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
  if (r.includes('rare') && r.includes('holo')) return 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
  if (r.includes('rare'))          return 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
  if (r.includes('uncommon'))      return 'bg-green-500/20 text-green-300 border border-green-500/30'
  return 'bg-gray-700/60 text-gray-400'
}

// ── Single card tile ──────────────────────────────────────────────────────────

function CardTile({ card }: { card: ArtistCard }) {
  const imgSrc = card.image ?? '/pokemon_card_backside.png'

  return (
    <div className="group flex flex-col rounded-xl overflow-hidden bg-elevated border border-subtle hover:border-accent/40 transition-all duration-200 hover:shadow-lg hover:shadow-accent/10">
      {/* Card image */}
      <div className="relative aspect-[2.5/3.5] bg-surface overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={card.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).src = '/pokemon_card_backside.png'
          }}
        />
      </div>

      {/* Card info */}
      <div className="px-3 py-2.5 flex flex-col gap-1">
        <p className="text-sm font-semibold text-primary leading-tight line-clamp-2 group-hover:text-accent transition-colors">
          {card.name}
        </p>

        {(card.sets?.[0]?.name ?? card.set_id) && (
          <p className="text-xs text-muted truncate">{card.sets?.[0]?.name ?? card.set_id}{card.number ? ` · ${card.number}` : ''}</p>
        )}

        {card.rarity && (
          <span className={`self-start mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${rarityColour(card.rarity)}`}>
            {card.rarity}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ArtistDetailClient({ artistName, initialCards }: ArtistDetailClientProps) {
  const [bio, setBio]           = useState<string | null>(null)
  const [bioLoading, setBioLoading] = useState(true)

  // ── Fetch AI/placeholder bio ──────────────────────────────────────────────
  useEffect(() => {
    const encodedName = encodeURIComponent(artistName)
    fetch(`/api/artists/${encodedName}/bio`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.bio) setBio(json.bio)
      })
      .catch(() => {/* silently ignore bio errors */})
      .finally(() => setBioLoading(false))
  }, [artistName])

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="max-w-screen-2xl mx-auto px-6 py-8">

        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-1.5 text-xs text-muted mb-6">
          <Link href="/browse" className="hover:text-accent transition-colors">Browse</Link>
          <span>/</span>
          <Link href="/artists" className="hover:text-accent transition-colors">Artists</Link>
          <span>/</span>
          <span className="text-secondary truncate max-w-[200px]">{artistName}</span>
        </nav>

        {/* ── Hero section ────────────────────────────────────────────────── */}
        <div className="mb-10 p-6 rounded-2xl bg-elevated border border-subtle">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {/* Icon */}
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-3xl">
              🎨
            </div>

            <div className="flex-1 min-w-0">
              {/* Name + badge row */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h1
                  className="text-3xl font-bold text-primary"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {artistName}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-semibold">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3 4a2 2 0 00-2 2v1h18V6a2 2 0 00-2-2H3zM1 12v2a2 2 0 002 2h14a2 2 0 002-2v-2H1z" />
                  </svg>
                  {initialCards.length.toLocaleString()} card{initialCards.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Bio */}
              {bioLoading ? (
                <div className="space-y-2">
                  <div className="h-4 rounded bg-surface animate-pulse w-full" />
                  <div className="h-4 rounded bg-surface animate-pulse w-5/6" />
                  <div className="h-4 rounded bg-surface animate-pulse w-4/6" />
                </div>
              ) : bio ? (
                <div className="space-y-3">
                  {bio.split('\n\n').map((para, i) => (
                    <p key={i} className="text-secondary text-sm leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm italic">
                  No bio available for this artist.
                </p>
              )}
            </div>
          </div>

          {/* Back link */}
          <div className="mt-5 pt-4 border-t border-subtle">
            <Link
              href="/artists"
              className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to all artists
            </Link>
          </div>
        </div>

        {/* ── Card grid ───────────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between">
          <h2
            className="text-lg font-semibold text-primary"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            All illustrated cards
            <span className="ml-2 text-sm font-normal text-muted">
              ({initialCards.length.toLocaleString()})
            </span>
          </h2>
        </div>

        {initialCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-5xl mb-4">🎨</span>
            <p className="text-secondary text-lg font-medium">No cards found</p>
            <p className="text-muted text-sm mt-1">
              We couldn't find any cards illustrated by {artistName}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
            {initialCards.map(card => (
              <CardTile key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
