import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

/**
 * GET /api/artists/search?q={query}&limit={n}
 *
 * Returns a list of distinct card artists matching the query string,
 * sorted by card count descending. Each artist entry includes up to
 * 3 sample card images for display in the Browse page artist gallery.
 *
 * Implemented as a JS-side aggregation over a Supabase query because
 * the anon client does not support GROUP BY. We cap the raw fetch at
 * 1 000 rows to keep memory usage bounded.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q     = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10), 1), 100)

  if (q.length < 1) {
    return NextResponse.json({ artists: [] })
  }

  try {
    const { data, error } = await supabase
      .from('cards')
      .select('artist, image')
      .ilike('artist', `%${q}%`)
      .not('artist', 'is', null)
      .limit(1000)

    if (error) {
      console.error('[artists/search] DB error:', error)
      return NextResponse.json({ error: 'Failed to search artists' }, { status: 500 })
    }

    // Aggregate by artist in JS: count cards and collect up to 3 sample images.
    const artistMap = new Map<string, { images: string[]; count: number }>()

    for (const card of data ?? []) {
      if (!card.artist) continue
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
      .map(([name, { images, count }]) => ({ name, card_count: count, sample_images: images }))
      .sort((a, b) => b.card_count - a.card_count)
      .slice(0, limit)

    const response = NextResponse.json({ artists })
    response.headers.set('Cache-Control', 's-maxage=120, stale-while-revalidate=600')
    return response
  } catch (err) {
    console.error('[artists/search] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to search artists' }, { status: 500 })
  }
}
