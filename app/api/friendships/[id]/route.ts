import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * PATCH /api/friendships/[id]
 * Update a friendship status (accept or decline a request).
 * Only the addressee can accept/decline; either party can block.
 * Body: { status: 'accepted' | 'declined' | 'blocked' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const newStatus: string | undefined = body?.status

  if (!newStatus || !['accepted', 'declined', 'blocked'].includes(newStatus)) {
    return NextResponse.json(
      { error: 'status must be one of: accepted, declined, blocked' },
      { status: 400 }
    )
  }

  // Fetch the row first to verify the user is a party to this friendship
  const { data: row, error: fetchError } = await supabaseAdmin
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .eq('id', id)
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Friendship not found' }, { status: 404 })
  }

  // Only parties to the friendship can update it
  if (row.requester_id !== user.id && row.addressee_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Accepting/declining can only be done by the addressee
  if ((newStatus === 'accepted' || newStatus === 'declined') && row.addressee_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the request recipient can accept or decline' },
      { status: 403 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('friendships')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, status')
    .single()

  if (error) {
    console.error('[PATCH /api/friendships/[id]] update error:', error)
    return NextResponse.json({ error: 'Failed to update friendship' }, { status: 500 })
  }

  return NextResponse.json({ friendship: data })
}

/**
 * DELETE /api/friendships/[id]
 * Remove a friendship or cancel a pending request.
 * Either party may delete.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership before deleting
  const { data: row, error: fetchError } = await supabaseAdmin
    .from('friendships')
    .select('id, requester_id, addressee_id')
    .eq('id', id)
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Friendship not found' }, { status: 404 })
  }

  if (row.requester_id !== user.id && row.addressee_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('friendships')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[DELETE /api/friendships/[id]] delete error:', error)
    return NextResponse.json({ error: 'Failed to remove friendship' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
