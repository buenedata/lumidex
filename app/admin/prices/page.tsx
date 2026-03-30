'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SetPriceStatus {
  set_id:       string
  name:         string
  setComplete:  number | null
  card_count:   number
  priced_count: number
  product_count:number
  last_synced:  string | null
}

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error'

interface SyncState {
  status:   SyncStatus
  message:  string
  matched:  number
  total:    number
  products: number
  elapsed:  number
  priceKeys?: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function coverage(priced: number, total: number): number {
  if (total === 0) return 0
  return Math.round((priced / total) * 100)
}

function formatElapsed(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)    return 'Just now'
  if (mins < 60)   return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)    return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminPricesPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  const [sets, setSets]       = useState<SetPriceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  // Per-set sync state
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({})
  const abortRefs = useRef<Record<string, AbortController>>({})

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      if (!user) { router.push('/login?redirect=/admin/prices'); return }
      if (profile?.role !== 'admin') router.push('/dashboard?error=admin_required')
    }
  }, [user, profile, isLoading, router])

  // ── Load set price status ──────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    setLoading(true)
    setFetchErr(null)
    try {
      const res = await fetch('/api/prices/status')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setSets(json.sets ?? [])
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : 'Failed to load price status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // ── Sync a single set ──────────────────────────────────────────────────────
  const syncSet = useCallback(async (setId: string) => {
    // Abort any ongoing sync for this set
    abortRefs.current[setId]?.abort()
    const controller = new AbortController()
    abortRefs.current[setId] = controller

    setSyncStates(prev => ({
      ...prev,
      [setId]: { status: 'syncing', message: 'Starting…', matched: 0, total: 0, products: 0, elapsed: 0 },
    }))

    try {
      const res = await fetch('/api/prices/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ setId }),
        signal:  controller.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'error') {
              setSyncStates(prev => ({
                ...prev,
                [setId]: { ...prev[setId], status: 'error', message: event.message ?? 'Unknown error' },
              }))
              break
            }

            if (event.type === 'progress') {
              setSyncStates(prev => ({
                ...prev,
                [setId]: {
                  ...prev[setId],
                  status:  'syncing',
                  message: `Page ${event.page} — ${event.matched} matched`,
                  matched: event.matched ?? prev[setId].matched,
                  total:   event.totalApiCards ?? prev[setId].total,
                },
              }))
            }

            if (event.type === 'products') {
              setSyncStates(prev => ({
                ...prev,
                [setId]: { ...prev[setId], products: event.count },
              }))
            }

            if (event.type === 'debug') {
              setSyncStates(prev => ({
                ...prev,
                [setId]: { ...prev[setId], priceKeys: event.priceKeys },
              }))
            }

            if (event.type === 'complete') {
              setSyncStates(prev => ({
                ...prev,
                [setId]: {
                  status:   'done',
                  message:  `${event.upsertedCount} prices saved · ${event.productCount} products · ${formatElapsed(event.elapsed)}`,
                  matched:  event.matched,
                  total:    event.matched + event.unmatched,
                  products: event.productCount,
                  elapsed:  event.elapsed,
                  priceKeys: prev[setId]?.priceKeys,
                },
              }))
              // Reload status to update coverage numbers
              await loadStatus()
            }
          } catch { /* malformed line — skip */ }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setSyncStates(prev => ({
        ...prev,
        [setId]: {
          ...prev[setId],
          status:  'error',
          message: e instanceof Error ? e.message : 'Sync failed',
        },
      }))
    }
  }, [loadStatus])

  // ── Sync all sets (sequential to avoid rate limits) ────────────────────────
  const syncAll = useCallback(async () => {
    for (const s of sets) {
      await syncSet(s.set_id)
    }
  }, [sets, syncSet])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading || !user || profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <span>←</span>
            <span>Back to Admin</span>
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl">💰</span>
                <h1 className="text-3xl font-bold">Price Data Sync</h1>
              </div>
              <p className="text-gray-400 text-sm">
                Fetches TCGPlayer + CardMarket prices (and graded / sealed product prices where available)
                from the Pokémon TCG API via RapidAPI. Prices are cached in the database.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadStatus}
                className="px-4 py-2 text-sm border border-gray-600 rounded-lg hover:border-gray-400 transition-colors text-gray-300 hover:text-white"
              >
                Refresh
              </button>
              <button
                onClick={syncAll}
                className="px-4 py-2 text-sm bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg transition-colors"
              >
                Sync All Sets
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {fetchErr && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {fetchErr}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-gray-500 animate-pulse">Loading set data…</div>
        ) : sets.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No sets found in database.</div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Set</th>
                  <th className="text-right px-4 py-3">Cards</th>
                  <th className="text-right px-4 py-3">Coverage</th>
                  <th className="text-right px-4 py-3">Products</th>
                  <th className="text-right px-4 py-3">Last Synced</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sets.map(s => {
                  const pct  = coverage(s.priced_count, s.card_count)
                  const sync = syncStates[s.set_id]

                  return (
                    <tr key={s.set_id} className="hover:bg-gray-900/50 transition-colors">
                      {/* Set name */}
                      <td className="px-5 py-3">
                        <div className="font-medium text-white">{s.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{s.set_id}</div>
                      </td>

                      {/* Card count */}
                      <td className="px-4 py-3 text-right text-gray-300">
                        {s.priced_count} / {s.card_count}
                      </td>

                      {/* Coverage bar */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium w-8 text-right ${
                            pct === 100 ? 'text-green-400' : pct > 50 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {pct}%
                          </span>
                        </div>
                      </td>

                      {/* Products */}
                      <td className="px-4 py-3 text-right text-gray-400">
                        {s.product_count > 0 ? (
                          <span className="text-green-400">{s.product_count}</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      {/* Last synced */}
                      <td className="px-4 py-3 text-right text-gray-500 text-xs">
                        {timeAgo(s.last_synced)}
                      </td>

                      {/* Sync action */}
                      <td className="px-5 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <button
                            onClick={() => syncSet(s.set_id)}
                            disabled={sync?.status === 'syncing'}
                            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                          >
                            {sync?.status === 'syncing' ? 'Syncing…' : 'Sync'}
                          </button>

                          {/* Status message */}
                          {sync && (
                            <span className={`text-xs max-w-[180px] text-right leading-tight ${
                              sync.status === 'error'  ? 'text-red-400' :
                              sync.status === 'done'   ? 'text-green-400' :
                              'text-yellow-400'
                            }`}>
                              {sync.message}
                            </span>
                          )}

                          {/* Debug: price keys seen */}
                          {sync?.priceKeys && sync.priceKeys.length > 0 && (
                            <details className="text-right">
                              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">
                                Price keys ({sync.priceKeys.length})
                              </summary>
                              <div className="text-xs text-gray-500 mt-1 space-y-0.5 text-right">
                                {sync.priceKeys.map(k => (
                                  <div key={k} className="font-mono">{k}</div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <p className="mt-6 text-xs text-gray-600 text-center">
          Coverage = cards with at least one TCGPlayer or CardMarket price in the database. &nbsp;
          Products = sealed products (booster packs, ETBs, boxes) synced from the API.
        </p>
      </div>
    </div>
  )
}
