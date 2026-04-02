import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

/**
 * GET /api/cards/search
 *
 * Query params:
 *   q         – name / number search string (supports "Pikachu 24" compound syntax)
 *   type      – filter by cards.type      e.g. "Fire"
 *   rarity    – filter by cards.rarity    e.g. "Rare Holo"
 *   supertype – filter by cards.supertype e.g. "Pokémon"
 *   limit     – max results (default 100, max 500)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q         = searchParams.get('q')
  const typeParam = searchParams.get('type')?.trim()      || null
  const rarityParam    = searchParams.get('rarity')?.trim()   || null
  const supertypeParam = searchParams.get('supertype')?.trim() || null
  const limit     = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '100', 10), 1), 500)

  // If no q and no filters return empty (needs at least a query)
  if ((!q || q.trim().length === 0) && !typeParam && !rarityParam && !supertypeParam) {
    const emptyResponse = NextResponse.json({ cards: [], total: 0, hasMore: false, query: '' })
    emptyResponse.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return emptyResponse
  }

  try {
    // Parse compound query like "Serperior 6" → name="Serperior", number="6"
    let namePart:   string | null = null
    let numberPart: string | null = null

    if (q && q.trim().length > 0) {
      const parts    = q.trim().split(/\s+/)
      const lastPart = parts[parts.length - 1]
      const isNumberToken = /^\d/.test(lastPart)

      if (isNumberToken && parts.length > 1) {
        namePart   = parts.slice(0, -1).join(' ')
        numberPart = lastPart
      } else if (isNumberToken) {
        numberPart = lastPart
      } else {
        namePart = q.trim()
      }
    }

    // Join cards with their set so we can display set name, series, release_date, and logo
    let dbQuery = supabase
      .from('cards')
      .select('id, name, number, rarity, type, supertype, image, set_id, default_variant_id, sets!inner(name, series, release_date, logo_url)')

    if (namePart)      dbQuery = dbQuery.ilike('name',      `%${namePart}%`)
    if (numberPart)    dbQuery = dbQuery.ilike('number',    `%${numberPart}%`)
    if (typeParam)     dbQuery = dbQuery.ilike('type',      `%${typeParam}%`)
    if (rarityParam)   dbQuery = dbQuery.ilike('rarity',    `%${rarityParam}%`)
    if (supertypeParam) dbQuery = dbQuery.ilike('supertype', `%${supertypeParam}%`)

    const { data, error } = await dbQuery
      .order('name')
      .limit(limit)

    if (error) {
      console.error('Card search database error:', error)
      return NextResponse.json({ error: 'Failed to search cards' }, { status: 500 })
    }

    const cards = data || []

    const transformedCards = cards.map((card) => {
      const set = Array.isArray(card.sets) ? card.sets[0] : card.sets
      return {
        id:                 card.id,
        name:               card.name || 'Unknown Card',
        image_url:          card.image || '',
        number:             card.number || '',
        rarity:             card.rarity || '',
        type:               card.type   || '',
        supertype:          card.supertype || '',
        default_variant_id: card.default_variant_id ?? null,
        set: {
          id:           card.set_id,
          name:         set?.name         || '',
          series:       set?.series       || '',
          release_date: set?.release_date || '',
          logo_url:     set?.logo_url     || '',
        },
      }
    })

    const response = NextResponse.json({
      cards:   transformedCards,
      total:   transformedCards.length,
      hasMore: false,
      query:   q ?? '',
    })
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return response
  } catch (error) {
    console.error('Card search database error:', error)
    return NextResponse.json({ error: 'Failed to search cards' }, { status: 500 })
  }
}
