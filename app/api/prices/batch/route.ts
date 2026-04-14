import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { EUR_TO_USD } from '@/lib/pricing'

/**
 * GET /api/prices/batch?ids=id1,id2,...&source=tcgplayer|cardmarket
 *
 * Returns the best available market price (USD) for each requested card ID,
 * respecting the user's preferred price source.
 *
 * Response: { prices: Record<cardId, number> }
 */
export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids') ?? ''
  const source   = request.nextUrl.searchParams.get('source') ?? 'tcgplayer'
  const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean)

  if (ids.length === 0) {
    return NextResponse.json({ prices: {} })
  }

  const { data, error } = await supabaseAdmin
    .from('card_prices')
    .select('card_id, tcgp_market, tcgp_normal, cm_avg_sell, cm_trend')
    .in('card_id', ids)

  if (error) {
    console.error('[prices/batch] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const prices: Record<string, number> = {}
  for (const row of data ?? []) {
    let price: number | null = null

    if (source === 'cardmarket') {
      // CardMarket prices are stored in EUR — convert to USD for the overlay
      const eur = (row.cm_avg_sell ?? row.cm_trend) as number | null
      price = eur != null ? eur * EUR_TO_USD : null
    } else {
      // TCGPlayer (default)
      price = (row.tcgp_market ?? row.tcgp_normal ?? row.cm_avg_sell) as number | null
    }

    if (price != null) prices[row.card_id as string] = price
  }

  const response = NextResponse.json({ prices })
  response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  return response
}
