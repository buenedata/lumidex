import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/admin/stories/[id]
 * Returns a single story by id, including full content, for the edit page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('stories')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }

  return NextResponse.json({ story: data })
}

/**
 * PATCH /api/admin/stories/[id]
 * Partial update of any story field.
 * Updating slug, content, title, description, gradient, cover_image_url, etc.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Whitelist updatable fields
  const allowed = [
    'slug', 'category', 'category_icon', 'title', 'description',
    'gradient', 'accent_colour', 'cover_image_url', 'content',
    'is_published', 'published_at',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // ── Safety guard: never overwrite real content with an empty array ──────────
  // A stale browser bundle (old client JS) may send content:[] when the edit
  // page hasn't loaded the existing blocks yet. We protect against data loss by
  // checking the database before applying an empty-array content update.
  if (
    'content' in updates &&
    Array.isArray(updates.content) &&
    (updates.content as unknown[]).length === 0
  ) {
    const { data: existing } = await supabaseAdmin
      .from('stories')
      .select('content')
      .eq('id', id)
      .single()

    const existingBlocks = existing?.content
    if (Array.isArray(existingBlocks) && existingBlocks.length > 0) {
      // The database already has content — keep it, drop the empty update
      delete updates.content
    }
  }

  const { data, error } = await supabaseAdmin
    .from('stories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error(`[PATCH /api/admin/stories/${id}]`, error)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A story with that slug already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to update story' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }

  return NextResponse.json({ story: data })
}

/**
 * DELETE /api/admin/stories/[id]
 * Permanently delete a story by id.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('stories')
    .delete()
    .eq('id', id)

  if (error) {
    console.error(`[DELETE /api/admin/stories/${id}]`, error)
    return NextResponse.json({ error: 'Failed to delete story' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
