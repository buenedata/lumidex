import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/users/[id]/collection?q=&limit=
 *
 * Returns a user's owned cards (quantity > 0) with full card details and
 * price data (cm_trend EUR, tcgp_market USD). Used by the Trade Hub so the
 * current user can browse a trading partner's collection.
 *
 * Response: { cards: FriendCard[] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = params.id
  if (!userId) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
  }

  const { searchParams } = request.nextUrl
  const q     = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '500', 10), 1000)

  // 1. Get all card IDs this user owns
  const { data: owned, error: ownedError } = await supabaseAdmin
    .from('user_cards')
    .select('card_id, quantity')
    .eq('user_id', userId)
    .gt('quantity', 0)

  if (ownedError) {
    console.error('[users/collection] user_cards error:', ownedError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const ownedMap = new Map<string, number>()
  for (const row of owned ?? []) {
    ownedMap.set(row.card_id as string, row.quantity as number)
  }

  if (ownedMap.size === 0) {
    return NextResponse.json({ cards: [] })
  }

  const cardIds = Array.from(ownedMap.keys())

  // 2. Fetch card details + prices in parallel
  let cardQuery = supabaseAdmin
    .from('cards')
    .select(`id, set_id, name, number, rarity, type, image, sets!set_id(name, logo_url)`)
    .in('id', cardIds)
    .limit(limit)

  if (q) {
    cardQuery = cardQuery.or(`name.ilike.%${q}%,number.ilike.%${q}%`)
  }

  const [{ data: cardRows, error: cardsError }, { data: priceRows }] = await Promise.all([
    cardQuery,
    supabaseAdmin
      .from('card_prices')
      .select('card_id, cm_trend, cm_avg_sell, tcgp_market')
      .in('card_id', cardIds),
  ])

  if (cardsError) {
    console.error('[users/collection] cards error:', cardsError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const priceMap = new Map<string, { eur: number | null; usd: number | null }>()
  for (const p of priceRows ?? []) {
    priceMap.set(p.card_id, {
      eur: p.cm_trend ?? p.cm_avg_sell ?? null,
      usd: p.tcgp_market ?? null,
    })
  }

  const cards = (cardRows ?? []).map(c => {
    const setInfo = (Array.isArray(c.sets) ? c.sets[0] : c.sets) as Record<string, unknown> | null
    const price   = priceMap.get(c.id as string)
    return {
      id:           c.id,
      set_id:       c.set_id,
      name:         c.name,
      number:       c.number,
      rarity:       c.rarity,
      type:         c.type,
      image:        c.image,
      set_name:     setInfo?.name     ?? null,
      set_logo_url: setInfo?.logo_url ?? null,
      quantity:     ownedMap.get(c.id as string) ?? 1,
      price_eur:    price?.eur ?? null,
      price_usd:    price?.usd ?? null,
    }
  })

  const response = NextResponse.json({ cards })
  response.headers.set('Cache-Control', 'private, no-cache')
  return response
}
