// ─────────────────────────────────────────────────────────────────────────────
// app/api/admin/prices/sync-set/route.ts
//
// POST /api/admin/prices/sync-set
// Bulk-syncs all card prices (singles + graded) for a given Supabase set
// by fetching the full card list with embedded prices from the TCGGO bulk endpoint:
//   GET /pokemon/episodes/{episodeId}/cards
//
// The response envelope is { data: [...] } with up to 100 cards per page.
// We paginate until a page contains fewer than PER_PAGE items.
// Upserts are batched in groups of UPSERT_BATCH to avoid timeouts.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const TCGGO_BASE_URL = 'https://cardmarket-api-tcg.p.rapidapi.com'
const PER_PAGE       = 100  // max supported by the episode-cards endpoint
const UPSERT_BATCH   = 50   // rows per Supabase upsert call

// ── TCGGO type shapes ─────────────────────────────────────────────────────────

interface TcggoGradedPrices {
  psa?:  { psa10?: number; psa9?: number; psa8?: number }
  bgs?:  { bgs10pristine?: number; bgs10?: number; bgs9?: number; bgs8?: number }
  cgc?:  { cgc10?: number; cgc9?: number; cgc8?: number }
}

interface TcggoCardEntry {
  id: number
  prices: {
    cardmarket?: {
      lowest_near_mint?: number | null
      graded?: TcggoGradedPrices | unknown[] | null
      currency?: string
    } | null
    tcg_player?: {
      market_price?: number | null
    } | null
  }
}

interface TcggoEpisodeCardsResponse {
  data: TcggoCardEntry[]
}

// ── Grade key definitions ─────────────────────────────────────────────────────

const GRADE_KEYS: Array<{ key: string; extract: (g: TcggoGradedPrices) => number | undefined }> = [
  { key: 'psa10',         extract: (g) => g.psa?.psa10 },
  { key: 'psa9',          extract: (g) => g.psa?.psa9 },
  { key: 'psa8',          extract: (g) => g.psa?.psa8 },
  { key: 'bgs10pristine', extract: (g) => g.bgs?.bgs10pristine },
  { key: 'bgs10',         extract: (g) => g.bgs?.bgs10 },
  { key: 'bgs9',          extract: (g) => g.bgs?.bgs9 },
  { key: 'bgs8',          extract: (g) => g.bgs?.bgs8 },
  { key: 'cgc10',         extract: (g) => g.cgc?.cgc10 },
  { key: 'cgc9',          extract: (g) => g.cgc?.cgc9 },
  { key: 'cgc8',          extract: (g) => g.cgc?.cgc8 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build single + graded price rows for a card */
export function buildPriceRows(card: TcggoCardEntry, now: string) {
  const rows: Array<{
    item_id: string
    item_type: string
    variant: string
    price: number | null
    currency: string
    source: string
    updated_at: string
  }> = []

  // Singles row
  rows.push({
    item_id:    String(card.id),
    item_type:  'single',
    variant:    'normal',
    price:      card.prices?.cardmarket?.lowest_near_mint ?? null,
    currency:   'EUR',
    source:     'tcggo',
    updated_at: now,
  })

  // Graded rows — only when graded is a plain object (not an array)
  const graded = card.prices?.cardmarket?.graded
  if (graded !== null && graded !== undefined && !Array.isArray(graded)) {
    const g = graded as TcggoGradedPrices
    for (const { key, extract } of GRADE_KEYS) {
      const price = extract(g)
      if (price !== undefined) {
        rows.push({
          item_id:    String(card.id),
          item_type:  'graded',
          variant:    key,
          price:      price ?? null,
          currency:   'EUR',
          source:     'cardmarket',
          updated_at: now,
        })
      }
    }
  }

  return rows
}

/** Upsert a list of price rows in batches; returns { synced, skipped, failed } */
export async function batchUpsert(rows: ReturnType<typeof buildPriceRows>) {
  let synced  = 0
  let skipped = 0
  let failed  = 0

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH)

    const { error } = await supabaseAdmin
      .from('item_prices')
      .upsert(batch, { onConflict: 'item_id,item_type,variant' })

    if (error) {
      console.error('[price-sync] Upsert batch error:', error)
      failed += batch.length
    } else {
      for (const row of batch) {
        if (row.price === null) skipped++
        else synced++
      }
    }
  }

  return { synced, skipped, failed }
}

/** Fetch all cards for a TCGGO episode ID. Throws on non-OK responses. */
export async function fetchEpisodeCards(episodeId: string): Promise<TcggoCardEntry[]> {
  const allCards: TcggoCardEntry[] = []
  let page = 1

  while (true) {
    const url = `${TCGGO_BASE_URL}/pokemon/episodes/${episodeId}/cards?per_page=${PER_PAGE}&page=${page}`

    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key':  process.env.RAPIDAPI_KEY ?? '',
        'X-RapidAPI-Host': 'cardmarket-api-tcg.p.rapidapi.com',
      },
    })

    if (!res.ok) {
      const detail = await res.text()
      throw Object.assign(new Error('TCGGO fetch failed'), { httpStatus: res.status, detail })
    }

    const json     = (await res.json()) as TcggoEpisodeCardsResponse
    const pageData = Array.isArray(json?.data) ? json.data : []

    allCards.push(...pageData)
    if (pageData.length < PER_PAGE) break
    page++
  }

  return allCards
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Parse & validate ───────────────────────────────────────────────────
  let setId: string
  let includeGraded = true
  try {
    const body   = await req.json()
    setId        = body?.setId
    if (body?.includeGraded === false) includeGraded = false
    if (!setId || typeof setId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid setId' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── 2. Resolve TCGGO episode ID ───────────────────────────────────────────
  const { data: setRow, error: setError } = await supabaseAdmin
    .from('sets')
    .select('api_set_id')
    .eq('set_id', setId)
    .maybeSingle()

  if (setError || !setRow || !setRow.api_set_id) {
    return NextResponse.json(
      { error: 'Set not found or missing TCGGO episode ID' },
      { status: 400 },
    )
  }

  const episodeId = setRow.api_set_id as string

  // ── 3. Fetch all cards from TCGGO ─────────────────────────────────────────
  let allCards: TcggoCardEntry[]
  try {
    allCards = await fetchEpisodeCards(episodeId)
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; detail?: string; message?: string }
    return NextResponse.json(
      { error: 'Failed to fetch from TCGGO', detail: e.detail ?? e.message },
      { status: 502 },
    )
  }

  // ── 4. Build upsert rows ──────────────────────────────────────────────────
  const now = new Date().toISOString()
  const allRows = allCards.flatMap((card) => {
    const rows = buildPriceRows(card, now)
    // Optionally strip graded rows
    return includeGraded ? rows : rows.filter((r) => r.item_type !== 'graded')
  })

  const singleRows = allRows.filter((r) => r.item_type === 'single')
  const gradedRows = allRows.filter((r) => r.item_type === 'graded')

  // ── 5. Batch upserts ──────────────────────────────────────────────────────
  const singleStats = await batchUpsert(singleRows)
  const gradedStats = includeGraded ? await batchUpsert(gradedRows) : { synced: 0, skipped: 0, failed: 0 }

  // ── 6. Return summary ─────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    singles: {
      total:   singleRows.length,
      synced:  singleStats.synced,
      skipped: singleStats.skipped,
      failed:  singleStats.failed,
    },
    graded: {
      rows:    gradedRows.length,
      synced:  gradedStats.synced,
      skipped: gradedStats.skipped,
      failed:  gradedStats.failed,
    },
  })
}
