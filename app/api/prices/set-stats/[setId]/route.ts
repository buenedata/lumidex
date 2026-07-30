import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/prices/set-stats/{setId}
 *
 * Returns aggregated pricing statistics for ALL cards in a set:
 *  - mostExpensive: the highest single-card EUR price in the set
 *  - mostExpensiveCard: card details (name, number, image, setName) for the priciest card
 *  - setValue: the sum of EUR normal-variant prices for all cards in the set
 *  - currency: always 'EUR'
 *
 * Pricing strategy (dual-path lookup against item_prices):
 *  1. TCGGO path  — cards that have a tcggo_id use that integer (as text) as
 *                   item_id. Populated by the admin sync-set pipeline.
 *  2. CM fallback — cards WITHOUT a tcggo_id (sets with no api_set_id) may
 *                   still have a CM price stored in item_prices with
 *                   item_id = card.id (UUID as text) and source = 'cardmarket'.
 *                   Both paths are queried in parallel and merged before
 *                   aggregation, so sets that rely entirely on CM pricing (no
 *                   TCGGO episode ID) will display correct stats.
 *
 * Cards without a price row in either path are silently excluded.
 * Public endpoint — does not require authentication.
 *
 * Bug fixes applied here:
 *  1. Previously filtered to user-owned cards only, so any set with 0 owned
 *     cards always returned null prices and showed "—" in the stats strip.
 *     Fixed by removing the user_card_variants ownership filter.
 *  2. sets table was queried with .eq('id', setId) but the PK column is
 *     'set_id' (not 'id'). Silently returned null, so setName was always null.
 *     Fixed by using .eq('set_id', setId).
 *  3. Cards without tcggo_id were hard-excluded (.not('tcggo_id','is',null)),
 *     so sets whose cards use the CM fallback path always showed "—" pricing.
 *     Fixed by fetching ALL cards and adding the UUID-keyed CM lookup path.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params

  interface CardRow {
    id: string
    name: string | null
    number: string | null
    image: string | null
    tcggo_id: number | null
  }

  // ── Step 1: collect ALL card details and set name in parallel ─────────────
  // NOTE: tcggo_id filter removed — we need all cards so we can attempt both
  //       the TCGGO path (item_id = tcggo_id) and the CM path (item_id = uuid).
  const [
    { data: cardRows, error: cardError },
    { data: setRow },
  ] = await Promise.all([
    supabaseAdmin
      .from('cards')
      .select('id, name, number, image, tcggo_id')
      .eq('set_id', setId),
    // Bug fix 2: was .eq('id', setId) — 'id' is not a column; PK is 'set_id'.
    supabaseAdmin
      .from('sets')
      .select('name')
      .eq('set_id', setId)
      .single(),
  ])

  if (cardError) {
    console.error('[set-stats] card fetch error:', cardError)
    return NextResponse.json({ error: cardError.message }, { status: 500 })
  }

  // Build two lookup maps:
  //  cardByTcggoId — keyed by tcggo_id string  → used for TCGGO price lookup
  //  cardByUUID    — keyed by card UUID string  → used for CM fallback lookup
  //                  (only cards that lack a tcggo_id go into this map)
  const cardByTcggoId = new Map<string, CardRow>()
  const cardByUUID    = new Map<string, CardRow>()

  for (const r of (cardRows ?? []) as CardRow[]) {
    if (r.tcggo_id != null) {
      cardByTcggoId.set(String(r.tcggo_id), r)
    } else {
      // No TCGGO ID — may still have a CM price row keyed by card UUID
      cardByUUID.set(r.id, r)
    }
  }

  const tcggoIds  = Array.from(cardByTcggoId.keys())
  const cardUUIDs = Array.from(cardByUUID.keys())

  // Nothing to price-check at all
  if (tcggoIds.length === 0 && cardUUIDs.length === 0) {
    return NextResponse.json({ mostExpensive: null, mostExpensiveCard: null, setValue: null, currency: 'EUR' })
  }

  // ── Step 2: fetch prices via both paths in parallel ───────────────────────
  //
  //  Path A — TCGGO: item_id matches cards.tcggo_id (as text).
  //  Path B — CM:    item_id matches cards.id (UUID as text); source='cardmarket'.
  //                  Only queried when there are cards without a tcggo_id.
  //
  // Both queries are identical in shape (item_type='single', variant='normal');
  // the CM path just uses UUID strings as item_id values instead of TCGGO ints.

  interface PriceRow { item_id: string; price: number }

  const [tcggoPriceResult, cmPriceResult] = await Promise.all([
    tcggoIds.length > 0
      ? supabaseAdmin
          .from('item_prices')
          .select('item_id, price')
          .in('item_id', tcggoIds)
          .eq('item_type', 'single')
          .eq('variant', 'normal')
          .not('price', 'is', null)
      : Promise.resolve({ data: [] as PriceRow[], error: null }),

    cardUUIDs.length > 0
      ? supabaseAdmin
          .from('item_prices')
          .select('item_id, price')
          .in('item_id', cardUUIDs)
          .eq('item_type', 'single')
          .eq('variant', 'normal')
          .not('price', 'is', null)
      : Promise.resolve({ data: [] as PriceRow[], error: null }),
  ])

  if (tcggoPriceResult.error) {
    console.error('[set-stats] TCGGO price fetch error:', tcggoPriceResult.error)
    return NextResponse.json({ error: tcggoPriceResult.error.message }, { status: 500 })
  }
  if (cmPriceResult.error) {
    console.error('[set-stats] CM price fetch error:', cmPriceResult.error)
    return NextResponse.json({ error: cmPriceResult.error.message }, { status: 500 })
  }

  // ── Step 3: merge results into a single priced-card list ──────────────────
  //
  // Associate each price row back to its card so we can display per-card info
  // (name, image, number) for the "most expensive" stat.

  interface PricedCard { card: CardRow; price: number }
  const pricedCards: PricedCard[] = []

  for (const r of (tcggoPriceResult.data ?? []) as PriceRow[]) {
    const card = cardByTcggoId.get(r.item_id)
    if (card) pricedCards.push({ card, price: r.price })
  }
  for (const r of (cmPriceResult.data ?? []) as PriceRow[]) {
    const card = cardByUUID.get(r.item_id)
    if (card) pricedCards.push({ card, price: r.price })
  }

  if (pricedCards.length === 0) {
    return NextResponse.json({ mostExpensive: null, mostExpensiveCard: null, setValue: null, currency: 'EUR' })
  }

  // ── Step 4: aggregate ─────────────────────────────────────────────────────
  const setValue = pricedCards.reduce((sum, pc) => sum + pc.price, 0)

  const mostExpensivePc = pricedCards.reduce<PricedCard>(
    (max, pc) => (pc.price > max.price ? pc : max),
    pricedCards[0],
  )
  const mostExpensive = mostExpensivePc.price

  const setName = (setRow as { name?: string | null } | null)?.name ?? null
  const card    = mostExpensivePc.card

  const mostExpensiveCard = {
    name:    card.name    ?? null,
    number:  card.number  ?? null,
    image:   card.image   ?? null,
    setName,
  }

  return NextResponse.json(
    { mostExpensive, mostExpensiveCard, setValue, currency: 'EUR' },
    {
      headers: {
        // Set-level stats are now public and change only when prices are re-synced.
        // Cache for 5 minutes with stale-while-revalidate for fast repeat visits.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  )
}
