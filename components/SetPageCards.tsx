'use client'

import { useState, useMemo } from 'react'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid'
import { cn } from '@/lib/utils'
import CardGrid from '@/components/CardGrid'
import CollectionGoalSelector from '@/components/CollectionGoalSelector'
import { useCollectionStore, useAuthStore } from '@/lib/store'
import { PokemonCard, CollectionGoal, QuickAddVariant, PriceSource } from '@/types'
import { formatPrice, type SetProductPrice } from '@/lib/pricing'

interface SetPageCardsProps {
  cards: PokemonCard[]
  setTotal: number
  setName: string
  setComplete?: number
  initialCardId?: string
  showSearch?: boolean
  // Collection goal props
  setId: string
  userId?: string
  hasPromos: boolean
  initialGoal?: CollectionGoal
  // Pricing (optional — only provided by the set detail page)
  cardPricesUSD?: Record<string, number>
  currency?: string
  /** Whether prices come from the live DB (true) or mock fallback (false) */
  pricesAreLive?: boolean
  /** User's preferred price source — drives the source badge label */
  priceSource?: PriceSource
  /** Sealed product prices for this set (booster packs, ETBs, etc.) */
  sealedProducts?: SetProductPrice[]
  /**
   * When true, cards are never greyed out regardless of the user's grey_out_unowned setting.
   * Used on the browse/search page where collection status should not affect card appearance.
   */
  disableGreyOut?: boolean
  // Static stats (optional — only provided by the set detail page)
  statSeries?: string
  statReleased?: string
  statCards?: string
  statMostExpensive?: string
  statSetValue?: string
}

type FilterTab = 'all' | 'owned' | 'missing' | 'duplicates'
type SortBy    = 'number' | 'name' | 'price'

const sortOptions: { label: string; value: SortBy }[] = [
  { label: 'Number', value: 'number' },
  { label: 'Name',   value: 'name'   },
  { label: 'Price',  value: 'price'  },
]

