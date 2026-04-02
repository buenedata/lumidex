import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

export type UserSearchResult = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  friendship_status: 'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted'
  friendship_id: string | null
}

/**
 * GET /api/users/search?q=<query>
 *
 * Search for users by username or display_name (case-insensitive, min 2 chars).
 * Excludes the current user. Returns up to 20 results enriched with
 * friendship_status relative to the current user.
 */
export async function GET(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()

  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  // Search users by username or display_name (exclude self)
  // Using serverClient (cookie-based session) so it satisfies the RLS
  // "auth.role() = 'authenticated'" policy on the users table.
  const { data: users, error } = await serverClient
    .from('users')
    .select('id, username, display_name, avatar_url')
    .neq('id', user.id)
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(20)

  if (error) {
    console.error('[GET /api/users/search] query error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ results: [] })
  }

  // Batch-load all friendship rows between current user and the matched users
  const matchedIds = users.map(u => u.id)

  const { data: friendships } = await serverClient
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .or(
      matchedIds
        .map(
          id =>
            `and(requester_id.eq.${user.id},addressee_id.eq.${id}),` +
            `and(requester_id.eq.${id},addressee_id.eq.${user.id})`
        )
        .join(',')
    )

  // Build a map: other_user_id → friendship row
  const friendshipMap = new Map<string, { id: string; requester_id: string; addressee_id: string; status: string }>()
  for (const f of friendships ?? []) {
    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id
    friendshipMap.set(otherId, f)
  }

  const results: UserSearchResult[] = users.map(u => {
    const f = friendshipMap.get(u.id)

    let friendship_status: UserSearchResult['friendship_status'] = 'none'
    let friendship_id: string | null = null

    if (f) {
      friendship_id = f.id
      if (f.status === 'accepted') {
        friendship_status = 'accepted'
      } else if (f.status === 'pending') {
        friendship_status =
          f.requester_id === user.id ? 'pending_outgoing' : 'pending_incoming'
      }
    }

    return {
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      friendship_status,
      friendship_id,
    }
  })

  return NextResponse.json({ results })
}
