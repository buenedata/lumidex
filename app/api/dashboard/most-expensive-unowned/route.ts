// ─────────────────────────────────────────────────────────────────────────────
// app/api/dashboard/most-expensive-unowned/route.ts
//
// GET /api/dashboard/most-expensive-unowned
//
// Returns the single most expensive card (by EUR price) that the authenticated
// user does NOT currently have in their collection (quantity = 0 or absent).
//
// Algorithm:
//   1. Fetch the user's owned card_ids from user_card_variants (quantity > 0).
//   2. Resolve the tcggo_ids for those cards.
//   3. Pull the top-N priced cards from item_prices (single/normal variant).
//   4. Walk the candidates top-down — skip any card whose tcggo_id is owned —
//      and return the first hit with full card + set metadata.
//
// Auth: Any authenticated user (no tier gate).
// Cache: private, 5 minutes.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

// How many top-priced rows to pull from item_prices before giving up.
// Large enough to survive a user who owns the very top portion of the market.
const CANDIDATE_BATCH = 400

interface CardDetailRow {
  id: string
  name: string | null
  tcggo_id: number | null
  image: string | null
  set_id: string
  sets: { name: string } | null
}

export async function GET() {
  // 1. Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Owned card_ids ────────────────────────────────────────────────────────
  const { data: ownedVariantsRaw } = await supabaseAdmin
    .from('user_card_variants')
    .select('card_id')
    .eq('user_id', user.id)
    .gt('quantity', 0)

  const ownedCardIds = new Set<string>(
    (ownedVariantsRaw ?? []).map((r) => r.card_id as string),
  )

  // 3. Owned tcggo_ids ───────────────────────────────────────────────────────
  // We need them to match against item_prices.item_id (which equals tcggo_id).
  const ownedTcggoIds = new Set<string>()

  if (ownedCardIds.size > 0) {
    const { data: ownedCardDetailsRaw } = await supabaseAdmin
      .from('cards')
      .select('id, tcggo_id')
      .in('id', [...ownedCardIds])
      .not('tcggo_id', 'is', null)

    for (const row of ownedCardDetailsRaw ?? []) {
      if (row.tcggo_id != null) {
        ownedTcggoIds.add(String(row.tcggo_id))
      }
    }
  }

  // 4. Top-priced cards from item_prices ────────────────────────────────────
  const { data: priceRowsRaw } = await supabaseAdmin
    .from('item_prices')
    .select('item_id, price')
    .eq('item_type', 'single')
    .eq('variant', 'normal')
    .not('price', 'is', null)
    .gt('price', 0)
    .order('price', { ascending: false })
    .limit(CANDIDATE_BATCH)

  const priceRows = priceRowsRaw ?? []

  if (priceRows.length === 0) {
    return NextResponse.json(
      { card: null },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  }

  // 5. Filter out owned items ────────────────────────────────────────────────
  const unownedPriceRows = priceRows.filter(
    (r) => !ownedTcggoIds.has(r.item_id as string),
  )

  if (unownedPriceRows.length === 0) {
    return NextResponse.json(
      { card: null },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  }

  // 6. Resolve card metadata for top candidates ─────────────────────────────
  // Take the top slice so we don't hit DB with 400 tcggo_id lookups.
  const TOP_RESOLVE = 30
  const topCandidates = unownedPriceRows.slice(0, TOP_RESOLVE)
  const candidateTcggoNumbers = topCandidates
    .map((r) => Number(r.item_id))
    .filter((n) => !isNaN(n) && n > 0)

  const { data: cardDetailsRaw } = await supabaseAdmin
    .from('cards')
    .select('id, name, tcggo_id, image, set_id, sets(name)')
    .in('tcggo_id', candidateTcggoNumbers)

  const cardByTcggoId = new Map<string, CardDetailRow>()
  for (const card of (cardDetailsRaw ?? []) as unknown as CardDetailRow[]) {
    if (card.tcggo_id != null) {
      cardByTcggoId.set(String(card.tcggo_id), card)
    }
  }

  // 7. Walk candidates and return the first unowned card with metadata ───────
  for (const priceRow of topCandidates) {
    const tcggoId = priceRow.item_id as string
    const card = cardByTcggoId.get(tcggoId)
    if (!card) continue
    // Check both card_id ownership (belt-and-suspenders)
    if (ownedCardIds.has(card.id)) continue

    const setName = (card.sets as { name: string } | null)?.name ?? null

    return NextResponse.json(
      {
        card: {
          id: card.id,
          name: card.name,
          set_name: setName,
          image: card.image,
          price_eur: priceRow.price as number,
        },
      },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  }

  // No matching card found
  return NextResponse.json(
    { card: null },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  )
}
