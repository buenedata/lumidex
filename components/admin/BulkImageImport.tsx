'use client'

import { useState } from 'react'

// ── SSE event type definitions ────────────────────────────────────────────────

interface StartPayload {
  total: number
}

interface ProgressPayload {
  cardId: string
  number: string
  name: string
  status: 'success' | 'skipped' | 'failed' | 'no_match'
  imageUrl?: string
  error?: string
}

interface CompletePayload {
  succeeded: number
  failed: number
  skipped: number
  no_match?: number
}

interface ErrorPayload {
  message: string
}

type SSEEvent =
  | { type: 'start'; payload: StartPayload }
  | { type: 'progress'; payload: ProgressPayload }
  | { type: 'complete'; payload: CompletePayload }
  | { type: 'error'; payload: ErrorPayload }

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  setId: string
  onComplete?: () => void
}

export function BulkImageImport({ setId, onComplete }: Props) {
  const [sourceUrl, setSourceUrl] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [total, setTotal] = useState(0)
  const [results, setResults] = useState<ProgressPayload[]>([])
  const [summary, setSummary] = useState({ succeeded: 0, skipped: 0, failed: 0 })
  const [fatalError, setFatalError] = useState<string | null>(null)

  const handleStart = async () => {
    setIsRunning(true)
    setIsDone(false)
    setResults([])
    setSummary({ succeeded: 0, skipped: 0, failed: 0 })
    setTotal(0)
    setFatalError(null)

    const res = await fetch('/api/bulk-import-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceUrl, setId, overwrite }),
    })

    if (!res.ok || !res.body) {
      setFatalError('Request failed — check the URL and try again.')
      setIsRunning(false)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        let event: SSEEvent
        try {
          event = JSON.parse(line.slice(6)) as SSEEvent
        } catch {
          continue
        }
        if (event.type === 'start') {
          setTotal(event.payload.total)
        } else if (event.type === 'progress') {
          const p = event.payload
          setResults((prev) => [...prev, p])
          setSummary((prev) => ({
            succeeded: prev.succeeded + (p.status === 'success' ? 1 : 0),
            skipped:
              prev.skipped + (p.status === 'skipped' || p.status === 'no_match' ? 1 : 0),
            failed: prev.failed + (p.status === 'failed' ? 1 : 0),
          }))
        } else if (event.type === 'complete') {
          setSummary({
            succeeded: event.payload.succeeded,
            skipped: event.payload.skipped + (event.payload.no_match ?? 0),
            failed: event.payload.failed,
          })
        } else if (event.type === 'error') {
          setFatalError(event.payload.message)
        }
      }
    }

    setIsRunning(false)
    setIsDone(true)
    onComplete?.()
  }

  const handleClear = () => {
    setIsDone(false)
    setResults([])
    setSummary({ succeeded: 0, skipped: 0, failed: 0 })
    setTotal(0)
    setFatalError(null)
  }

  const processed = summary.succeeded + summary.skipped + summary.failed
  const progressPct = total > 0 ? Math.min((processed / total) * 100, 100) : 0

  return (
    <div className="text-sm text-white space-y-4">

      {/* ── Input area ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <label className="block text-gray-400 mb-1" htmlFor="source-url">
            Import source URL
          </label>
          <input
            id="source-url"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://www.pkmn.gg/series/…  or  https://app.dextcg.com/expansions/me1?…"
            disabled={isRunning}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 disabled:opacity-50"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            disabled={isRunning}
            className="accent-yellow-500 w-4 h-4 disabled:opacity-50"
          />
          <span className="text-gray-300">Overwrite existing images</span>
          {overwrite && (
            <span className="text-yellow-400 text-xs">
              ⚠️ Will replace manually uploaded images
            </span>
          )}
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStart}
            disabled={isRunning || sourceUrl.trim() === ''}
            className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRunning ? 'Importing…' : 'Start Import'}
          </button>
          {isDone && (
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
            >
              Import Again
            </button>
          )}
        </div>

        <p className="text-gray-500 text-xs">
          Accepts pkmn.gg set pages (<code className="text-gray-400">pkmn.gg/series/…</code>
          {' '}or <code className="text-gray-400">/collections/…</code>) and dext TCG expansion pages
          (<code className="text-gray-400">app.dextcg.com/expansions/{'{id}'}?…</code>).
          Images are fetched from the source, compressed to WebP, and stored in Cloudflare R2.
        </p>
      </div>

      {/* ── Fatal error ───────────────────────────────────────────────────── */}
      {fatalError && (
        <div className="flex items-start gap-2 p-3 bg-red-950 border border-red-800 rounded-lg text-red-300 text-xs">
          <span>❌</span>
          <span>{fatalError}</span>
        </div>
      )}

      {/* ── Progress area ─────────────────────────────────────────────────── */}
      {(isRunning || isDone) && (
        <div className="space-y-3">

          {/* Summary line */}
          <p className="text-gray-300">
            <span className="text-green-400 font-medium">{summary.succeeded} uploaded</span>
            {' · '}
            <span className="text-gray-400">{summary.skipped} skipped</span>
            {' · '}
            <span className={summary.failed > 0 ? 'text-red-400 font-medium' : 'text-gray-400'}>
              {summary.failed} failed
            </span>
            {total > 0 && (
              <span className="text-gray-500"> / {total} total</span>
            )}
          </p>

          {/* Progress bar */}
          <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isDone ? 'bg-green-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Completion message */}
          {isDone && (
            <p className={summary.failed > 0 ? 'text-red-400' : 'text-green-400'}>
              {summary.failed > 0
                ? `❌ Import complete with ${summary.failed} failure${summary.failed !== 1 ? 's' : ''}.`
                : '✅ All images imported successfully.'}
            </p>
          )}

          {/* Per-card results list */}
          {results.length > 0 && (
            <ul className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-gray-800 bg-gray-950 p-2">
              {results.map((r, i) => (
                <li key={`${r.cardId}-${i}`} className="flex items-start gap-1.5 text-xs">
                  {r.status === 'success' && (
                    <>
                      <span className="shrink-0">✅</span>
                      <span className="text-gray-200">
                        {r.name} <span className="text-gray-500">#{r.number}</span>
                      </span>
                    </>
                  )}
                  {r.status === 'skipped' && (
                    <>
                      <span className="shrink-0">⏭️</span>
                      <span className="text-gray-400">
                        {r.name} <span className="text-gray-500">#{r.number}</span>
                        <span className="text-gray-500"> — skipped</span>
                      </span>
                    </>
                  )}
                  {r.status === 'no_match' && (
                    <>
                      <span className="shrink-0">⏭️</span>
                      <span className="text-gray-400">
                        {r.name} <span className="text-gray-500">#{r.number}</span>
                        <span className="text-gray-500"> — skipped (no match)</span>
                      </span>
                    </>
                  )}
                  {r.status === 'failed' && (
                    <>
                      <span className="shrink-0">❌</span>
                      <span className="text-red-400">
                        {r.name} <span className="text-gray-500">#{r.number}</span>
                        {r.error && (
                          <span className="text-red-500"> — {r.error}</span>
                        )}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
