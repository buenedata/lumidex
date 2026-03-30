import { NextRequest, NextResponse } from 'next/server'
import { getCardsBySet } from '@/lib/db'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const { setId } = await params

  try {
    // Use database query instead of external API
    const cards = await getCardsBySet(setId)

    const transformedCards = cards.map((card) => ({
      id: card.id,
      set_id: card.set_id,
      name: card.name || 'Unknown Card',
      image: card.image ?? null,
      number: card.number || '',
      rarity: card.rarity || ''
    }))

    const response = NextResponse.json(transformedCards)
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return response
  } catch (error) {
    console.error('Database error fetching cards:', error)
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 })
  }
}