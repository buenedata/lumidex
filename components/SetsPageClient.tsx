'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import SetCard from '@/components/SetCard'
import { supabase } from '@/lib/supabase'
import type { DbSet } from '@/lib/db'
import type { SetProgress } from '@/types'
import { cn } from '@/lib/utils'

export type EnrichedSet = DbSet & { user_card_count?: number }

interface SetsPageClientProps {
  sets: EnrichedSet[]
  favoritedSetIds: string[]
  userId: string | null
  /** Series names that have at least one sealed product in the DB */
  seriesWithProducts?: string[]
}

// Canonical series chronological order (oldest = smallest number, newest = largest).
// Used as the primary sort key so data inconsistencies (e.g. a late-added Japanese
// Sword & Shield set whose release_date is 2023-01-27 — newer than the first S&V
// sets released 2023-01-20) can never flip the era order.
const KNOWN_SERIES_ORDER: Record<string, number> = {
  'Base Set':                  100,
  'Jungle':                    100,
  'Fossil':                    100,
  'Team Rocket':               110,
  'Gym Heroes':                110,
  'Gym Challenge':             110,
  'Neo Genesis':               120,
  'Neo Discovery':             120,
  'Neo Revelation':            120,
  'Neo Destiny':               120,
  'Legendary Collection':      130,
  'Expedition Base Set':       140,
  'Aquapolis':                 140,
  'Skyridge':                  140,
  'Ruby & Sapphire':           150,
  'EX':                        150,
  'Diamond & Pearl':           160,
  'Platinum':                  160,
  'HeartGold & SoulSilver':    170,
  'HS':                        170,
  'Call of Legends':           170,
  'Black & White':             180,
  'BW':                        180,
  'XY':                        190,
  'Sun & Moon':                200,
  'Sword & Shield':            210,
  'Scarlet & Violet':          220,
}

