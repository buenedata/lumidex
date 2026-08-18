'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import type { ScryfallSetListing } from '@/lib/scryfall'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SseEvent {
  type: 'status' | 'progress' | 'done' | 'error'
  message?: string
  current?: number
  total?: number
  setsCreated?: number
  cardsCreated?: number
  cardsSkipped?: number
  setId?: string
  setName?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SeriesBadge({ series }: { series: string }) {
  const colours =
    series === 'Masters Sets'
      ? 'bg-purple-900/50 text-purple-300 border-purple-700/50'
      : 'bg-blue-900/50 text-blue-300 border-blue-700/50'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colours}`}>
      {series === 'Masters Sets' ? 'Masters' : 'Standard'}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MtgSetImport() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  const [sets, setSets] = useState<ScryfallSetListing[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [search, setSearch] = useState('')
  const [seriesFilter, setSeriesFilter] = useState<'all' | 'Standard Sets' | 'Masters Sets'>('all')

  // Import state
  const [importingCode, setImportingCode] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)
  const [importLog, setImportLog] = useState<string[]>([])
  const [importedCodes, setImportedCodes] = useState<Set<string>>(new Set())
  const logRef = useRef<HTMLDivElement>(null)

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      if (!user) { router.push('/login?redirect=/admin/mtg-import'); return }
      if (profile?.role !== 'admin') { router.push('/dashboard?error=admin_required') }
    }
  }, [user, profile, isLoading, router])

  // ── Fetch sets from Scryfall (via admin proxy) ──────────────────────────────
  useEffect(() => {
    if (!user || profile?.role !== 'admin') return
    setIsFetching(true)
    setFetchError(null)

    fetch('/api/admin/scryfall/sets?limit=20')
      .then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error ?? `HTTP ${r.status}`) })
        return r.json()
      })
      .then((data: ScryfallSetListing[]) => {
        setSets(data)
        // Pre-populate already-imported set from initial response
        const alreadyIn = new Set(data.filter((s) => s.already_imported).map((s) => s.code))
        setImportedCodes(alreadyIn)
      })
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setIsFetching(false))
  }, [user, profile])

  // ── Auto-scroll log ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [importLog])

  // ── Import a set via SSE stream ─────────────────────────────────────────────
  async function handleImport(setCode: string) {
    if (importingCode) return // already importing something

    setImportingCode(setCode)
    setImportProgress(null)
    setImportLog([`▶ Starting import for set "${setCode}"…`])

    try {
      const res = await fetch('/api/admin/import-mtg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setCode }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setImportLog((prev) => [...prev, `✗ Error: ${err.error}`])
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response body')

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Split on double-newlines (SSE event boundaries)
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          try {
            const event: SseEvent = JSON.parse(line.slice(5).trim())
            handleSseEvent(event, setCode)
          } catch {
            // malformed line — ignore
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setImportLog((prev) => [...prev, `✗ Unexpected error: ${msg}`])
    } finally {
      setImportingCode(null)
    }
  }

  function handleSseEvent(event: SseEvent, setCode: string) {
    switch (event.type) {
      case 'status':
        setImportLog((prev) => [...prev, event.message ?? ''])
        break
      case 'progress':
        setImportProgress({ current: event.current ?? 0, total: event.total ?? 1 })
        break
      case 'done':
        setImportLog((prev) => [
          ...prev,
          `✓ Done! ${event.cardsCreated} cards imported, ${event.cardsSkipped} skipped.`,
        ])
        setImportProgress(null)
        // Mark this set as imported in local state
        setImportedCodes((prev) => new Set([...prev, setCode]))
        setSets((prev) =>
          prev.map((s) => (s.code === setCode ? { ...s, already_imported: true } : s)),
        )
        break
      case 'error':
        setImportLog((prev) => [...prev, `✗ Error: ${event.message}`])
        break
    }
  }

  // ── Derived list ────────────────────────────────────────────────────────────
  const displayed = sets.filter((s) => {
    if (seriesFilter !== 'all' && s.series !== seriesFilter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.code.includes(search.toLowerCase())) return false
    return true
  })

  // ── Loading / auth gates ────────────────────────────────────────────────────
  if (isLoading || !user || profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading…</div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Filter bar */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        {/* Series pills */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'Standard Sets', 'Masters Sets'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSeriesFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                seriesFilter === f
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
        />
      </div>

      {/* Set list */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
        {isFetching && (
          <div className="p-8 text-center text-gray-400 animate-pulse">
            Fetching MTG sets from Scryfall…
          </div>
        )}

        {fetchError && (
          <div className="p-6 text-red-400 text-sm">
            ✗ Failed to load sets: {fetchError}
          </div>
        )}

        {!isFetching && !fetchError && displayed.length === 0 && (
          <div className="p-8 text-center text-gray-500">No sets match your filters.</div>
        )}

        {!isFetching && !fetchError && displayed.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr className="text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left p-4 w-10">Icon</th>
                <th className="text-left p-4">Set</th>
                <th className="text-left p-4 hidden md:table-cell">Released</th>
                <th className="text-left p-4 hidden sm:table-cell">Cards</th>
                <th className="text-left p-4 hidden lg:table-cell">Type</th>
                <th className="text-right p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {displayed.map((s) => {
                const isThis = importingCode === s.code
                const isImported = importedCodes.has(s.code) || s.already_imported

                return (
                  <tr
                    key={s.code}
                    className={`transition-colors ${isThis ? 'bg-yellow-500/5' : 'hover:bg-gray-800/50'}`}
                  >
                    {/* Set icon */}
                    <td className="p-4">
                      {s.icon_svg_uri ? (
                        // Scryfall SVG icons — rendered as <img> (SVG from external CDN)
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.icon_svg_uri}
                          alt={s.code}
                          width={20}
                          height={20}
                          className="invert opacity-70"
                        />
                      ) : (
                        <span className="text-gray-600">🃏</span>
                      )}
                    </td>

                    {/* Name + code + series badge */}
                    <td className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{s.name}</span>
                        <span className="text-gray-500 text-xs font-mono">{s.code}</span>
                        <SeriesBadge series={s.series} />
                      </div>

                      {/* Progress bar (visible during active import of this set) */}
                      {isThis && importProgress && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden w-full max-w-xs">
                            <div
                              className="h-full bg-yellow-500 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round((importProgress.current / importProgress.total) * 100),
                                )}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {importProgress.current} / {importProgress.total} cards
                          </p>
                        </div>
                      )}
                    </td>

                    {/* Released */}
                    <td className="p-4 text-gray-400 hidden md:table-cell">
                      {s.released_at ?? '—'}
                    </td>

                    {/* Card count */}
                    <td className="p-4 text-gray-400 hidden sm:table-cell">{s.card_count}</td>

                    {/* Set type */}
                    <td className="p-4 text-gray-500 hidden lg:table-cell capitalize">{s.set_type}</td>

                    {/* Action */}
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-2 justify-end flex-wrap">
                        {isImported && !isThis && (
                          <span className="inline-flex items-center gap-1 text-green-400 text-xs font-medium shrink-0">
                            <span>✓</span>
                            <span>Imported</span>
                          </span>
                        )}
                        <button
                          onClick={() => handleImport(s.code)}
                          disabled={!!importingCode}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            isThis
                              ? 'bg-yellow-500/20 text-yellow-300 cursor-not-allowed'
                              : importingCode
                              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                              : isImported
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                              : 'bg-yellow-500 text-black hover:bg-yellow-400'
                          }`}
                        >
                          {isThis ? 'Importing…' : isImported ? 'Re-import' : 'Import'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Import log */}
      {importLog.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Import Log</h3>
          <div
            ref={logRef}
            className="font-mono text-xs text-gray-400 space-y-0.5 max-h-48 overflow-y-auto"
          >
            {importLog.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith('✓')
                    ? 'text-green-400'
                    : line.startsWith('✗')
                    ? 'text-red-400'
                    : line.startsWith('▶')
                    ? 'text-yellow-400'
                    : 'text-gray-400'
                }
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
