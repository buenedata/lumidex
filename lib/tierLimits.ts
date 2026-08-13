/**
 * Tier limit constants — client & server safe.
 *
 * This file contains ONLY pure TypeScript constants with no Node.js or
 * server-only imports, so it is safe to import in both Client Components
 * and server-side code alike.
 *
 * lib/subscription.ts (server-only) re-exports these for convenience.
 * hooks/useProGate.ts (client) imports directly from here.
 */

export type UserTier = 'free' | 'pro'

/**
 * Per-tier feature limits.
 * Import this anywhere — server or client — to keep limits defined in one place.
 */
export const TIER_LIMITS = {
  /** Maximum number of user-created custom lists (excludes the built-in Wanted list). */
  CUSTOM_LISTS: {
    free: 2,
    pro: Infinity,
  },
} as const
