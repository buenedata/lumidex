'use client'

import { useState, useEffect } from 'react'

interface PokemonSetOption {
  id: string
  name: string
  series: string | null
  total_cards: number
  release_date: string | null
}

interface Props {
  onSetSelect: (setId: string, setName: string) => void
  selectedSetId: string | null
}

export function SetSelector({ onSetSelect, selectedSetId }: Props) {
  const [sets, setSets] = useState<PokemonSetOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchSets() {
      try {
        const res = await fetch('/api/sets')
        if (!res.ok) throw new Error('Failed to fetch sets')
        const data = await res.json()
        setSets(data.sets ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sets')
      } finally {
        setLoading(false)
      }
    }
    fetchSets()
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
              <div>
                <span className={`font-medium ${selectedSetId === set.id ? 'text-yellow-400' : 'text-white group-hover:text-yellow-300'}`}>
                  {set.name}
                </span>
                {set.series && (
                  <span className="ml-2 text-gray-500 text-xs">{set.series}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-gray-500 text-xs shrink-0">
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
