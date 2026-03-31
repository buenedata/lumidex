'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { formatPrice, EUR_TO_USD, type SetProductPrice } from '@/lib/pricing'
import type { PriceSource } from '@/types'

// ── Product type badge colours ────────────────────────────────────────────────
const PRODUCT_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  'Booster Pack':    { bg: 'bg-green-500/15',  text: 'text-green-400',  label: 'Booster Pack'    },
  'Booster Box':     { bg: 'bg-blue-500/15',   text: 'text-blue-400',   label: 'Booster Box'     },
  'Elite Trainer Box': { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'ETB'            },
  'ETB':             { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'ETB'              },
  'Booster Bundle':  { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'Bundle'           },
  'Collection Box':  { bg: 'bg-pink-500/15',   text: 'text-pink-400',   label: 'Collection Box'  },
  'Tin':             { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'Tin'              },
  'Blister Pack':    { bg: 'bg-teal-500/15',   text: 'text-teal-400',   label: 'Blister'         },
}

function getProductTypeStyle(type: string | null) {
  if (!type) return { bg: 'bg-gray-500/15', text: 'text-gray-400', label: 'Product' }
  // Exact match first
  if (PRODUCT_TYPE_STYLES[type]) return PRODUCT_TYPE_STYLES[type]
  // Partial match
  for (const [key, style] of Object.entries(PRODUCT_TYPE_STYLES)) {
    if (type.toLowerCase().includes(key.toLowerCase())) return style
  }
  return { bg: 'bg-gray-500/15', text: 'text-gray-400', label: type }
}

interface ProductCardProps {
  product:          SetProductPrice
  setName:          string
  currency:         string
  /** User's preferred price source — drives which price is shown first */
  priceSource:      PriceSource
  userId:           string | null
  initialQuantity?: number
}

export default function ProductCard({
  product,
  setName,
  currency,
  priceSource,
  userId,
  initialQuantity = 0,
}: ProductCardProps) {
  const [quantity, setQuantity]   = useState(initialQuantity)
  const [saving,   setSaving]     = useState(false)

  const typeStyle = getProductTypeStyle(product.product_type)

  // Resolve best price in USD honouring the user's preferred price source.
  // CardMarket prices are stored in EUR — convert to USD for uniform math.
  const priceUSD: number | null = (() => {
    if (priceSource === 'tcgplayer') {
      // Prefer TCGPlayer market; fall back to CardMarket converted to USD
      if (product.tcgp_market != null) return product.tcgp_market
      const cm = product.cm_avg_sell ?? product.cm_trend
      return cm != null ? Math.round(cm * EUR_TO_USD * 100) / 100 : null
    } else {
      // CardMarket preferred: prefer cm_avg_sell, fall back to tcgp_market
      const cm = product.cm_avg_sell ?? product.cm_trend
      if (cm != null) return Math.round(cm * EUR_TO_USD * 100) / 100
      return product.tcgp_market ?? null
    }
  })()

  const priceSourceLabel = priceSource === 'tcgplayer' ? 'TCGPlayer' : 'CardMarket'
  const productUrl = priceSource === 'tcgplayer' ? product.tcgp_url : (product.cm_url ?? product.tcgp_url)

  const updateQuantity = useCallback(async (newQty: number) => {
    if (!userId || saving) return
    const clamped = Math.max(0, newQty)
    setQuantity(clamped)  // optimistic
    setSaving(true)
    try {
      const res = await fetch('/api/user-sealed-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, productId: product.id, quantity: clamped }),
      })
      if (!res.ok) {
        // Revert on failure
        setQuantity(quantity)
        console.error('[ProductCard] Failed to update quantity')
      }
    } catch {
      setQuantity(quantity)
    } finally {
      setSaving(false)
    }
  }, [userId, saving, product.id, quantity])

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl overflow-hidden',
        'bg-surface border border-subtle',
        'hover:border-accent/40 hover:shadow-[0_0_16px_rgba(109,95,255,0.1)]',
        'transition-all duration-200'
      )}
    >
      {/* Header strip with product type colour */}
      <div className={cn('h-1 w-full', typeStyle.bg.replace('/15', '/60'))} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Product type badge + set name */}
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              typeStyle.bg, typeStyle.text
            )}
          >
            {typeStyle.label}
          </span>
          <span className="text-xs text-muted text-right leading-tight shrink-0 max-w-[45%] line-clamp-1">
            {setName}
          </span>
        </div>

        {/* Product name */}
        <h3
          className="font-semibold text-sm text-primary leading-snug line-clamp-2 flex-1"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {product.name}
        </h3>

        {/* Price */}
        <div className="flex items-end justify-between gap-2">
          <div>
            {priceUSD !== null ? (
              <p className="text-base font-bold text-accent">
                {formatPrice(priceUSD, currency)}
              </p>
            ) : (
              <p className="text-sm text-muted italic">Price unavailable</p>
            )}
            {productUrl && (
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted hover:text-accent transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  {priceSourceLabel} ↗
                </a>
              )}
          </div>

          {/* Quantity controls */}
          {userId ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => updateQuantity(quantity - 1)}
                disabled={saving || quantity === 0}
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold transition-all',
                  'bg-elevated border border-subtle hover:border-accent/50 hover:text-accent',
                  'disabled:opacity-30 disabled:cursor-not-allowed'
                )}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span
                className={cn(
                  'w-8 text-center text-sm font-semibold tabular-nums',
                  quantity > 0 ? 'text-accent' : 'text-muted'
                )}
              >
                {saving ? '…' : quantity}
              </span>
              <button
                onClick={() => updateQuantity(quantity + 1)}
                disabled={saving}
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold transition-all',
                  'bg-elevated border border-subtle hover:border-accent/50 hover:text-accent',
                  'disabled:opacity-30 disabled:cursor-not-allowed'
                )}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted italic">Log in to track</p>
          )}
        </div>
      </div>
    </div>
  )
}
