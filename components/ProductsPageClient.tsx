'use client'

import { useState, useMemo, useCallback } from 'react'
import ProductCard from '@/components/ProductCard'
import MissingProductModal from '@/components/MissingProductModal'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import type { SeriesProductGroup } from '@/types'

// ── Known product types for the type filter pills ─────────────────────────────
const KNOWN_PRODUCT_TYPES = [
  'Booster Pack',
  'Booster Box',
  'ETB',
  'Booster Bundle',
  'Collection Box',
  'Tin',
  'Blister Pack',
  'Sleeved Booster',
  'Case',
  'Other',
]

interface ProductsPageClientProps {
  allSeries:       SeriesProductGroup[]
  initialSeries:   string   // 'All' or a specific series name
  ownedQuantities: Record<string, number>
  userId:          string | null
}

export default function ProductsPageClient({
  allSeries,
  initialSeries,
  ownedQuantities,
  userId,
}: ProductsPageClientProps) {
  const { profile } = useAuthStore()
  const isAdmin = (profile as any)?.role === 'admin'

  const [activeSeries,         setActiveSeries]         = useState<string>(initialSeries)
  const [activeType,           setActiveType]           = useState<string>('All')
  const [collapsedSets,        setCollapsedSets]        = useState<Set<string>>(new Set())
  const [missingProductOpen,   setMissingProductOpen]   = useState(false)

  const toggleSet = useCallback((setId: string) => {
    setCollapsedSets(prev => {
      const next = new Set(prev)
      if (next.has(setId)) next.delete(setId)
      else next.add(setId)
      return next
    })
  }, [])

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
                'pill px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
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
                  'pill px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
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
                  'pill px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
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
                    'pill px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
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

        {/* Missing a Product? button */}
        <div className="flex justify-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted uppercase tracking-wider select-none">Report</span>
            <button
              onClick={() => setMissingProductOpen(true)}
              title="Report a sealed product that is missing from the database"
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
                'border border-subtle bg-surface text-secondary',
                'hover:border-accent/50 hover:text-primary transition-all duration-150 cursor-pointer'
              )}
            >
              <span className="text-base leading-none" aria-hidden>📦</span>
              <span>Missing a Product?</span>
            </button>
          </div>
        </div>
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
              <span className="pill text-xs text-muted bg-elevated px-2 py-0.5 rounded-full">
                {group.sets.reduce((sum, s) => sum + s.products.length, 0)} products
              </span>
            </div>
          )}

          {/* Per-set sub-sections within the series */}
          {group.sets.map(setGroup => {
            const isCollapsed = collapsedSets.has(setGroup.setId)
            return (
              <div key={setGroup.setId} className="mb-8">
                {/* Set heading — click anywhere to toggle */}
                <button
                  type="button"
                  onClick={() => toggleSet(setGroup.setId)}
                  className="flex items-center gap-3 mb-4 group text-left"
                >
                  {setGroup.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={setGroup.logoUrl}
                      alt={setGroup.setName}
                      width={80}
                      height={40}
                      className="object-contain h-7 w-auto"
                    />
                  )}
                  <h3
                    className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    {setGroup.setName}
                  </h3>
                  <span className="pill text-xs text-muted bg-elevated px-2 py-0.5 rounded-full">
                    {setGroup.products.length}
                  </span>
                  {/* Chevron — sits right after the count badge */}
                  <span
                    className={cn(
                      'text-base text-muted group-hover:text-primary transition-transform duration-200 leading-none',
                      isCollapsed ? '-rotate-90' : 'rotate-0'
                    )}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>

                {/* Product grid — hidden when collapsed */}
                {!isCollapsed && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                    {setGroup.products.map(product => (
                      <ProductCard
                          key={product.id}
                          product={product}
                          setName={setGroup.setName}
                          userId={userId}
                          initialQuantity={ownedQuantities[product.id] ?? 0}
                          isAdmin={isAdmin}
                        />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}

      {/* ── Missing Product Modal ─────────────────────────────────────── */}
      <MissingProductModal
        isOpen={missingProductOpen}
        onClose={() => setMissingProductOpen(false)}
      />
    </div>
  )
}
