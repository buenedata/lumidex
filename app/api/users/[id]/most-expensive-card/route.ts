import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/users/[id]/most-expensive-card
 *
 * Returns the single highest-priced card the user actually owns (quantity ≥ 1).
 *
 * Price lookup uses the same proven dual-path strategy as
 * /api/prices/set-stats/[setId] (commit eb28ee8):
 *
 *   Path A — TCGGO: item_id = String(cards.tcggo_id)
 *   Path B — CM:    item_id = cards.id (UUID), for cards without a tcggo_id
 *
 * Only cards present in user_card_variants with quantity > 0 are considered.
 *
 * Response:
 *   { name, number, image, setName, price, currency: 'EUR' }
 *   | { price: null, currency: 'EUR' }  ← no owned cards or no prices found
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: userId } = await params
  if (!userId) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
  }

  // ── Step 1: All owned card variants with quantity > 0 ─────────────────────
  const { data: ownedVariants, error: variantError } = await supabaseAdmin
    .from('user_card_variants')
    .select('card_id, quantity')
    .eq('user_id', userId)
    .gt('quantity', 0)
    .limit(10000)

  if (variantError) {
    console.error('[most-expensive-card] variant fetch error:', variantError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!ownedVariants || ownedVariants.length === 0) {
    return NextResponse.json({ price: null, currency: 'EUR' })
  }

  // Deduplicate: one entry per unique card_id
  const cardIds = [...new Set(ownedVariants.map((v) => v.card_id as string))]

  // ── Step 2: Fetch card details for all owned cards ────────────────────────
  const { data: cardRows, error: cardError } = await supabaseAdmin
    .from('cards')
    .select('id, name, number, image, tcggo_id, set_id')
    .in('id', cardIds)

  if (cardError) {
    console.error('[most-expensive-card] card fetch error:', cardError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!cardRows || cardRows.length === 0) {
    return NextResponse.json({ price: null, currency: 'EUR' })
  }

  // ── Step 3: Build dual-path lookup maps (mirrors set-stats exactly) ───────
  interface CardMeta {
    id: string
    name: string | null
    number: string | null
    image: string | null
    tcggo_id: number | null
    set_id: string | null
  }

  const cardByTcggoId = new Map<string, CardMeta>()
  const cardByUUID    = new Map<string, CardMeta>()

  for (const c of cardRows as CardMeta[]) {
    if (c.tcggo_id != null) {
      cardByTcggoId.set(String(c.tcggo_id), c)
    } else {
      // No TCGGO ID — may have a CM price row keyed by card UUID
      cardByUUID.set(c.id, c)
    }
  }

  const tcggoIds  = Array.from(cardByTcggoId.keys())
  const cardUUIDs = Array.from(cardByUUID.keys())

  if (tcggoIds.length === 0 && cardUUIDs.length === 0) {
    return NextResponse.json({ price: null, currency: 'EUR' })
  }

  // ── Step 4: Resolve set names ─────────────────────────────────────────────
  const setIdSet = new Set(
    (cardRows as CardMeta[])
      .map((c) => c.set_id)
      .filter((id): id is string => id != null),
  )

  const { data: setRows } = await supabaseAdmin
    .from('sets')
    .select('set_id, name')
    .in('set_id', Array.from(setIdSet))

  const setNameMap = new Map<string, string>(
    (setRows ?? []).map((s) => [s.set_id as string, s.name as string]),
  )

  // ── Step 5: Fetch prices via both paths in parallel (mirrors set-stats) ───
  interface PriceRow { item_id: string; price: number }

  const [tcggoPriceResult, cmPriceResult] = await Promise.all([
    tcggoIds.length > 0
      ? supabaseAdmin
          .from('item_prices')
          .select('item_id, price')
          .in('item_id', tcggoIds)
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
    console.error('[most-expensive-card] TCGGO price fetch error:', tcggoPriceResult.error)
    return NextResponse.json({ error: 'Price lookup failed' }, { status: 500 })
  }
  if (cmPriceResult.error) {
    console.error('[most-expensive-card] CM price fetch error:', cmPriceResult.error)
    return NextResponse.json({ error: 'Price lookup failed' }, { status: 500 })
  }

  // ── Step 6: Merge results into a priced-card list (mirrors set-stats) ─────
  interface PricedCard { card: CardMeta; price: number }
  const pricedCards: PricedCard[] = []

  for (const r of (tcggoPriceResult.data ?? []) as PriceRow[]) {
    const card = cardByTcggoId.get(r.item_id)
    if (card) pricedCards.push({ card, price: r.price })
  }
  for (const r of (cmPriceResult.data ?? []) as PriceRow[]) {
    const card = cardByUUID.get(r.item_id)
    if (card) pricedCards.push({ card, price: r.price })
  }

  if (pricedCards.length === 0) {
    return NextResponse.json({ price: null, currency: 'EUR' })
  }

  // ── Step 7: Pick the highest-priced card ─────────────────────────────────
  const best = pricedCards.reduce<PricedCard>(
    (max, pc) => (pc.price > max.price ? pc : max),
    pricedCards[0],
  )

  return NextResponse.json(
    {
      name:    best.card.name   ?? null,
      number:  best.card.number ?? null,
      image:   best.card.image  ?? null,
      setName: best.card.set_id ? (setNameMap.get(best.card.set_id) ?? null) : null,
      price:   best.price,
      currency: 'EUR',
    },
    { headers: { 'Cache-Control': 'private, no-cache' } },
  )
}
