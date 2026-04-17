import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/prices/set-stats/{setId}
 *
 * Returns aggregated pricing statistics for all cards in a set:
 *  - mostExpensive: the highest single-card EUR price in the set
 *  - setValue: the sum of all known EUR normal-variant prices
 *  - currency: always 'EUR'
 *
 * Uses item_prices with item_type='single' and variant='normal'.
 * Cards without a tcggo_id or without a price row are silently excluded
 * (they don't contribute to setValue and can't be mostExpensive).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params

  // ── Step 1: collect all tcggo_ids for cards in this set ──────────────────
  const { data: cardRows, error: cardError } = await supabaseAdmin
    .from('cards')
    .select('tcggo_id')
    .eq('set_id', setId)
    .not('tcggo_id', 'is', null)

  if (cardError) {
    console.error('[set-stats] card fetch error:', cardError)
    return NextResponse.json({ error: cardError.message }, { status: 500 })
  }

  // tcggo_id is stored as integer in cards but as text (item_id) in item_prices
  const tcggoIds: string[] = (cardRows ?? [])
    .map((r: { tcggo_id: number | null }) => (r.tcggo_id != null ? String(r.tcggo_id) : null))
    .filter((id): id is string => id !== null)

  if (tcggoIds.length === 0) {
    return NextResponse.json({ mostExpensive: null, setValue: null, currency: 'EUR' })
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

  const prices: number[] = (priceRows ?? []).map((r: { price: number }) => r.price)

  if (prices.length === 0) {
    return NextResponse.json({ mostExpensive: null, setValue: null, currency: 'EUR' })
  }

  // ── Step 3: aggregate ─────────────────────────────────────────────────────
  const mostExpensive = Math.max(...prices)
  const setValue      = prices.reduce((sum, p) => sum + p, 0)

  return NextResponse.json(
    { mostExpensive, setValue, currency: 'EUR' },
    {
      headers: {
        // Cache for 5 minutes — prices update hourly at most
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    },
  )
}
