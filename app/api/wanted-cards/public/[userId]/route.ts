import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/wanted-cards/public/[userId]
 *
 * Returns full card data for all wanted cards belonging to a given user UUID.
 * No authentication required — wanted cards are treated as public profile data.
 *
 * Response: { cards: PokemonCard[] }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params

  if (!userId?.trim()) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

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
    .eq('user_id', userId.trim())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[wanted-cards/public GET] DB error:', error)
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
