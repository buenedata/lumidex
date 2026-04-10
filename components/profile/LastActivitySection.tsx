'use client'

import React, { useEffect, useState } from 'react'
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

/**
 * If updated_at is within 8 seconds of created_at we treat it as a fresh add
 * (the DB timestamps are set in the same transaction). Only used for sealed
 * products where we don't yet store a signed delta.
 */
function isNewAdd(created_at: string, updated_at: string): boolean {
  return new Date(updated_at).getTime() - new Date(created_at).getTime() < 8_000
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

// ── Delta badge ───────────────────────────────────────────────────────────────

/** Arrow-based quantity badge showing "before → after".
 *  - delta > 0  → green ↑  "N → M"
 *  - delta < 0  → red   ↓  "N → M"
 *  - delta null → grey  "×M"  (row predates delta tracking)
 */
function DeltaBadge({ delta, quantity }: { delta: number | null; quantity: number }) {
  if (delta !== null && delta > 0) {
    const before = quantity - delta
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-green-400">
        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1 L11 8 H7 V11 H5 V8 H1 Z" />
        </svg>
        {before} → {quantity}
      </span>
    )
  }
  if (delta !== null && delta < 0) {
    const before = quantity - delta
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-red-400">
        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 11 L1 4 H5 V1 H7 V4 H11 Z" />
        </svg>
        {before} → {quantity}
      </span>
    )
  }
  // Unknown direction (null delta or no change)
  return (
    <span className="inline-flex items-center text-[11px] font-semibold text-muted">
      ×{quantity}
    </span>
  )
}

/** Sealed-product badge: we don't track delta yet, so use heuristic. */
function ProductDeltaBadge({ created_at, updated_at, quantity }: {
  created_at: string
  updated_at: string
  quantity: number
}) {
  const isNew = isNewAdd(created_at, updated_at)
  if (isNew) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-green-400">
        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1 L11 8 H7 V11 H5 V8 H1 Z" />
        </svg>
        ×{quantity}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-[11px] font-semibold text-muted">
      ×{quantity}
    </span>
  )
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
      className="group flex-none w-28 flex flex-col items-center gap-1.5 focus:outline-none"
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
      <div className="w-full text-center space-y-0.5">
        <p className="text-[11px] font-medium text-primary leading-tight line-clamp-1">
          {item.card_name}
        </p>
        <p className="text-[10px] text-muted leading-tight line-clamp-1">
          {item.set_name}
          {item.variant_type && (
            <span className="text-muted/60"> · {variantLabel(item.variant_type)}</span>
          )}
        </p>
        {/* Delta badge */}
        <div className="flex justify-center pt-0.5">
          <DeltaBadge delta={item.quantity_delta} quantity={item.quantity} />
        </div>
        <p className="text-[10px] text-muted/60">{timeAgo(item.timestamp)}</p>
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
      className="group flex-none w-28 flex flex-col items-center gap-1.5 focus:outline-none"
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
      </div>

      {/* Text */}
      <div className="w-full text-center space-y-0.5">
        <p className="text-[11px] font-medium text-primary leading-tight line-clamp-1">
          {item.product_name}
        </p>
        <p className="text-[10px] text-muted leading-tight line-clamp-1">
          {item.set_name}
          {item.product_type && (
            <span className="text-muted/60"> · {item.product_type}</span>
          )}
        </p>
        {/* Delta badge (heuristic for sealed products) */}
        <div className="flex justify-center pt-0.5">
          <ProductDeltaBadge
            created_at={item.created_at}
            updated_at={item.timestamp}
            quantity={item.quantity}
          />
        </div>
        <p className="text-[10px] text-muted/60">{timeAgo(item.timestamp)}</p>
      </div>
    </Link>
  )
}

/** Skeleton placeholder tiles shown while loading */
function SkeletonTile() {
  return (
    <div className="flex-none w-28 flex flex-col items-center gap-1.5">
      <div className="skeleton w-16 h-[88px] rounded-lg" />
      <div className="skeleton h-2.5 w-16 rounded" />
      <div className="skeleton h-2 w-12 rounded" />
      <div className="skeleton h-3 w-8 rounded" />
      <div className="skeleton h-2 w-8 rounded" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface LastActivitySectionProps {
  userId: string
  isOwnProfile: boolean
  /** When true the heading uses a smaller compact style (Collection page). */
  compact?: boolean
}

export default function LastActivitySection({
  userId,
  isOwnProfile,
  compact = false,
}: LastActivitySectionProps): React.ReactElement | null {
  const [items,   setItems]   = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res  = await fetch(`/api/users/${userId}/last-activity`, { cache: 'no-store' })
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

  // Never show the section if viewing a public profile that has no activity.
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
        <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-thin">
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
        <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-thin">
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
