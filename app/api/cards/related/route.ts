import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export interface RelatedCard {
  id: string
  name: string | null
  number: string | null
  rarity: string | null
  image: string | null
  set_id: string | null
  setName: string | null
  setLogoUrl: string | null
}

export interface RelatedCardsResponse {
  cards: RelatedCard[]
  total: number
}

/**
 * GET /api/cards/related
 *
 * Returns cards that share the same name as the requested card but come from
 * different sets, joined with set metadata.
 *
 * Query params:
 *   name          – The Pokémon name to search (required)
 *   excludeCardId – Card ID to exclude from results (the currently viewed card)
 *   limit         – Max results to return (default 3, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')
    const excludeCardId = searchParams.get('excludeCardId') ?? ''
    const limitParam = parseInt(searchParams.get('limit') ?? '3', 10)
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 3 : limitParam), 100)

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'name parameter is required' },
        { status: 400 }
      )
    }

    // ── Step 1: Count ALL matching cards (for "View all X cards" label) ──
    let countQuery = supabaseAdmin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('name', name.trim())

    if (excludeCardId) {
      countQuery = countQuery.neq('id', excludeCardId)
    }

    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      console.error('Error counting related cards:', countError)
      return NextResponse.json(
        { error: 'Failed to count related cards' },
        { status: 500 }
      )
    }

    const total = totalCount ?? 0

    if (total === 0) {
      return NextResponse.json({ cards: [], total: 0 } satisfies RelatedCardsResponse)
    }

    // ── Step 2: Fetch the limited result set ─────────────────────────────
    let cardsQuery = supabaseAdmin
      .from('cards')
      .select('id, name, number, rarity, image, set_id')
      .eq('name', name.trim())
      .order('set_id', { ascending: true })
      .limit(limit)

    if (excludeCardId) {
      cardsQuery = cardsQuery.neq('id', excludeCardId)
    }

    const { data: cards, error: cardsError } = await cardsQuery

    if (cardsError) {
      console.error('Error fetching related cards:', cardsError)
      return NextResponse.json(
        { error: 'Failed to fetch related cards' },
        { status: 500 }
      )
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ cards: [], total: 0 } satisfies RelatedCardsResponse)
    }

    // ── Step 3: Fetch set metadata for those cards ────────────────────────
    const setIds = [...new Set(cards.map((c) => c.set_id).filter(Boolean) as string[])]

    const { data: sets, error: setsError } = await supabaseAdmin
      .from('sets')
      .select('set_id, name, logo_url, release_date')
      .in('set_id', setIds)
      .order('release_date', { ascending: false })

    if (setsError) {
      console.error('Error fetching set metadata:', setsError)
      // Non-fatal — return cards without set names
    }

    const setsMap = new Map(
      (sets ?? []).map((s) => [s.set_id, s])
    )

    // ── Step 4: Merge and return ──────────────────────────────────────────
    const relatedCards: RelatedCard[] = cards.map((card) => {
      const setMeta = card.set_id ? setsMap.get(card.set_id) : undefined

      // Use the stored image URL; if absent generate the Supabase Storage URL
      // from set_id + number (same convention used by lib/imageUpload.ts).
      let resolvedImage: string | null = card.image ?? null
      if (!resolvedImage && card.set_id && card.number) {
        const cardNumber = card.number.split('/')[0]
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (supabaseUrl) {
          resolvedImage = `${supabaseUrl}/storage/v1/object/public/card-images/${card.set_id}-${cardNumber}.jpg`
        }
      }

      return {
        id: card.id,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        image: resolvedImage,
        set_id: card.set_id,
        setName: setMeta?.name ?? null,
        setLogoUrl: setMeta?.logo_url ?? null,
      }
    })

    return NextResponse.json({
      cards: relatedCards,
      total,
    } satisfies RelatedCardsResponse)

  } catch (error) {
    console.error('Unexpected error in /api/cards/related:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
