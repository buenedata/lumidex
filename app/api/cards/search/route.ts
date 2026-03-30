import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q || q.trim().length === 0) {
    const emptyResponse = NextResponse.json({ cards: [], total: 0, hasMore: false, query: '' })
    emptyResponse.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return emptyResponse
  }

  try {
    // Parse compound queries like "Serperior 6" → name="Serperior", number="6"
    // If last token starts with a digit it is treated as a card number filter.
    const parts = q.trim().split(/\s+/)
    const lastPart = parts[parts.length - 1]
    const isNumberToken = /^\d/.test(lastPart)

    let namePart: string | null = null
    let numberPart: string | null = null

    if (isNumberToken && parts.length > 1) {
      // e.g. "Serperior 6" → name "Serperior", number "6"
      namePart = parts.slice(0, -1).join(' ')
      numberPart = lastPart
    } else if (isNumberToken) {
      // e.g. "6" → number only
      numberPart = lastPart
    } else {
      // e.g. "Serperior" → name only
      namePart = q.trim()
    }

    // Join cards with their set so we can display set name, series, and release_date
    let dbQuery = supabase
      .from('cards')
      .select('id, name, number, rarity, image, set_id, default_variant_id, sets!inner(name, series, release_date)')

    if (namePart) {
      dbQuery = dbQuery.ilike('name', `%${namePart}%`)
    }
    if (numberPart) {
      dbQuery = dbQuery.ilike('number', `%${numberPart}%`)
    }

    const { data, error } = await dbQuery
      .order('name')
      .limit(50)

    if (error) {
      console.error('Card search database error:', error)
      return NextResponse.json({ error: 'Failed to search cards' }, { status: 500 })
    }

    const cards = data || []

    // Transform to match frontend SearchResponse interface
    const transformedCards = cards.map((card) => {
      const set = Array.isArray(card.sets) ? card.sets[0] : card.sets
      return {
        id: card.id,
        name: card.name || 'Unknown Card',
        image_url: card.image || '',
        number: card.number || '',
        rarity: card.rarity || '',
        default_variant_id: card.default_variant_id ?? null,
        set: {
          id: card.set_id,
          name: set?.name || '',
          series: set?.series || '',
          release_date: set?.release_date || ''
        }
      }
    })

    const response = NextResponse.json({
      cards: transformedCards,
      total: transformedCards.length,
      hasMore: false,
      query: q
    })
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return response
  } catch (error) {
    console.error('Card search database error:', error)
    return NextResponse.json({ error: 'Failed to search cards' }, { status: 500 })
  }
}