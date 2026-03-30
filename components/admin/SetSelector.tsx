'use client'

import { useState, useEffect } from 'react'

interface PokemonSetOption {
  id: string
  name: string
  series: string | null
  total_cards: number
  release_date: string | null
}

interface SetImageStat {
  set_id: string
  total_cards: number
  cards_with_images: number
}

interface Props {
  onSetSelect: (setId: string, setName: string) => void
  selectedSetId: string | null
  /** When true, fetches image-coverage stats and renders ✅ / ⚠️ / ❌ beside each set */
  showImageStatus?: boolean
}

// ── Image-status icon helpers ────────────────────────────────────────────────

function ImageStatusIcon({ stat }: { stat: SetImageStat | undefined }) {
  if (!stat || stat.total_cards === 0) {
    // No stat data available — treat as unknown / no images
    return (
      <span title="No image data" className="flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 text-red-500"
        >
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </span>
    )
  }

  const { total_cards, cards_with_images } = stat

  if (cards_with_images === 0) {
    // No images at all — red X
    return (
      <span title={`0 / ${total_cards} cards have images`} className="flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 text-red-500"
        >
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </span>
    )
  }

  if (cards_with_images === total_cards) {
    // All images present — green checkmark
    return (
      <span title={`All ${total_cards} cards have images`} className="flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4 text-green-400"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    )
  }

  // Partial — amber warning triangle
  const pct = Math.round((cards_with_images / total_cards) * 100)
  return (
    <span title={`${cards_with_images} / ${total_cards} cards have images (${pct}%)`} className="flex items-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-4 h-4 text-amber-400"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function SetSelector({ onSetSelect, selectedSetId, showImageStatus = false }: Props) {
  const [sets, setSets] = useState<PokemonSetOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [imageStatsBySetId, setImageStatsBySetId] = useState<Record<string, SetImageStat>>({})
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        // Always fetch sets; optionally fetch image stats in parallel
        const requests: [Promise<Response>, Promise<Response> | null] = [
          fetch('/api/sets'),
          showImageStatus ? fetch('/api/sets/image-stats') : null,
        ]

        const [setsRes, statsRes] = await Promise.all(requests)

        if (!setsRes!.ok) throw new Error('Failed to fetch sets')
        const setsData = await setsRes!.json()
        setSets(setsData.sets ?? [])

        if (statsRes) {
          if (statsRes.ok) {
            const statsData: SetImageStat[] = await statsRes.json()
            const map: Record<string, SetImageStat> = {}
            for (const s of statsData) map[s.set_id] = s
            setImageStatsBySetId(map)
          }
          // If stats fail, silently degrade — icons just won't show
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sets')
      } finally {
        setLoading(false)
        setStatsLoading(false)
      }
    }

    if (showImageStatus) setStatsLoading(true)
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = sets.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.series ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="h-12 bg-gray-800 border border-gray-700 rounded-lg animate-pulse" />
    )
  }

  if (error) {
    return (
      <p className="text-red-400 text-sm">⚠️ {error}</p>
    )
  }

  return (
    <div className="space-y-2">
      {/* Search filter */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter sets…"
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
      />

      {/* Image-status legend */}
      {showImageStatus && (
        <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
          <span className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-green-400">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
            All images
          </span>
          <span className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-amber-400">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            Partial
          </span>
          <span className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-red-500">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
            No images
          </span>
          {statsLoading && <span className="text-gray-600 italic">Loading stats…</span>}
        </div>
      )}

      {/* Set list */}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-700 divide-y divide-gray-800">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-gray-500 text-sm">No sets match "{search}"</p>
        ) : (
          filtered.map((set) => (
            <button
              key={set.id}
              onClick={() => onSetSelect(set.id, set.name)}
              className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-gray-800 flex items-center justify-between group ${
                selectedSetId === set.id
                  ? 'bg-yellow-500/10 border-l-2 border-l-yellow-500'
                  : 'bg-gray-900'
              }`}
            >
              {/* Left: name + series + image status icon */}
              <div className="flex items-center gap-2 min-w-0">
                {showImageStatus && (
                  <ImageStatusIcon stat={imageStatsBySetId[set.id]} />
                )}
                <span className={`font-medium truncate ${selectedSetId === set.id ? 'text-yellow-400' : 'text-white group-hover:text-yellow-300'}`}>
                  {set.name}
                </span>
                {set.series && (
                  <span className="ml-1 text-gray-500 text-xs shrink-0">{set.series}</span>
                )}
              </div>

              {/* Right: year + card count + selected tick */}
              <div className="flex items-center gap-3 text-gray-500 text-xs shrink-0 ml-2">
                {set.release_date && (
                  <span>{set.release_date.slice(0, 4)}</span>
                )}
                <span>{set.total_cards} cards</span>
                {selectedSetId === set.id && (
                  <span className="text-yellow-400">✓</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
