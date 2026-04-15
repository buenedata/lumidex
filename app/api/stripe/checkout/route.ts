import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import { stripe, STRIPE_PRICES, type BillingPeriod } from '@/lib/stripe'

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the selected billing period
 * and returns the hosted Stripe URL to redirect the user to.
 *
 * Body:   { period: 'monthly' | 'annual' }
 * Returns: { url: string }
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

  // ── Validate body ─────────────────────────────────────────────────────────
  let body: { period?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const period = body.period as BillingPeriod
  if (!period || !STRIPE_PRICES[period]) {
    return NextResponse.json(
      { error: 'period must be "monthly" or "annual"' },
      { status: 400 }
    )
  }

  const priceId = STRIPE_PRICES[period]

  // ── Look up or create Stripe Customer ─────────────────────────────────────
  // Check if user already has a stripe_customer_id stored
  const { data: subscription } = await supabaseAdmin
    .from('user_subscriptions')
    .select('stripe_customer_id, tier')
    .eq('user_id', user.id)
    .maybeSingle()

  // If already Pro, don't allow creating a new checkout session
  if (subscription?.tier === 'pro') {
    return NextResponse.json(
      { error: 'You are already subscribed to Lumidex Pro.' },
      { status: 409 }
    )
  }

  let stripeCustomerId = subscription?.stripe_customer_id ?? null

  if (!stripeCustomerId) {
    // Create a new Stripe Customer tied to this user
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: {
        userId: user.id,
        // Belt-and-suspenders: also store on customer so webhook can resolve userId
        // even if user_subscriptions row doesn't exist yet
      },
    })
    stripeCustomerId = customer.id

    // Persist the customer ID immediately so the portal route can use it
    // even before checkout completes
    await supabaseAdmin.from('user_subscriptions').upsert(
      {
        user_id: user.id,
        tier: 'free',
        stripe_customer_id: stripeCustomerId,
      },
      { onConflict: 'user_id' }
    )
  }

  // ── Create Checkout Session ───────────────────────────────────────────────
  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://lumidex.app'

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/upgrade`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    // Automatic tax collection (handles EU VAT)
    automatic_tax: { enabled: true },
    customer_update: {
      address: 'auto',
      name: 'auto',
    },
    subscription_data: {
      metadata: {
        userId: user.id,
      },
    },
    metadata: {
      userId: user.id,
    },
  })

  if (!session.url) {
    console.error('[stripe/checkout] No URL in checkout session', session.id)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
