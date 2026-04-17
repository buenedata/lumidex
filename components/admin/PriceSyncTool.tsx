'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/admin/PriceSyncTool.tsx
//
// Admin UI for bulk-syncing TCGGO card prices for a single set.
// Calls POST /api/admin/prices/sync-set with the selected set's Supabase UUID.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { SetSelector } from './SetSelector'

// ── Types ─────────────────────────────────────────────────────────────────────

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error'

interface SyncResult {
  total:   number
  synced:  number
  skipped: number
  failed:  number
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Stat({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg py-2 px-3 text-center">
      <div className={`font-bold text-base ${colour}`}>{value}</div>
      <div className="text-gray-500 text-xs">{label}</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PriceSyncTool() {
  const [selectedSetId,   setSelectedSetId]   = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null)
  const [status,          setStatus]          = useState<SyncStatus>('idle')
  const [result,          setResult]          = useState<SyncResult | null>(null)
  const [errorMsg,        setErrorMsg]        = useState<string | null>(null)

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSetSelect = (setId: string, setName: string) => {
    setSelectedSetId(setId)
    setSelectedSetName(setName)
    // Reset previous run state when a different set is chosen
    setStatus('idle')
    setResult(null)
    setErrorMsg(null)
  }

  const handleSync = async () => {
    if (!selectedSetId || status === 'syncing') return

    setStatus('syncing')
    setResult(null)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/admin/prices/sync-set', {
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

      setResult(data as SyncResult)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  const handleReset = () => {
    setStatus('idle')
    setResult(null)
    setErrorMsg(null)
  }

  const isSyncing = status === 'syncing'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Set selector */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">
          Select a Pokémon set to sync prices for
        </label>
        <SetSelector
          onSetSelect={handleSetSelect}
          selectedSetId={selectedSetId}
        />
      </div>

      {/* Description */}
      {status === 'idle' && (
        <p className="text-gray-400 text-xs leading-relaxed">
          Fetches all cards for the selected set from the{' '}
          <strong className="text-white">TCGGO bulk episode endpoint</strong>, then upserts
          each card&apos;s Cardmarket{' '}
          <strong className="text-white">Lowest Near Mint</strong> price into{' '}
          <code className="text-yellow-400">item_prices</code>. Cards with no price are
          skipped but still recorded.
        </p>
      )}

      {/* Sync button — hidden while showing final done state */}
      {status !== 'done' && (
        <button
          onClick={handleSync}
          disabled={!selectedSetId || isSyncing}
          className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-lg text-sm transition-colors whitespace-nowrap"
        >
          {isSyncing ? '⏳ Syncing…' : '▶ Sync Prices'}
        </button>
      )}

      {/* Loading state */}
      {isSyncing && (
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
          Fetching prices from TCGGO and writing to database…
        </div>
      )}

      {/* Error state */}
      {status === 'error' && errorMsg && (
        <div className="p-3 bg-red-950 border border-red-700 rounded-lg text-red-300 text-sm">
          ⚠️ {errorMsg}
          <button
            onClick={handleReset}
            className="ml-4 text-xs text-gray-400 underline hover:text-white transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Success summary */}
      {status === 'done' && result && (
        <div className="p-4 bg-gray-900 border border-green-800 rounded-xl text-sm space-y-3">
          <p className="font-semibold text-green-400">
            ✅ Price sync complete{selectedSetName ? ` — ${selectedSetName}` : ''}
          </p>
          <p className="text-gray-300">
            Synced{' '}
            <span className="text-white font-medium">{result.synced}</span>
            {' '}/ {result.total} cards
            {result.skipped > 0 && (
              <span className="text-gray-400"> ({result.skipped} skipped — no price data)</span>
            )}
          </p>
          {result.failed > 0 && (
            <p className="text-red-400">
              {result.failed} card{result.failed !== 1 ? 's' : ''} failed to upsert.
            </p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Synced"  value={result.synced}  colour="text-green-400" />
            <Stat label="Skipped" value={result.skipped} colour="text-gray-400"  />
            <Stat label="Failed"  value={result.failed}  colour="text-red-400"   />
          </div>

          <button
            onClick={handleReset}
            className="text-xs text-gray-400 underline hover:text-white transition-colors"
          >
            Sync another set
          </button>
        </div>
      )}
    </div>
  )
}
