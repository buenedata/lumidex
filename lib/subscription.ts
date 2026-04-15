/**
 * Subscription Tier Utilities
 *
 * Server-only helpers for reading and enforcing Lumidex membership tiers.
 * All writes to user_subscriptions are performed exclusively by the
 * Stripe webhook handler — these helpers are read-only from the app's perspective.
 *
 * Tier logic: a missing row in user_subscriptions === 'free'.
 * The application NEVER locks users out due to a DB error — all errors
 * fall back to 'free' (safe degradation, never blocks access to paid features
 * the user should have, but the alternative of accidentally granting Pro is worse
 * than occasionally failing to show Pro UI).
 */

import { createSupabaseServerClient } from './supabaseServer'
import { supabaseAdmin } from './supabase'
// Import from the client-safe constants file — re-exported here for convenience
// so callers can do: import { getUserTier, TIER_LIMITS } from '@/lib/subscription'
import type { UserTier } from './tierLimits'
import { TIER_LIMITS } from './tierLimits'
export type { UserTier }
export { TIER_LIMITS }

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserSubscription {
  id: string
  user_id: string
  tier: UserTier
  billing_period: 'monthly' | 'annual' | null
  current_period_start: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Get the membership tier for a given user ID.
 *
 * Uses the service-role admin client — safe for server-only code only.
 * Returns 'free' if no subscription row exists OR if an error occurs (fail-safe).
 *
 * @example
 * const tier = await getUserTier(user.id)
 * if (tier === 'pro') { ... }
 */
export async function getUserTier(userId: string): Promise<UserTier> {
  const { data, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[subscription] getUserTier error for user', userId, error)
    return 'free' // fail-safe: never accidentally grant Pro, but don't block on errors
  }

  return (data?.tier as UserTier) ?? 'free'
}

/**
 * Get the full subscription record for a user.
 * Returns null when no row exists (free tier by default in the application).
 */
export async function getSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[subscription] getSubscription error for user', userId, error)
    return null
  }

  return (data as UserSubscription) ?? null
}

/**
 * Returns true if the given user is on the Pro tier.
 * Convenience wrapper around getUserTier to avoid the string comparison at call sites.
 */
export async function isUserPro(userId: string): Promise<boolean> {
  return (await getUserTier(userId)) === 'pro'
}

/**
 * Assert that a user is on the Pro tier.
 * Throws a `ProRequiredError` (HTTP 402) if the user is free.
 *
 * Use this at the top of Route Handler functions to gate Pro-only API endpoints:
 *
 * @example
 * const user = await getSessionUser()
 * try {
 *   await requirePro(user.id)
 * } catch (err) {
 *   if (err instanceof ProRequiredError)
 *     return NextResponse.json({ error: err.message, code: 'PRO_REQUIRED' }, { status: 402 })
 *   throw err
 * }
 */
export async function requirePro(userId: string): Promise<void> {
  const tier = await getUserTier(userId)
  if (tier !== 'pro') {
    throw new ProRequiredError()
  }
}

// ─── Session-aware helpers (use only in Route Handlers / Server Components) ───

/**
 * Reads the authenticated user's tier from the cookie-based session.
 * Returns 'free' if the user is not authenticated.
 *
 * Only use this in Route Handlers and Server Components — not in plain server
 * utility functions that don't have access to the request context (cookies).
 */
export async function getSessionUserTier(): Promise<UserTier> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return 'free'
  return getUserTier(user.id)
}

/**
 * Reads the authenticated user from cookies and asserts they are Pro.
 * Returns the authenticated user object for convenience (e.g. to access user.id).
 * Throws `ProRequiredError` if not authenticated or not Pro.
 *
 * @example
 * export async function GET() {
 *   try {
 *     const user = await requireSessionPro()
 *     // ... Pro-only logic using user.id
 *   } catch (err) {
 *     if (err instanceof ProRequiredError)
 *       return NextResponse.json({ error: err.message, code: 'PRO_REQUIRED' }, { status: 402 })
 *     throw err
 *   }
 * }
 */
export async function requireSessionPro() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new ProRequiredError('Not authenticated')
  }

  await requirePro(user.id)
  return user
}

// ─── Limit helpers ────────────────────────────────────────────────────────────

/**
 * Returns the custom list limit for a given tier.
 * @example
 * const limit = getCustomListLimit('free') // 2
 */
export function getCustomListLimit(tier: UserTier): number {
  return TIER_LIMITS.CUSTOM_LISTS[tier]
}

/**
 * Returns the number of price history days accessible for a given tier.
 * @example
 * const days = getPriceHistoryDays('pro') // 365
 */
export function getPriceHistoryDays(tier: UserTier): number {
  return TIER_LIMITS.PRICE_HISTORY_DAYS[tier]
}

/**
 * Returns the number of portfolio history days accessible for a given tier.
 * @example
 * const days = getPortfolioHistoryDays('free') // 0 (snapshot only)
 */
export function getPortfolioHistoryDays(tier: UserTier): number {
  return TIER_LIMITS.PORTFOLIO_HISTORY_DAYS[tier]
}

// ─── Error class ──────────────────────────────────────────────────────────────

/**
 * Thrown by requirePro() and requireSessionPro() when the user lacks Pro.
 * Callers should catch this and return HTTP 402.
 *
 * @example
 * } catch (err) {
 *   if (err instanceof ProRequiredError)
 *     return NextResponse.json({ error: err.message, code: 'PRO_REQUIRED' }, { status: 402 })
 * }
 */
export class ProRequiredError extends Error {
  /** Always 402 — "Payment Required". Use to set HTTP response status. */
  readonly status = 402 as const
  /** Machine-readable code for client-side upgrade prompt routing. */
  readonly code = 'PRO_REQUIRED' as const

  constructor(message = 'This feature requires Lumidex Pro.') {
    super(message)
    this.name = 'ProRequiredError'
  }
}
