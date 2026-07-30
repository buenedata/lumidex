// ─────────────────────────────────────────────────────────────────────────────
// app/api/prices/card-variants/[tcggoId]/route.ts
//
// GET /api/prices/card-variants/{tcggoId}
//
// Returns all current prices for a single card, split by item_type:
//   - singles (item_type = 'single') keyed by variant
//   - graded  (item_type = 'graded') keyed by grade variant (psa10, bgs9, etc.)
//
// Response:
//   {
//     variants: { normal: 3.50, reverse: null, … },
//     graded:   { psa10: 45.00, psa9: 22.00, bgs10: 55.00, … },
//     currency: 'EUR'
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ── Singles variant allow-list ─────────────────────────────────────────────────
// TCGGO / CardMarket only provide reliable pricing for these two single variants.
// Any other variant key in item_prices (e.g. 'cosmos_holo', 'holiday', 'confetti')
// was written incorrectly — the TCGGO API returned the Normal lowest_near_mint
// under that key because it is variant-blind for singles.  Filtering here means
// the display immediately shows '—' for those variants even while stale DB rows
// still exist (no migration required).
// When proper per-variant CardMarket scraping is added, expand this set.
const SUPPORTED_SINGLE_VARIANTS = new Set(['normal', 'reverse_holo'])

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tcggoId: string }> },
) {
  const { tcggoId } = await params

  if (!tcggoId) {
    return NextResponse.json({ error: 'Missing tcggoId' }, { status: 400 })
  }

  // Fetch both singles and graded in one query
  const { data, error } = await supabaseAdmin
    .from('item_prices')
    .select('item_type, variant, price, currency')
    .eq('item_id', tcggoId)
    .in('item_type', ['single', 'graded'])

  if (error) {
    console.error('[card-variants] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const variants: Record<string, number | null> = {}
  const graded:   Record<string, number | null> = {}
  let currency = 'EUR'

  for (const row of data ?? []) {
    if (row.item_type === 'single') {
      // Only include variants that have genuine TCGGO/CardMarket price data.
      // Unsupported keys (cosmos_holo, holiday, confetti, …) are suppressed so
      // the card modal shows '—' rather than a misleading Normal price.
      if (SUPPORTED_SINGLE_VARIANTS.has(row.variant)) {
        variants[row.variant] = row.price ?? null
      }
    } else if (row.item_type === 'graded') {
      graded[row.variant] = row.price ?? null
    }
    if (row.currency) currency = row.currency
  }

  return NextResponse.json(
    { variants, graded, currency },
    {
      headers: {
        // Cache for 1 hour — same TTL as the individual price endpoint.
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  )
}
