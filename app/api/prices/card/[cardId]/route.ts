import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/prices/card/[cardId]
 *
 * Returns the full card_prices row for a given card UUID, plus any per-variant
 * CardMarket URL overrides stored in card_cm_url_overrides.
 *
 * Public endpoint — price data is publicly readable.
 *
 * Used by the card detail modal to show:
 *  - Per-variant raw prices (normal, reverse holo, holo, cosmos holo)
 *  - Graded prices (PSA 10/9, BGS 9.5/9, CGC 10)
 *  - CardMarket prices
 *  - Per-variant CardMarket URL overrides (variant_cm_urls)
 *
 * Response shape:
 *   { price: CardPriceRow | null, variant_cm_urls: Record<string, string> }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params

  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  // Run both queries in parallel
  const [priceResult, urlOverridesResult] = await Promise.all([
    supabaseAdmin
      .from('card_prices')
      .select(`
        card_id,
        tcgp_normal,
        tcgp_reverse_holo,
        tcgp_holo,
        tcgp_1st_edition,
        tcgp_market,
        tcgp_psa10,
        tcgp_psa9,
        tcgp_bgs95,
        tcgp_bgs9,
        tcgp_cgc10,
        cm_avg_sell,
        cm_low,
        cm_trend,
        cm_avg_30d,
        cm_reverse_holo,
        cm_cosmos_holo,
        cm_url,
        tcgp_updated_at,
        cm_updated_at,
        fetched_at
      `)
      .eq('card_id', cardId)
      .maybeSingle(),

    supabaseAdmin
      .from('card_cm_url_overrides')
      .select('variant_key, cm_url')
      .eq('card_id', cardId),
  ])

  if (priceResult.error) {
    console.error('[prices/card] DB error (card_prices):', priceResult.error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (urlOverridesResult.error) {
    // Non-fatal: log and continue with empty overrides
    console.warn('[prices/card] DB warning (card_cm_url_overrides):', urlOverridesResult.error.message)
  }

  // Build variant_cm_urls map: { [variantKey]: url }
  const variant_cm_urls: Record<string, string> = {}
  for (const row of (urlOverridesResult.data ?? [])) {
    variant_cm_urls[row.variant_key as string] = row.cm_url as string
  }

  if (!priceResult.data) {
    return NextResponse.json({ price: null, variant_cm_urls })
  }

  return NextResponse.json({ price: priceResult.data, variant_cm_urls })
}
