import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { GRADED_VARIANT_KEY } from '@/lib/analytics'

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

  // ── Step 1: Fetch owned card variants + graded copies in parallel ─────────
  // .limit(10000) mirrors the pattern used in lib/store.ts fetchUserCards.
  const [
    { data: ownedVariants, error: variantError },
    { data: ownedGraded,   error: gradedError   },
  ] = await Promise.all([
    supabaseAdmin
      .from('user_card_variants')
      .select('card_id, quantity')
      .eq('user_id', userId)
      .gt('quantity', 0)
      .limit(10000),
    supabaseAdmin
      .from('user_graded_cards')
      .select('card_id, grading_company, grade, quantity, cards(tcggo_id)')
      .eq('user_id', userId)
      .gt('quantity', 0),
  ])

  if (variantError) {
    console.error('[portfolio-value] variant fetch error:', variantError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  if (gradedError) {
    console.error('[portfolio-value] graded fetch error:', gradedError)
    // Non-fatal — continue with regular variants only
  }

  const variantCount = ownedVariants?.length ?? 0
  const gradedCount  = ownedGraded?.length  ?? 0
  console.log(`[portfolio-value] variants: ${variantCount}, graded: ${gradedCount} for user ${userId}`)

  // Return early only when the user owns nothing at all (no variants, no graded)
  if (variantCount === 0 && gradedCount === 0) {
    console.log(`[portfolio-value] Nothing owned — returning value: 0`)
    return NextResponse.json({ value: 0, currency: 'EUR' })
  }

  // Aggregate total quantity per card_id (a card may have multiple variant rows)
  // ownedVariants may be null when the user has zero regular variants but has graded copies.
  const qtyByCardId = new Map<string, number>()
  for (const v of ownedVariants ?? []) {
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

  // ── Step 4: Sum regular variant price × quantity ──────────────────────────
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

  // ── Step 5: Add graded card value (Bug fix: graded copies were not priced) ─
  // For each graded copy, look up its EUR market price via item_prices
  // (item_type = 'graded') using the GRADED_VARIANT_KEY mapping.
  const gradedRows = (ownedGraded ?? []) as unknown as {
    card_id: string
    grading_company: string
    grade: string
    quantity: number
    cards: { tcggo_id: number | null } | null
  }[]

  if (gradedRows.length > 0) {
    const gradedTcggoIds = [
      ...new Set(
        gradedRows
          .map((g) => g.cards?.tcggo_id)
          .filter((id): id is number => id != null)
          .map(String),
      ),
    ]

    if (gradedTcggoIds.length > 0) {
      const { data: gradedPriceRows, error: gradedPriceError } = await supabaseAdmin
        .from('item_prices')
        .select('item_id, variant, price')
        .in('item_id', gradedTcggoIds)
        .eq('item_type', 'graded')
        .not('price', 'is', null)

      if (gradedPriceError) {
        console.error('[portfolio-value] graded price query error:', gradedPriceError)
      } else {
        // Build map: `${tcggo_id}:${variant_key}` → price
        const gradedPriceMap = new Map<string, number>()
        for (const row of (gradedPriceRows ?? []) as unknown as { item_id: string; variant: string; price: number }[]) {
          gradedPriceMap.set(`${row.item_id}:${row.variant}`, row.price)
        }

        for (const g of gradedRows) {
          const tcggoId   = g.cards?.tcggo_id != null ? String(g.cards.tcggo_id) : null
          const variantKey = GRADED_VARIANT_KEY[g.grading_company]?.[g.grade] ?? null
          if (tcggoId && variantKey) {
            const price = gradedPriceMap.get(`${tcggoId}:${variantKey}`) ?? 0
            if (price > 0) {
              totalValue += price * g.quantity
              hasData = true
            }
          }
        }
      }
    }
  }

  console.log(`[portfolio-value] hasData: ${hasData}, totalValue: ${totalValue}`)

  return NextResponse.json(
    { value: hasData ? totalValue : null, currency: 'EUR' },
    { headers: { 'Cache-Control': 'private, no-cache' } },
  )
}
