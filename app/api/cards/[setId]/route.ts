import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { getCardsBySet } from '@/lib/db'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  noStore() // always read live DB data — never serve Next.js Data Cache
  const { setId } = await params

  try {
    // Use database query instead of external API
    const cards = await getCardsBySet(setId)

    const transformedCards = cards.map((card) => ({
      id: card.id,
      set_id: card.set_id,
      name: card.name || 'Unknown Card',
      // own_image: the card's own uploaded file (null = never uploaded for this card)
      image: card.own_image ?? null,
      // source_image: the inherited image from source_card_id when no own image exists
      source_image: card.own_image ? null : (card.image ?? null),
      source_card_id: card.source_card_id ?? null,
      number: card.number || '',
      rarity: card.rarity || '',
      type: (card as any).type ?? null,
    }))

    const response = NextResponse.json(transformedCards)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('Database error fetching cards:', error)
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 })
  }
}