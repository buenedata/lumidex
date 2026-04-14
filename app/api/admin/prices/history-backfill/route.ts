import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchTcggoCardHistory } from '@/services/pricing/tcggoHistoryService'
import { savePriceHistoryBackfill, BackfillPricePoint } from '@/services/pricing/priceRepository'

export const maxDuration = 300

// ── Types ─────────────────────────────────────────────────────────────────────

interface BackfillRequest {
  /** DB set_id to backfill history for. Required. */
  setId: string
  /**
   * How many days of history to fetch.
   * Default: 180 (6 months). Max: 365.
   */
  days?: number
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/prices/history-backfill
 *
 * For every card in a set that has a tcggo_id stored (populated by the normal
 * price sync), this endpoint fetches CardMarket + TCGPlayer daily price history
 * from the tcggo RapidAPI and writes it to card_price_history with the real
 * historical dates.
 *
 * This is a backfill operation — safe to re-run (inserts duplicate-date rows
 * are benign for chart rendering). Designed to be triggered from the admin
 * prices page after a set's first sync.
 */
export async function POST(request: NextRequest) {
  // 1. Auth guard
  try {
    await requireAdmin()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 2. Parse body
  let body: BackfillRequest
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const setId = body.setId?.trim()
  if (!setId) {
    return new Response(JSON.stringify({ error: 'setId is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const days = Math.min(Math.max(Number(body.days ?? 180), 1), 365)

  // 3. Build date range
  const dateTo   = new Date()
  const dateFrom = new Date(dateTo.getTime() - days * 24 * 60 * 60 * 1000)
  const dfStr    = dateFrom.toISOString().split('T')[0]
  const dtStr    = dateTo.toISOString().split('T')[0]

  // 4. Fetch all cards for the set that have a tcggo_id
  const { data: cards, error: dbErr } = await supabaseAdmin
    .from('cards')
    .select('id, name, number, tcggo_id')
    .eq('set_id', setId)
    .not('tcggo_id', 'is', null)

  if (dbErr) {
    return new Response(JSON.stringify({ error: dbErr.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!cards || cards.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        message: `No cards with tcggo_id found for set "${setId}". ` +
          'Run a price sync first to populate tcggo_id values.',
        cardsProcessed: 0,
        pointsSaved: 0,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  console.log(
    `[history-backfill] set=${setId} cards=${cards.length} ` +
    `date_range=${dfStr}→${dtStr} (${days}d)`
  )

  // 5. Fetch history for each card and accumulate price points
  let cardsProcessed  = 0
  let cardsErrored    = 0
  const allPoints: BackfillPricePoint[] = []

  // Process cards in batches of 10 concurrent requests to respect API rate limits
  const CONCURRENCY = 10
  for (let i = 0; i < cards.length; i += CONCURRENCY) {
    const chunk = cards.slice(i, i + CONCURRENCY)

    const results = await Promise.allSettled(
      chunk.map(async (card) => {
        const history = await fetchTcggoCardHistory(card.tcggo_id as number, dfStr, dtStr)

        for (const point of history) {
          // CardMarket low price (EUR)
          if (point.cmLow != null) {
            allPoints.push({
              cardId:     card.id as string,
              variantKey: 'normal',
              price:      point.cmLow,
              currency:   'EUR',
              source:     'cardmarket',
              recordedAt: point.date,
            })
          }
          // TCGPlayer market price (USD)
          if (point.tcgpMarket != null) {
            allPoints.push({
              cardId:     card.id as string,
              variantKey: 'normal',
              price:      point.tcgpMarket,
              currency:   'USD',
              source:     'tcgplayer',
              recordedAt: point.date,
            })
          }
        }

        return history.length
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled') {
        cardsProcessed++
      } else {
        cardsErrored++
        console.error('[history-backfill] card error:', r.reason)
      }
    }
  }

  // 6. Bulk-insert all accumulated points
  if (allPoints.length > 0) {
    await savePriceHistoryBackfill(allPoints)
  }

  console.log(
    `[history-backfill] done — cards=${cardsProcessed} ` +
    `errors=${cardsErrored} points=${allPoints.length}`
  )

  return new Response(
    JSON.stringify({
      ok:             true,
      setId,
      dateFrom:       dfStr,
      dateTo:         dtStr,
      cardsProcessed,
      cardsErrored,
      pointsSaved:    allPoints.length,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
