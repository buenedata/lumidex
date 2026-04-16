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
  api_set_id:    string | null
}

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error'

interface SyncState {
  status:        SyncStatus
  message:       string
  matched:       number
  total:         number
  products:      number
  gradedPoints:  number
  elapsed:       number
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
  const [apiSetIdInput,     setApiSetIdInput]     = useState('')
  const [apiSuggestions,    setApiSuggestions]    = useState<{ id: string; name: string; series?: string }[]>([])
  const [suggestionsSearch, setSuggestionsSearch] = useState('')
  const [allApiSets,        setAllApiSets]        = useState<{ id: string; name: string; series?: string }[]>([])
  const [allSetsSearch,     setAllSetsSearch]     = useState('')
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverErr,     setDiscoverErr]     = useState<string | null>(null)
  const [probeResult,     setProbeResult]     = useState<Record<string, unknown> | null>(null)
  const [probeLoading,    setProbeLoading]    = useState(false)
  const [stats,           setStats]           = useState<SetStats | null>(null)
  const [statsLoading,    setStatsLoading]    = useState(false)
  const [syncState,       setSyncState]       = useState<SyncState>({
    status: 'idle', message: '', matched: 0, total: 0, products: 0, gradedPoints: 0, elapsed: 0,
  })
  const [probeCardId,      setProbeCardId]      = useState('')
  const [includeProducts, setIncludeProducts] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const [singleCardId,     setSingleCardId]     = useState('')
  const [singleCardState,  setSingleCardState]  = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [singleCardResult, setSingleCardResult] = useState<string>('')

  // ── History backfill state ───────────────────────────────────────────────────
  const [backfillStatus,  setBackfillStatus]  = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [backfillMsg,     setBackfillMsg]     = useState('')
  const [backfillDays,    setBackfillDays]    = useState(180)

  // ── Bulk seed state ──────────────────────────────────────────────────────────
  const [bulkStatus,   setBulkStatus]   = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [bulkProgress, setBulkProgress] = useState({
    setsProcessed: 0, remaining: -1, cardsProcessed: 0, errors: 0, totalRuns: 0,
  })
  const [bulkAutoLoop, setBulkAutoLoop] = useState(true)
  const [bulkMsg,      setBulkMsg]      = useState('')
  const bulkRunningRef  = useRef(false)
  const bulkAbortRef    = useRef<AbortController | null>(null)

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
        const s: SetStats | null = json.stats ?? null
        setStats(s)

        // Auto-populate the episode ID when the set already has one saved
        if (s?.api_set_id) {
          setApiSetIdInput(s.api_set_id)
          setIncludeProducts(true)
        }
      }
    } finally {
      setStatsLoading(false)
    }
  }, [setApiSetIdInput, setIncludeProducts])

  // ── Set selection ──────────────────────────────────────────────────────────
  const handleSetSelect = useCallback((setId: string, setName: string) => {
    setSelectedSetId(setId)
    setSelectedSetName(setName)
    setApiSetIdInput('')
    setApiSuggestions([])
    setSuggestionsSearch('')
    setDiscoverErr(null)
    setSyncState({ status: 'idle', message: '', matched: 0, total: 0, products: 0, gradedPoints: 0, elapsed: 0 })
    loadStats(setId)
  }, [loadStats])

  // Search the RapidAPI for sets matching this set's name
  const discoverApiSetId = useCallback(async (setName: string) => {
    setDiscoverLoading(true)
    setDiscoverErr(null)
    setApiSuggestions([])
    setAllApiSets([])  // clear any previous browse-all results
    try {
      const res = await fetch(`/api/prices/discover?name=${encodeURIComponent(setName)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const sets = json.sets ?? []
      if (sets.length === 0) {
        setDiscoverErr(`No sets found matching "${setName}" in the API. Try the full API set list below.`)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setApiSuggestions(sets.map((s: any) => ({
          id:     String(s.id ?? ''),
          name:   String(s.name ?? ''),
          // series can be a nested object {id, name, slug} — extract just the name
          series: s.series ? (typeof s.series === 'object' ? String(s.series.name ?? '') : String(s.series)) : undefined,
        })))
      }
    } catch (e) {
      setDiscoverErr(e instanceof Error ? e.message : 'Discovery failed')
    } finally {
      setDiscoverLoading(false)
    }
  }, [])

  const probeApi = useCallback(async () => {
    setProbeLoading(true)
    setProbeResult(null)
    try {
      const res = await fetch('/api/prices/discover?probe=episodes')
      const json = await res.json()
      setProbeResult(json)
    } catch (e) {
      setProbeResult({ error: String(e) })
    } finally {
      setProbeLoading(false)
    }
  }, [])

  // Fetch ALL sets from the API (for browsing when name search fails)
  const browseAllSets = useCallback(async () => {
    setDiscoverLoading(true)
    setDiscoverErr(null)
    setAllApiSets([])
    setAllSetsSearch('')
    try {
      const res = await fetch('/api/prices/discover')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const sets = json.sets ?? []
      if (sets.length === 0) {
        setDiscoverErr('API returned no sets at all. Check your RAPIDAPI_KEY and the API endpoint.')
      } else {
        // Normalise every field to a string — tcggo.com may return series as {id, name, slug}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAllApiSets(sets.map((s: any) => ({
          id:     String(s.id ?? ''),
          name:   String(s.name ?? ''),
          series: s.series ? (typeof s.series === 'object' ? String(s.series.name ?? '') : String(s.series)) : undefined,
        })))
      }
    } catch (e) {
      setDiscoverErr(e instanceof Error ? e.message : 'Browse failed')
    } finally {
      setDiscoverLoading(false)
    }
  }, [])

  // ── Sync selected set ──────────────────────────────────────────────────────
  const syncSet = useCallback(async (setId: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSyncState({ status: 'syncing', message: 'Starting…', matched: 0, total: 0, products: 0, gradedPoints: 0, elapsed: 0 })

    try {
      const body: Record<string, unknown> = { setId }
      if (includeProducts && apiSetIdInput.trim()) body.apiSetId = apiSetIdInput.trim()

      const res = await fetch('/api/prices/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
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
            if (event.type === 'fetching') {
              setSyncState(prev => ({ ...prev, status: 'syncing', message: event.message ?? `Calling API (page ${event.page})…` }))
            }
            if (event.type === 'graded') {
              setSyncState(prev => ({ ...prev, status: 'syncing', message: `🏅 ${event.message ?? 'Running graded card pricing…'}` }))
            }
            if (event.type === 'graded_card') {
              setSyncState(prev => ({
                ...prev,
                gradedPoints: event.runningTotal ?? (prev.gradedPoints + (event.pointsSaved ?? 0)),
                message: `🏅 Graded: ${event.runningTotal ?? prev.gradedPoints + (event.pointsSaved ?? 0)} pts found so far…`,
              }))
            }
            if (event.type === 'warning') {
              setSyncState(prev => ({ ...prev, status: 'syncing', message: `⚠️ ${event.message ?? 'Warning'}` }))
            }
            if (event.type === 'fetched') {
              setSyncState(prev => ({ ...prev, status: 'syncing', message: `API responded HTTP ${event.httpStatus} (page ${event.page})` }))
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
              const gradedSaved: number = event.gradedPointsSaved ?? 0
              const parts: string[] = [`${event.upsertedCount} cards`]
              if (gradedSaved > 0) parts.push(`${gradedSaved} graded pts`)
              parts.push(`${event.productCount} products`)
              parts.push(formatElapsed(event.elapsed))
              setSyncState({
                status:       'done',
                message:      parts.join(' · '),
                matched:      event.matched,
                total:        event.matched + event.unmatched,
                products:     event.productCount,
                gradedPoints: gradedSaved,
                elapsed:      event.elapsed,
                priceKeys:    undefined,
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
  }, [loadStats, apiSetIdInput, includeProducts])

  // ── Sync Single Card ───────────────────────────────────────────────────────
  async function syncSingleCardAdmin() {
    if (!singleCardId.trim()) return
    setSingleCardState('running')
    setSingleCardResult('')
    try {
      const res = await fetch(`/api/admin/sync/card/${encodeURIComponent(singleCardId.trim())}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.ok) {
        setSingleCardState('done')
        setSingleCardResult(`✅ ${data.pricePointsSaved} price points saved · aggregated: ${data.aggregated ? 'yes' : 'no'}`)
      } else {
        setSingleCardState('error')
        setSingleCardResult(data.error ?? 'Unknown error')
      }
    } catch {
      setSingleCardState('error')
      setSingleCardResult('Network error')
    }
  }

  // ── History Backfill ───────────────────────────────────────────────────────
  async function runHistoryBackfill() {
    if (!selectedSetId) return
    setBackfillStatus('running')
    setBackfillMsg(`Fetching ${backfillDays}d of price history…`)
    try {
      const res = await fetch('/api/admin/prices/history-backfill', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ setId: selectedSetId, days: backfillDays }),
      })
      const data = await res.json()
      if (data.ok) {
        setBackfillStatus('done')
        setBackfillMsg(
          data.cardsProcessed === 0
            ? data.message ?? 'No cards with tcggo_id found — run a price sync first.'
            : `✅ ${data.pointsSaved} history points saved across ${data.cardsProcessed} cards (${data.dateFrom} → ${data.dateTo})`
        )
        await loadStats(selectedSetId)
      } else {
        setBackfillStatus('error')
        setBackfillMsg(data.error ?? 'Backfill failed')
      }
    } catch (e) {
      setBackfillStatus('error')
      setBackfillMsg(e instanceof Error ? e.message : 'Network error')
    }
  }

  // ── Bulk Seed All Sets ─────────────────────────────────────────────────────
  async function runBulkSeed(forceAll = false) {
    if (bulkRunningRef.current) return
    bulkRunningRef.current = true
    setBulkStatus('running')
    setBulkMsg('Starting bulk seed…')

    let totalSetsProcessed  = 0
    let totalCardsProcessed = 0
    let totalErrors         = 0
    let totalRuns           = 0
    let remaining           = 1  // start > 0 so the loop runs at least once

    try {
      while (remaining > 0 && bulkRunningRef.current) {
        // Fresh AbortController for each request so Stop cancels the in-flight call
        const controller = new AbortController()
        bulkAbortRef.current = controller

        let res: Response
        try {
          res = await fetch('/api/admin/sync/prices/bulk', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ forceAll, concurrency: 5, setsPerRun: 3 }),
            signal:  controller.signal,
          })
        } catch (err) {
          // Aborted by Stop button — exit cleanly
          if ((err as Error).name === 'AbortError') break
          throw err
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
        }

        const data = await res.json() as {
          setsProcessed:  number
          remaining:      number
          cardsProcessed: number
          errors:         number
          message:        string
        }

        totalRuns++
        totalSetsProcessed  += data.setsProcessed
        totalCardsProcessed += data.cardsProcessed
        totalErrors         += data.errors
        remaining            = data.remaining ?? 0

        setBulkProgress({
          setsProcessed:  totalSetsProcessed,
          remaining,
          cardsProcessed: totalCardsProcessed,
          errors:         totalErrors,
          totalRuns,
        })
        // Use cumulative totals in the status message, not the per-batch count
        setBulkMsg(
          remaining > 0
            ? `${totalSetsProcessed} sets done, ${remaining} remaining — continuing…`
            : `All sets seeded! ${totalSetsProcessed} sets · ${totalCardsProcessed} cards updated.`
        )

        // Stop looping if auto-loop is off or user clicked Stop
        if (!bulkAutoLoop || !bulkRunningRef.current) break

        // Short pause between runs so the browser stays responsive
        if (remaining > 0) await new Promise(r => setTimeout(r, 300))
      }

      setBulkStatus(remaining > 0 ? 'idle' : 'done')
      setBulkMsg(
        remaining > 0
          ? `Paused — ${remaining} sets still pending. Click "Continue" to resume.`
          : `✅ All sets seeded! ${totalSetsProcessed} sets · ${totalCardsProcessed} cards updated.`
      )
    } catch (err) {
      setBulkStatus('error')
      setBulkMsg(err instanceof Error ? err.message : 'Bulk seed failed')
    } finally {
      bulkRunningRef.current  = false
      bulkAbortRef.current    = null
    }
  }

  function stopBulkSeed() {
    bulkRunningRef.current = false
    bulkAbortRef.current?.abort()
    bulkAbortRef.current = null
    setBulkStatus('idle')
    setBulkMsg('Stopped.')
  }

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
            <div>
              <h2 className="text-lg font-semibold text-white">{selectedSetName}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{selectedSetId}</p>
            </div>

            {/* ── What to import ─────────────────────────────────────────── */}
            <div className="border border-gray-700 rounded-lg p-4 space-y-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Import options</p>

              {/* Card prices — always on */}
              <label className="flex items-center gap-3 cursor-default select-none opacity-60">
                <input
                  type="checkbox"
                  checked
                  readOnly
                  className="w-4 h-4 rounded accent-purple-500 cursor-default"
                />
                <span className="text-sm text-gray-300">
                  Card prices <span className="text-gray-500">(Pokémon TCG API — TCGPlayer &amp; CardMarket)</span>
                </span>
                <span className="ml-auto text-xs text-gray-600 italic">always included</span>
              </label>

              {/* Sealed product prices */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeProducts}
                  onChange={e => setIncludeProducts(e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-500"
                />
                <span className="text-sm text-gray-300">
                  Sealed product prices <span className="text-gray-500">(requires tcggo.com Episode ID)</span>
                </span>
              </label>
              {includeProducts && !apiSetIdInput.trim() && (
                <p className="text-xs text-amber-400 pl-7">
                  ⚠️ Set the tcggo.com Episode ID below before syncing product prices.
                </p>
              )}
            </div>

            {/* tcggo.com Episode ID — lookup + override */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400">
                tcggo.com Episode ID
                <span className="text-gray-600 font-normal ml-1">
                  — tcggo.com calls sets &quot;episodes&quot; and IDs them as integers (e.g. 396)
                </span>
                {stats?.api_set_id && stats.api_set_id === apiSetIdInput.trim() && (
                  <span className="ml-2 text-xs text-emerald-500 font-normal">✓ saved</span>
                )}
              </label>
                <button
                  onClick={() => selectedSetName && discoverApiSetId(selectedSetName)}
                  disabled={discoverLoading}
                  className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded transition-colors"
                >
                  {discoverLoading ? 'Searching…' : '🔍 Find in API'}
                </button>
              </div>

              {/* Manual override input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Episode ID (integer) — e.g. 396 for Ascended Heroes"
                  value={apiSetIdInput}
                  onChange={e => { setApiSetIdInput(e.target.value); setApiSuggestions([]); setSuggestionsSearch('') }}
                  className="flex-1 h-9 bg-gray-800 border border-gray-700 rounded-lg px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
                {apiSetIdInput.trim() && (
                  <button onClick={() => setApiSetIdInput('')} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
                )}
              </div>

              {/* Discovery error + browse-all fallback */}
              {discoverErr && (
                <div className="space-y-2">
                  <p className="text-xs text-red-400">{discoverErr}</p>
                  <button
                    onClick={browseAllSets}
                    disabled={discoverLoading}
                    className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded transition-colors"
                  >
                    {discoverLoading ? 'Loading…' : '📋 Browse all API sets'}
                  </button>
                </div>
              )}

              {/* Full API set browser */}
              {allApiSets.length > 0 && (
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Filter sets…"
                      value={allSetsSearch}
                      onChange={e => setAllSetsSearch(e.target.value)}
                      className="flex-1 h-7 bg-gray-700 border border-gray-600 rounded px-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-gray-500 shrink-0">{allApiSets.length} sets</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-gray-800">
                    {allApiSets
                      .filter(s => {
                        if (!allSetsSearch.trim()) return true
                        const q = allSetsSearch.toLowerCase()
                        const idStr = String(s.id ?? '')
                        return s.name?.toLowerCase().includes(q) || idStr.toLowerCase().includes(q)
                      })
                      .map(s => (
                        <button
                          key={String(s.id)}
                          onClick={() => { setApiSetIdInput(String(s.id)); setAllApiSets([]); setApiSuggestions([]); setSuggestionsSearch('') }}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700 transition-colors text-left"
                        >
                          <div>
                            <span className="text-sm text-white">{s.name}</span>
                            {s.series && <span className="text-xs text-gray-500 ml-2">{s.series}</span>}
                          </div>
                          <code className="text-xs font-mono text-indigo-400 ml-4 shrink-0">{String(s.id)}</code>
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}

              {/* Suggestions from API */}
              {apiSuggestions.length > 0 && (
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Filter episodes…"
                      value={suggestionsSearch}
                      onChange={e => setSuggestionsSearch(e.target.value)}
                      className="flex-1 h-7 bg-gray-700 border border-gray-600 rounded px-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-gray-500 shrink-0">{apiSuggestions.length} episodes</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-gray-800">
                    {apiSuggestions
                      .filter(s => {
                        if (!suggestionsSearch.trim()) return true
                        const q = suggestionsSearch.toLowerCase()
                        return s.name?.toLowerCase().includes(q) || String(s.id).includes(q)
                      })
                      .map(s => (
                        <button
                          key={String(s.id)}
                          onClick={() => { setApiSetIdInput(String(s.id)); setApiSuggestions([]); setSuggestionsSearch('') }}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700 transition-colors text-left"
                        >
                          <div>
                            <span className="text-sm text-white">{s.name}</span>
                            {s.series && <span className="text-xs text-gray-500 ml-2">{s.series}</span>}
                          </div>
                          <code className="text-xs font-mono text-indigo-400 ml-4 shrink-0">{s.id}</code>
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Sync Prices button */}
            <button
              onClick={() => syncSet(selectedSetId)}
              disabled={syncState.status === 'syncing'}
              className="w-full px-5 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
            >
              {syncState.status === 'syncing' ? '⏳ Syncing…' : '🚀 Sync Prices'}
            </button>

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

        {/* History Backfill */}
        {selectedSetId && (
          <div className="mt-6 bg-gray-900 border border-gray-700 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-1">Backfill Price History</h3>
            <p className="text-xs text-gray-500 mb-4">
              Fetches real historical prices from the tcggo CardMarket API for each card in this set
              and writes them to <code className="font-mono text-gray-400">card_price_history</code> with
              the original dates. Run <strong>after</strong> a price sync (requires{' '}
              <code className="font-mono text-gray-400">tcggo_id</code> to be populated).
            </p>

            <div className="flex items-center gap-3 mb-4">
              <label className="text-xs text-gray-400 whitespace-nowrap">Days of history</label>
              <select
                value={backfillDays}
                onChange={e => setBackfillDays(Number(e.target.value))}
                className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-2 py-1"
              >
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>1 year</option>
              </select>
            </div>

            <button
              onClick={runHistoryBackfill}
              disabled={backfillStatus === 'running'}
              className="w-full px-5 py-2.5 text-sm font-semibold bg-teal-700 hover:bg-teal-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors mb-3"
            >
              {backfillStatus === 'running' ? '⏳ Backfilling…' : '📈 Backfill Price History'}
            </button>

            {backfillStatus !== 'idle' && (
              <div className={`rounded-lg p-3 text-sm border ${
                backfillStatus === 'error' ? 'bg-red-900/30 border-red-700 text-red-300' :
                backfillStatus === 'done'  ? 'bg-green-900/30 border-green-700 text-green-300' :
                'bg-teal-900/30 border-teal-700 text-teal-300'
              }`}>
                <div className="flex items-center gap-2">
                  {backfillStatus === 'running' && <span className="w-3 h-3 rounded-full bg-teal-400 animate-pulse shrink-0" />}
                  {backfillStatus === 'done'    && <span>✅</span>}
                  {backfillStatus === 'error'   && <span>❌</span>}
                  <span>{backfillMsg}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sync Single Card */}
        <div className="mt-6 bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-1">Sync Single Card</h3>
          <p className="text-xs text-gray-500 mb-4">
            Run the full pricing pipeline for a single card by its UUID. Fetches all sources,
            saves to <code className="font-mono text-gray-400">price_points</code>, and aggregates
            to <code className="font-mono text-gray-400">card_prices</code>.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Card UUID (e.g. 550e8400-e29b-41d4-a716-…)"
              value={singleCardId}
              onChange={e => { setSingleCardId(e.target.value); setSingleCardResult('') }}
              className="flex-1 h-9 bg-gray-800 border border-gray-700 rounded-lg px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              onClick={syncSingleCardAdmin}
              disabled={singleCardState === 'running' || !singleCardId.trim()}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors shrink-0"
            >
              {singleCardState === 'running' ? '⏳ Syncing…' : 'Sync Card'}
            </button>
          </div>
          {singleCardResult && (
            <div className={`mt-3 text-sm ${singleCardState === 'done' ? 'text-green-400' : 'text-red-400'}`}>
              {singleCardResult}
            </div>
          )}
        </div>

        {/* ── Bulk Seed All Sets ─────────────────────────────────────────── */}
        <div className="mt-8 bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>🚀</span> Bulk Seed All Sets
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Populates TCGPlayer + CardMarket prices for <strong>every set</strong> using the
              Pokémon TCG API. Runs 5 cards in parallel —
              typically <strong>5–15 seconds per set</strong>.
              eBay graded prices are added automatically by the nightly cron.
            </p>
          </div>

          {/* Options */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={bulkAutoLoop}
              onChange={e => setBulkAutoLoop(e.target.checked)}
              disabled={bulkStatus === 'running'}
              className="w-4 h-4 rounded accent-indigo-500"
            />
            <span className="text-gray-300">Auto-continue until all sets are done</span>
          </label>

          {/* Progress display */}
          {(bulkStatus !== 'idle' || bulkProgress.totalRuns > 0) && (
            <div className="bg-gray-800 rounded-lg p-3 space-y-1 text-xs font-mono">
              {bulkMsg && (
                <p className={
                  bulkStatus === 'error'   ? 'text-red-400' :
                  bulkStatus === 'done'    ? 'text-green-400' :
                  bulkStatus === 'running' ? 'text-indigo-300 animate-pulse' :
                  'text-gray-300'
                }>
                  {bulkMsg}
                </p>
              )}
              {bulkProgress.totalRuns > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-gray-400 pt-1">
                  <span>Sets done: <span className="text-white">{bulkProgress.setsProcessed}</span></span>
                  {bulkProgress.remaining >= 0 && (
                    <span>Remaining: <span className={bulkProgress.remaining === 0 ? 'text-green-400' : 'text-amber-400'}>
                      {bulkProgress.remaining}
                    </span></span>
                  )}
                  <span>Cards: <span className="text-white">{bulkProgress.cardsProcessed}</span></span>
                  {bulkProgress.errors > 0 && (
                    <span>Errors: <span className="text-red-400">{bulkProgress.errors}</span></span>
                  )}
                  <span>API calls: <span className="text-white">{bulkProgress.totalRuns}</span></span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {bulkStatus !== 'running' && (
              <>
                <button
                  onClick={() => runBulkSeed(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {bulkProgress.totalRuns === 0 ? '🚀 Seed All Sets' : '▶ Continue Seeding'}
                </button>
                <button
                  onClick={() => {
                    setBulkProgress({ setsProcessed: 0, remaining: -1, cardsProcessed: 0, errors: 0, totalRuns: 0 })
                    runBulkSeed(true)
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                  title="Force re-sync ALL sets even if recently priced"
                >
                  🔄 Force Reseed All
                </button>
              </>
            )}
            {bulkStatus === 'running' && (
              <button
                onClick={stopBulkSeed}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                ⏹ Stop
              </button>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-xs text-gray-600 text-center">
          Prices are cached — re-sync a set at any time. &nbsp;
          Graded price key names are logged to the server console on the first sync.
        </p>
      </div>
    </div>
  )
}
