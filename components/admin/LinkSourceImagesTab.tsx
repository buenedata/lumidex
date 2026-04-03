'use client'

import { useState, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CandidateCard {
  id: string
  set_id: string
  name: string
  number: string
  image: string
}

interface AmbiguousCard {
  card: { id: string; set_id: string; name: string; number: string }
  candidates: CandidateCard[]
}

interface SseStatus {
  type: 'status'
  message: string
  total?: number
  toLink?: number
  noMatch?: number
  ambiguous?: number
}

interface SseProgress {
  type: 'progress'
  linked: number
  total: number
}

interface SseComplete {
  type: 'complete'
  linked: number
  noMatch: number
  skipped: number
  ambiguous: AmbiguousCard[]
}

interface SseError {
  type: 'error'
  message: string
}

type SseEvent = SseStatus | SseProgress | SseComplete | SseError

// ── Component ─────────────────────────────────────────────────────────────────

export function LinkSourceImagesTab() {
  const [running, setRunning]         = useState(false)
  const [statusLog, setStatusLog]     = useState<string[]>([])
  const [progress, setProgress]       = useState<{ done: number; total: number } | null>(null)
  const [result, setResult]           = useState<SseComplete | null>(null)
  const [error, setError]             = useState<string | null>(null)

  // Ambiguous resolution: cardId → chosen sourceCardId (or null = skip)
  const [resolutions, setResolutions] = useState<Record<string, string | null>>({})
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const addLog = (msg: string) =>
    setStatusLog((prev) => [...prev.slice(-49), msg])   // keep last 50 lines

  // ── Run auto-link ────────────────────────────────────────────────────────

  const handleRun = async () => {
    setRunning(true)
    setStatusLog([])
    setProgress(null)
    setResult(null)
    setError(null)
    setResolutions({})
    setSaveMsg(null)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/admin/link-source-cards', {
        method: 'POST',
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt: SseEvent = JSON.parse(line.slice(6))

            if (evt.type === 'status') {
              addLog(evt.message)
            } else if (evt.type === 'progress') {
              setProgress({ done: evt.linked, total: evt.total })
            } else if (evt.type === 'complete') {
              setResult(evt)
              // Prefill resolutions: first candidate for each ambiguous card
              const prefill: Record<string, string | null> = {}
              for (const a of evt.ambiguous) {
                prefill[a.card.id] = a.candidates[0]?.id ?? null
              }
              setResolutions(prefill)
            } else if (evt.type === 'error') {
              setError(evt.message)
            }
          } catch {
            // malformed JSON — ignore
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err?.message ?? 'Unknown error')
      }
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setRunning(false)
    addLog('Stopped by user.')
  }

  // ── Save ambiguous resolutions ───────────────────────────────────────────

  const handleSaveResolutions = async () => {
    if (!result) return
    setSaving(true)
    setSaveMsg(null)

    let saved = 0
    let skipped = 0

    for (const [cardId, sourceCardId] of Object.entries(resolutions)) {
      if (!sourceCardId) { skipped++; continue }
      const res = await fetch('/api/admin/link-source-cards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, sourceCardId }),
      })
      if (res.ok) saved++
    }

    setSaveMsg(`Saved ${saved} manual links. ${skipped} skipped.`)
    setSaving(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Description */}
      <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 text-sm text-gray-400 space-y-1">
        <p className="text-white font-semibold">Auto-Link Source Images</p>
        <p>
          Scans every card that has no image and no source link, then matches it to the
          best candidate in another set with the same <strong>name</strong> and
          <strong> card number</strong>. Matched cards will display the source card&apos;s
          image without uploading a duplicate file.
        </p>
        <p className="text-yellow-400/80 text-xs">
          ⚠️ Collection tracking is unaffected — each card row remains independent.
        </p>
      </div>

      {/* Run button */}
      <div className="flex items-center gap-3">
        {!running ? (
          <button
            onClick={handleRun}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
          >
            🔗 Run Auto-Link
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
          >
            ⏹ Stop
          </button>
        )}
        {running && (
          <span className="text-sm text-gray-400 animate-pulse">Running…</span>
        )}
      </div>

      {/* Progress bar */}
      {progress && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Updating source links…</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Status log */}
      {statusLog.length > 0 && (
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 font-mono text-xs text-gray-400 space-y-0.5 max-h-40 overflow-y-auto">
          {statusLog.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Summary */}
      {result && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Auto-linked',  value: result.linked,           color: 'text-green-400'  },
              { label: 'No match',     value: result.noMatch,          color: 'text-gray-400'   },
              { label: 'Ambiguous',    value: result.ambiguous.length, color: 'text-yellow-400' },
              { label: 'Skipped',      value: result.skipped,          color: 'text-gray-500'   },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-3 bg-gray-900 rounded-lg border border-gray-800 text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Ambiguous review */}
          {result.ambiguous.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-yellow-400">
                  ⚠️ {result.ambiguous.length} cards with multiple candidates — pick the right source:
                </p>
                <button
                  onClick={handleSaveResolutions}
                  disabled={saving}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : 'Save selections'}
                </button>
              </div>

              {saveMsg && (
                <p className="text-green-400 text-sm">{saveMsg}</p>
              )}

              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Card</th>
                      <th className="px-3 py-2 text-left">Set</th>
                      <th className="px-3 py-2 text-left">Number</th>
                      <th className="px-3 py-2 text-left">Choose source</th>
                      <th className="px-3 py-2 text-left">Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.ambiguous.map(({ card, candidates }) => {
                      const chosen = resolutions[card.id]
                      const chosenCard = candidates.find((c) => c.id === chosen)
                      return (
                        <tr key={card.id} className="bg-gray-950">
                          <td className="px-3 py-2 text-white font-medium">{card.name}</td>
                          <td className="px-3 py-2 text-gray-400 font-mono text-xs">{card.set_id}</td>
                          <td className="px-3 py-2 text-gray-400 font-mono text-xs">#{card.number}</td>
                          <td className="px-3 py-2">
                            <select
                              value={chosen ?? ''}
                              onChange={(e) =>
                                setResolutions((prev) => ({
                                  ...prev,
                                  [card.id]: e.target.value || null,
                                }))
                              }
                              className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 w-full"
                            >
                              <option value="">— skip —</option>
                              {candidates.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.set_id} #{c.number}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            {chosenCard ? (
                              <img
                                src={chosenCard.image}
                                alt={chosenCard.name}
                                className="w-8 h-auto rounded"
                              />
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
