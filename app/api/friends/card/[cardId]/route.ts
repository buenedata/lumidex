import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/friends/card/[cardId]
 *
 * Returns accepted friends of the authenticated user who own
 * the given card, along with their per-variant quantities.
 *
 * Response:
 *   { friends: FriendCardOwner[] }
 *
 * FriendCardOwner:
 *   {
 *     userId:    string
 *     username:  string | null
 *     avatarUrl: string | null
 *     variants:  { variantName: string; quantity: number }[]
 *   }
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params

  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const serverClient = await createSupabaseServerClient()
  const { data: { user } } = await serverClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ friends: [] })   // Not logged in → empty, not an error
  }

  // ── 2. Fetch accepted friend IDs via the accepted_friends view ───────────────
  const { data: friendRows, error: friendErr } = await supabaseAdmin
    .from('accepted_friends')
    .select('friend_id')
    .eq('user_id', user.id)

  if (friendErr) {
    // View might not exist yet (migration not run) — return empty gracefully
    console.warn('[friends/card] accepted_friends view error (migration pending?):', friendErr.message)
    return NextResponse.json({ friends: [] })
  }

  if (!friendRows || friendRows.length === 0) {
    return NextResponse.json({ friends: [] })
  }

  const friendIds = friendRows.map((r: { friend_id: string }) => r.friend_id)

  // ── 3. Find which friends own this card + their variant breakdown ─────────────
  // Join: user_card_variants × variants × users, filtered to this card + our friend list
  const { data: ownerRows, error: ownerErr } = await supabaseAdmin
    .from('user_card_variants')
    .select(`
      user_id,
      quantity,
      variants ( name ),
      users    ( username, avatar_url )
    `)
    .eq('card_id', cardId)
    .in('user_id', friendIds)
    .gt('quantity', 0)

  if (ownerErr) {
    console.error('[friends/card] ownerRows error:', ownerErr)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // ── 4. Group by user ─────────────────────────────────────────────────────────
  const byUser = new Map<string, {
    userId:    string
    username:  string | null
    avatarUrl: string | null
    variants:  { variantName: string; quantity: number }[]
  }>()

  for (const row of ownerRows ?? []) {
    const uid = row.user_id as string
    if (!byUser.has(uid)) {
      // Supabase returns FK relations as arrays — take the first element
      const usersArr = (row.users as unknown) as { username: string | null; avatar_url: string | null }[] | null
      const userObj  = Array.isArray(usersArr) ? usersArr[0] : usersArr
      byUser.set(uid, {
        userId:    uid,
        username:  userObj?.username  ?? null,
        avatarUrl: userObj?.avatar_url ?? null,
        variants:  [],
      })
    }
    const variantsArr = (row.variants as unknown) as { name: string }[] | null
    const varObj      = Array.isArray(variantsArr) ? variantsArr[0] : variantsArr
    if (varObj?.name) {
      byUser.get(uid)!.variants.push({
        variantName: varObj.name,
        quantity:    row.quantity as number,
      })
    }
  }

  return NextResponse.json({ friends: Array.from(byUser.values()) })
}
