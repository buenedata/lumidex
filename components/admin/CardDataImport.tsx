'use client'

import { useState } from 'react'

// ── SSE event type definitions ────────────────────────────────────────────────

interface TcgDebug {
  firstId: string | null
  tcgSetId: string | null
  mapSize: number
}

interface StartPayload {
  total: number
  tcgDebug?: TcgDebug
}

export interface ProgressPayload {
  cardId: string
  /** Card number from the DB */
  number: string
  /** Card name currently stored in the DB (may be updated after a successful import) */
  name: string
  /** Card name sourced from pkmn.gg */
  pkmnName: string | null
  artist: string | null
  supertype: string | null
  /** Element type, e.g. "Grass" or "Fire/Water" */
  type: string | null
  status: 'success' | 'skipped' | 'no_match' | 'failed' | 'created'
  error?: string
  /** True when an image was successfully downloaded and stored during this import */
  imageSaved?: boolean
}

interface CompletePayload {
  succeeded: number
  skipped: number
  failed: number
  no_match: number
  created: number
}

interface ErrorPayload {
  message: string
}

type SSEEvent =
  | { type: 'start'; payload: StartPayload }
  | { type: 'progress'; payload: ProgressPayload }
  | { type: 'complete'; payload: CompletePayload }
  | { type: 'error'; payload: ErrorPayload }

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ProgressPayload['status'], string> = {
  success: 'bg-green-500/20 text-green-400 border border-green-500/30',
  skipped: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  no_match: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
  created: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
}

const STATUS_LABEL: Record<ProgressPayload['status'], string> = {
  success: 'saved',
  skipped: 'skipped',
  no_match: 'no match',
  failed: 'failed',
  created: 'created',
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  setId: string
  onComplete?: () => void
}

