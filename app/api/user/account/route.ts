import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * DELETE /api/user/account
 *
 * Permanently deletes the authenticated user's account from Supabase Auth.
 * The public.users row is removed automatically via the ON DELETE CASCADE
 * foreign key on users.id → auth.users.id.
 *
 * This action is irreversible.
 */
export async function DELETE() {
  // 1. Verify authenticated session
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Delete the auth user via admin client (cascades to public.users + all
  //    related rows that have ON DELETE CASCADE set up).
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

  if (deleteError) {
    console.error('[delete-account] auth.admin.deleteUser error:', deleteError)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
