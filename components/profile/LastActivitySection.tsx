'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ActivityItem } from '@/app/api/users/[id]/last-activity/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30)  return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const VARIANT_COLORS: Record<string, string> = {
  normal:     'bg-green-500',
  reverse:    'bg-blue-500',
  holo:       'bg-purple-500',
  pokeball:   'bg-red-500',
  masterball: 'bg-yellow-500',
}

const VARIANT_LABELS: Record<string, string> = {
  normal:     'Normal',
  reverse:    'Reverse',
  holo:       'Holo',
  pokeball:   'Pokéball',
  masterball: 'Masterball',
}

function variantColor(key: string | null): string {
  if (!key) return 'bg-gray-500'
  return VARIANT_COLORS[key.toLowerCase()] ?? 'bg-gray-500'
}

function variantLabel(key: string | null): string {
  if (!key) return ''
  return VARIANT_LABELS[key.toLowerCase()] ?? key
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** A single card activity tile */
function CardTile({ item }: { item: Extract<ActivityItem, { type: 'card' }> }) {
  const [imgError, setImgError] = useState(false)
  const imgSrc = (!item.card_image || imgError)
    ? '/pokemon_card_backside.png'
    : item.card_image

  return (
    <Link
      href={`/set/${item.set_id}`}
      className="group flex-none w-24 flex flex-col items-center gap-1.5 focus:outline-none"
    >
      {/* Card thumbnail */}
      <div className="relative w-16 h-[88px] rounded-lg overflow-hidden shadow-md
                      ring-1 ring-white/10
                      group-hover:ring-accent group-hover:shadow-accent/20
                      transition-all duration-200">
        <img
          src={imgSrc}
          alt={item.card_name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
        {/* Variant badge */}
        {item.variant_type && (
          <span
            className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full
                        border border-black/30 shadow-sm
                        ${variantColor(item.variant_type)}`}
            title={variantLabel(item.variant_type)}
          />
        )}
      </div>

      {/* Text */}
      <div className="w-full text-center">
        <p className="text-[11px] font-medium text-primary leading-tight line-clamp-1">
          {item.card_name}
        </p>
        <p className="text-[10px] text-muted leading-tight line-clamp-1 mt-0.5">
          {item.set_name}
        </p>
        <p className="text-[10px] text-muted/70 mt-0.5">{timeAgo(item.timestamp)}</p>
      </div>
    </Link>
  )
}

/** A single sealed-product activity tile */
function ProductTile({ item }: { item: Extract<ActivityItem, { type: 'sealed_product' }> }) {
  const [imgError, setImgError] = useState(false)
  const hasImg = !!item.product_image && !imgError

  return (
    <Link
      href={`/set/${item.set_id}`}
      className="group flex-none w-24 flex flex-col items-center gap-1.5 focus:outline-none"
    >
      {/* Product thumbnail */}
      <div className="relative w-16 h-[88px] rounded-lg overflow-hidden shadow-md
                      bg-surface border border-subtle
                      ring-1 ring-white/10
                      group-hover:ring-accent group-hover:shadow-accent/20
                      transition-all duration-200 flex items-center justify-center">
        {hasImg ? (
          <img
            src={item.product_image!}
            alt={item.product_name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-2xl select-none">📦</span>
        )}
        {/* Quantity badge */}
        {item.quantity > 1 && (
          <span
            className="absolute bottom-1 right-1 min-w-[18px] h-[18px] px-1
                       rounded-full bg-accent text-white text-[10px]
                       font-bold flex items-center justify-center shadow"
          >
            {item.quantity}
          </span>
        )}
      </div>

      {/* Text */}
      <div className="w-full text-center">
        <p className="text-[11px] font-medium text-primary leading-tight line-clamp-1">
          {item.product_name}
        </p>
        <p className="text-[10px] text-muted leading-tight line-clamp-1 mt-0.5">
          {item.set_name}
        </p>
        <p className="text-[10px] text-muted/70 mt-0.5">{timeAgo(item.timestamp)}</p>
      </div>
    </Link>
  )
}

/** Skeleton placeholder tiles shown while loading */
function SkeletonTile() {
  return (
    <div className="flex-none w-24 flex flex-col items-center gap-1.5">
      <div className="skeleton w-16 h-[88px] rounded-lg" />
      <div className="skeleton h-2.5 w-14 rounded" />
      <div className="skeleton h-2 w-10 rounded" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface LastActivitySectionProps {
  userId: string
  isOwnProfile: boolean
  /** When true the section heading is omitted (used on the Collection page
   *  where a heading already surrounds the stats block). */
  compact?: boolean
}

export default function LastActivitySection({
  userId,
  isOwnProfile,
  compact = false,
}: LastActivitySectionProps) {
  const [items,   setItems]   = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res  = await fetch(`/api/users/${userId}/last-activity`)
        const json = await res.json()
        if (!cancelled) setItems(json.data ?? [])
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  // Never show the section if the profile is public, not the owner, and there
  // is genuinely nothing to display once loaded.
  if (!loading && items.length === 0 && !isOwnProfile) return null

  return (
    <section className="mb-8">
      {!compact && (
        <h2
          className="text-xl font-bold text-primary mb-4"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Last Activity
        </h2>
      )}

      {compact && (
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Last Activity
        </h3>
      )}

      {loading ? (
        /* ── Skeleton ────────────────────────────────────────────────────── */
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonTile key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        /* ── Empty state (own profile only) ─────────────────────────────── */
        <div className="bg-surface border border-subtle rounded-xl p-6 flex items-center gap-3 text-sm text-secondary">
          <span className="text-xl">🕐</span>
          <span>No recent activity yet — start adding cards to your collection!</span>
        </div>
      ) : (
        /* ── Activity row ────────────────────────────────────────────────── */
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {items.map((item, idx) =>
            item.type === 'card' ? (
              <CardTile key={`card-${item.card_id}-${idx}`} item={item} />
            ) : (
              <ProductTile key={`product-${item.product_id}-${idx}`} item={item} />
            )
          )}
        </div>
      )}
    </section>
  )
}
