import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/my-collection?q={search}&limit={n}
 *
 * Returns the authenticated user's owned cards (quantity > 0) with full
 * card details, optionally filtered by a name/number search query.
 * Used by the Trade Hub proposal builder to search the user's inventory.
 *
 * Response: { cards: PokemonCard[] }
 */
export async function GET(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const q     = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  // 1. Get card IDs the user owns
  const { data: owned, error: ownedError } = await supabaseAdmin
    .from('user_cards')
    .select('card_id, quantity')
    .eq('user_id', user.id)
    .gt('quantity', 0)

  if (ownedError) {
    console.error('[my-collection] user_cards error:', ownedError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const ownedMap = new Map<string, number>()
  for (const row of owned ?? []) {
    ownedMap.set(row.card_id as string, row.quantity as number)
  }

  if (ownedMap.size === 0) {
    return NextResponse.json({ cards: [] })
  }

  // 2. Fetch card details (with optional search filter)
  let query = supabaseAdmin
    .from('cards')
    .select(`id, set_id, name, number, rarity, type, image, sets!set_id(name, logo_url)`)
    .in('id', Array.from(ownedMap.keys()))
    .limit(limit)

  if (q) {
    query = query.or(`name.ilike.%${q}%,number.ilike.%${q}%`)
  }

  const { data: cardRows, error: cardsError } = await query

  if (cardsError) {
    console.error('[my-collection] cards error:', cardsError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const cards = (cardRows ?? []).map(c => {
    const setInfo = (Array.isArray(c.sets) ? c.sets[0] : c.sets) as Record<string, unknown> | null
    return {
      id:          c.id,
      set_id:      c.set_id,
      name:        c.name,
      number:      c.number,
      rarity:      c.rarity,
      type:        c.type,
      image:       c.image,
      set_name:    setInfo?.name     ?? null,
      set_logo_url:setInfo?.logo_url ?? null,
      quantity:    ownedMap.get(c.id as string) ?? 1,
    }
  })

  const response = NextResponse.json({ cards })
  response.headers.set('Cache-Control', 'private, no-cache')
  return response
}