export function CardDataImport({ setId, onComplete }: Props) {
  const [pkmnGgUrl, setPkmnGgUrl] = useState('')
  const [language, setLanguage] = useState<'en' | 'ja'>('en')
  const [overwrite, setOverwrite] = useState(false)
  const [importImages, setImportImages] = useState(false)
  const [lookupTypes, setLookupTypes] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [total, setTotal] = useState(0)
  const [tcgDebug, setTcgDebug] = useState<TcgDebug | null>(null)
  const [results, setResults] = useState<ProgressPayload[]>([])
  const [summary, setSummary] = useState({ succeeded: 0, skipped: 0, failed: 0, no_match: 0, created: 0 })
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState<{
    total: number
    availableKeys: string[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sample: any[]
  } | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const handleStart = async () => {
    if (!pkmnGgUrl.trim()) return
    setIsRunning(true)
    setIsDone(false)
    setResults([])
    setSummary({ succeeded: 0, skipped: 0, failed: 0, no_match: 0, created: 0 })
    setTotal(0)
    setTcgDebug(null)
    setFatalError(null)

    const res = await fetch('/api/import-card-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pkmnGgUrl: pkmnGgUrl.trim(), setId, overwrite, importImages, lookupTypes, language }),
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
          if (event.payload.tcgDebug) setTcgDebug(event.payload.tcgDebug)
        } else if (event.type === 'progress') {
          const p = event.payload
          setResults((prev) => [...prev, p])
          setSummary((prev) => ({
            succeeded: prev.succeeded + (p.status === 'success' ? 1 : 0),
            skipped: prev.skipped + (p.status === 'skipped' ? 1 : 0),
            failed: prev.failed + (p.status === 'failed' ? 1 : 0),
            no_match: prev.no_match + (p.status === 'no_match' ? 1 : 0),
            created: prev.created + (p.status === 'created' ? 1 : 0),
          }))
        } else if (event.type === 'complete') {
          setSummary({
            succeeded: event.payload.succeeded,
            skipped: event.payload.skipped,
            failed: event.payload.failed,
            no_match: event.payload.no_match,
            created: event.payload.created,
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

  const handlePreview = async () => {
    if (!pkmnGgUrl.trim()) return
    setIsPreviewing(true)
    setPreviewData(null)
    setPreviewError(null)
    try {
      const res = await fetch(
        `/api/import-card-data?pkmnGgUrl=${encodeURIComponent(pkmnGgUrl.trim())}`,
      )
      const json = await res.json()
      if (!res.ok) {
        setPreviewError(json.error ?? 'Preview failed')
      } else {
        setPreviewData(json)
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleClear = () => {
    setIsDone(false)
    setResults([])
    setSummary({ succeeded: 0, skipped: 0, failed: 0, no_match: 0, created: 0 })
    setTotal(0)
    setTcgDebug(null)
    setFatalError(null)
    setPreviewData(null)
    setPreviewError(null)
  }

  const processed = summary.succeeded + summary.skipped + summary.failed + summary.no_match + summary.created
  const progressPct = total > 0 ? Math.min((processed / total) * 100, 100) : 0

  // Show the "Import card images" checkbox only when a pkmn.gg URL is present
  // and preview data has been loaded (so we know the page is valid)
  const showImageCheckbox = pkmnGgUrl.trim().length > 0 && previewData !== null

  return (
    <div className="text-sm text-white space-y-4">

      {/* ── Input area ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <label className="block text-gray-400 mb-1" htmlFor="pkmn-gg-url">
            pkmn.gg set URL
          </label>
          <input
            id="pkmn-gg-url"
            type="url"
            value={pkmnGgUrl}
            onChange={(e) => setPkmnGgUrl(e.target.value)}
            placeholder="https://www.pkmn.gg/series/scarlet-violet/151"
            disabled={isRunning}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 disabled:opacity-50"
          />
        </div>

        {/* Language selector */}
        <div>
          <label className="block text-gray-400 mb-2 text-sm">Set Language</label>
          <div className="flex gap-5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="set-language"
                value="en"
                checked={language === 'en'}
                onChange={() => setLanguage('en')}
                disabled={isRunning}
                className="accent-yellow-500 disabled:opacity-50"
              />
              <span className="text-gray-300">🇬🇧 English</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="set-language"
                value="ja"
                checked={language === 'ja'}
                onChange={() => setLanguage('ja')}
                disabled={isRunning}
                className="accent-yellow-500 disabled:opacity-50"
              />
              <span className="text-gray-300">🇯🇵 Japanese</span>
            </label>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            disabled={isRunning}
            className="w-4 h-4 accent-yellow-500 disabled:opacity-50"
          />
          <span className="text-gray-300">
            Overwrite cards that already have all fields populated
          </span>
        </label>

        {showImageCheckbox && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={importImages}
              onChange={(e) => setImportImages(e.target.checked)}
              disabled={isRunning}
              className="w-4 h-4 accent-yellow-500 disabled:opacity-50"
            />
            <span className="text-gray-300">Import card images</span>
            <span className="text-gray-500 text-xs">— Slower: downloads and stores card images</span>
          </label>
        )}

        {showImageCheckbox && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lookupTypes}
              onChange={(e) => setLookupTypes(e.target.checked)}
              disabled={isRunning}
              className="w-4 h-4 accent-yellow-500 disabled:opacity-50"
            />
            <span className="text-gray-300">Look up missing element types from pokemontcg.io</span>
            <span className="text-gray-500 text-xs">— Slower: one API call per card without a type</span>
          </label>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleStart}
            disabled={isRunning || isPreviewing || !pkmnGgUrl.trim()}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? 'Importing…' : 'Start Import'}
          </button>
          <button
            onClick={handlePreview}
            disabled={isRunning || isPreviewing || !pkmnGgUrl.trim()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Fetch pkmn.gg and show which fields are available before importing"
          >
            {isPreviewing ? 'Loading…' : '🔍 Preview Fields'}
          </button>
          {(isDone || results.length > 0 || previewData) && (
            <button
              onClick={handleClear}
              disabled={isRunning || isPreviewing}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Fatal error ───────────────────────────────────────────────────── */}
      {/* ── Preview result ───────────────────────────────────────────────── */}
      {previewError && (
        <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 text-red-300">
          ⚠️ Preview error: {previewError}
        </div>
      )}
      {previewData && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
            pkmn.gg field preview — {previewData.total} cards found
          </p>
          <div className="flex flex-wrap gap-2">
            {previewData.availableKeys.map((k) => (
              <span
                key={k}
                className={`text-xs px-2 py-0.5 rounded-full border font-mono ${
                  ['name', 'number', 'artist', 'hp', 'supertype', 'subtypes', 'types', 'type'].includes(k)
                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                    : ['largeImageUrl', 'thumbImageUrl', 'largeImagePath', 'thumbImagePath'].includes(k)
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    : 'bg-gray-700 text-gray-400 border-gray-600'
                }`}
              >
                {k}
              </span>
            ))}
          </div>
          <details className="text-xs">
            <summary className="text-gray-500 cursor-pointer hover:text-gray-300">
              Show first card raw data
            </summary>
            <pre className="mt-2 bg-black/40 rounded p-3 overflow-x-auto text-gray-300 text-xs leading-relaxed">
              {JSON.stringify(previewData.sample[0], null, 2)}
            </pre>
          </details>
        </div>
      )}

      {fatalError && (
        <div className="bg-red-900/30 border border-red-500/40 rounded-lg px-4 py-3 text-red-300">
          ⚠️ {fatalError}
        </div>
      )}

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      {(isRunning || isDone) && total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-gray-400 text-xs">
            <span>
              {processed} / {total} cards
            </span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-yellow-500 h-2 rounded-full transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── TCG type lookup debug notice ──────────────────────────────────── */}
      {tcgDebug && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${
          tcgDebug.mapSize > 0
            ? 'bg-blue-900/20 border-blue-500/30 text-blue-300'
            : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-300'
        }`}>
          {tcgDebug.mapSize > 0 ? (
            <>🔍 TCG type lookup: set <code className="font-mono">{tcgDebug.tcgSetId}</code> — {tcgDebug.mapSize} card type{tcgDebug.mapSize !== 1 ? 's' : ''} fetched</>
          ) : tcgDebug.firstId ? (
            <>⚠️ TCG type lookup: fetched set <code className="font-mono">{tcgDebug.tcgSetId}</code> but got 0 types — check the set ID</>
          ) : (
            <>⚠️ TCG type lookup: no card with a pokemontcg.io-format ID found (card.id missing or no hyphen)</>
          )}
        </div>
      )}

      {/* ── Summary pills ─────────────────────────────────────────────────── */}
      {(isRunning || isDone) && (
        <div className="flex flex-wrap gap-3 text-xs font-medium">
          <span className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">
            + {summary.created} created
          </span>
          <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            ✓ {summary.succeeded} saved
          </span>
          <span className="px-3 py-1 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
            ↷ {summary.skipped} skipped
          </span>
          <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            ? {summary.no_match} no match
          </span>
          <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            ✗ {summary.failed} failed
          </span>
        </div>
      )}

      {/* ── Results log ───────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-800/60 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
              Results
            </span>
            <span className="text-gray-500 text-xs">{results.length} cards processed</span>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-800">
            {results.map((r, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-3 hover:bg-gray-800/40">
                {/* Status badge */}
                <span
                  className={`mt-0.5 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.status]}`}
                >
                  {STATUS_LABEL[r.status]}
                </span>

                {/* Card identity */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-gray-400 text-xs tabular-nums">#{r.number}</span>
                    <span className="text-white truncate font-medium">{r.name || '—'}</span>
                    {/* Show pkmn.gg name when it differs from the DB name (or DB name is blank) */}
                    {r.pkmnName && r.pkmnName !== r.name && (
                      <span className="text-yellow-400 text-xs truncate">
                        ← pkmn.gg: {r.pkmnName}
                      </span>
                    )}
                  </div>

                  {/* Scraped fields + image saved chip */}
                  {r.status !== 'no_match' && (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
                      {r.pkmnName && (
                        <span>
                          <span className="text-gray-600">name</span>{' '}
                          <span className="text-gray-300">{r.pkmnName}</span>
                        </span>
                      )}
                      {r.artist && (
                        <span>
                          <span className="text-gray-600">artist</span>{' '}
                          <span className="text-gray-300">{r.artist}</span>
                        </span>
                      )}
                      {r.supertype && (
                        <span>
                          <span className="text-gray-600">supertype</span>{' '}
                          <span className="text-gray-300">{r.supertype}</span>
                        </span>
                      )}
                      {r.type && (
                        <span>
                          <span className="text-gray-600">type</span>{' '}
                          <span className="text-gray-300">{r.type}</span>
                        </span>
                      )}
                      {r.imageSaved && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25 font-medium">
                          🖼 image saved
                        </span>
                      )}
                    </div>
                  )}

                  {r.error && (
                    <p className="text-red-400 text-xs mt-0.5">{r.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isDone && !fatalError && (
        <p className="text-green-400 text-xs">
          ✅ Import complete —{' '}
          {summary.created > 0 && (
            <span className="text-teal-400">
              {summary.created} card{summary.created !== 1 ? 's' : ''} created
            </span>
          )}
          {summary.created > 0 && summary.succeeded > 0 && ', '}
          {summary.succeeded > 0 && (
            <span>
              {summary.succeeded} card{summary.succeeded !== 1 ? 's' : ''} updated
            </span>
          )}
          {summary.created === 0 && summary.succeeded === 0 && 'no cards written'}{' '}
          in the database.
        </p>
      )}
    </div>
  )
}
