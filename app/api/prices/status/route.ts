import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/prices/status
 *
 * Returns a list of all sets with their price coverage statistics.
 * Admin-only endpoint used by the /admin/prices management page.
 *
 * Response shape:
 * {
 *   sets: Array<{
 *     set_id:        string
 *     name:          string
 *     setComplete:   number | null
 *     card_count:    number
 *     priced_count:  number
 *     product_count: number
 *     last_synced:   string | null   (ISO timestamp of most recent card_prices.fetched_at)
 *   }>
 * }
 */
export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    // Fetch all sets
    const { data: setsData, error: setsErr } = await supabaseAdmin
      .from('sets')
      .select('set_id, name, setComplete')
      .order('release_date', { ascending: false })

    if (setsErr) throw setsErr

    const sets = setsData ?? []

    // For each set, count cards, priced cards, products, and last synced
    // We do this in a single batch of parallel queries rather than N+1 queries.
    const setIds = sets.map(s => s.set_id as string)

    // Count cards grouped by set_id
    const { data: cardCounts } = await supabaseAdmin
      .from('cards')
      .select('set_id, id')
      .in('set_id', setIds)

    // Count priced cards (join card_prices → cards)
    const { data: pricedCards } = await supabaseAdmin
      .from('card_prices')
      .select('card_id, cards!inner(set_id), fetched_at')
      .in('cards.set_id', setIds)

    // Count products per set
    const { data: products } = await supabaseAdmin
      .from('set_products')
      .select('set_id, id')
      .in('set_id', setIds)

    // Build lookup maps
    const cardCountMap   = new Map<string, number>()
    const pricedCountMap = new Map<string, number>()
    const lastSyncedMap  = new Map<string, string>()
    const productCountMap = new Map<string, number>()

    for (const row of (cardCounts ?? [])) {
      const sid = row.set_id as string
      cardCountMap.set(sid, (cardCountMap.get(sid) ?? 0) + 1)
    }

    for (const row of (pricedCards ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sid = (row.cards as any)?.set_id as string | undefined
      if (!sid) continue
      pricedCountMap.set(sid, (pricedCountMap.get(sid) ?? 0) + 1)
      const existing = lastSyncedMap.get(sid)
      const fetched  = row.fetched_at as string
      if (!existing || fetched > existing) lastSyncedMap.set(sid, fetched)
    }

    for (const row of (products ?? [])) {
      const sid = row.set_id as string
      productCountMap.set(sid, (productCountMap.get(sid) ?? 0) + 1)
    }

    const result = sets.map(s => ({
      set_id:        s.set_id,
      name:          s.name,
      setComplete:   s.setComplete ?? null,
      card_count:    cardCountMap.get(s.set_id as string) ?? 0,
      priced_count:  pricedCountMap.get(s.set_id as string) ?? 0,
      product_count: productCountMap.get(s.set_id as string) ?? 0,
      last_synced:   lastSyncedMap.get(s.set_id as string) ?? null,
    }))

    return NextResponse.json({ sets: result })

  } catch (err) {
    console.error('[prices/status]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
