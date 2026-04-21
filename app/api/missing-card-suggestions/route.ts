import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

// ── POST: submit a missing-card report (public — auth optional) ───────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { card_name, set_name, card_number, variant } = body

    if (!card_name?.trim()) {
      return NextResponse.json({ error: 'card_name is required' }, { status: 400 })
    }

    // Resolve the current user if logged in.  Anonymous submissions are also fine.
    let userId: string | null = null
    try {
      const supabase = await createSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    } catch {
      // Non-fatal — anonymous submission
    }

    const { error } = await supabaseAdmin
      .from('missing_card_suggestions')
      .insert({
        card_name:    card_name.trim(),
        set_name:     set_name?.trim()    || null,
        card_number:  card_number?.trim() || null,
        variant:      variant?.trim()     || null,
        submitted_by: userId,
        status:       'pending',
      })

    if (error) {
      console.error('[missing-card-suggestions POST] Insert error:', error)
      return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[missing-card-suggestions POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── GET: list pending reports (admin only) ────────────────────────────────────
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('missing_card_suggestions')
      .select('*, users:submitted_by(id, username, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[missing-card-suggestions GET] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[missing-card-suggestions GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH: approve or dismiss a report (admin only) ───────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, status } = body // status: 'resolved' | 'dismissed'

    if (!id || !['resolved', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request: id and status (resolved|dismissed) required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('missing_card_suggestions')
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', id)

    if (error) {
      console.error('[missing-card-suggestions PATCH] Update error:', error)
      return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[missing-card-suggestions PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
