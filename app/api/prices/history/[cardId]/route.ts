// ─────────────────────────────────────────────────────────────────────────────
// app/api/prices/history/[cardId]/route.ts
//
// GET /api/prices/history/{cardId}?range=7d
//
// Returns price history for a card from card_price_history, filtered by the
// requested date range.  All prices are in EUR (or USD for legacy rows) —
// the consumer is responsible for currency formatting.
//
// Supported ranges: 7d | 14d | 30d | 3m | 6m | 1y
// Default:          7d
//
// Response:
//   { history: PriceHistoryPoint[], currency: 'EUR' }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { PriceHistoryPoint } from '@/types'

type Range = '7d' | '14d' | '30d' | '3m' | '6m' | '1y'

/** Convert a range string to a PostgreSQL INTERVAL expression. */
function rangeToInterval(range: Range): string {
  switch (range) {
    case '7d':  return '7 days'
    case '14d': return '14 days'
    case '30d': return '30 days'
    case '3m':  return '3 months'
    case '6m':  return '6 months'
    case '1y':  return '1 year'
    default:    return '7 days'
  }
}

const VALID_RANGES = new Set<Range>(['7d', '14d', '30d', '3m', '6m', '1y'])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params
  const rawRange   = req.nextUrl.searchParams.get('range') ?? '7d'
  const range      = VALID_RANGES.has(rawRange as Range) ? (rawRange as Range) : '7d'

  if (!cardId) {
    return NextResponse.json({ error: 'Missing cardId' }, { status: 400 })
  }

  const interval = rangeToInterval(range)

  // card_price_history uses card_id (uuid FK → cards.id) as the key.
  const { data, error } = await supabaseAdmin
    .from('card_price_history')
    .select('variant_key, price_usd, source, recorded_at')
    .eq('card_id', cardId)
    .gte('recorded_at', `now() - interval '${interval}'`)
    .order('recorded_at', { ascending: true })

  if (error) {
    console.error('[price-history] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const history: PriceHistoryPoint[] = (data ?? []).map((row) => ({
    variantKey:  row.variant_key as PriceHistoryPoint['variantKey'],
    priceUsd:    row.price_usd,
    recordedAt:  row.recorded_at,
    source:      row.source,
  }))

  return NextResponse.json(
    { history, currency: 'EUR' },
    {
      headers: {
        // Cache 5 minutes — fresh enough for the card modal.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  )
}
