'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import ProductCard from '@/components/ProductCard'
import { cn } from '@/lib/utils'
import type { SeriesProductGroup } from '@/lib/pricing'
import type { PriceSource } from '@/types'

// ── Known product types for the type filter pills ─────────────────────────────
const KNOWN_PRODUCT_TYPES = [
  'Booster Pack',
  'Booster Box',
  'Elite Trainer Box',
  'ETB',
  'Booster Bundle',
  'Collection Box',
  'Tin',
  'Blister Pack',
]

interface ProductsPageClientProps {
  allSeries:       SeriesProductGroup[]
  initialSeries:   string   // 'All' or a specific series name
  ownedQuantities: Record<string, number>
  userId:          string | null
  currency:        string
  priceSource:     PriceSource
}

export default function ProductsPageClient({
  allSeries,
  initialSeries,
  ownedQuantities,
  userId,
  currency,
  priceSource,
}: ProductsPageClientProps) {
  const [activeSeries, setActiveSeries] = useState<string>(initialSeries)
  const [activeType,   setActiveType]   = useState<string>('All')

  // ── Collect all unique product types present in the data ──────────────────
  const availableTypes = useMemo(() => {
    const typeSet = new Set<string>()
    for (const group of allSeries) {
      for (const setGroup of group.sets) {
        for (const product of setGroup.products) {
          if (product.product_type) typeSet.add(product.product_type)
        }
      }
    }
    // Return in KNOWN_PRODUCT_TYPES order, then any unknown types alphabetically
    const known   = KNOWN_PRODUCT_TYPES.filter(t => typeSet.has(t))
    const unknown = [...typeSet].filter(t => !KNOWN_PRODUCT_TYPES.includes(t)).sort()
    return [...known, ...unknown]
  }, [allSeries])

  // ── Filter data by active series + active product type ───────────────────
  const filteredSeries = useMemo(() => {
    let groups = allSeries

    if (activeSeries !== 'All') {
      groups = groups.filter(g => g.series === activeSeries)
    }

    if (activeType === 'All') return groups

    // Filter products within each set within each series
    return groups
      .map(group => ({
        ...group,
        sets: group.sets
          .map(s => ({
            ...s,
            products: s.products.filter(
              p => p.product_type === activeType ||
                   p.product_type?.toLowerCase().includes(activeType.toLowerCase())
            ),
          }))
          .filter(s => s.products.length > 0),
      }))
      .filter(g => g.sets.length > 0)
  }, [allSeries, activeSeries, activeType])

  const totalVisible = useMemo(
    () => filteredSeries.reduce((sum, g) => sum + g.sets.reduce((s2, s) => s2 + s.products.length, 0), 0),
    [filteredSeries]
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="mb-8 space-y-4">
        {/* Series pill buttons */}
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-2">Series</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveSeries('All')}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
                activeSeries === 'All'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-surface border border-subtle text-secondary hover:border-accent/50 hover:text-primary'
              )}
            >
              All
            </button>
            {allSeries.map(group => (
              <button
                key={group.series}
                onClick={() => setActiveSeries(group.series)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
                  activeSeries === group.series
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-surface border border-subtle text-secondary hover:border-accent/50 hover:text-primary'
                )}
              >
                {group.series}
              </button>
            ))}
          </div>
        </div>

        {/* Product type filter pills */}
        {availableTypes.length > 0 && (
          <div>
            <p className="text-xs text-muted uppercase tracking-widest mb-2">Product Type</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveType('All')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
                  activeType === 'All'
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-surface border border-subtle text-secondary hover:border-accent/50 hover:text-primary'
                )}
              >
                All
              </button>
              {availableTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
                    activeType === type
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-surface border border-subtle text-secondary hover:border-accent/50 hover:text-primary'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {totalVisible === 0 && (
        <div className="text-center py-24">
          <div className="text-4xl mb-4">📦</div>
          <p className="text-muted mb-2">No products found</p>
          <p className="text-xs text-muted/70">
            Try a different series or product type filter
          </p>
        </div>
      )}

      {/* ── Series sections ──────────────────────────────────────────────── */}
      {filteredSeries.map(group => (
        <section key={group.series} className="mb-12">
          {/* Series heading — only show in "All" view */}
          {activeSeries === 'All' && (
            <div className="flex items-center gap-2 mb-6">
              <h2
                className="text-lg font-semibold"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {group.series}
              </h2>
              <span className="text-xs text-muted bg-elevated px-2 py-0.5 rounded-full">
                {group.sets.reduce((sum, s) => sum + s.products.length, 0)} products
              </span>
            </div>
          )}

          {/* Per-set sub-sections within the series */}
          {group.sets.map(setGroup => (
            <div key={setGroup.setId} className="mb-8">
              {/* Set heading */}
              <div className="flex items-center gap-3 mb-4">
                {setGroup.logoUrl && (
                  <Image
                    src={setGroup.logoUrl}
                    alt={setGroup.setName}
                    width={80}
                    height={40}
                    unoptimized
                    className="object-contain h-7 w-auto"
                  />
                )}
                <h3
                  className="text-sm font-semibold text-secondary"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {setGroup.setName}
                </h3>
                <span className="text-xs text-muted bg-elevated px-2 py-0.5 rounded-full">
                  {setGroup.products.length}
                </span>
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                {setGroup.products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    setName={setGroup.setName}
                    currency={currency}
                    priceSource={priceSource}
                    userId={userId}
                    initialQuantity={ownedQuantities[product.id] ?? 0}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
