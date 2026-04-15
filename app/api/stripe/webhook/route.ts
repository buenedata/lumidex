import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import type Stripe from 'stripe'

/**
 * POST /api/stripe/webhook
 *
 * Receives and processes Stripe events. Verifies the webhook signature
 * using STRIPE_WEBHOOK_SECRET before processing any event.
 *
 * Handles:
 *   checkout.session.completed     → upgrade user to Pro
 *   customer.subscription.updated  → sync period dates / handle plan changes
 *   customer.subscription.deleted  → downgrade user to Free
 *   invoice.payment_failed         → log (future: notify user)
 */

// ─── Raw body required for signature verification ─────────────────────────────
// Next.js App Router: read raw body with request.text() — do NOT call .json()

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // ── Verify signature ───────────────────────────────────────────────────────
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe/webhook] Signature verification failed:', message)
    return NextResponse.json({ error: `Webhook signature invalid: ${message}` }, { status: 400 })
  }

  console.log(`[stripe/webhook] Received event: ${event.type} (${event.id})`)

  // ── Route events ───────────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        // Silently ignore unhandled events — we only subscribed to the 4 above
        break
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[stripe/webhook] Error processing ${event.type}:`, message)
    // Return 500 so Stripe will retry the webhook
    return NextResponse.json({ error: 'Internal error processing event' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Event handlers ───────────────────────────────────────────────────────────

/**
 * checkout.session.completed
 * Fired when a user successfully completes the Stripe hosted checkout.
 * Upgrades the user to Pro in user_subscriptions.
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // userId was stored in metadata when the checkout session was created
  const userId = session.metadata?.userId
  if (!userId) {
    console.error('[webhook] checkout.session.completed: missing metadata.userId', session.id)
    return
  }

  const stripeCustomerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id

  const stripeSubscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id

  if (!stripeSubscriptionId || !stripeCustomerId) {
    console.error('[webhook] checkout.session.completed: missing customer/subscription IDs', session.id)
    return
  }

  // Fetch the full subscription to get period dates
  // In Stripe API 2026+, period dates live on the SubscriptionItem, not the top-level Subscription
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
  const item = subscription.items.data[0]
  const billingPeriod = item?.plan?.interval === 'year' ? 'annual' : 'monthly'
  const periodStart = item?.current_period_start ?? subscription.billing_cycle_anchor
  const periodEnd   = item?.current_period_end   ?? null

  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .upsert(
      {
        user_id:                user_id_from(userId),
        tier:                   'pro',
        billing_period:         billingPeriod,
        current_period_start:   periodStart ? new Date(periodStart * 1000).toISOString() : null,
        current_period_end:     periodEnd   ? new Date(periodEnd   * 1000).toISOString() : null,
        stripe_customer_id:     stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[webhook] checkout.session.completed: DB upsert failed', error)
    throw error
  }

  console.log(`[webhook] ✅ User ${userId} upgraded to Pro (${billingPeriod})`)
}

/**
 * customer.subscription.updated
 * Fired on every renewal and on plan changes.
 * Syncs period dates; downgrades if subscription is no longer active.
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = await resolveUserId(subscription)
  if (!userId) return

  const isActive = subscription.status === 'active' || subscription.status === 'trialing'
  const item = subscription.items.data[0]
  const billingPeriod = item?.plan?.interval === 'year' ? 'annual' : 'monthly'
  const periodStart = item?.current_period_start ?? subscription.billing_cycle_anchor
  const periodEnd   = item?.current_period_end   ?? null

  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      tier:                 isActive ? 'pro' : 'free',
      billing_period:       isActive ? billingPeriod : null,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end:   periodEnd   ? new Date(periodEnd   * 1000).toISOString() : null,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('[webhook] customer.subscription.updated: DB update failed', error)
    throw error
  }

  console.log(`[webhook] ✅ Subscription updated for user ${userId} — status: ${subscription.status}`)
}

/**
 * customer.subscription.deleted
 * Fired after a subscription is fully cancelled (at period end).
 * Downgrades the user back to Free.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await resolveUserId(subscription)
  if (!userId) return

  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      tier:                   'free',
      billing_period:         null,
      current_period_end:     null,
      stripe_subscription_id: null,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('[webhook] customer.subscription.deleted: DB update failed', error)
    throw error
  }

  console.log(`[webhook] ✅ User ${userId} downgraded to Free (subscription deleted)`)
}

/**
 * invoice.payment_failed
 * Logged for future in-app payment failure notification.
 * Stripe will automatically retry failed payments and send reminder emails.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id

  console.warn(`[webhook] ⚠️ Payment failed for Stripe customer ${customerId} — invoice ${invoice.id}`)
  // TODO: Set a 'payment_failed' flag on user_subscriptions and show an in-app banner
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert userId string to the user_subscriptions.user_id shape */
function user_id_from(userId: string): string {
  return userId
}

/**
 * Resolve userId from a Stripe subscription object.
 * First checks subscription.metadata.userId (set on subscription_data at checkout),
 * then falls back to looking up the customer ID in user_subscriptions.
 */
async function resolveUserId(subscription: Stripe.Subscription): Promise<string | null> {
  // Primary: userId in subscription metadata (set at checkout creation)
  const metaUserId = subscription.metadata?.userId
  if (metaUserId) return metaUserId

  // Fallback: look up via stripe_customer_id in our DB
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id

  if (!customerId) {
    console.error('[webhook] resolveUserId: no customer ID on subscription', subscription.id)
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (error || !data) {
    console.error('[webhook] resolveUserId: could not find user for customer', customerId, error)
    return null
  }

  return data.user_id
}
