'use client'

import { useState, useEffect } from 'react'

export interface SetGridItem {
  id: string       // set_id aliased
  name: string
  series: string | null
  logo_url: string | null
}

interface Props {
  onSetSelect: (set: SetGridItem) => void
  onSetsLoaded?: (sets: SetGridItem[]) => void
  selectedSetId?: string | null
  refreshKey?: number
}

export function SetImageGrid({ onSetSelect, onSetsLoaded, selectedSetId, refreshKey = 0 }: Props) {
  const [sets, setSets] = useState<SetGridItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)

    async function fetchSets() {
      try {
        const res = await fetch('/api/sets')
        if (!res.ok) throw new Error(`Failed to fetch sets: ${res.status}`)
        const data = await res.json()
        // The /api/sets route returns { sets: [...] }
        const raw: Array<{ id: string; name: string; series?: string | null; logo_url?: string | null }> =
          Array.isArray(data) ? data : (data.sets ?? [])
        const mapped = raw.map((s) => ({
          id: s.id,
          name: s.name,
          series: s.series ?? null,
          logo_url: s.logo_url ?? null,
        }))
        setSets(mapped)
        onSetsLoaded?.(mapped)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sets')
      } finally {
        setLoading(false)
      }
    }

    fetchSets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-red-400 text-sm">⚠️ {error}</p>
  }

  if (sets.length === 0) {
    return <p className="text-gray-500 text-sm py-4 text-center">No sets found in the database.</p>
  }

  const withLogo  = sets.filter((s) => !!s.logo_url).length
  const total     = sets.length

  const filtered = search.trim()
    ? sets.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.series ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : sets

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          <span className="text-green-400 font-semibold">{withLogo}</span>
          {' / '}
          <span className="text-white font-semibold">{total}</span>
          {' '}sets have logos
        </span>
        {total > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-32 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(withLogo / total) * 100}%` }}
              />
            </div>
            <span className="text-gray-500 text-xs">
              {Math.round((withLogo / total) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Filter sets…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-500"
      />

      {/* Set list */}
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {filtered.map((set) => {
          const hasLogo   = !!set.logo_url
          const isSelected = set.id === selectedSetId

          return (
            <button
              key={set.id}
              onClick={() => onSetSelect(set)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150
                focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400
                ${isSelected
                  ? 'bg-yellow-500/15 border border-yellow-500/50 ring-1 ring-yellow-500/40'
                  : 'bg-gray-900 border border-gray-800 hover:border-yellow-500/40 hover:bg-gray-800'}
              `}
            >
              {/* Logo thumbnail or placeholder */}
              <div className="w-16 h-9 rounded flex-shrink-0 overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center">
                {hasLogo ? (
                  <img
                    src={set.logo_url!}
                    alt={set.name}
                    className="w-full h-full object-contain p-0.5"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-gray-600 text-xs">🎴</span>
                )}
              </div>

              {/* Set name + series */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isSelected ? 'text-yellow-300' : 'text-white'}`}>
                  {set.name}
                </p>
                {set.series && (
                  <p className="text-xs text-gray-500 truncate">{set.series}</p>
                )}
              </div>

              {/* Status badge */}
              <span
                className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium
                  ${hasLogo
                    ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                    : 'bg-gray-700 text-gray-500 border border-gray-600'}`}
              >
                {hasLogo ? '✓ logo' : 'no logo'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
