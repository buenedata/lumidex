'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/admin/PriceSyncTool.tsx
//
// Admin UI for bulk-syncing TCGGO card prices.  Three independent sections:
//   1. Sync Single Set   — picks one set, optionally includes graded prices
//   2. Sync All Sets     — iterates every set with a TCGGO episode ID
//   3. Sync Products     — syncs sealed product prices
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { SetSelector } from './SetSelector'

// ── Shared types ──────────────────────────────────────────────────────────────

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error'

// ── Shared sub-components ─────────────────────────────────────────────────────

function Stat({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg py-2 px-3 text-center">
      <div className={`font-bold text-base ${colour}`}>{value.toLocaleString()}</div>
      <div className="text-gray-500 text-xs">{label}</div>
    </div>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-5 bg-gray-900/60 border border-gray-700/60 rounded-xl space-y-4">
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-white tracking-wide uppercase opacity-70">
      {children}
    </h3>
  )
}

function SyncButton({
  onClick,
  disabled,
  loading,
  label,
  loadingLabel,
}: {
  onClick: () => void
  disabled: boolean
  loading: boolean
  label: string
  loadingLabel?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-lg text-sm transition-colors whitespace-nowrap"
    >
      {loading ? (loadingLabel ?? '⏳ Syncing…') : label}
    </button>
  )
}

function Spinner() {
  return (
    <span className="animate-spin inline-block w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
  )
}

function ErrorBanner({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="p-3 bg-red-950 border border-red-700 rounded-lg text-red-300 text-sm">
      ⚠️ {message}
      <button
        onClick={onReset}
        className="ml-4 text-xs text-gray-400 underline hover:text-white transition-colors"
      >
        Try again
      </button>
    </div>
  )
}

// ── Section 1: Sync Single Set ────────────────────────────────────────────────

interface SingleSetResult {
  singles: { total: number; synced: number; skipped: number; failed: number }
  graded:  { rows: number; synced: number; failed: number }
}

