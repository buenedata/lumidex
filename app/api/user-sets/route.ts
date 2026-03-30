import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import { CollectionGoal } from '@/types'

const VALID_GOALS: CollectionGoal[] = ['normal', 'masterset', 'grandmasterset']

// ── GET /api/user-sets?setId=xxx ─────────────────────────────────────────────
// Returns the authenticated user's user_sets row for the given set (if any).
// 401 when unauthenticated, 400 when setId is missing.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const setId = searchParams.get('setId')

  if (!setId) {
    return NextResponse.json({ error: 'setId query param is required' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('user_sets')
    .select('id, user_id, set_id, collection_goal, created_at')
    .eq('user_id', user.id)
    .eq('set_id', setId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching user set:', error)
    return NextResponse.json({ error: 'Failed to fetch user set' }, { status: 500 })
  }

  // No row = user hasn't added this set yet → return null with 200
  const response = NextResponse.json(data ?? null)
  response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  return response
}

// ── PATCH /api/user-sets ─────────────────────────────────────────────────────
// Upserts a user_sets row, setting (or updating) the collection_goal.
// Body: { setId: string, collection_goal: CollectionGoal }
// Creates the row if it doesn't exist, updates collection_goal if it does.
export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { setId?: string; collection_goal?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { setId, collection_goal } = body

  if (!setId) {
    return NextResponse.json({ error: 'setId is required' }, { status: 400 })
  }

  if (!collection_goal || !VALID_GOALS.includes(collection_goal as CollectionGoal)) {
    return NextResponse.json(
      { error: `collection_goal must be one of: ${VALID_GOALS.join(', ')}` },
      { status: 400 }
    )
  }

  // Upsert: create row if absent, update collection_goal if present
  const { data, error } = await supabaseAdmin
    .from('user_sets')
    .upsert(
      {
        user_id: user.id,
        set_id: setId,
        collection_goal: collection_goal as CollectionGoal,
      },
      { onConflict: 'user_id,set_id' }
    )
    .select('id, user_id, set_id, collection_goal, created_at')
    .single()

  if (error) {
    console.error('Error upserting user set:', error)
    return NextResponse.json({ error: 'Failed to update collection goal' }, { status: 500 })
  }

  return NextResponse.json(data)
}
