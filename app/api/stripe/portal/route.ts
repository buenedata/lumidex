import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so the user can manage their
 * subscription (cancel, update payment method, view invoices).
 *
 * Requires: user must have a stripe_customer_id (i.e. has gone through checkout at least once)
 * Returns:  { url: string } — redirect user to this URL
 *
 * Prerequisite: Configure the portal in Stripe Dashboard:
 * https://dashboard.stripe.com/settings/billing/portal
 */
export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const serverClient = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await serverClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Look up Stripe customer ID ─────────────────────────────────────────────
  const { data: subscription, error: dbError } = await supabaseAdmin
    .from('user_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (dbError) {
    console.error('[stripe/portal] DB error:', dbError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No billing account found. Please subscribe first.' },
      { status: 404 }
    )
  }

  // ── Create portal session ──────────────────────────────────────────────────
  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://lumidex.app'

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${origin}/dashboard`,
  })

  return NextResponse.json({ url: portalSession.url })
}
