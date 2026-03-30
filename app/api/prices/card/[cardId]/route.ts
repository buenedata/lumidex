import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/prices/card/[cardId]
 *
 * Returns the full card_prices row for a given card UUID.
 * Public endpoint — price data is publicly readable.
 *
 * Used by the card detail modal to show:
 *  - Per-variant raw prices (normal, reverse holo, holo)
 *  - Graded prices (PSA 10/9, BGS 9.5/9, CGC 10)
 *  - CardMarket prices
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params

  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
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
      tcgp_updated_at,
      cm_updated_at,
      fetched_at
    `)
    .eq('card_id', cardId)
    .maybeSingle()

  if (error) {
    console.error('[prices/card] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ price: null })
  }

  return NextResponse.json({ price: data })
}
