import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/stories
 * Returns all published stories ordered by published_at DESC.
 * Optional query params:
 *   ?limit=N   — return only the first N stories (default: all)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : undefined

  let query = supabaseAdmin
    .from('stories')
    .select('id, slug, category, category_icon, title, description, gradient, accent_colour, cover_image_url, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  if (limit && !isNaN(limit) && limit > 0) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/stories]', error)
    return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 })
  }

  return NextResponse.json({ stories: data ?? [] })
}
