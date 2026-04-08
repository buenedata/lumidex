import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * /api/user-lists/card/[cardId]
 *
 * GET – Returns the IDs of all custom lists belonging to the authenticated user
 *        that contain the given card.  Used by AddToListDropdown to show
 *        checkmark indicators for lists already containing the open card.
 *
 *       Response: { listIds: string[] }
 */

async function getAuthUser() {
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error } = await serverClient.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { cardId } = await params

  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  // Find all list items for this card where the parent list belongs to this user
  const { data, error: dbError } = await supabaseAdmin
    .from('user_card_list_items')
    .select('list_id, user_card_lists!inner(user_id)')
    .eq('card_id', cardId)
    .eq('user_card_lists.user_id', user.id)

  if (dbError) {
    console.error('[user-lists/card GET] DB error:', dbError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const listIds = (data ?? []).map((row: { list_id: string }) => row.list_id)

  return NextResponse.json({ listIds })
}
