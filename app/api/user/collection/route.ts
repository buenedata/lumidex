import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * DELETE /api/user/collection
 *
 * Permanently deletes all card and sealed-product entries from the
 * authenticated user's collection. This action is irreversible.
 */
export async function DELETE() {
  // 1. Verify authenticated session
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id

  // 2. Delete all user card variants (the core collection rows)
  const { error: cardsError } = await supabaseAdmin
    .from('user_card_variants')
    .delete()
    .eq('user_id', userId)

  if (cardsError) {
    console.error('[delete-collection] user_card_variants error:', cardsError)
    return NextResponse.json({ error: 'Failed to reset collection' }, { status: 500 })
  }

  // 3. Delete all sealed products
  const { error: sealedError } = await supabaseAdmin
    .from('user_sealed_products')
    .delete()
    .eq('user_id', userId)

  if (sealedError) {
    console.error('[delete-collection] user_sealed_products error:', sealedError)
    return NextResponse.json({ error: 'Failed to reset sealed products' }, { status: 500 })
  }

  // 4. Delete the activity log so last-activity panel clears too
  const { error: logError } = await supabaseAdmin
    .from('user_card_activity_log')
    .delete()
    .eq('user_id', userId)

  if (logError) {
    // Non-fatal — log and continue
    console.warn('[delete-collection] activity log clear error:', logError)
  }

  return NextResponse.json({ success: true })
}
