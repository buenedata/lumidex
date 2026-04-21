import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/prices/set-stats/{setId}
 *
 * Returns aggregated pricing statistics for all cards in a set:
 *  - mostExpensive: the highest single-card EUR price in the set
 *  - mostExpensiveCard: card details (name, number, image, setName) for the priciest card
 *  - setValue: the sum of all known EUR normal-variant prices
 *  - currency: always 'EUR'
 *
 * Uses item_prices with item_type='single' and variant='normal'.
 * Cards without a tcggo_id or without a price row are silently excluded.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params

  // ── Step 1: collect card details + set name in parallel ──────────────────
  const [
    { data: cardRows, error: cardError },
    { data: setRow },
  ] = await Promise.all([
    supabaseAdmin
      .from('cards')
      .select('id, name, number, image, tcggo_id')
      .eq('set_id', setId)
      .not('tcggo_id', 'is', null),
    supabaseAdmin
      .from('sets')
      .select('name')
      .eq('id', setId)
      .single(),
  ])

  if (cardError) {
    console.error('[set-stats] card fetch error:', cardError)
    return NextResponse.json({ error: cardError.message }, { status: 500 })
  }

  // Build a lookup map: tcggo_id string → card row (for O(1) resolution later)
  interface CardRow { id: string; name: string | null; number: string | null; image: string | null; tcggo_id: number | null }
  const cardByTcggoId = new Map<string, CardRow>()
  ;(cardRows ?? []).forEach((r: CardRow) => {
    if (r.tcggo_id != null) cardByTcggoId.set(String(r.tcggo_id), r)
  })

  const tcggoIds = Array.from(cardByTcggoId.keys())

  if (tcggoIds.length === 0) {
    return NextResponse.json({ mostExpensive: null, mostExpensiveCard: null, setValue: null, currency: 'EUR' })
  }

  // ── Step 2: fetch prices from item_prices ─────────────────────────────────
  const { data: priceRows, error: priceError } = await supabaseAdmin
    .from('item_prices')
    .select('item_id, price')
    .in('item_id', tcggoIds)
    .eq('item_type', 'single')
    .eq('variant', 'normal')
    .not('price', 'is', null)

  if (priceError) {
    console.error('[set-stats] price fetch error:', priceError)
    return NextResponse.json({ error: priceError.message }, { status: 500 })
  }

  interface PriceRow { item_id: string; price: number }
  const rows: PriceRow[] = priceRows ?? []

  if (rows.length === 0) {
    return NextResponse.json({ mostExpensive: null, mostExpensiveCard: null, setValue: null, currency: 'EUR' })
  }

  // ── Step 3: aggregate ─────────────────────────────────────────────────────
  const setValue = rows.reduce((sum, r) => sum + r.price, 0)

  // Find the price row with the highest price
  const mostExpensiveRow = rows.reduce<PriceRow>(
    (max, r) => (r.price > max.price ? r : max),
    rows[0],
  )
  const mostExpensive = mostExpensiveRow.price

  // Resolve the card details for the most expensive card
  const card = cardByTcggoId.get(mostExpensiveRow.item_id) ?? null
  const setName = (setRow as { name?: string | null } | null)?.name ?? null

  const mostExpensiveCard = card
    ? {
        name:    card.name    ?? null,
        number:  card.number  ?? null,
        image:   card.image   ?? null,
        setName,
      }
    : null

  return NextResponse.json(
    { mostExpensive, mostExpensiveCard, setValue, currency: 'EUR' },
    {
      headers: {
        // Cache for 5 minutes — prices update hourly at most
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    },
  )
}
