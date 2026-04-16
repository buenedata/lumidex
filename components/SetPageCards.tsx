'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { ChevronUpDownIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid'
import { cn } from '@/lib/utils'
import CardGrid from '@/components/CardGrid'
import CollectionGoalSelector from '@/components/CollectionGoalSelector'
import BinderCalculatorModal from '@/components/BinderCalculatorModal'
import { useCollectionStore, useAuthStore } from '@/lib/store'
import { PokemonCard, CollectionGoal, QuickAddVariant } from '@/types'

/** Card-id → variant structure, pre-fetched server-side. Passed from the set page / browse page. */
export type InitialCardVariants = Record<string, QuickAddVariant[]>

interface SetPageCardsProps {
  cards: PokemonCard[]
  setTotal: number
  /** When omitted (browse page), CardGrid falls back to per-card set_name in the modal. */
  setName?: string
  /**
   * Variant structure pre-fetched server-side (from batchFetchVariantStructure).
   * When provided, CardGrid renders variant dots on first paint with no client fetch.
   */
  initialCardVariants?: InitialCardVariants
  setComplete?: number
  initialCardId?: string
  showSearch?: boolean
  // Collection goal props
  setId: string
  userId?: string
  hasPromos: boolean
  initialGoal?: CollectionGoal
  currency?: string
  /**
   * When true, cards are never greyed out regardless of the user's grey_out_unowned setting.
   * Used on the browse/search page where collection status should not affect card appearance.
   */
  disableGreyOut?: boolean
  // Static stats (optional — only provided by the set detail page)
  statSeries?: string
  statReleased?: string
  statCards?: string
  /** Name of the most-expensive card — formatted client-side with effectiveCurrency */
  statMostExpensiveName?: string
  /** USD price of the most-expensive card — formatted client-side with effectiveCurrency */
  statMostExpensiveUSD?: number
  /** Total set value in USD — formatted client-side with effectiveCurrency */
  statSetValueUSD?: number
}

type FilterTab    = 'all' | 'owned' | 'missing' | 'duplicates'
type SortBy       = 'number' | 'name' | 'date'
type SortDirection = 'asc' | 'desc'

const sortOptions: { label: string; value: SortBy }[] = [
  { label: 'Number', value: 'number' },
  { label: 'Name',   value: 'name'   },
  { label: 'Date',   value: 'date'   },
]

