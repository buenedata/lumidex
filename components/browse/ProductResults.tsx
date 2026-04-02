'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { BrowseProduct } from './types'

// ── Product type badge styles ─────────────────────────────────────────────────

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  'Booster Pack':      { bg: 'bg-green-500/15',  text: 'text-green-400'  },
  'Booster Box':       { bg: 'bg-blue-500/15',   text: 'text-blue-400'   },
  'Elite Trainer Box': { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  'ETB':               { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  'Booster Bundle':    { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  'Bundle':            { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  'Collection Box':    { bg: 'bg-pink-500/15',   text: 'text-pink-400'   },
  'Tin':               { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  'Blister Pack':      { bg: 'bg-teal-500/15',   text: 'text-teal-400'   },
}

function getTypeStyle(type: string | null): { bg: string; text: string } {
  if (!type) return { bg: 'bg-surface', text: 'text-muted' }
  if (TYPE_STYLES[type]) return TYPE_STYLES[type]
  for (const [key, s] of Object.entries(TYPE_STYLES)) {
    if (type.toLowerCase().includes(key.toLowerCase())) return s
  }
  return { bg: 'bg-surface', text: 'text-muted' }
}

function shortType(type: string): string {
  const map: Record<string, string> = {
    'Elite Trainer Box': 'ETB',
    'Booster Bundle':    'Bundle',
    'Collection Box':    'Coll. Box',
    'Blister Pack':      'Blister',
  }
  return map[type] ?? type
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ProductResultsProps {
  products: BrowseProduct[]
  query:    string
}

export default function ProductResults({ products, query }: ProductResultsProps) {

  const filtered = useMemo(() => {
    if (!query.trim()) return products
    const q = query.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.set_name.toLowerCase().includes(q) ||
      (p.product_type?.toLowerCase().includes(q) ?? false) ||
      p.series.toLowerCase().includes(q),
    )
  }, [products, query])

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (filtered.length === 0) {
    return (
      <div className="max-w-screen-2xl mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4">📦</div>
        <p className="text-lg text-secondary mb-2">
          No products found for &ldquo;{query}&rdquo;
        </p>
        <p className="text-sm text-muted mb-6">
          Try searching by set name, product type, or series
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/15 text-accent border border-accent/30 text-sm font-medium hover:bg-accent/20 transition-colors"
        >
          Browse all products →
        </Link>
      </div>
    )
  }

  // ── Results ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2
            className="text-xl font-bold text-primary"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Products matching{' '}
            <span className="text-accent">&ldquo;{query}&rdquo;</span>
          </h2>
          <p className="text-sm text-muted mt-1">
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/products" className="shrink-0 text-sm text-accent hover:underline mt-1">
          Browse all →
        </Link>
      </div>

      {/* Products grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filtered.map(product => {
          const { bg, text } = getTypeStyle(product.product_type)
          return (
            <Link
              key={product.id}
              href={`/products?series=${encodeURIComponent(product.series)}`}
              className="group flex flex-col bg-elevated border border-subtle rounded-xl overflow-hidden hover:border-accent/40 transition-all hover:shadow-lg hover:shadow-accent/10"
            >
              {/* Product image */}
              <div className="aspect-square overflow-hidden bg-surface flex items-center justify-center p-3">
                {product.image_url
                  ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  )
                  : (
                    <div className="text-4xl text-muted">📦</div>
                  )
                }
              </div>

              {/* Product info */}
              <div className="p-3 flex flex-col gap-1 flex-1">
                <p className="text-xs font-medium text-primary leading-snug line-clamp-2 min-h-[2.5em]">
                  {product.name}
                </p>
                <p className="text-xs text-muted truncate">{product.set_name}</p>

                {/* Type badge + price row */}
                <div className="flex items-center justify-between mt-auto pt-1.5 gap-1">
                  {product.product_type && (
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0', bg, text)}>
                      {shortType(product.product_type)}
                    </span>
                  )}
                  {product.tcgp_market != null && (
                    <span className="text-xs font-semibold text-price ml-auto">
                      ${product.tcgp_market.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
