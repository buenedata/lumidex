import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/admin/stories
 * Returns ALL stories (is_published=true and false) for the admin list.
 */
export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('stories')
    .select('id, slug, category, category_icon, title, description, gradient, accent_colour, cover_image_url, is_published, published_at, created_at, updated_at')
    .order('published_at', { ascending: false })

  if (error) {
    console.error('[GET /api/admin/stories]', error)
    return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 })
  }

  return NextResponse.json({ stories: data ?? [] })
}

/**
 * POST /api/admin/stories
 * Create a new story. is_published defaults to true.
 * Body: { slug, category, category_icon, title, description, gradient,
 *         accent_colour, cover_image_url?, content, published_at? }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const required = ['slug', 'category', 'category_icon', 'title', 'description', 'gradient', 'accent_colour']
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('stories')
    .insert({
      slug:            body.slug,
      category:        body.category,
      category_icon:   body.category_icon,
      title:           body.title,
      description:     body.description,
      gradient:        body.gradient,
      accent_colour:   body.accent_colour,
      cover_image_url: body.cover_image_url ?? null,
      content:         body.content ?? [],
      is_published:    true,
      published_at:    body.published_at ?? new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/admin/stories]', error)
    // Unique slug violation
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A story with that slug already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create story' }, { status: 500 })
  }

  return NextResponse.json({ story: data }, { status: 201 })
}