function SyncSingleSetSection() {
  const [selectedSetId,   setSelectedSetId]   = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null)
  const [includeGraded,   setIncludeGraded]   = useState(true)
  const [episodeIdOverride, setEpisodeIdOverride] = useState('')
  const [status,          setStatus]          = useState<SyncStatus>('idle')
  const [result,          setResult]          = useState<SingleSetResult | null>(null)
  const [errorMsg,        setErrorMsg]        = useState<string | null>(null)

  const reset = () => { setStatus('idle'); setResult(null); setErrorMsg(null) }

  const handleSetSelect = (id: string, name: string) => {
    setSelectedSetId(id)
    setSelectedSetName(name)
    reset()
  }

  const handleSync = async () => {
    if (!selectedSetId || status === 'syncing') return
    setStatus('syncing')
    setResult(null)
    setErrorMsg(null)

    try {
      const body: Record<string, unknown> = { setId: selectedSetId, includeGraded }
      if (episodeIdOverride.trim()) body.episodeId = episodeIdOverride.trim()

      const res = await fetch('/api/admin/prices/sync-set', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data?.error ?? `Request failed (${res.status})`)
        setStatus('error')
        return
      }
      setResult(data as SingleSetResult)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  const isSyncing = status === 'syncing'

  return (
    <SectionCard>
      <SectionTitle>1 · Sync Single Set</SectionTitle>

      {/* Set selector */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">
          Select a set to sync prices for
        </label>
        <SetSelector onSetSelect={handleSetSelect} selectedSetId={selectedSetId} />
      </div>

      {/* TCGGO Episode ID override */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          TCGGO Episode ID{' '}
          <span className="text-gray-600 font-normal">(optional — required only if this set has no episode ID stored yet)</span>
        </label>
        <input
          type="text"
          value={episodeIdOverride}
          onChange={(e) => setEpisodeIdOverride(e.target.value)}
          placeholder="e.g. 1, 42, 587"
          className="w-full max-w-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
        />
        <p className="mt-1 text-gray-600 text-xs">
          If filled in, this ID is saved to the set&apos;s record so future syncs work automatically.
        </p>
      </div>

      {/* Include graded checkbox */}
      <label className="flex items-center gap-2 text-sm text-gray-300 select-none cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={includeGraded}
          onChange={(e) => setIncludeGraded(e.target.checked)}
          className="w-4 h-4 accent-yellow-500 cursor-pointer"
        />
        Include graded card prices (PSA / BGS / CGC)
      </label>

      {/* Description */}
      {status === 'idle' && (
        <p className="text-gray-400 text-xs leading-relaxed">
          Fetches all cards for the selected set from the{' '}
          <strong className="text-white">TCGGO episode endpoint</strong> and upserts each card&apos;s
          Cardmarket <strong className="text-white">Lowest Near Mint</strong> price into{' '}
          <code className="text-yellow-400">item_prices</code>.
          {includeGraded && ' Graded prices (PSA/BGS/CGC) are extracted when available.'}
        </p>
      )}

      {/* Action row */}
      {status !== 'done' && (
        <SyncButton
          onClick={handleSync}
          disabled={!selectedSetId || isSyncing}
          loading={isSyncing}
          label="▶ Sync Set"
        />
      )}

      {isSyncing && (
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Spinner />
          Fetching prices from TCGGO and writing to database…
        </div>
      )}

      {status === 'error' && errorMsg && (
        <ErrorBanner message={errorMsg} onReset={reset} />
      )}

      {status === 'done' && result && (
        <div className="p-4 bg-gray-900 border border-green-800 rounded-xl text-sm space-y-3">
          <p className="font-semibold text-green-400">
            ✅ Price sync complete{selectedSetName ? ` — ${selectedSetName}` : ''}
          </p>

          {/* Singles summary */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Singles</p>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Synced"  value={result.singles.synced}  colour="text-green-400" />
              <Stat label="Skipped" value={result.singles.skipped} colour="text-gray-400"  />
              <Stat label="Failed"  value={result.singles.failed}  colour="text-red-400"   />
            </div>
          </div>

          {/* Graded summary */}
          {includeGraded && (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Graded</p>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Rows"   value={result.graded.rows}   colour="text-blue-400"  />
                <Stat label="Synced" value={result.graded.synced} colour="text-green-400" />
                <Stat label="Failed" value={result.graded.failed} colour="text-red-400"   />
              </div>
            </div>
          )}

          <button
            onClick={reset}
            className="text-xs text-gray-400 underline hover:text-white transition-colors"
          >
            Sync another set
          </button>
        </div>
      )}
    </SectionCard>
  )
}

// ── Section 2: Sync All Sets ──────────────────────────────────────────────────

interface AllSetsResult {
  sets_synced:       number
  sets_skipped:      number
  total_singles:     number
  total_graded_rows: number
}

function SyncAllSetsSection() {
  const [status,   setStatus]   = useState<SyncStatus>('idle')
  const [result,   setResult]   = useState<AllSetsResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const reset = () => { setStatus('idle'); setResult(null); setErrorMsg(null) }

  const handleSync = async () => {
    if (status === 'syncing') return
    setStatus('syncing')
    setResult(null)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/admin/prices/sync-all-sets', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data?.error ?? `Request failed (${res.status})`)
        setStatus('error')
        return
      }
      setResult(data as AllSetsResult)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  const isSyncing = status === 'syncing'

  return (
    <SectionCard>
      <SectionTitle>2 · Sync All Sets</SectionTitle>

      <p className="text-gray-400 text-xs leading-relaxed">
        Fetches prices for <strong className="text-white">every set</strong> with a TCGGO episode ID.
        Sets are processed sequentially with a 200 ms delay to respect rate limits.{' '}
        <span className="text-yellow-500">May take several minutes.</span>
      </p>

      {status !== 'done' && (
        <SyncButton
          onClick={handleSync}
          disabled={isSyncing}
          loading={isSyncing}
          label="▶ Sync All Sets"
          loadingLabel="⏳ Syncing sets… (this may take a while)"
        />
      )}

      {isSyncing && (
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Spinner />
          Syncing all sets one by one — please keep this tab open…
        </div>
      )}

      {status === 'error' && errorMsg && (
        <ErrorBanner message={errorMsg} onReset={reset} />
      )}

      {status === 'done' && result && (
        <div className="p-4 bg-gray-900 border border-green-800 rounded-xl text-sm space-y-3">
          <p className="font-semibold text-green-400">✅ All sets sync complete</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Sets Synced"  value={result.sets_synced}       colour="text-green-400" />
            <Stat label="Sets Skipped" value={result.sets_skipped}      colour="text-gray-400"  />
            <Stat label="Singles"      value={result.total_singles}     colour="text-blue-400"  />
            <Stat label="Graded Rows"  value={result.total_graded_rows} colour="text-purple-400"/>
          </div>
          <button
            onClick={reset}
            className="text-xs text-gray-400 underline hover:text-white transition-colors"
          >
            Run again
          </button>
        </div>
      )}
    </SectionCard>
  )
}

// ── Section 3: Sync Products ──────────────────────────────────────────────────

interface ProductsResult {
  total:          number
  synced:         number
  skipped:        number
  failed:         number
  catalogCreated: number
}

function SyncProductsSection() {
  const [selectedSetId,   setSelectedSetId]   = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null)
  const [status,          setStatus]          = useState<SyncStatus>('idle')
  const [result,          setResult]          = useState<ProductsResult | null>(null)
  const [errorMsg,        setErrorMsg]        = useState<string | null>(null)

  const reset = () => { setStatus('idle'); setResult(null); setErrorMsg(null) }

  const handleSetSelect = (id: string, name: string) => {
    setSelectedSetId(id)
    setSelectedSetName(name)
    reset()
  }

  const handleSync = async () => {
    if (!selectedSetId || status === 'syncing') return
    setStatus('syncing')
    setResult(null)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/admin/prices/sync-products', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ setId: selectedSetId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data?.error ?? `Request failed (${res.status})`)
        setStatus('error')
        return
      }
      setResult(data as ProductsResult)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  const isSyncing = status === 'syncing'

  return (
    <SectionCard>
      <SectionTitle>3 · Sync Products</SectionTitle>

      {/* Set selector */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">
          Select a set to sync sealed product prices for
        </label>
        <SetSelector onSetSelect={handleSetSelect} selectedSetId={selectedSetId} />
      </div>

      <p className="text-gray-400 text-xs leading-relaxed">
        Fetches <strong className="text-white">all sealed products</strong> for the selected set from
        the <strong className="text-white">TCGGO episode endpoint</strong>, upserts each
        product&apos;s Cardmarket <strong className="text-white">lowest</strong> price into{' '}
        <code className="text-yellow-400">item_prices</code>, and{' '}
        <strong className="text-white">creates new catalog entries</strong> in{' '}
        <code className="text-yellow-400">set_products</code> for any products not yet in the database.
      </p>

      {status !== 'done' && (
        <SyncButton
          onClick={handleSync}
          disabled={!selectedSetId || isSyncing}
          loading={isSyncing}
          label="▶ Sync Products"
        />
      )}

      {isSyncing && (
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Spinner />
          Fetching product prices from TCGGO and writing to database…
        </div>
      )}

      {status === 'error' && errorMsg && (
        <ErrorBanner message={errorMsg} onReset={reset} />
      )}

      {status === 'done' && result && (
        <div className="p-4 bg-gray-900 border border-green-800 rounded-xl text-sm space-y-3">
          <p className="font-semibold text-green-400">
            ✅ Product sync complete{selectedSetName ? ` — ${selectedSetName}` : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Synced"           value={result.synced}         colour="text-green-400"  />
            <Stat label="Skipped"          value={result.skipped}        colour="text-gray-400"   />
            <Stat label="Failed"           value={result.failed}         colour="text-red-400"    />
            <Stat label="Catalog Created"  value={result.catalogCreated ?? 0} colour="text-blue-400" />
          </div>
          <p className="text-gray-400 text-xs">
            {result.total.toLocaleString()} product{result.total !== 1 ? 's' : ''} processed in total.
          </p>
          <button
            onClick={reset}
            className="text-xs text-gray-400 underline hover:text-white transition-colors"
          >
            Run again
          </button>
        </div>
      )}
    </SectionCard>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function PriceSyncTool() {
  return (
    <div className="space-y-6">
      <SyncSingleSetSection />
      <SyncAllSetsSection />
      <SyncProductsSection />
    </div>
  )
}