export default function SetsPageClient({ sets, favoritedSetIds, userId }: SetsPageClientProps) {
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(
    () => new Set(favoritedSetIds)
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSeries, setActiveSeries] = useState<string>('All')
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ja'>(() => {
    if (typeof window === 'undefined') return 'en'
    return (localStorage.getItem('lumidex_sets_lang') as 'en' | 'ja') ?? 'en'
  })

  // ── Language switch — also resets the active series pill ─────────────────
  const handleLanguageChange = (lang: 'en' | 'ja') => {
    localStorage.setItem('lumidex_sets_lang', lang)
    setSelectedLanguage(lang)
    setActiveSeries('All')
  }

  // ── Series order ──────────────────────────────────────────────────────────
  // Computed from only the sets that belong to the currently selected language
  // so the pills always reflect the correct series for that language.
  // Newest series first; "Other" always last.
  //
  // We prefer the best *real* release_date for a series when at least one set
  // has one.  Only if **no** set in a series has a release_date do we fall back
  // to the best created_at.  This prevents a series like Scarlet & Violet
  // (where some Japanese sets lack release dates) from being accidentally sorted
  // below an older series whose sets all have explicit release dates.
  const seriesOrder = useMemo(() => {
    const langSets = sets.filter(s => (s.language ?? 'en') === selectedLanguage)
    const bestRelease  = new Map<string, string>()  // max non-null release_date
    const bestFallback = new Map<string, string>()  // max created_at
    for (const set of langSets) {
      const s = set.series ?? 'Other'
      if (set.release_date && set.release_date > (bestRelease.get(s) ?? '')) {
        bestRelease.set(s, set.release_date)
      }
      if (set.created_at > (bestFallback.get(s) ?? '')) {
        bestFallback.set(s, set.created_at)
      }
    }
    const allSeries = new Set([...bestRelease.keys(), ...bestFallback.keys()])
    return Array.from(allSeries)
      .map(s => {
        const sortKey = bestRelease.get(s) ?? bestFallback.get(s) ?? ''
        return [s, sortKey] as [string, string]
      })
      .sort((a, b) => {
        if (a[0] === 'Other') return 1
        if (b[0] === 'Other') return -1
        // Prefer the canonical era order when both series are known.
        const pa = KNOWN_SERIES_ORDER[a[0]]
        const pb = KNOWN_SERIES_ORDER[b[0]]
        if (pa !== undefined && pb !== undefined) return pb - pa
        // One or both unknown — fall back to date string comparison.
        return b[1].localeCompare(a[1])
      })
      .map(([s]) => s)
  }, [sets, selectedLanguage])

  // ── Favorite toggle ───────────────────────────────────────────────────────
  const toggleFavorite = async (setId: string) => {
    if (!userId) return
    const wasFavorited = favoritedIds.has(setId)

    // Optimistic update
    setFavoritedIds(prev => {
      const next = new Set(prev)
      if (wasFavorited) next.delete(setId)
      else next.add(setId)
      return next
    })

    try {
      if (wasFavorited) {
        await supabase
          .from('user_sets')
          .delete()
          .eq('user_id', userId)
          .eq('set_id', setId)
      } else {
        await supabase
          .from('user_sets')
          .insert({ user_id: userId, set_id: setId })
      }
    } catch {
      // Revert on error
      setFavoritedIds(prev => {
        const next = new Set(prev)
        if (wasFavorited) next.add(setId)
        else next.delete(setId)
        return next
      })
    }
  }

  // ── Progress helper ───────────────────────────────────────────────────────
  const getProgress = (set: EnrichedSet): SetProgress | undefined => {
    if (userId === null || set.user_card_count === undefined) return undefined
    const totalCards = set.setComplete ?? set.total ?? 0
    if (totalCards === 0) return undefined
    return {
      owned_cards: set.user_card_count,
      total_cards: totalCards,
      percentage: Math.min(100, Math.round((set.user_card_count / totalCards) * 100)),
    }
  }

  // ── Filter + group ────────────────────────────────────────────────────────
  const { filteredFavorites, groupedSets } = useMemo(() => {
    // Always show only the selected language
    let filtered = sets.filter(s => (s.language ?? 'en') === selectedLanguage)

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(s => s.name.toLowerCase().includes(q))
    }

    // Series pill filter
    if (activeSeries !== 'All') {
      filtered = filtered.filter(s => (s.series ?? 'Other') === activeSeries)
    }

    // Favorites at top: only in "All" view and only when logged in
    const filteredFavorites =
      userId !== null && activeSeries === 'All'
        ? filtered.filter(s => favoritedIds.has(s.id))
        : []

    // All filtered sets go into their series groups regardless of favorited status
    const remaining = filtered

    // Group by series
    const ungrouped = new Map<string, EnrichedSet[]>()
    for (const set of remaining) {
      const name = set.series ?? 'Other'
      if (!ungrouped.has(name)) ungrouped.set(name, [])
      ungrouped.get(name)!.push(set)
    }

    // Preserve series order determined above; within each group order:
    // regular sets (0) → Promo sets (1) → Energy sets (2)
    // Products card is appended last via JSX so it is effectively position 3.
    const setOrder = (name: string) =>
      /promo/i.test(name) ? 1 : /energy/i.test(name) ? 2 : 0
    const grouped = new Map<string, EnrichedSet[]>()
    for (const s of seriesOrder) {
      if (ungrouped.has(s)) {
        const sorted = [...ungrouped.get(s)!].sort(
          (a, b) => setOrder(a.name) - setOrder(b.name)
        )
        grouped.set(s, sorted)
      }
    }

    return { filteredFavorites, groupedSets: grouped }
  }, [sets, searchQuery, activeSeries, selectedLanguage, favoritedIds, userId, seriesOrder])

  const totalVisible =
    filteredFavorites.length +
    Array.from(groupedSets.values()).reduce((acc, arr) => acc + arr.length, 0)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Search + series filter bar ─────────────────────────────────── */}
      <div className="mb-8 space-y-4">
        {/* Search input + language toggle row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative max-w-sm flex-1">
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
              placeholder="Search sets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 bg-surface border border-subtle rounded-lg pl-9 pr-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
            />
          </div>

          {/* Language segmented toggle */}
          <div className="flex items-center bg-surface border border-subtle rounded-lg p-1 gap-1">
            <button
              onClick={() => handleLanguageChange('en')}
              className={cn(
                'px-3 py-1 rounded text-sm font-medium transition-all duration-150 select-none',
                selectedLanguage === 'en'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              )}
            >
              English
            </button>
            <button
              onClick={() => handleLanguageChange('ja')}
              className={cn(
                'px-3 py-1 rounded text-sm font-medium transition-all duration-150 select-none',
                selectedLanguage === 'ja'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              )}
            >
              Japanese
            </button>
          </div>
        </div>

        {/* Series pill buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button
            onClick={() => setActiveSeries('All')}
            className={cn(
              'pill px-3 py-1.5 rounded-full text-sm font-medium text-center transition-all duration-150',
              activeSeries === 'All'
                ? 'bg-accent text-white shadow-sm'
                : 'bg-surface border border-subtle text-secondary hover:border-accent/50 hover:text-primary'
            )}
          >
            All
          </button>
          {seriesOrder.map(series => (
            <button
              key={series}
              onClick={() => setActiveSeries(series)}
              className={cn(
                'pill px-3 py-1.5 rounded-full text-sm font-medium text-center transition-all duration-150',
                activeSeries === series
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-surface border border-subtle text-secondary hover:border-accent/50 hover:text-primary'
              )}
            >
              {series}
            </button>
          ))}
        </div>
      </div>

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {totalVisible === 0 && (
        <div className="text-center py-24">
          <div className="text-4xl mb-4">📦</div>
          <p className="text-muted mb-2">No sets found</p>
          {searchQuery && (
            <p className="text-xs text-muted/70">Try a different search term</p>
          )}
        </div>
      )}

      {/* ── Favorites section ──────────────────────────────────────────── */}
      {filteredFavorites.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setIsFavoritesOpen(prev => !prev)}
              className="flex items-center gap-2 group focus:outline-none"
              aria-expanded={isFavoritesOpen}
              aria-controls="favorites-grid"
            >
              <h2
                className="text-lg font-semibold"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                ⭐ Favorites
              </h2>
              <svg
                className={cn(
                  'w-4 h-4 text-muted transition-transform duration-200',
                  isFavoritesOpen ? 'rotate-0' : '-rotate-90'
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <span className="pill text-xs text-muted bg-elevated px-2 py-0.5 rounded-full">
              {filteredFavorites.length}
            </span>
          </div>
          {isFavoritesOpen && (
            <div
              id="favorites-grid"
              className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4"
            >
              {filteredFavorites.map(set => (
                <SetCard
                  key={set.id}
                  set={set}
                  progress={getProgress(set)}
                  isFavorited={favoritedIds.has(set.id)}
                  onFavorite={() => toggleFavorite(set.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Series sections ────────────────────────────────────────────── */}
      {Array.from(groupedSets.entries()).map(([series, seriesSets]) => {
        // Use the logo of the first set in the series (newest) for the Products card background
        const seriesLogoUrl = seriesSets[0]?.logo_url ?? null

        return (
          <section key={series} className="mb-10">
            {/* Series heading — only shown in "All" mode */}
            {activeSeries === 'All' && (
              <div className="flex items-center gap-2 mb-4">
                <h2
                  className="text-lg font-semibold"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {series}
                </h2>
                <span className="pill text-xs text-muted bg-elevated px-2 py-0.5 rounded-full">
                  {seriesSets.length}
                </span>
              </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {seriesSets.map(set => (
                <SetCard
                  key={set.id}
                  set={set}
                  progress={getProgress(set)}
                  isFavorited={favoritedIds.has(set.id)}
                  onFavorite={userId ? () => toggleFavorite(set.id) : undefined}
                />
              ))}

              {/* Products entry card — always shown as last tile in each series */}
              <Link
                  href={`/products?series=${encodeURIComponent(series)}`}
                  className={cn(
                    'group relative flex flex-col rounded-xl overflow-hidden h-full min-h-[220px]',
                    'bg-surface border border-dashed border-accent/40',
                    'hover:border-accent hover:shadow-[0_0_20px_rgba(109,95,255,0.2)]',
                    'transition-all duration-200 cursor-pointer'
                  )}
                >
                  {/* Blurred set logo background */}
                  <div className="relative h-36 bg-elevated overflow-hidden">
                    {seriesLogoUrl && (
                      <div className="absolute inset-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={seriesLogoUrl}
                          alt=""
                          aria-hidden
                          className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-20"
                        />
                      </div>
                    )}
                    {/* Bottom gradient */}
                    <div className="absolute inset-0 z-[5] bg-gradient-to-t from-black via-black/40 to-transparent" />

                    {/* Center icon */}
                    <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2">
                      <div className="w-14 h-14 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center group-hover:bg-accent/25 transition-colors">
                        <span className="text-3xl">📦</span>
                      </div>
                    </div>

                    {/* Set logo faded in corner for context */}
                    {seriesLogoUrl && (
                      <div className="absolute bottom-2 right-2 z-10 opacity-40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={seriesLogoUrl}
                          alt=""
                          width={60}
                          height={30}
                          aria-hidden
                          className="object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Card info */}
                  <div className="p-3 flex flex-col flex-1 gap-1">
                    <h3
                      className="font-semibold text-sm text-accent leading-tight"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      Products
                    </h3>
                    <p className="text-xs text-muted">Sealed product collection</p>
                    <span className="mt-auto text-xs text-accent/70 group-hover:text-accent transition-colors">
                      View all →
                    </span>
                  </div>
              </Link>
            </div>
          </section>
        )
      })}
    </div>
  )
}
