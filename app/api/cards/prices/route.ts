import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/cards/prices?ids=id1,id2,...
 *
 * Returns price data for the given card UUID list.
 * Prices are taken from card_prices; cm_* values are EUR-denominated,
 * tcgp_* values are USD-denominated.
 *
 * Response: { prices: Record<cardId, { eur: number|null, usd: number|null }> }
 */
export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids') ?? ''
  const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean)

  if (ids.length === 0) {
    return NextResponse.json({ prices: {} })
  }

  const { data, error } = await supabaseAdmin
    .from('card_prices')
    .select('card_id, cm_trend, cm_avg_sell, tcgp_market')
    .in('card_id', ids)

  if (error) {
    console.error('[cards/prices] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const prices: Record<string, { eur: number | null; usd: number | null }> = {}
  for (const row of data ?? []) {
    prices[row.card_id] = {
      eur: (row.cm_trend ?? row.cm_avg_sell) ?? null,
      usd: row.tcgp_market ?? null,
    }
  }

  const response = NextResponse.json({ prices })
  response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  return response
}
