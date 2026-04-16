import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/users/[id]/collection?q=&limit=
 *
 * Returns a user's owned cards with full card details.
 * Source of truth is `user_card_variants` (quantities aggregated per card).
 *
 * Used by the Trade Hub FriendCardPickerModal so the current user can
 * browse a trading partner's collection.
 *
 * Response: { cards: FriendCard[] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: userId } = await params
  if (!userId) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
  }

  const { searchParams } = request.nextUrl
  const q     = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 250)

  // 1. Aggregate quantities from user_card_variants (the real collection store)
  const { data: variantRows, error: variantError } = await supabaseAdmin
    .from('user_card_variants')
    .select('card_id, quantity')
    .eq('user_id', userId)
    .gt('quantity', 0)

  if (variantError) {
    console.error('[users/collection] user_card_variants error:', variantError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Sum quantities per card (a card may have multiple variant rows)
  const ownedMap = new Map<string, number>()
  for (const row of variantRows ?? []) {
    const cardId = row.card_id as string
    ownedMap.set(cardId, (ownedMap.get(cardId) ?? 0) + (row.quantity as number))
  }

  if (ownedMap.size === 0) {
    return NextResponse.json({ cards: [] })
  }

  const cardIds = Array.from(ownedMap.keys())

  // 2. Fetch card details
  let cardQuery = supabaseAdmin
    .from('cards')
    .select(`id, set_id, name, number, rarity, type, image, sets!set_id(name, logo_url)`)
    .in('id', cardIds)
    .limit(limit)

  if (q) {
    cardQuery = cardQuery.or(`name.ilike.%${q}%,number.ilike.%${q}%`)
  }

  const { data: cardRows, error: cardsError } = await cardQuery

  if (cardsError) {
    console.error('[users/collection] cards error:', cardsError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const cards = (cardRows ?? []).map(c => {
    const setInfo = (Array.isArray(c.sets) ? c.sets[0] : c.sets) as Record<string, unknown> | null
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
    }
  })

  const response = NextResponse.json({ cards })
  response.headers.set('Cache-Control', 'private, no-cache')
  return response
}
