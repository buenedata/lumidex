import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

/**
 * GET /api/artists?q={query}&limit={n}
 *
 * Returns all distinct card artists/illustrators sorted by card count descending.
 * Supports an optional `q` parameter to filter by name.
 *
 * Because the Supabase anon client does not support GROUP BY, aggregation is
 * done in JS. We fetch up to 10 000 card rows (artist + image only) which is
 * memory-efficient, and then aggregate in a single Map pass.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q     = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '500', 10), 1), 1000)

  try {
    let query = supabase
      .from('cards')
      .select('artist, image')
      .not('artist', 'is', null)
      .not('artist', 'ilike', 'n/a')
      .not('artist', 'ilike', 'N/A')
      .limit(10000)

    // Server-side name filter when a query is provided
    if (q.length > 0) {
      query = query.ilike('artist', `%${q}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[artists] DB error:', error)
      return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
    }

    // JS-side aggregation: count cards per artist and collect up to 3 sample images.
    const artistMap = new Map<string, { images: string[]; count: number }>()

    for (const card of data ?? []) {
      if (!card.artist || card.artist.trim() === '' || card.artist.toLowerCase() === 'n/a') continue
      const entry = artistMap.get(card.artist)
      if (entry) {
        entry.count++
        if (entry.images.length < 3 && card.image) {
          entry.images.push(card.image)
        }
      } else {
        artistMap.set(card.artist, {
          images: card.image ? [card.image] : [],
          count: 1,
        })
      }
    }

    const artists = Array.from(artistMap.entries())
      .map(([name, { images, count }]) => ({
        name,
        card_count:    count,
        sample_images: images,
      }))
      // Safety-net: exclude any placeholder/null artist names that slipped through
      .filter(({ name }) => name.trim() !== '' && name.toLowerCase() !== 'n/a')
      .sort((a, b) => b.card_count - a.card_count)
      .slice(0, limit)

    const response = NextResponse.json({ artists, total: artists.length })
    // Cache for 5 minutes at edge; stale-while-revalidate for 30 minutes
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=1800')
    return response
  } catch (err) {
    console.error('[artists] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
  }
}
