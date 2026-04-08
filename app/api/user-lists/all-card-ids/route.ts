import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/user-lists/all-card-ids
 *
 * Returns all card IDs that appear in ANY of the authenticated user's
 * custom lists.  Called once when the first card modal opens, alongside
 * the wanted-cards fetch, so the star icon can correctly reflect list
 * membership (star fills yellow if the card is wanted OR in any list).
 *
 * Response: { cardIds: string[] }
 */

export async function GET(_request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Join through user_card_lists to scope items to this user
  const { data, error } = await supabaseAdmin
    .from('user_card_list_items')
    .select('card_id, user_card_lists!inner(user_id)')
    .eq('user_card_lists.user_id', user.id)

  if (error) {
    console.error('[all-card-ids GET] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const cardIds = [...new Set((data ?? []).map((row: { card_id: string }) => row.card_id))]

  return NextResponse.json({ cardIds })
}
