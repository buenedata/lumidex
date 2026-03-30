'use client'

import { useState, useMemo } from 'react'
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
}

export default function SetsPageClient({ sets, favoritedSetIds, userId }: SetsPageClientProps) {
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(
    () => new Set(favoritedSetIds)
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSeries, setActiveSeries] = useState<string>('All')
  const [showEnglish, setShowEnglish] = useState(true)
  const [showJapanese, setShowJapanese] = useState(true)

  // ── Series order ──────────────────────────────────────────────────────────
  // Build list of unique series names, sorted by the most recent release_date
  // found in each series (newest series first). "Other" is always last.
  const seriesOrder = useMemo(() => {
    const latestDate = new Map<string, string>()
    for (const set of sets) {
      const s = set.series ?? 'Other'
      if (!latestDate.has(s) || (set.release_date && set.release_date > (latestDate.get(s) ?? ''))) {
        latestDate.set(s, set.release_date ?? '')
      }
    }
    return Array.from(latestDate.entries())
      .sort((a, b) => {
        if (a[0] === 'Other') return 1
        if (b[0] === 'Other') return -1
        return b[1].localeCompare(a[1])
      })
      .map(([s]) => s)
  }, [sets])

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
    let filtered = sets

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(s => s.name.toLowerCase().includes(q))
    }

    // Language filter
    if (!showEnglish) filtered = filtered.filter(s => (s.language ?? 'en') !== 'en')
    if (!showJapanese) filtered = filtered.filter(s => (s.language ?? 'en') !== 'ja')

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

    // Preserve series order determined above; within each group push promo/energy sets last
    const isSpecial = (name: string) => /promo|energy/i.test(name)
    const grouped = new Map<string, EnrichedSet[]>()
    for (const s of seriesOrder) {
      if (ungrouped.has(s)) {
        const sorted = [...ungrouped.get(s)!].sort(
          (a, b) => Number(isSpecial(a.name)) - Number(isSpecial(b.name))
        )
        grouped.set(s, sorted)
      }
    }

    return { filteredFavorites, groupedSets: grouped }
  }, [sets, searchQuery, activeSeries, showEnglish, showJapanese, favoritedIds, userId, seriesOrder])

  const totalVisible =
    filteredFavorites.length +
    Array.from(groupedSets.values()).reduce((acc, arr) => acc + arr.length, 0)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Search + series filter bar ─────────────────────────────────── */}
      <div className="mb-8 space-y-4">
        {/* Search input + language checkboxes row */}
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

          {/* Language checkboxes */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showEnglish}
                onChange={e => setShowEnglish(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-accent)] rounded"
              />
              <span className="text-sm text-secondary">🇬🇧 English</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showJapanese}
                onChange={e => setShowJapanese(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-accent)] rounded"
              />
              <span className="text-sm text-secondary">🇯🇵 Japanese</span>
            </label>
          </div>
        </div>

        {/* Series pill buttons */}
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
          {seriesOrder.map(series => (
            <button
              key={series}
              onClick={() => setActiveSeries(series)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
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
            <h2
              className="text-lg font-semibold"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              ⭐ Favorites
            </h2>
            <span className="text-xs text-muted bg-elevated px-2 py-0.5 rounded-full">
              {filteredFavorites.length}
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
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
        </section>
      )}

      {/* ── Series sections ────────────────────────────────────────────── */}
      {Array.from(groupedSets.entries()).map(([series, seriesSets]) => (
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
              <span className="text-xs text-muted bg-elevated px-2 py-0.5 rounded-full">
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
          </div>
        </section>
      ))}
    </div>
  )
}