export default function SetPageCards({
  cards,
  setTotal,
  setName,
  setComplete,
  initialCardId,
  showSearch = true,
  setId,
  userId,
  hasPromos,
  initialGoal = 'normal',
  cardPricesUSD = {},
  currency = 'USD',
  pricesAreLive = false,
  priceSource = 'tcgplayer',
  sealedProducts = [],
  disableGreyOut = false,
  statSeries,
  statReleased,
  statCards,
  statMostExpensive,
  statSetValue,
}: SetPageCardsProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery]   = useState('')
  const [sortBy, setSortBy]             = useState<SortBy>('number')
  const [collectionGoal, setCollectionGoal] = useState<CollectionGoal>(initialGoal)
  const [legendVariants, setLegendVariants] = useState<QuickAddVariant[]>([])

  const { userCards: storeUserCards } = useCollectionStore()
  const { user, profile } = useAuthStore()
  const isAuthenticated = !!user

  // Prefer the client-side profile's preferred_currency (always up-to-date after
  // login) over the server-passed prop, which may have defaulted to 'USD' if the
  // server-side supabaseAdmin query failed silently.
  const effectiveCurrency = (profile as any)?.preferred_currency ?? currency

  // ── Search filter ────────────────────────────────────────────────────────
  const filteredCards = searchQuery.trim()
    ? cards.filter(card => {
        const q = searchQuery.toLowerCase()
        return (
          card.name?.toLowerCase().includes(q) ||
          card.number?.toLowerCase().includes(q)
        )
      })
    : cards

  // ── Tab counts ───────────────────────────────────────────────────────────
  const haveCount = useMemo(() =>
    cards.filter(c => (storeUserCards.get(c.id)?.quantity ?? 0) > 0).length,
    [cards, storeUserCards])

  // Reactive total value of the user's collected cards in this set
  const myCollectedValue = useMemo(() =>
    cards
      .filter(c => (storeUserCards.get(c.id)?.quantity ?? 0) > 0)
      .reduce((sum, c) => sum + (cardPricesUSD[c.id] ?? 0), 0),
    [cards, storeUserCards, cardPricesUSD]
  )

  const needCount = useMemo(() =>
    cards.filter(c => (storeUserCards.get(c.id)?.quantity ?? 0) === 0).length,
    [cards, storeUserCards])

  // Total extra copies across all cards and variant types.
  // e.g. one card with Normal×2 + Reverse×2  →  duplicatesCount = 2
  const duplicatesCount = useMemo(() =>
    cards.reduce((sum, c) => sum + (storeUserCards.get(c.id)?.duplicateCount ?? 0), 0),
    [cards, storeUserCards])

  const hasDuplicates = duplicatesCount > 0

  // Tabs — Duplicates only shown when user actually has duplicates
  const tabs = useMemo<{ label: string; value: FilterTab; count?: number; dimCount?: boolean }[]>(() => {
    const list: { label: string; value: FilterTab; count?: number; dimCount?: boolean }[] = [
      { label: 'Show All',   value: 'all' },
      { label: 'Have',       value: 'owned',   count: isAuthenticated ? haveCount : undefined },
      { label: 'Need',       value: 'missing', count: isAuthenticated ? needCount : undefined, dimCount: true },
    ]
    if (isAuthenticated && hasDuplicates) {
      list.push({ label: 'Duplicates', value: 'duplicates', count: duplicatesCount })
    }
    return list
  }, [isAuthenticated, haveCount, needCount, duplicatesCount, hasDuplicates])

  // Make sure activeFilter stays valid if Duplicates tab disappears
  const safeFilter: FilterTab =
    activeFilter === 'duplicates' && !hasDuplicates ? 'all' : activeFilter

  // ── Progress calculation ─────────────────────────────────────────────────
  const promoCards    = useMemo(() => cards.filter(c => c.rarity?.toLowerCase().includes('promo')), [cards])
  const nonPromoCards = useMemo(() => cards.filter(c => !c.rarity?.toLowerCase().includes('promo')), [cards])

  const progressTotal = useMemo(() => {
    if (collectionGoal === 'grandmasterset') return cards.length
    if (collectionGoal === 'masterset')      return nonPromoCards.length
    return setTotal
  }, [collectionGoal, cards.length, nonPromoCards.length, setTotal])

  const progressOwned = useMemo(() => {
    if (collectionGoal === 'grandmasterset') return haveCount
    if (collectionGoal === 'masterset')
      return nonPromoCards.filter(c => (storeUserCards.get(c.id)?.quantity ?? 0) > 0).length
    return haveCount
  }, [collectionGoal, haveCount, nonPromoCards, storeUserCards])

  const progressPct = progressTotal > 0 ? Math.round((progressOwned / progressTotal) * 100) : 0

  const progressLabel = useMemo(() => {
    if (collectionGoal === 'masterset')      return `${progressOwned} / ${progressTotal} cards (all variants)`
    if (collectionGoal === 'grandmasterset') return `${progressOwned} / ${progressTotal} cards incl. promos`
    return `${progressOwned} / ${progressTotal} cards`
  }, [collectionGoal, progressOwned, progressTotal])

  return (
    <div>
      {/* ── Stats strip (only on set detail page where stat props are provided) ── */}
      {statSeries !== undefined && (
        <div className="border-b border-subtle">
          <div className="max-w-screen-2xl mx-auto px-6 py-4">
            <div className="flex items-center gap-8 flex-wrap">
              {[
                { label: 'Series',         value: statSeries         ?? '—' },
                { label: 'Released',       value: statReleased       ?? '—' },
                { label: 'Cards',          value: statCards          ?? '—' },
                { label: 'Most Expensive', value: statMostExpensive  ?? '—' },
                { label: 'Set Value',      value: statSetValue       ?? '—' },
                ...(isAuthenticated && myCollectedValue > 0
                  ? [{ label: 'My Collection', value: formatPrice(myCollectedValue, effectiveCurrency) }]
                  : []
                ),
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted uppercase tracking-wider">{label}</span>
                  <span className="text-sm font-medium text-primary">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Sealed Products section ──────────────────────────────── */}
      {sealedProducts.length > 0 && (
        <div className="border-b border-subtle">
          <div className="max-w-screen-2xl mx-auto px-6 py-4">
            <details>
              <summary className="flex items-center gap-2 cursor-pointer select-none list-none group">
                <span className="text-base">📦</span>
                <span className="text-sm font-medium text-secondary group-hover:text-primary transition-colors">
                  Sealed Products
                </span>
                <span className="text-xs text-muted ml-1">({sealedProducts.length})</span>
                <svg
                  className="w-4 h-4 text-muted ml-auto transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted uppercase tracking-wider border-b border-subtle">
                      <th className="text-left pb-2 font-medium">Product</th>
                      <th className="text-left pb-2 font-medium">Type</th>
                      <th className="text-right pb-2 font-medium">Price</th>
                      <th className="text-right pb-2 font-medium">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {sealedProducts.map(product => {
                      // Resolve price in USD based on priceSource
                      const priceUSD =
                        priceSource === 'cardmarket'
                          ? (product.cm_avg_sell != null ? product.cm_avg_sell * 1.09 : null)
                          : product.tcgp_market

                      const url =
                        priceSource === 'cardmarket' ? product.cm_url : product.tcgp_url

                      return (
                        <tr key={product.id} className="hover:bg-elevated/30 transition-colors">
                          <td className="py-2.5 pr-4 text-primary font-medium">
                            {product.name}
                          </td>
                          <td className="py-2.5 pr-4 text-muted text-xs">
                            {product.product_type ?? '—'}
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            {priceUSD != null ? (
                              <span className="text-success font-semibold">
                                {formatPrice(priceUSD, effectiveCurrency)}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right">
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-accent hover:text-accent-hover transition-colors"
                              >
                                {priceSource === 'cardmarket' ? 'CardMarket ↗' : 'TCGPlayer ↗'}
                              </a>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* ── Collection Goal Selector + Variant Legend ────────────── */}
      <div className="max-w-screen-2xl mx-auto px-6 pt-5 pb-4 border-b border-subtle">
        <div className="flex flex-wrap items-start gap-6">
          <CollectionGoalSelector
            setId={setId}
            value={collectionGoal}
            hasPromos={hasPromos}
            isAuthenticated={isAuthenticated}
            onChange={setCollectionGoal}
          />

          {/* Variant legend — mirrors CollectionGoalSelector's flex-col structure so rows align */}
          {legendVariants.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted uppercase tracking-wider select-none">
                Variant Key
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {legendVariants.map(v => (
                  <div key={v.color} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ({
                        green:  '#10b981',
                        blue:   '#3b82f6',
                        purple: '#8b5cf6',
                        red:    '#ef4444',
                        pink:   '#ec4899',
                        yellow: '#eab308',
                        gray:   '#6b7280',
                        orange: '#f97316',
                        teal:   '#14b8a6',
                      } as Record<string, string>)[v.color] ?? '#6b7280' }}
                    />
                    <span className="text-xs text-gray-400">
                      {v.color === 'gray' ? 'Custom Variant' : v.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress bar (only when user has anything collected) ─── */}
      {isAuthenticated && progressOwned > 0 && (
        <div className="max-w-screen-2xl mx-auto px-6 py-3 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs text-muted whitespace-nowrap shrink-0">
              {progressLabel}
            </span>
            <span className="text-xs font-semibold text-accent shrink-0">
              {progressPct}%
            </span>
          </div>
        </div>
      )}

      {/* ── Search bar ───────────────────────────────────────────── */}
      {showSearch && (
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center gap-3 flex-wrap">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Name or Number..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-52 h-9 bg-surface border border-subtle rounded-lg pl-9 pr-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
            />
          </div>
        </div>
      )}

      {/* ── Sort dropdown + filter tabs ──────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="flex items-center gap-0 border-b border-subtle">

          {/* Sort dropdown */}
          <div className="flex items-center gap-2 pr-3 mr-0 border-r border-subtle self-stretch">
            <span className="text-sm text-muted select-none whitespace-nowrap">Sort by</span>

            <Listbox value={sortBy} onChange={setSortBy}>
              <div className="relative">
                <ListboxButton className="flex items-center gap-1 px-3 py-2.5 text-sm font-medium text-secondary hover:text-primary focus:outline-none transition-colors cursor-pointer whitespace-nowrap">
                  <span>{sortOptions.find(o => o.value === sortBy)?.label}</span>
                  <ChevronUpDownIcon className="w-3.5 h-3.5 text-muted shrink-0" />
                </ListboxButton>

                <ListboxOptions
                  anchor="bottom start"
                  className="z-50 mt-1 min-w-[90px] rounded border border-subtle bg-elevated shadow-xl focus:outline-none [--anchor-gap:4px]"
                >
                  {sortOptions.map(opt => (
                    <ListboxOption
                      key={opt.value}
                      value={opt.value}
                      className={({ focus, selected }) =>
                        cn(
                          'flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer select-none',
                          focus    ? 'bg-accent/20 text-primary' : 'text-secondary',
                          selected ? 'font-medium text-primary'  : ''
                        )
                      }
                    >
                      {({ selected }) => (
                        <>
                          <CheckIcon className={cn('w-3.5 h-3.5 shrink-0', selected ? 'text-accent' : 'invisible')} />
                          {opt.label}
                        </>
                      )}
                    </ListboxOption>
                  ))}
                </ListboxOptions>
              </div>
            </Listbox>
          </div>

          {/* Filter tabs — with counts */}
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all duration-150 -mb-px',
                safeFilter === tab.value ? 'tab-active' : 'tab-inactive'
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full font-semibold leading-none',
                    safeFilter === tab.value
                      ? 'bg-accent/30 text-accent'
                      : tab.dimCount
                        ? 'bg-surface text-muted'
                        : 'bg-surface text-secondary'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cards grid ───────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {filteredCards.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-4xl mb-4">🎴</div>
            <p className="text-muted">
              {searchQuery ? 'No cards match your search' : 'No cards found for this set'}
            </p>
          </div>
        ) : (
          <CardGrid
              cards={filteredCards}
              userCards={new Map()}
              filter={safeFilter}
              sortBy={sortBy}
              setTotal={setTotal}
              setName={setName}
              setComplete={setComplete}
              initialCardId={initialCardId}
              collectionGoal={collectionGoal}
              cardPricesUSD={cardPricesUSD}
              currency={effectiveCurrency}
              priceSource={priceSource}
              onVariantsLegendChange={setLegendVariants}
              disableGreyOut={disableGreyOut}
            />
        )}
      </div>
    </div>
  )
}
