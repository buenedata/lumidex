'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCollectionStore } from '@/lib/store'
import { getCardImageUrl } from '@/lib/imageUpload'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ArtistCard {
  id:      string
  name:    string
  image:   string | null
  set_id:  string | null
  /** Supabase returns the joined set as a single object (many-to-one FK), never an array. */
  sets:    { name: string; symbol: string | null; setComplete: number | null } | null
  number:  string | null
  rarity:  string | null
}

interface ArtistDetailClientProps {
  artistName:   string
  initialCards: ArtistCard[]
}

// ── Single card tile ──────────────────────────────────────────────────────────

function CardTile({ card, collectionQty }: { card: ArtistCard; collectionQty: number }) {
  // Mirror the fallback chain in getCardImageWithFallback:
  // 1. cards.image (R2 webp / direct URL stored in DB)
  // 2. Legacy R2 key derived from set_id + number (for cards uploaded before the image column was backfilled)
  // 3. Card-back placeholder
  const imgSrc = card.image
    ?? (card.set_id && card.number ? getCardImageUrl(card.set_id, card.number) : null)
    ?? '/pokemon_card_backside.png'
  const setName     = card.sets?.name ?? null
  const setSymbol   = card.sets?.symbol ?? null
  const setComplete = card.sets?.setComplete ?? null

  // Format card number as "#024/102" — number field contains e.g. "024", setComplete from set join
  const numberDisplay = card.number
    ? `#${card.number}${setComplete ? `/${setComplete}` : ''}`
    : null

  return (
    <div className="group relative flex flex-col rounded-xl overflow-hidden bg-elevated border border-subtle hover:border-accent/40 transition-all duration-200 hover:shadow-lg hover:shadow-accent/10">
      {/* Collection quantity badge — top-right corner of the card image */}
      <div className="absolute top-1.5 right-1.5 z-10">
        {collectionQty > 0 ? (
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[11px] font-bold text-white bg-purple-500 shadow-sm tabular-nums">
            {collectionQty}
          </span>
        ) : (
          <span className="flex items-center justify-center w-5 h-5 rounded border border-gray-600/50 bg-gray-800/30" />
        )}
      </div>

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
        {/* Pokémon name */}
        <p className="text-sm font-semibold text-primary leading-tight line-clamp-2 group-hover:text-accent transition-colors">
          {card.name}
        </p>

        {/* Card number with # prefix */}
        {numberDisplay && (
          <p className="text-xs text-muted">{numberDisplay}</p>
        )}

        {/* Set symbol + set name */}
        {setName && (
          <div className="flex items-center gap-1 min-w-0">
            {setSymbol && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={setSymbol}
                alt=""
                className="w-4 h-4 object-contain shrink-0 opacity-75"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <span className="text-xs text-muted truncate">{setName}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ArtistDetailClient({ artistName, initialCards }: ArtistDetailClientProps) {
  const [bio, setBio]           = useState<string | null>(null)
  const [bioLoading, setBioLoading] = useState(true)

  // Collection store — fetches and caches the user's owned quantities
  const { userCards, fetchUserCards } = useCollectionStore()
  useEffect(() => { fetchUserCards() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
              <CardTile
                key={card.id}
                card={card}
                collectionQty={userCards.get(card.id)?.quantity ?? 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
