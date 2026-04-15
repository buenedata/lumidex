import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Admin-only subscription management endpoints.
 *
 * GET  /api/admin/subscriptions?q=username
 *   Returns matching users with their current subscription tier.
 *
 * POST /api/admin/subscriptions
 *   Body: { userId: string, tier: 'pro' | 'free', note?: string }
 *   Manually grants or revokes Pro for a user (no Stripe payment required).
 *   Sets billing_period = null and stripe_subscription_id = null so the app
 *   knows this is a manually-granted, non-Stripe subscription.
 */

// ─── GET — search users + their tiers ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  // Fetch up to 50 users matching the search query (username or email)
  const usersQuery = supabaseAdmin
    .from('users')
    .select('id, username, display_name, email, role, avatar_url, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) {
    usersQuery.or(`username.ilike.%${q}%,email.ilike.%${q}%,display_name.ilike.%${q}%`)
  }

  const { data: users, error: usersError } = await usersQuery

  if (usersError) {
    console.error('[admin/subscriptions GET] users query error:', usersError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!users?.length) {
    return NextResponse.json({ users: [] })
  }

  // Fetch subscription rows for these users in one query
  const userIds = users.map((u) => u.id)
  const { data: subs } = await supabaseAdmin
    .from('user_subscriptions')
    .select('user_id, tier, billing_period, current_period_end, stripe_subscription_id')
    .in('user_id', userIds)

  const subMap = new Map((subs ?? []).map((s) => [s.user_id, s]))

  const result = users.map((u) => {
    const sub = subMap.get(u.id)
    return {
      id:                u.id,
      username:          u.username,
      display_name:      u.display_name,
      email:             u.email,
      role:              u.role,
      avatar_url:        u.avatar_url,
      tier:              sub?.tier ?? 'free',
      billing_period:    sub?.billing_period ?? null,
      current_period_end:sub?.current_period_end ?? null,
      is_manual_grant:   sub?.tier === 'pro' && !sub?.stripe_subscription_id,
    }
  })

  return NextResponse.json({ users: result })
}

// ─── POST — grant or revoke Pro ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { userId?: string; tier?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { userId, tier } = body
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }
  if (tier !== 'pro' && tier !== 'free') {
    return NextResponse.json({ error: 'tier must be "pro" or "free"' }, { status: 400 })
  }

  // Verify the user exists
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, username')
    .eq('id', userId)
    .single()

  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (tier === 'pro') {
    // Grant Pro — manual grant, no Stripe IDs, no billing period
    const { error } = await supabaseAdmin
      .from('user_subscriptions')
      .upsert(
        {
          user_id:                userId,
          tier:                   'pro',
          billing_period:         null,   // manually granted — no Stripe billing cycle
          current_period_start:   null,
          current_period_end:     null,
          stripe_subscription_id: null,   // distinguishes manual grants from paid subs
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('[admin/subscriptions POST] grant error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    console.log(`[admin] ✅ Manually granted Pro to user ${user.username} (${userId})`)
    return NextResponse.json({
      success: true,
      message: `Granted Pro to @${user.username}`,
      tier: 'pro',
    })
  } else {
    // Revoke Pro — reset to free, preserve stripe_customer_id so they can still use the portal
    const { error } = await supabaseAdmin
      .from('user_subscriptions')
      .update({
        tier:                   'free',
        billing_period:         null,
        current_period_start:   null,
        current_period_end:     null,
        stripe_subscription_id: null,
      })
      .eq('user_id', userId)

    if (error) {
      console.error('[admin/subscriptions POST] revoke error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    console.log(`[admin] ✅ Revoked Pro from user ${user.username} (${userId})`)
    return NextResponse.json({
      success: true,
      message: `Revoked Pro from @${user.username}`,
      tier: 'free',
    })
  }
}
