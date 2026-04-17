// ─────────────────────────────────────────────────────────────────────────────
// app/api/admin/prices/sync-set/route.ts
//
// POST /api/admin/prices/sync-set
// Bulk-syncs all card prices for a given Supabase set (identified by its UUID)
// by fetching the full card list with embedded prices from the TCGGO bulk endpoint:
//   GET /v1/pokemon/episodes/{episodeId}/cards
//
// The response envelope is { data: [...] } with up to 100 cards per page.
// We paginate until a page contains fewer than PER_PAGE items.
// Upserts are batched in groups of UPSERT_BATCH_SIZE to avoid timeouts.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const TCGGO_BASE_URL  = 'https://cardmarket-api-tcg.p.rapidapi.com'
const PER_PAGE        = 100   // max supported by the episode-cards endpoint
const UPSERT_BATCH    = 50    // rows per Supabase upsert call

// ── TCGGO type shapes ─────────────────────────────────────────────────────────

interface TcggoCardEntry {
  id: number
  prices: {
    cardmarket?: {
      lowest_near_mint?: number | null
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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Parse & validate setId ─────────────────────────────────────────────
  let setId: string
  try {
    const body = await req.json()
    setId = body?.setId
    if (!setId || typeof setId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid setId' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── 2. Resolve TCGGO episode ID from Supabase ─────────────────────────────
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

  // ── 3. Fetch all cards from TCGGO (paginated) ─────────────────────────────
  const allCards: TcggoCardEntry[] = []

  try {
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
        const errorBody = await res.text()
        return NextResponse.json(
          { error: 'Failed to fetch from TCGGO', status: res.status, detail: errorBody },
          { status: 502 },
        )
      }

      const json   = (await res.json()) as TcggoEpisodeCardsResponse
      const pageData = Array.isArray(json?.data) ? json.data : []

      allCards.push(...pageData)

      // Last page reached when fewer items than requested
      if (pageData.length < PER_PAGE) break
      page++
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: 'Failed to fetch from TCGGO', detail },
      { status: 502 },
    )
  }

  // ── 4. Build upsert rows ──────────────────────────────────────────────────
  const total = allCards.length
  const now   = new Date().toISOString()

  const rows = allCards.map((card) => ({
    item_id:    String(card.id),
    item_type:  'single' as const,
    variant:    'normal',
    price:      card.prices?.cardmarket?.lowest_near_mint ?? null,
    currency:   'EUR',
    source:     'tcggo',
    updated_at: now,
  }))

  // ── 5. Batch upserts ──────────────────────────────────────────────────────
  let synced  = 0
  let skipped = 0
  let failed  = 0

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH)

    const { error: upsertError } = await supabaseAdmin
      .from('item_prices')
      .upsert(batch, { onConflict: 'item_id,item_type,variant' })

    if (upsertError) {
      console.error('[sync-set] Upsert batch error:', upsertError)
      failed += batch.length
    } else {
      for (const row of batch) {
        if (row.price === null) {
          skipped++
        } else {
          synced++
        }
      }
    }
  }

  // ── 6. Return summary ─────────────────────────────────────────────────────
  return NextResponse.json({ success: true, total, synced, skipped, failed })
}
