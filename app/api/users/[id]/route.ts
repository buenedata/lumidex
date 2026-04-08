import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/users/[id]
 *
 * Returns the public profile fields for a single user by UUID.
 * Used by the Trade Hub to display the trade partner's name + avatar.
 *
 * Response: { user: { id, display_name, username, avatar_url } | null }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!id?.trim()) {
    return NextResponse.json({ user: null }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, display_name, username, avatar_url')
    .eq('id', id.trim())
    .maybeSingle()

  if (error) {
    console.error('[users/id] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ user: null }, { status: 404 })
  }

  return NextResponse.json({
    user: {
      id:           data.id,
      display_name: data.display_name ?? null,
      username:     data.username     ?? null,
      avatar_url:   data.avatar_url   ?? null,
    },
  })
}
