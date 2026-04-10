import { NextRequest, NextResponse } from 'next/server'
import { getCardsBySet } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const setId = searchParams.get('setId')
    
    if (!setId) {
      return NextResponse.json(
        { error: 'setId parameter is required' },
        { status: 400 }
      )
    }

    // Use database query instead of external API
    const cards = await getCardsBySet(setId)

    const transformedCards = cards.map((card) => ({
      id: card.id,
      name: card.name || 'Unknown Card',
      number: card.number || '',
      rarity: card.rarity || '',
      image_url: card.image || ''
    }))

    const response = NextResponse.json({ cards: transformedCards })
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return response
  } catch (error) {
    console.error('Database error fetching cards:', error)
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 })
  }
}