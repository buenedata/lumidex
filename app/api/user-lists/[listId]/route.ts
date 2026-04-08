import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * /api/user-lists/[listId]
 *
 * PATCH  – Update a list's name, description, or is_public flag.
 *           Body:     { name?: string, description?: string, is_public?: boolean }
 *           Response: { list: UserCardList }
 *
 * DELETE – Delete a list (cascades all items automatically via FK).
 *           Response: { deleted: true }
 */

async function getAuthUser() {
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error } = await serverClient.auth.getUser()
  if (error || !user) return null
  return user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { listId } = await params

  let body: { name?: string; description?: string; is_public?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Build the update payload — only include fields that were provided
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    patch.name = name
  }
  if (typeof body.description === 'string') {
    patch.description = body.description.trim() || null
  }
  if (typeof body.is_public === 'boolean') {
    patch.is_public = body.is_public
  }

  const { data, error: updateError } = await supabaseAdmin
    .from('user_card_lists')
    .update(patch)
    .eq('id', listId)
    .eq('user_id', user.id) // owner-guard: non-owners get 0 rows → 404 below
    .select()
    .single()

  if (updateError || !data) {
    if (updateError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }
    console.error('[user-lists PATCH] DB error:', updateError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ list: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { listId } = await params

  const { error: deleteError, count } = await supabaseAdmin
    .from('user_card_lists')
    .delete({ count: 'exact' })
    .eq('id', listId)
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('[user-lists DELETE] DB error:', deleteError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (count === 0) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}
