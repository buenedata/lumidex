import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/prices/batch?ids=id1,id2,...
 *
 * Returns the best available market price (USD) for each requested card ID.
 * Priority: tcgp_market → tcgp_normal → cm_avg_sell
 *
 * Response: { prices: Record<cardId, number> }
 */
export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids') ?? ''
  const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean)

  if (ids.length === 0) {
    return NextResponse.json({ prices: {} })
  }

  const { data, error } = await supabaseAdmin
    .from('card_prices')
    .select('card_id, tcgp_market, tcgp_normal, cm_avg_sell')
    .in('card_id', ids)

  if (error) {
    console.error('[prices/batch] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const prices: Record<string, number> = {}
  for (const row of data ?? []) {
    const best = row.tcgp_market ?? row.tcgp_normal ?? row.cm_avg_sell
    if (best != null) prices[row.card_id as string] = best as number
  }

  const response = NextResponse.json({ prices })
  response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  return response
}
