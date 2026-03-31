import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/friendships/public/[userId]
 *
 * Returns the public accepted-friends list for any user.
 * Used by the profile page to display someone else's friends.
 *
 * Response: { friends: FriendEntry[] }
 *
 * FriendEntry: { friendship_id, user_id, username, display_name, avatar_url }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params

  if (!userId) {
    return NextResponse.json({ friends: [] })
  }

  // Find all accepted friendships where this user is a party
  const { data: rows, error } = await supabaseAdmin
    .from('friendships')
    .select('id, requester_id, addressee_id')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted')

  if (error) {
    console.error(`[GET /api/friendships/public/${userId}] error:`, error)
    return NextResponse.json({ friends: [] })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ friends: [] })
  }

  // Collect the OTHER user's ID for each friendship
  const friendIds = rows.map(r =>
    r.requester_id === userId ? r.addressee_id : r.requester_id
  )

  const { data: profiles } = await supabaseAdmin
    .from('users')
    .select('id, username, display_name, avatar_url')
    .in('id', friendIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

  const friends = rows.map(row => {
    const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id
    const profile = profileMap.get(otherId)
    return {
      friendship_id: row.id,
      user_id:       otherId,
      username:      profile?.username      ?? null,
      display_name:  profile?.display_name  ?? null,
      avatar_url:    profile?.avatar_url    ?? null,
    }
  })

  return NextResponse.json({ friends })
}
