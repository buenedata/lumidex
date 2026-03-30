'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { SetSelector } from '@/components/admin/SetSelector'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SetStats {
  set_id:        string
  card_count:    number
  priced_count:  number
  product_count: number
  last_synced:   string | null
}

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error'

interface SyncState {
  status:    SyncStatus
  message:   string
  matched:   number
  total:     number
  products:  number
  elapsed:   number
  priceKeys?: string[]
  apiShape?: {
    topKeys:   string[]
    cardKeys:  string[]
    rawCounts: Record<string, number | undefined>
  }
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
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminPricesPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  const [selectedSetId,   setSelectedSetId]   = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null)
  const [stats,           setStats]           = useState<SetStats | null>(null)
  const [statsLoading,    setStatsLoading]    = useState(false)
  const [syncState,       setSyncState]       = useState<SyncState>({
    status: 'idle', message: '', matched: 0, total: 0, products: 0, elapsed: 0,
  })
  const abortRef = useRef<AbortController | null>(null)

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      if (!user) { router.push('/login?redirect=/admin/prices'); return }
      if (profile?.role !== 'admin') router.push('/dashboard?error=admin_required')
    }
  }, [user, profile, isLoading, router])

  // ── Load stats for selected set ────────────────────────────────────────────
  const loadStats = useCallback(async (setId: string) => {
    setStatsLoading(true)
    setStats(null)
    try {
      const res = await fetch(`/api/prices/status?setId=${encodeURIComponent(setId)}`)
      if (res.ok) {
        const json = await res.json()
        setStats(json.stats ?? null)
      }
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // ── Set selection ──────────────────────────────────────────────────────────
  const handleSetSelect = useCallback((setId: string, setName: string) => {
    setSelectedSetId(setId)
    setSelectedSetName(setName)
    setSyncState({ status: 'idle', message: '', matched: 0, total: 0, products: 0, elapsed: 0 })
    loadStats(setId)
  }, [loadStats])

  // ── Sync selected set ──────────────────────────────────────────────────────
  const syncSet = useCallback(async (setId: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSyncState({ status: 'syncing', message: 'Starting…', matched: 0, total: 0, products: 0, elapsed: 0 })

    try {
      const res = await fetch('/api/prices/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ setId }),
        signal:  controller.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

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
              setSyncState(prev => ({ ...prev, status: 'error', message: event.message ?? 'Error' }))
            }
            if (event.type === 'progress') {
              setSyncState(prev => ({
                ...prev,
                status:  'syncing',
                message: `Page ${event.page} — ${event.matched ?? prev.matched} matched`,
                matched: event.matched ?? prev.matched,
                total:   event.totalApiCards ?? prev.total,
              }))
            }
            if (event.type === 'products') {
              setSyncState(prev => ({ ...prev, products: event.count }))
            }
            if (event.type === 'debug') {
              setSyncState(prev => ({ ...prev, priceKeys: event.priceKeys }))
            }
            if (event.type === 'api_shape') {
              setSyncState(prev => ({
                ...prev,
                apiShape: {
                  topKeys:   event.topKeys  ?? [],
                  cardKeys:  event.cardKeys ?? [],
                  rawCounts: event.rawCounts ?? {},
                },
              }))
            }
            if (event.type === 'complete') {
              setSyncState({
                status:   'done',
                message:  `${event.upsertedCount} prices · ${event.productCount} products · ${formatElapsed(event.elapsed)}`,
                matched:  event.matched,
                total:    event.matched + event.unmatched,
                products: event.productCount,
                elapsed:  event.elapsed,
                priceKeys: undefined,
              })
              loadStats(setId)
            }
          } catch { /* bad event line */ }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setSyncState(prev => ({
        ...prev,
        status:  'error',
        message: e instanceof Error ? e.message : 'Sync failed',
      }))
    }
  }, [loadStats])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading || !user || profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading…</div>
      </div>
    )
  }

  const pct = stats ? coverage(stats.priced_count, stats.card_count) : 0

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <span>←</span>
            <span>Back to Admin</span>
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">💰</span>
            <h1 className="text-3xl font-bold">Price Data Sync</h1>
          </div>
          <p className="text-gray-400 text-sm">
            Sync TCGPlayer + CardMarket prices (and sealed products / graded prices where available)
            from the Pokémon TCG API via RapidAPI.
          </p>
        </div>

        {/* Set Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">Select a set to sync</label>
          <SetSelector
            onSetSelect={handleSetSelect}
            selectedSetId={selectedSetId}
          />
        </div>

        {/* Stats + Sync panel — only shown once a set is selected */}
        {selectedSetId && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-5">

            {/* Set name */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedSetName}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedSetId}</p>
              </div>
              <button
                onClick={() => syncSet(selectedSetId)}
                disabled={syncState.status === 'syncing'}
                className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
              >
                {syncState.status === 'syncing' ? 'Syncing…' : 'Sync Prices'}
              </button>
            </div>

            {/* Stats grid */}
            {statsLoading ? (
              <div className="text-gray-600 text-sm animate-pulse">Loading stats…</div>
            ) : stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Coverage */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Coverage</div>
                  <div className={`text-xl font-bold ${pct === 100 ? 'text-green-400' : pct > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {pct}%
                  </div>
                  <div className="mt-1.5 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{stats.priced_count} / {stats.card_count} cards</div>
                </div>

                {/* Cards */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Total Cards</div>
                  <div className="text-xl font-bold text-white">{stats.card_count}</div>
                  <div className="text-xs text-gray-500 mt-1">in database</div>
                </div>

                {/* Products */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Sealed Products</div>
                  <div className={`text-xl font-bold ${stats.product_count > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                    {stats.product_count}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">booster packs, ETBs…</div>
                </div>

                {/* Last synced */}
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Last Synced</div>
                  <div className="text-sm font-semibold text-white">{timeAgo(stats.last_synced)}</div>
                  {stats.last_synced && (
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(stats.last_synced).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Sync progress / result */}
            {syncState.status !== 'idle' && (
              <div className={`rounded-lg p-4 text-sm border ${
                syncState.status === 'error'  ? 'bg-red-900/30 border-red-700 text-red-300' :
                syncState.status === 'done'   ? 'bg-green-900/30 border-green-700 text-green-300' :
                'bg-indigo-900/30 border-indigo-700 text-indigo-300'
              }`}>
                <div className="flex items-center gap-2">
                  {syncState.status === 'syncing' && (
                    <span className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                  )}
                  {syncState.status === 'done'  && <span>✅</span>}
                  {syncState.status === 'error' && <span>❌</span>}
                  <span>{syncState.message}</span>
                </div>

                {/* Progress bar during sync */}
                {syncState.status === 'syncing' && syncState.total > 0 && (
                  <div className="mt-3 h-1.5 bg-indigo-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full transition-all"
                      style={{ width: `${Math.round((syncState.matched / syncState.total) * 100)}%` }}
                    />
                  </div>
                )}

                {/* API response shape debug */}
                {syncState.apiShape && (
                  <details className="mt-3">
                    <summary className="text-xs text-indigo-400 cursor-pointer hover:text-indigo-300">
                      API response shape (debug)
                    </summary>
                    <div className="mt-2 font-mono text-xs text-gray-400 space-y-1.5">
                      <div><span className="text-gray-500">Top-level keys:</span> {syncState.apiShape.topKeys.join(', ') || '—'}</div>
                      <div><span className="text-gray-500">Card keys:</span> {syncState.apiShape.cardKeys.join(', ') || 'no cards returned'}</div>
                      <div className="space-y-0.5">
                        <span className="text-gray-500">Count fields:</span>
                        {Object.entries(syncState.apiShape.rawCounts).map(([k, v]) => (
                          <div key={k} className="ml-2">{k}: {v ?? 'undefined'}</div>
                        ))}
                      </div>
                    </div>
                  </details>
                )}

                {/* Graded price key debug */}
                {syncState.priceKeys && syncState.priceKeys.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-indigo-400 cursor-pointer hover:text-indigo-300">
                      TCGPlayer price keys seen ({syncState.priceKeys.length})
                    </summary>
                    <div className="mt-1 font-mono text-xs text-gray-400 space-y-0.5">
                      {syncState.priceKeys.map(k => <div key={k}>{k}</div>)}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer note */}
        <p className="mt-8 text-xs text-gray-600 text-center">
          Prices are cached — re-sync a set at any time. &nbsp;
          Graded price key names are logged to the server console on the first sync.
        </p>
      </div>
    </div>
  )
}
