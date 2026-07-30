import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/users/[id]/portfolio-value
 *
 * Returns the user's portfolio value: SUM(price × quantity) for every owned card.
 * Uses the same dual-path price lookup as /api/prices/set-stats:
 *
 *   Path A — TCGGO: item_id = cards.tcggo_id (as text)
 *   Path B — CM:    item_id = cards.id (UUID), source = 'cardmarket'
 *
 * Unlike set-stats (which sums one price per card in a set regardless of ownership),
 * this endpoint accounts for how many copies the user actually holds so
 * portfolio value = correct "what is my collection worth" figure.
 *
 * Response: { value: number | null, currency: 'EUR' }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: userId } = await params
  if (!userId) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
  }

  // ── Step 1: All owned card variants with quantities ───────────────────────
  // .limit(10000) mirrors the pattern used in lib/store.ts fetchUserCards —
  // without it PostgREST may silently cap results at 1 000 rows on some
  // Supabase projects, causing large collections to be partially evaluated.
  const { data: ownedVariants, error: variantError } = await supabaseAdmin
    .from('user_card_variants')
    .select('card_id, quantity')
    .eq('user_id', userId)
    .gt('quantity', 0)
    .limit(10000)

  if (variantError) {
    console.error('[portfolio-value] variant fetch error:', variantError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  console.log(`[portfolio-value] ownedVariants count: ${ownedVariants?.length ?? 0} for user ${userId}`)

  if (!ownedVariants || ownedVariants.length === 0) {
    console.log(`[portfolio-value] No owned variants found — returning value: 0`)
    return NextResponse.json({ value: 0, currency: 'EUR' })
  }

  // Aggregate total quantity per card_id (a card may have multiple variant rows)
  const qtyByCardId = new Map<string, number>()
  for (const v of ownedVariants) {
    qtyByCardId.set(v.card_id, (qtyByCardId.get(v.card_id) ?? 0) + (v.quantity as number))
  }
  const cardIds = Array.from(qtyByCardId.keys())

  // ── Step 2: Get tcggo_ids to determine price-lookup path per card ─────────
  const { data: cardRows, error: cardError } = await supabaseAdmin
    .from('cards')
    .select('id, tcggo_id')
    .in('id', cardIds)

  if (cardError) {
    console.error('[portfolio-value] card fetch error:', cardError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Build reverse maps: item_id → card_id (needed to trace price row back to quantity)
  const tcggoItemToCardId = new Map<string, string>()
  const uuidItemToCardId  = new Map<string, string>()
  const tcggoItemIds: string[] = []
  const cardUUIDs: string[]    = []

  console.log(`[portfolio-value] cardIds: ${cardIds.length}, cardRows: ${cardRows?.length ?? 0}`)

  for (const c of (cardRows ?? [])) {
    if (c.tcggo_id != null) {
      const t = String(c.tcggo_id)
      tcggoItemToCardId.set(t, c.id)
      tcggoItemIds.push(t)
    } else {
      uuidItemToCardId.set(c.id, c.id)
      cardUUIDs.push(c.id)
    }
  }

  console.log(`[portfolio-value] tcggoItemIds: ${tcggoItemIds.length}, cardUUIDs: ${cardUUIDs.length}`)

  interface PriceRow { item_id: string; price: number }

  // ── Step 3: Fetch prices for both paths in parallel ───────────────────────
  const [tcggoPriceResult, cmPriceResult] = await Promise.all([
    tcggoItemIds.length > 0
      ? supabaseAdmin
          .from('item_prices')
          .select('item_id, price')
          .in('item_id', tcggoItemIds)
          .eq('item_type', 'single')
          .eq('variant', 'normal')
          .not('price', 'is', null)
      : Promise.resolve({ data: [] as PriceRow[], error: null }),

    cardUUIDs.length > 0
      ? supabaseAdmin
          .from('item_prices')
          .select('item_id, price')
          .in('item_id', cardUUIDs)
          .eq('item_type', 'single')
          .eq('variant', 'normal')
          .not('price', 'is', null)
      : Promise.resolve({ data: [] as PriceRow[], error: null }),
  ])

  if (tcggoPriceResult.error) {
    console.error('[portfolio-value] TCGGO price query error:', tcggoPriceResult.error)
    return NextResponse.json({ error: 'Price lookup failed' }, { status: 500 })
  }
  if (cmPriceResult.error) {
    console.error('[portfolio-value] CM price query error:', cmPriceResult.error)
    return NextResponse.json({ error: 'Price lookup failed' }, { status: 500 })
  }
  console.log(`[portfolio-value] TCGGO price rows: ${tcggoPriceResult.data?.length ?? 0}, CM price rows: ${cmPriceResult.data?.length ?? 0}`)

  // ── Step 4: Sum price × quantity ──────────────────────────────────────────
  let totalValue = 0
  let hasData    = false

  for (const row of (tcggoPriceResult.data ?? []) as PriceRow[]) {
    const cardId = tcggoItemToCardId.get(row.item_id)
    if (cardId) {
      totalValue += row.price * (qtyByCardId.get(cardId) ?? 0)
      hasData = true
    }
  }
  for (const row of (cmPriceResult.data ?? []) as PriceRow[]) {
    const cardId = uuidItemToCardId.get(row.item_id)
    if (cardId) {
      totalValue += row.price * (qtyByCardId.get(cardId) ?? 0)
      hasData = true
    }
  }

  console.log(`[portfolio-value] hasData: ${hasData}, totalValue: ${totalValue}`)

  return NextResponse.json(
    { value: hasData ? totalValue : null, currency: 'EUR' },
    { headers: { 'Cache-Control': 'private, no-cache' } },
  )
}
