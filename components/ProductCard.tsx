'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useItemPrice } from '@/hooks/useItemPrice'
import { useAuthStore } from '@/lib/store'
import { fmtCardPrice } from '@/lib/currency'

// ── Known product types ───────────────────────────────────────────────────────
export const PRODUCT_TYPES = [
  'Booster Pack',
  'Booster Box',
  'Elite Trainer Box',
  'ETB',
  'Booster Bundle',
  'Collection Box',
  'Tin',
  'Blister Pack',
  'Other',
]

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
  if (PRODUCT_TYPE_STYLES[type]) return PRODUCT_TYPE_STYLES[type]
  for (const [key, style] of Object.entries(PRODUCT_TYPE_STYLES)) {
    if (type.toLowerCase().includes(key.toLowerCase())) return style
  }
  return { bg: 'bg-gray-500/15', text: 'text-gray-400', label: type }
}

interface SealedProduct {
  id:             string
  api_product_id: string | null
  name:           string
  product_type:   string | null
  image_url:      string | null
}

interface ProductCardProps {
  product:          SealedProduct
  setName:          string
  userId:           string | null
  initialQuantity?: number
  isAdmin?:         boolean
}

export default function ProductCard({
  product,
  setName,
  userId,
  initialQuantity = 0,
  isAdmin = false,
}: ProductCardProps) {
  const [quantity,    setQuantity]    = useState(initialQuantity)
  const [saving,      setSaving]      = useState(false)
  const [productType, setProductType] = useState<string | null>(product.product_type)
  const [typesaving,  setTypeSaving]  = useState(false)

  const { profile } = useAuthStore()
  const userCurrency: string = (profile as any)?.preferred_currency ?? 'USD'

  const typeStyle = getProductTypeStyle(productType)

  const handleTypeChange = useCallback(async (newType: string) => {
    setProductType(newType)
    setTypeSaving(true)
    try {
      await fetch(`/api/admin/set-products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_type: newType }),
      })
    } catch {
      console.error('[ProductCard] Failed to update product type')
    } finally {
      setTypeSaving(false)
    }
  }, [product.id])
  const { price, loading: priceLoading } = useItemPrice(product.api_product_id, 'product', 'normal')

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

      {/* Product image (if available) */}
      {product.image_url && (
        <div className="w-full bg-elevated flex items-center justify-center overflow-hidden" style={{ maxHeight: '160px' }}>
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-40 object-contain"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Product type badge (or admin dropdown) + set name */}
        <div className="flex items-start justify-between gap-2">
          {isAdmin ? (
            <select
              value={productType ?? ''}
              onChange={e => handleTypeChange(e.target.value)}
              disabled={typesaving}
              className={cn(
                'pill text-xs font-medium rounded-full px-2 py-0.5 border cursor-pointer',
                'bg-surface border-subtle text-secondary hover:border-accent/50',
                'disabled:opacity-50'
              )}
            >
              {PRODUCT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          ) : (
            <span
              className={cn(
                'pill inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                typeStyle.bg, typeStyle.text
              )}
            >
              {typeStyle.label}
            </span>
          )}
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
        <div className="text-right">
          {priceLoading ? (
            <span className="text-xs text-muted animate-pulse">Loading…</span>
          ) : price !== null ? (
            <span className="text-sm font-semibold text-accent">
              {fmtCardPrice({ eur: price, usd: null }, userCurrency) ?? `EUR ${price.toFixed(2)}`}
            </span>
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </div>

        {/* Quantity controls */}
        <div className="flex items-end justify-end gap-2">
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
