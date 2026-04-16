import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/prices/history/[cardId]?range=7d
 *
 * Returns per-variant price history for a card, used to render
 * the line chart on the Price tab of the card detail modal.
 *
 * Query params:
 *   range  – '7d' | '14d' | '30d' | '3m' | '6m' | '1y'  (default: '7d')
 *
 * Access rules (enforced client-side via blur; API returns data for all ranges):
 *   - Free tier : only '7d' is shown unblurred
 *   - Pro tier  : all ranges available
 *
 * Response:
 *   { history: PriceHistoryPoint[] }
 *
 * PriceHistoryPoint:
 *   { variantKey: string; priceUsd: number; recordedAt: string }
 */

type RangeKey = '7d' | '14d' | '30d' | '3m' | '6m' | '1y'

const RANGE_INTERVALS: Record<RangeKey, string> = {
  '7d':  '7 days',
  '14d': '14 days',
  '30d': '30 days',
  '3m':  '3 months',
  '6m':  '6 months',
  '1y':  '1 year',
}

const VALID_SOURCES = new Set(['tcgplayer', 'cardmarket'])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params

  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const rangeParam  = (searchParams.get('range')  ?? '7d') as RangeKey
  const sourceParam = searchParams.get('source')
  const interval    = RANGE_INTERVALS[rangeParam] ?? RANGE_INTERVALS['7d']

  // When the caller passes a recognised source (e.g. 'tcgplayer' or 'cardmarket'),
  // filter to that source only.  When omitted or unrecognised, return all sources
  // so that sets tracked only by CardMarket (common for EU promotional sets) also
  // display history data.
  let query = supabaseAdmin
    .from('card_price_history')
    .select('variant_key, price_usd, source, recorded_at')
    .eq('card_id', cardId)
    .gte('recorded_at', `now() - interval '${interval}'`)
    .order('recorded_at', { ascending: true })

  if (sourceParam && VALID_SOURCES.has(sourceParam)) {
    query = query.eq('source', sourceParam)
  }

  const { data, error } = await query

  if (error) {
    console.error('[prices/history] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const history = (data ?? []).map(row => ({
    variantKey:  row.variant_key,
    priceUsd:    Number(row.price_usd),
    recordedAt:  row.recorded_at,
  }))

  return NextResponse.json({ history })
}
