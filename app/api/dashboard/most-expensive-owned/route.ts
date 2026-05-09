// ─────────────────────────────────────────────────────────────────────────────
// app/api/dashboard/most-expensive-owned/route.ts
//
// GET /api/dashboard/most-expensive-owned
//
// Returns the single most expensive card (by EUR price) that the authenticated
// user currently owns (quantity > 0 in user_card_variants).
//
// Algorithm:
//   1. Fetch all owned card_ids + card metadata from user_card_variants → cards.
//   2. Collect all unique tcggo_ids from those cards.
//   3. Batch-fetch current EUR prices from item_prices for those tcggo_ids.
//   4. Find the owned card with the highest price and return its full metadata.
//
// Auth: Any authenticated user (no tier gate).
// Cache: private, 5 minutes.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

interface OwnedCardRow {
  card_id: string
  quantity: number
  cards: {
    id: string
    name: string | null
    tcggo_id: number | null
    image: string | null
    set_id: string
    sets: { name: string } | null
  } | null
}

export async function GET() {
  // 1. Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Fetch owned card variants with card + set metadata ───────────────────
  const { data: ownedRaw, error: ownedError } = await supabaseAdmin
    .from('user_card_variants')
    .select(`
      card_id,
      quantity,
      cards (
        id,
        name,
        tcggo_id,
        image,
        set_id,
        sets ( name )
      )
    `)
    .eq('user_id', user.id)
    .gt('quantity', 0)

  if (ownedError) {
    console.error('[dashboard/most-expensive-owned] owned query failed:', ownedError)
    return NextResponse.json({ error: ownedError.message }, { status: 500 })
  }

  const owned = (ownedRaw ?? []) as unknown as OwnedCardRow[]

  if (owned.length === 0) {
    return NextResponse.json(
      { card: null },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  }

  // 3. Collect unique tcggo_ids ─────────────────────────────────────────────
  const tcggoIds = [
    ...new Set(
      owned
        .map((r) => r.cards?.tcggo_id)
        .filter((id): id is number => id != null)
        .map(String),
    ),
  ]

  if (tcggoIds.length === 0) {
    return NextResponse.json(
      { card: null },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  }

  // 4. Batch-fetch prices from item_prices ──────────────────────────────────
  const { data: priceRowsRaw, error: priceError } = await supabaseAdmin
    .from('item_prices')
    .select('item_id, price')
    .in('item_id', tcggoIds)
    .eq('item_type', 'single')
    .eq('variant', 'normal')
    .not('price', 'is', null)
    .gt('price', 0)

  if (priceError) {
    console.error('[dashboard/most-expensive-owned] prices query failed:', priceError)
    return NextResponse.json({ error: priceError.message }, { status: 500 })
  }

  const priceMap = new Map<string, number>(
    ((priceRowsRaw ?? []) as { item_id: string; price: number }[]).map((p) => [
      p.item_id,
      p.price,
    ]),
  )

  // 5. Find the owned card with the highest price ───────────────────────────
  let bestCard: OwnedCardRow | null = null
  let bestPrice = 0

  // Deduplicate by card_id (a card may appear in multiple variant rows)
  const seenCardIds = new Set<string>()

  for (const row of owned) {
    const card = row.cards
    if (!card) continue
    if (seenCardIds.has(row.card_id)) continue
    seenCardIds.add(row.card_id)

    const tcggoKey = card.tcggo_id != null ? String(card.tcggo_id) : null
    if (!tcggoKey) continue

    const price = priceMap.get(tcggoKey) ?? 0
    if (price > bestPrice) {
      bestPrice = price
      bestCard = row
    }
  }

  if (!bestCard || bestPrice === 0) {
    return NextResponse.json(
      { card: null },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  }

  const card = bestCard.cards!
  const setName = (card.sets as { name: string } | null)?.name ?? null

  return NextResponse.json(
    {
      card: {
        id: card.id,
        name: card.name,
        set_name: setName,
        image: card.image,
        price_eur: bestPrice,
      },
    },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  )
}
