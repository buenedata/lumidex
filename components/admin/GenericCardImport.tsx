'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { ALL_GAME_SLUGS, GAMES } from '@/lib/games'
import type { GameSlug } from '@/lib/games'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CardInput {
  name: string
  number: string
  rarity?: string
  image_url?: string
  artist?: string
  type?: string
}

interface SetInput {
  name: string
  series?: string
  release_date?: string
  total?: number
  logo_url?: string
  symbol_url?: string
  language?: string
  cards: CardInput[]
}

interface ImportPayload {
  game: string
  sets: SetInput[]
}

interface ImportResult {
  setsCreated: number
  setsSkipped: number
  cardsCreated: number
  cardsSkipped: number
}

interface ValidationSummary {
  setCount: number
  cardCount: number
  sets: Array<{ name: string; cardCount: number }>
}

// ── Non-Pokémon games only ────────────────────────────────────────────────────
const IMPORTABLE_GAME_SLUGS = ALL_GAME_SLUGS.filter((g) => g !== 'pokemon')

// ── Example payload ───────────────────────────────────────────────────────────
const EXAMPLE_PAYLOAD = JSON.stringify(
  {
    game: 'moomin',
    sets: [
      {
        name: 'The Wonderful World of Moomin',
        series: 'The Wonderful World of Moomin',
        release_date: '2025-01-01',
        total: 202,
        language: 'en',
        cards: [
          {
            name: 'Moomintroll',
            number: '001',
            rarity: 'Common',
            artist: 'Tove Jansson',
            image_url: 'https://example.com/images/moomin-001.jpg',
          },
          {
            name: 'Snorkmaiden',
            number: '002',
            rarity: 'Common',
          },
        ],
      },
    ],
  },
  null,
  2,
)

// ── Component ─────────────────────────────────────────────────────────────────