export default function SetPageCards({
  cards,
  setTotal,
  setName = '',
  initialCardVariants,
  setComplete,
  initialCardId,
  showSearch = true,
  setId,
  userId,
  hasPromos,
  initialGoal = 'normal',
  currency = 'USD',
  disableGreyOut = false,
  statSeries,
  statReleased,
  statCards,
}: SetPageCardsProps) {
  const [activeFilter, setActiveFilter]     = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery]       = useState('')
  // Browse page (setId === '') defaults to newest-first; set detail page defaults to card number asc.
  const [sortBy, setSortBy]                 = useState<SortBy>(setId ? 'number' : 'date')
  const [sortDirection, setSortDirection]   = useState<SortDirection>(setId ? 'asc' : 'desc')
  const [collectionGoal, setCollectionGoal] = useState<CollectionGoal>(initialGoal)
  const [legendVariants, setLegendVariants]     = useState<QuickAddVariant[]>([])
  const [binderModalOpen, setBinderModalOpen]   = useState(false)
  // Set to true once the batch variant fetch detects any card-specific variants.
  // Combined with hasPromos to determine Grandmaster Set selector visibility.
  const [hasExtraVariants, setHasExtraVariants] = useState(false)
  // Tracks whether the batch variant fetch is in flight.
  const [variantsBatchLoading, setVariantsBatchLoading] = useState(false)
  // Only flip the shimmer visible if loading takes > 250ms — prevents a flash on fast/cached loads.
  const [showVariantShimmer, setShowVariantShimmer] = useState(false)
  useEffect(() => {
    if (!variantsBatchLoading) {
      setShowVariantShimmer(false)
      return
    }
    const t = setTimeout(() => setShowVariantShimmer(true), 250)
    return () => clearTimeout(t)
  }, [variantsBatchLoading])
  // Goal-aware Have/Need counts emitted by CardGrid after the batch variant load.
  // null until first emission — tab badges fall back to the basic Zustand counts.
  const [goalHave, setGoalHave] = useState<number | null>(null)
  const [goalNeed, setGoalNeed] = useState<number | null>(null)
  // Variant-slot owned count for masterset + grandmasterset progress bars.
  const [goalVariantOwned, setGoalVariantOwned] = useState<number | null>(null)
  const handleCountsChange = useCallback((have: number, need: number, variantOwned?: number) => {
    setGoalHave(have)
    setGoalNeed(need)
    setGoalVariantOwned(variantOwned ?? null)
  }, [])

  const { userCards: storeUserCards } = useCollectionStore()
  const { user, profile, isLoading: isAuthLoading } = useAuthStore()
  const isAuthenticated = !!user

  // Prefer the client-side profile's preferred_currency (always up-to-date after
  // login) over the server-passed prop, which may have defaulted to 'USD' if the
  // server-side supabaseAdmin query failed silently.
  const effectiveCurrency = (profile as any)?.preferred_currency ?? currency

  // ── Search filter ────────────────────────────────────────────────────────
  // Wrapped in useMemo so a non-empty searchQuery doesn't produce a new array
  // reference on every render — which would re-trigger CardGrid's batch-load
  // useEffect([cards, userId]) unnecessarily.
  const filteredCards = useMemo(() =>
    searchQuery.trim()
      ? cards.filter(card => {
          const q = searchQuery.toLowerCase()
          return (
            card.name?.toLowerCase().includes(q) ||
            card.number?.toLowerCase().includes(q)
          )
        })
      : cards,
    [cards, searchQuery]
  )

  // ── Tab counts ───────────────────────────────────────────────────────────
  const haveCount = useMemo(() =>
    cards.filter(c => (storeUserCards.get(c.id)?.quantity ?? 0) > 0).length,
    [cards, storeUserCards])

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
      // Use goal-aware counts once CardGrid emits them; fall back to the basic
      // Zustand-aggregate counts until the batch variant fetch completes.
      { label: 'Have',       value: 'owned',   count: isAuthenticated ? (goalHave ?? haveCount) : undefined },
      { label: 'Need',       value: 'missing', count: isAuthenticated ? (goalNeed ?? needCount) : undefined, dimCount: true },
    ]
    if (isAuthenticated && hasDuplicates) {
      list.push({ label: 'Duplicates', value: 'duplicates', count: duplicatesCount })
    }
    return list
  }, [isAuthenticated, haveCount, needCount, goalHave, goalNeed, duplicatesCount, hasDuplicates])

  // Make sure activeFilter stays valid if Duplicates tab disappears
  const safeFilter: FilterTab =
    activeFilter === 'duplicates' && !hasDuplicates ? 'all' : activeFilter

  // ── Progress calculation ─────────────────────────────────────────────────
  // Denominators computed from SSR variant structure (initialCardVariants) so
  // they are accurate on first paint with no dependency on loading state.
  //
  //  mastersetTotal    = sum of global (non-card-specific) variant slots across all cards
  //  grandmastersetTotal = sum of ALL variant slots (global + card-specific) across all cards
  const mastersetTotal = useMemo(() => {
    if (!initialCardVariants) return setComplete ?? setTotal
    const slots = Object.values(initialCardVariants).reduce(
      (sum, vs) => sum + vs.filter(v => v.card_id == null).length, 0
    )
    return slots > 0 ? slots : (setComplete ?? setTotal)
  }, [initialCardVariants, setComplete, setTotal])

  const grandmastersetTotal = useMemo(() => {
    if (!initialCardVariants) return setComplete ?? setTotal
    const slots = Object.values(initialCardVariants).reduce(
      (sum, vs) => sum + vs.length, 0
    )
    return slots > 0 ? slots : (setComplete ?? setTotal)
  }, [initialCardVariants, setComplete, setTotal])

  const progressTotal = useMemo(() => {
    if (collectionGoal === 'grandmasterset') return grandmastersetTotal
    if (collectionGoal === 'masterset')      return mastersetTotal
    // Normal Set: every card counts once regardless of variant — use setComplete (full set incl. secrets).
    return setComplete ?? setTotal
  }, [collectionGoal, grandmastersetTotal, mastersetTotal, setComplete, setTotal])

  const progressOwned = useMemo(() => {
    // Masterset + Grandmaster: count owned variant slots emitted by CardGrid.
    if (collectionGoal === 'masterset' || collectionGoal === 'grandmasterset')
      return goalVariantOwned ?? haveCount
    // Normal: one unique card per slot — goal-aware unique-card count.
    return goalHave ?? haveCount
  }, [collectionGoal, goalHave, goalVariantOwned, haveCount])

  const progressPct = progressTotal > 0 ? Math.round((progressOwned / progressTotal) * 100) : 0

  const progressLabel = useMemo(() => {
    if (collectionGoal === 'masterset')      return `${progressOwned} / ${progressTotal} variants`
    if (collectionGoal === 'grandmasterset') return `${progressOwned} / ${progressTotal} variants`
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
                { label: 'Series',   value: statSeries   ?? '—' },
                { label: 'Released', value: statReleased ?? '—' },
                { label: 'Cards',    value: statCards    ?? '—' },
                { label: 'Most Expensive', value: '—' },
                { label: 'Set Value',      value: '—' },
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

      {/* ── Collection Goal Selector + Variant Legend + Binder Guide ── */}
      <div className="max-w-screen-2xl mx-auto px-6 pt-5 pb-4 border-b border-subtle">
        <div className="flex flex-wrap items-start gap-6">
          {setId && (
            <CollectionGoalSelector
              setId={setId}
              value={collectionGoal}
              hasPromos={hasPromos || hasExtraVariants}
              isAuthenticated={isAuthenticated}
              onChange={setCollectionGoal}
            />
          )}

          {/* Variant legend — once legend data is known, show it permanently.
              The shimmer is only shown during the initial load before any
              legend data exists. This prevents the key from blinking when
              CardGrid's batch-load re-fires (e.g. after a Supabase token
              refresh that briefly flips userId undefined → value). */}
          {legendVariants.filter(v => v.color !== 'gray').length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted uppercase tracking-wider select-none">
                Variant Key
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {legendVariants.filter(v => v.color !== 'gray').map(v => (
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
          ) : showVariantShimmer ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted uppercase tracking-wider select-none">
                Variant Key
              </span>
              <div className="flex items-center gap-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="flex items-center gap-1.5 animate-pulse">
                    <div className="w-3 h-3 rounded-full bg-surface shrink-0" />
                    <div className="h-2 bg-surface rounded w-10" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Binder Guide button — aligned to the right via ml-auto */}
          <div className="flex flex-col gap-1.5 ml-auto">
            <span className="text-xs text-muted uppercase tracking-wider select-none">
              Binder
            </span>
            <button
              onClick={() => setBinderModalOpen(true)}
              title="See how many binder pages you need to store this set"
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
                'border border-subtle bg-surface text-secondary',
                'hover:border-accent/50 hover:text-primary transition-all duration-150 cursor-pointer'
              )}
            >
              <span className="text-base leading-none" aria-hidden>🗂️</span>
              <span>Binder Guide</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Progress bar (only when user has anything collected) ─── */}
      {isAuthLoading ? (
        // Skeleton while Supabase auth is resolving — prevents layout shift
        <div className="max-w-screen-2xl mx-auto px-6 py-3 border-b border-subtle">
          <div className="flex items-center gap-3 animate-pulse">
            <div className="flex-1 h-2 bg-surface rounded-full" />
            <div className="w-24 h-2 bg-surface rounded" />
          </div>
        </div>
      ) : isAuthenticated && progressOwned > 0 ? (
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
      ) : null}

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

      {/* ── Sort pills ───────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-6 py-2.5 border-b border-subtle">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted uppercase tracking-wider select-none mr-1.5">Sort</span>
          {sortOptions.map(opt => {
            const isActive = sortBy === opt.value
            const handleClick = () => {
              if (isActive) {
                setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
              } else {
                setSortBy(opt.value)
                setSortDirection(opt.value === 'date' ? 'desc' : 'asc')
              }
            }
            return (
              <button
                key={opt.value}
                onClick={handleClick}
                title={isActive
                  ? (sortDirection === 'asc' ? 'Ascending — click to sort descending' : 'Descending — click to sort ascending')
                  : `Sort by ${opt.label}`}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 select-none cursor-pointer',
                  isActive
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-secondary hover:text-primary hover:bg-surface border border-transparent hover:border-subtle'
                )}
              >
                <span>{opt.label}</span>
                {isActive ? (
                  sortDirection === 'asc'
                    ? <ArrowUpIcon className="w-3.5 h-3.5 shrink-0" />
                    : <ArrowDownIcon className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronUpDownIcon className="w-3.5 h-3.5 shrink-0 opacity-40" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Filter tabs ──────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="flex items-center gap-0 border-b border-subtle">
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
             userCards={storeUserCards}
             filter={safeFilter}
             sortBy={sortBy}
             sortDirection={sortDirection}
             setTotal={setTotal}
             setName={setName}
             setComplete={setComplete}
             initialCardId={initialCardId}
             collectionGoal={collectionGoal}
             currency={effectiveCurrency}
             userId={userId}
             allCards={cards}
             onCountsChange={handleCountsChange}
             onVariantsLegendChange={setLegendVariants}
             onHasExtraVariants={setHasExtraVariants}
             onVariantsBatchLoading={setVariantsBatchLoading}
             initialCardVariants={initialCardVariants}
             disableGreyOut={disableGreyOut}
           />
        )}
      </div>

      {/* ── Binder Calculator Modal ───────────────────────────── */}
      <BinderCalculatorModal
        isOpen={binderModalOpen}
        onClose={() => setBinderModalOpen(false)}
        setId={setId}
        setName={setName}
        currentGoal={collectionGoal}
        hasPromos={hasPromos || hasExtraVariants}
      />
    </div>
  )
}
