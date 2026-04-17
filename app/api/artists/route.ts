import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/artists?q={query}&limit={n}
 *
 * Returns all distinct card artists/illustrators sorted by card count descending.
 * Supports an optional `q` parameter to filter by name.
 *
 * Uses the get_artist_card_counts RPC which performs a proper SQL GROUP BY —
 * giving accurate per-artist counts regardless of DB size (no JS-side sampling).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q     = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '500', 10), 1), 1000)

  try {
    const { data, error } = await supabaseAdmin
      .rpc('get_artist_card_counts', {
        p_search: q.length > 0 ? q : null,
        p_limit:  limit,
      })

    if (error) {
      console.error('[artists] RPC error:', error)
      return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
    }

    const artists = (data ?? []).map((row: { name: string; card_count: number; sample_images: string[] | null }) => ({
      name:          row.name,
      card_count:    Number(row.card_count),
      sample_images: row.sample_images ?? [],
    }))

    const response = NextResponse.json({ artists, total: artists.length })
    // Cache for 5 minutes at edge; stale-while-revalidate for 30 minutes
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=1800')
    return response
  } catch (err) {
    console.error('[artists] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
  }
}
