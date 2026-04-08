import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/wanted-cards/cards
 *
 * Returns full card data for all cards in the authenticated user's
 * wanted list.  Used by the /wanted page.
 *
 * Response: { cards: PokemonCard[] }
 */

export async function GET(_request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch wanted cards joined with card data + set info
  const { data, error } = await supabaseAdmin
    .from('wanted_cards')
    .select(`
      created_at,
      cards (
        id, set_id, name, number, rarity, type, image,
        artist, hp, supertype, subtypes, created_at,
        sets!set_id ( name, logo_url )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[wanted-cards/cards GET] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const cards = (data ?? [])
    .map((row: { created_at: string; cards: unknown }) => {
      const cardData = (Array.isArray(row.cards) ? row.cards[0] : row.cards) as Record<string, unknown> | null
      if (!cardData) return null
      const setInfo = (Array.isArray(cardData.sets) ? cardData.sets[0] : cardData.sets) as Record<string, unknown> | null
      return {
        ...cardData,
        sets: undefined,
        set_name:     setInfo?.name     ?? null,
        set_logo_url: setInfo?.logo_url ?? null,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ cards })
}
