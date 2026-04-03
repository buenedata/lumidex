'use client'

import { useState } from 'react'

// ── SSE event types ───────────────────────────────────────────────────────────

type Bucket = 'card-images' | 'product-images' | 'set-images' | 'set-symbols'

interface ProgressPayload {
  filename: string
  status: 'success' | 'skipped' | 'failed'
  reason?: string
  originalBytes?: number
  compressedBytes?: number
  savedBytes?: number
  error?: string
}

interface CompletePayload {
  succeeded: number
  skipped: number
  failed: number
  savedBytes: number
}

type SSEEvent =
  | { type: 'start';    payload: { total: number } }
  | { type: 'progress'; payload: ProgressPayload }
  | { type: 'complete'; payload: CompletePayload }
  | { type: 'error';    payload: { message: string } }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const BUCKET_LABELS: Record<Bucket, string> = {
  'card-images':    'Card Images',
  'product-images': 'Product Images',
  'set-images':     'Set Images',
  'set-symbols':    'Set Symbols',
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Pre-select a bucket (e.g. from the surrounding page context). */
  defaultBucket?: Bucket
}

export function RecompressImages({ defaultBucket = 'card-images' }: Props) {
  const [bucket, setBucket]         = useState<Bucket>(defaultBucket)
  const [isRunning, setIsRunning]   = useState(false)
  const [isDone, setIsDone]         = useState(false)
  const [total, setTotal]           = useState(0)
  const [results, setResults]       = useState<ProgressPayload[]>([])
  const [summary, setSummary]       = useState<CompletePayload | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  const processed = results.length

  const handleStart = async () => {
    setIsRunning(true)
    setIsDone(false)
    setResults([])
    setSummary(null)
    setTotal(0)
    setFatalError(null)

    const res = await fetch('/api/admin/recompress-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket }),
    })

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => 'Unknown error')
      setFatalError(`Request failed (${res.status}): ${text}`)
      setIsRunning(false)
      return
    }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer    = ''

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
          setResults((prev) => [...prev, event.payload as ProgressPayload])
        } else if (event.type === 'complete') {
          setSummary(event.payload)
        } else if (event.type === 'error') {
          setFatalError(event.payload.message)
        }
      }
    }

    setIsRunning(false)
    setIsDone(true)
  }

  const handleReset = () => {
    setIsRunning(false)
    setIsDone(false)
    setResults([])
    setSummary(null)
    setTotal(0)
    setFatalError(null)
  }

  // ── Derived display values ─────────────────────────────────────────────────

  const succeeded = results.filter((r) => r.status === 'success').length
  const skipped   = results.filter((r) => r.status === 'skipped').length
  const failed    = results.filter((r) => r.status === 'failed').length
  const totalSavedBytes = results
    .filter((r) => r.status === 'success')
    .reduce((acc, r) => acc + (r.savedBytes ?? 0), 0)

  const progressPct = total > 0 ? Math.round((processed / total) * 100) : 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Bucket selector + run button */}
      {!isRunning && !isDone && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Storage bucket to recompress
            </label>
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value as Bucket)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
            >
              {(Object.entries(BUCKET_LABELS) as [Bucket, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleStart}
            className="mt-auto px-5 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg text-sm transition-colors whitespace-nowrap"
          >
            ▶ Run Recompressor
          </button>
        </div>
      )}

      {/* What this does — shown before start */}
      {!isRunning && !isDone && (
        <p className="text-gray-400 text-xs leading-relaxed">
          Downloads every image in the selected bucket, compresses it to{' '}
          <strong className="text-white">WebP at 82 % quality / 500 px max width</strong>,
          and re-uploads it in-place. Files that are already smaller after compression are
          skipped. Expected saving:{' '}
          <strong className="text-yellow-400">85–90 % per image</strong> vs raw PNG.
        </p>
      )}

      {/* Fatal error */}
      {fatalError && (
        <div className="p-3 bg-red-950 border border-red-700 rounded-lg text-red-300 text-sm">
          ⚠️ {fatalError}
        </div>
      )}

      {/* Progress bar */}
      {(isRunning || isDone) && total > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{isRunning ? 'Processing…' : 'Done'}</span>
            <span>{processed} / {total} ({progressPct} %)</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                backgroundColor: isDone ? '#22c55e' : '#eab308',
              }}
            />
          </div>
        </div>
      )}

      {/* Live counters */}
      {(isRunning || isDone) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
          <Stat label="Compressed" value={succeeded} colour="text-green-400" />
          <Stat label="Skipped"    value={skipped}   colour="text-gray-400" />
          <Stat label="Failed"     value={failed}     colour="text-red-400" />
          <Stat
            label="Saved"
            value={formatBytes(summary?.savedBytes ?? totalSavedBytes)}
            colour="text-yellow-400"
          />
        </div>
      )}

      {/* Done summary */}
      {isDone && summary && (
        <div className="p-4 bg-gray-900 border border-green-800 rounded-xl text-sm space-y-1">
          <p className="font-semibold text-green-400">✅ Recompression complete</p>
          <p className="text-gray-300">
            {summary.succeeded} file{summary.succeeded !== 1 ? 's' : ''} recompressed,
            saving <span className="text-yellow-400 font-medium">{formatBytes(summary.savedBytes)}</span> of storage.
          </p>
          {summary.skipped > 0 && (
            <p className="text-gray-400">{summary.skipped} file{summary.skipped !== 1 ? 's' : ''} skipped (already optimal).</p>
          )}
          {summary.failed > 0 && (
            <p className="text-red-400">{summary.failed} file{summary.failed !== 1 ? 's' : ''} failed — see log below.</p>
          )}
          <button
            onClick={handleReset}
            className="mt-2 text-xs text-gray-400 underline hover:text-white transition-colors"
          >
            Run again on a different bucket
          </button>
        </div>
      )}

      {/* Scrollable log */}
      {results.length > 0 && (
        <div className="max-h-72 overflow-y-auto bg-gray-950 border border-gray-800 rounded-lg p-3 space-y-0.5 font-mono text-xs">
          {results.map((r, i) => (
            <LogLine key={i} result={r} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value, colour }: { label: string; value: string | number; colour: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg py-2 px-3">
      <div className={`font-bold text-base ${colour}`}>{value}</div>
      <div className="text-gray-500 text-xs">{label}</div>
    </div>
  )
}

function LogLine({ result }: { result: ProgressPayload }) {
  if (result.status === 'success') {
    return (
      <div className="text-green-400">
        ✓ {result.filename}
        {result.savedBytes !== undefined && (
          <span className="text-gray-500 ml-2">
            {formatBytes(result.originalBytes ?? 0)} → {formatBytes(result.compressedBytes ?? 0)}
            {' '}(-{formatBytes(result.savedBytes)})
          </span>
        )}
      </div>
    )
  }
  if (result.status === 'skipped') {
    return (
      <div className="text-gray-500">
        – {result.filename}
        <span className="ml-2 italic">{result.reason}</span>
      </div>
    )
  }
  return (
    <div className="text-red-400">
      ✗ {result.filename}
      {result.error && <span className="ml-2 text-red-300">{result.error}</span>}
    </div>
  )
}
