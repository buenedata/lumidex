import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/friendships
 *
 * Returns all friendships for the current user:
 *   {
 *     accepted:         FriendshipUser[]   – accepted friends
 *     pending_incoming: FriendshipUser[]   – requests where I'm the addressee
 *     pending_outgoing: FriendshipUser[]   – requests where I'm the requester
 *   }
 *
 * Optionally pass ?user_id=<uuid> to get the specific friendship status
 * between the current user and that user (for the FriendButton).
 *
 * FriendshipUser: { friendship_id, user_id, username, display_name, avatar_url }
 */

export async function GET(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get('user_id')

  if (targetUserId) {
    // ── Single-user lookup: return the friendship row between me and targetUserId ──
    const { data: row, error } = await supabaseAdmin
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),` +
        `and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`
      )
      .maybeSingle()

    if (error) {
      console.error('[GET /api/friendships] single lookup error:', error)
      return NextResponse.json({ friendship: null })
    }

    return NextResponse.json({ friendship: row ?? null })
  }

  // ── Full list: all friendships where I'm either party ─────────────────────────
  const { data: rows, error } = await supabaseAdmin
    .from('friendships')
    .select('id, requester_id, addressee_id, status, created_at, updated_at')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[GET /api/friendships] list error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      accepted: [],
      pending_incoming: [],
      pending_outgoing: [],
      accepted_outgoing: [],
      declined_outgoing: [],
    })
  }

  // Collect all "other" user IDs to batch-load their profiles
  const otherIds = rows.map(r =>
    r.requester_id === user.id ? r.addressee_id : r.requester_id
  )

  const { data: profiles } = await supabaseAdmin
    .from('users')
    .select('id, username, display_name, avatar_url')
    .in('id', otherIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

  const accepted: unknown[]          = []
  const pending_incoming: unknown[]  = []
  const pending_outgoing: unknown[]  = []
  const accepted_outgoing: unknown[] = []
  const declined_outgoing: unknown[] = []

  for (const row of rows) {
    const isRequester = row.requester_id === user.id
    const otherId     = isRequester ? row.addressee_id : row.requester_id
    const profile     = profileMap.get(otherId) ?? { id: otherId, username: null, display_name: null, avatar_url: null }

    const entry = {
      friendship_id: row.id,
      user_id:       otherId,
      username:      (profile as { username: string | null }).username,
      display_name:  (profile as { display_name: string | null }).display_name,
      avatar_url:    (profile as { avatar_url: string | null }).avatar_url,
      created_at:    row.created_at,
      updated_at:    row.updated_at,
    }

    if (row.status === 'accepted') {
      accepted.push(entry)
      // Also track outgoing-accepted separately for notification bell
      if (isRequester) {
        accepted_outgoing.push(entry)
      }
    } else if (row.status === 'pending') {
      if (row.addressee_id === user.id) {
        // They sent to me
        pending_incoming.push({ ...entry, friendship_id: row.id })
      } else {
        // I sent to them
        pending_outgoing.push({ ...entry, friendship_id: row.id })
      }
    } else if (row.status === 'declined' && isRequester) {
      // My outgoing request was declined → notification bell
      declined_outgoing.push(entry)
    }
  }

  return NextResponse.json({ accepted, pending_incoming, pending_outgoing, accepted_outgoing, declined_outgoing })
}

/**
 * POST /api/friendships
 *
 * Send a friend request.
 * Body: { addressee_id: string }
 * Returns: { friendship: { id, status } }
 */
export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const addresseeId: string | undefined = body?.addressee_id

  if (!addresseeId) {
    return NextResponse.json({ error: 'addressee_id is required' }, { status: 400 })
  }

  if (addresseeId === user.id) {
    return NextResponse.json({ error: 'Cannot friend yourself' }, { status: 400 })
  }

  // Check if a friendship already exists in either direction
  const { data: existing } = await supabaseAdmin
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),` +
      `and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`
    )
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ friendship: existing })
  }

  const { data, error } = await supabaseAdmin
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' })
    .select('id, status')
    .single()

  if (error) {
    console.error('[POST /api/friendships] insert error:', error)
    return NextResponse.json({ error: 'Failed to send friend request' }, { status: 500 })
  }

  return NextResponse.json({ friendship: data }, { status: 201 })
}
