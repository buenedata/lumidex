import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/prices/status?setId=sv1
 *
 * Returns price coverage stats for a single set.
 * If setId is omitted, returns a minimal list of all sets (id + name only)
 * for populating the SetSelector dropdown.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const setId = request.nextUrl.searchParams.get('setId')

  // ── Set list mode (no setId) ──────────────────────────────────────────────
  if (!setId) {
    const { data, error } = await supabaseAdmin
      .from('sets')
      .select('set_id, name, series')
      .order('release_date', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      sets: (data ?? []).map(s => ({
        set_id: s.set_id,
        name:   s.name,
        series: s.series,
      })),
    })
  }

  // ── Single-set stats mode ─────────────────────────────────────────────────
  try {
    // Card count for this set — use count: 'exact' to avoid row limits
    const { count: cardCount, error: cardErr } = await supabaseAdmin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('set_id', setId)

    if (cardErr) throw cardErr

    // Priced card count — get all card UUIDs for the set, then count price rows
    const { data: setCards, error: setCardsErr } = await supabaseAdmin
      .from('cards')
      .select('id')
      .eq('set_id', setId)

    if (setCardsErr) throw setCardsErr

    const cardIds = (setCards ?? []).map(c => c.id as string)
    let pricedCount = 0
    let lastSynced: string | null = null

    if (cardIds.length > 0) {
      const { data: priceRows, error: priceErr } = await supabaseAdmin
        .from('card_prices')
        .select('card_id, fetched_at')
        .in('card_id', cardIds)

      if (priceErr) throw priceErr

      pricedCount = (priceRows ?? []).length
      const timestamps = (priceRows ?? []).map(r => r.fetched_at as string).filter(Boolean)
      if (timestamps.length > 0) {
        const sorted = timestamps.sort()
        lastSynced = sorted[sorted.length - 1] ?? null
      }
    }

    // Product count
    const { count: productCount, error: prodErr } = await supabaseAdmin
      .from('set_products')
      .select('id', { count: 'exact', head: true })
      .eq('set_id', setId)

    if (prodErr) throw prodErr

    return NextResponse.json({
      stats: {
        set_id:        setId,
        card_count:    cardCount ?? 0,
        priced_count:  pricedCount,
        product_count: productCount ?? 0,
        last_synced:   lastSynced,
      },
    })
  } catch (err) {
    console.error('[prices/status]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