export function GenericCardImport() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  const [selectedGame, setSelectedGame] = useState<GameSlug>(
    IMPORTABLE_GAME_SLUGS[0] ?? 'moomin',
  )
  const [jsonInput, setJsonInput] = useState('')
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [showExample, setShowExample] = useState(false)

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading…</div>
      </div>
    )
  }

  if (!user) {
    router.push('/login?redirect=/admin/card-import')
    return null
  }

  if (profile?.role !== 'admin') {
    router.push('/dashboard?error=admin_required')
    return null
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  function handleValidate() {
    setValidationError(null)
    setValidationSummary(null)
    setImportResult(null)
    setImportError(null)

    if (!jsonInput.trim()) {
      setValidationError('Paste a JSON payload before validating.')
      return
    }

    let parsed: ImportPayload
    try {
      parsed = JSON.parse(jsonInput)
    } catch (err) {
      setValidationError(`JSON parse error: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    if (!parsed.game || typeof parsed.game !== 'string') {
      setValidationError('Payload must include a "game" string field.')
      return
    }

    if (parsed.game !== selectedGame) {
      setValidationError(
        `Payload game "${parsed.game}" does not match selected game "${selectedGame}". Update the selector or the payload.`,
      )
      return
    }

    if (parsed.game === 'pokemon') {
      setValidationError(
        'This tool does not support Pokémon. Use the dedicated Pokémon import tool.',
      )
      return
    }

    if (!Array.isArray(parsed.sets) || parsed.sets.length === 0) {
      setValidationError('Payload must include a non-empty "sets" array.')
      return
    }

    const setsSummary = parsed.sets.map((s: SetInput) => ({
      name: s.name ?? '(unnamed set)',
      cardCount: Array.isArray(s.cards) ? s.cards.length : 0,
    }))

    const totalCards = setsSummary.reduce((acc, s) => acc + s.cardCount, 0)

    setValidationSummary({
      setCount: parsed.sets.length,
      cardCount: totalCards,
      sets: setsSummary,
    })
  }

  // ── Import ────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!validationSummary) {
      setImportError('Validate the payload before importing.')
      return
    }

    setIsImporting(true)
    setImportError(null)
    setImportResult(null)

    try {
      const payload: ImportPayload = JSON.parse(jsonInput)
      // Enforce the selected game (overrides whatever is in the JSON)
      payload.game = selectedGame

      const res = await fetch('/api/admin/import-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setImportError(data?.error ?? `Request failed with status ${res.status}`)
        return
      }

      setImportResult(data as ImportResult)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unexpected error during import')
    } finally {
      setIsImporting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Game selector */}
      <section className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">1. Select Game</h2>
        <div className="flex flex-wrap gap-3">
          {IMPORTABLE_GAME_SLUGS.map((slug) => (
            <button
              key={slug}
              onClick={() => {
                setSelectedGame(slug)
                setValidationSummary(null)
                setValidationError(null)
                setImportResult(null)
                setImportError(null)
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedGame === slug
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {GAMES[slug].displayName}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Pokémon is excluded — use the dedicated{' '}
          <a
            href="/admin/card-data-import"
            className="text-yellow-400 hover:text-yellow-300 underline"
          >
            Pokémon import tool
          </a>
          .
        </p>
      </section>

      {/* JSON input */}
      <section className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">2. Paste JSON Payload</h2>
          <button
            onClick={() => setShowExample((v) => !v)}
            className="text-xs text-yellow-400 hover:text-yellow-300 underline transition-colors"
          >
            {showExample ? 'Hide' : 'Show'} example
          </button>
        </div>

        {showExample && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">
              Example payload structure — edit and paste into the textarea below:
            </p>
            <pre className="bg-gray-800 border border-gray-600 rounded-lg p-4 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap break-all">
              {EXAMPLE_PAYLOAD}
            </pre>
            <button
              onClick={() => {
                setJsonInput(EXAMPLE_PAYLOAD)
                setShowExample(false)
                setValidationSummary(null)
                setValidationError(null)
              }}
              className="mt-2 text-xs text-yellow-400 hover:text-yellow-300 underline transition-colors"
            >
              Load example into textarea
            </button>
          </div>
        )}

        <textarea
          value={jsonInput}
          onChange={(e) => {
            setJsonInput(e.target.value)
            setValidationSummary(null)
            setValidationError(null)
            setImportResult(null)
            setImportError(null)
          }}
          placeholder={`{\n  "game": "${selectedGame}",\n  "sets": [ ... ]\n}`}
          rows={16}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg p-4 text-sm text-gray-100 font-mono placeholder-gray-600 focus:outline-none focus:border-yellow-500 resize-y"
          spellCheck={false}
        />

        {/* Field reference */}
        <details className="mt-4">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 select-none">
            Field reference
          </summary>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400">
            <div>
              <p className="text-gray-300 font-semibold mb-1">Set fields</p>
              <ul className="space-y-0.5">
                <li>
                  <code className="text-yellow-400">name</code>{' '}
                  <span className="text-red-400">required</span> — set display name
                </li>
                <li>
                  <code className="text-yellow-400">series</code> — grouping label
                </li>
                <li>
                  <code className="text-yellow-400">release_date</code> — YYYY-MM-DD
                </li>
                <li>
                  <code className="text-yellow-400">total</code> — total card count
                </li>
                <li>
                  <code className="text-yellow-400">logo_url</code> — set logo image URL
                </li>
                <li>
                  <code className="text-yellow-400">symbol_url</code> — set symbol image URL
                </li>
                <li>
                  <code className="text-yellow-400">language</code> — ISO 639-1, default{' '}
                  <code>"en"</code>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-gray-300 font-semibold mb-1">Card fields</p>
              <ul className="space-y-0.5">
                <li>
                  <code className="text-yellow-400">name</code>{' '}
                  <span className="text-red-400">required</span> — card name
                </li>
                <li>
                  <code className="text-yellow-400">number</code>{' '}
                  <span className="text-red-400">required</span> — e.g. "042"
                </li>
                <li>
                  <code className="text-yellow-400">rarity</code> — e.g. "Common"
                </li>
                <li>
                  <code className="text-yellow-400">image_url</code> — stored as-is
                </li>
                <li>
                  <code className="text-yellow-400">artist</code> — illustrator name
                </li>
                <li>
                  <code className="text-yellow-400">type</code> — card element type
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            The import is <strong className="text-gray-300">idempotent</strong>: sets matched by{' '}
            <code className="text-yellow-400">name + game</code> and cards matched by{' '}
            <code className="text-yellow-400">number + set_id</code> are silently skipped on
            re-runs.
          </p>
        </details>

        <div className="mt-4">
          <button
            onClick={handleValidate}
            disabled={!jsonInput.trim()}
            className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            Validate JSON
          </button>
        </div>
      </section>

      {/* Validation result */}
      {validationError && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-5">
          <p className="text-red-400 text-sm font-medium">Validation Error</p>
          <p className="text-red-300 text-sm mt-1">{validationError}</p>
        </div>
      )}

      {validationSummary && (
        <section className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">3. Preview &amp; Import</h2>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-3 mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-sm font-medium">
              <span className="text-lg font-bold text-blue-400">{validationSummary.setCount}</span>
              {validationSummary.setCount === 1 ? 'set' : 'sets'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 text-sm font-medium">
              <span className="text-lg font-bold text-green-400">{validationSummary.cardCount}</span>
              {validationSummary.cardCount === 1 ? 'card' : 'cards'} total
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-sm font-medium">
              Game: <strong className="text-yellow-400">{GAMES[selectedGame].displayName}</strong>
            </span>
          </div>

          {/* Per-set breakdown */}
          <div className="space-y-2 mb-6">
            {validationSummary.sets.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2.5 text-sm"
              >
                <span className="text-gray-200 font-medium">{s.name}</span>
                <span className="text-gray-400">
                  {s.cardCount} {s.cardCount === 1 ? 'card' : 'cards'}
                </span>
              </div>
            ))}
          </div>

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {isImporting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Importing…
              </>
            ) : (
              <>📥 Run Import</>
            )}
          </button>
        </section>
      )}

      {/* Import error */}
      {importError && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-5">
          <p className="text-red-400 text-sm font-medium">Import Failed</p>
          <p className="text-red-300 text-sm mt-1">{importError}</p>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <section className="bg-gray-900 border border-green-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-2xl">✅</span>
            <h2 className="text-lg font-semibold text-green-400">Import Complete</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ResultStat
              value={importResult.setsCreated}
              label="Sets created"
              color="text-green-400"
            />
            <ResultStat
              value={importResult.setsSkipped}
              label="Sets skipped"
              color="text-gray-400"
            />
            <ResultStat
              value={importResult.cardsCreated}
              label="Cards created"
              color="text-green-400"
            />
            <ResultStat
              value={importResult.cardsSkipped}
              label="Cards skipped"
              color="text-gray-400"
            />
          </div>
          {importResult.setsSkipped > 0 || importResult.cardsSkipped > 0 ? (
            <p className="mt-4 text-xs text-gray-500">
              Skipped rows already existed in the database — no duplicates were created.
            </p>
          ) : null}
        </section>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResultStat({
  value,
  label,
  color,
}: {
  value: number
  label: string
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg px-4 py-3 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}
