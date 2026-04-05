import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import { checkAndUnlockAchievements } from '@/lib/achievements'

/**
 * /api/wanted-cards
 *
 * GET    – Returns the authenticated user's wanted card IDs
 *          Response: { wantedCardIds: string[] }
 *
 * POST   – Adds a card to the user's wanted list
 *          Body:     { cardId: string }
 *          Response: { isWanted: true }
 *
 * DELETE – Removes a card from the user's wanted list
 *          Body:     { cardId: string }
 *          Response: { isWanted: false }
 */

async function getAuthUser() {
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error } = await serverClient.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET(_request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('wanted_cards')
    .select('card_id')
    .eq('user_id', user.id)

  if (error) {
    console.error('[wanted-cards GET] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({
    wantedCardIds: (data ?? []).map((row: { card_id: string }) => row.card_id),
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { cardId } = await request.json()
  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('wanted_cards')
    .upsert(
      { user_id: user.id, card_id: cardId },
      { onConflict: 'user_id,card_id' },
    )

  if (error) {
    console.error('[wanted-cards POST] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Fire-and-forget: check & unlock any newly earned achievements
  checkAndUnlockAchievements(user.id, supabaseAdmin).catch(err =>
    console.error('[wanted-cards] achievement check failed:', err)
  )

  return NextResponse.json({ isWanted: true })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { cardId } = await request.json()
  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('wanted_cards')
    .delete()
    .eq('user_id', user.id)
    .eq('card_id', cardId)

  if (error) {
    console.error('[wanted-cards DELETE] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ isWanted: false })
}
