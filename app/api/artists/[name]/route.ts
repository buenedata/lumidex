import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

/**
 * GET /api/artists/[name]
 *
 * Returns all cards illustrated by a specific artist.
 * The name param is URL-decoded and matched case-insensitively.
 *
 * Response: { artist: string, cards: ArtistCard[], totalCards: number }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params
  const artistName = decodeURIComponent(name).trim()

  if (!artistName) {
    return NextResponse.json({ error: 'Artist name is required' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('cards')
      .select('id, name, image, set_id, number, rarity')
      .ilike('artist', artistName)
      .order('set_id', { ascending: true })
      .order('number', { ascending: true })
      .limit(2000)

    if (error) {
      console.error('[artists/[name]] DB error:', error)
      return NextResponse.json({ error: 'Failed to fetch artist cards' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: `No cards found for artist "${artistName}"` },
        { status: 404 },
      )
    }

    // Use the canonical artist name from the first card (preserves original casing)
    const response = NextResponse.json({
      artist:     artistName,
      cards:      data,
      totalCards: data.length,
    })
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=1800')
    return response
  } catch (err) {
    console.error('[artists/[name]] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to fetch artist cards' }, { status: 500 })
  }
}
