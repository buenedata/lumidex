import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/update-profile
 * Updates the authenticated user's profile row using the admin client
 * (bypasses RLS). The server-side session is verified first so only
 * the currently logged-in user can mutate their own row.
 */
export async function POST(request: NextRequest) {
  // 1. Verify authenticated session
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // 3. Update — always scoped to the authenticated user's id (not caller-supplied)
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update(body)
    .eq('id', user.id)

  if (updateError) {
    console.error('[update-profile] DB error:', updateError)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
