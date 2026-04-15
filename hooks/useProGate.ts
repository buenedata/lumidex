'use client'

/**
 * useProGate — client-side hook for Lumidex Pro feature gating.
 *
 * Reads tier from the global Zustand subscription store (populated on sign-in).
 * Use this in any Client Component to conditionally render Pro content or
 * show an upgrade prompt.
 *
 * @example — conditional render
 * const { isPro, isLoading } = useProGate()
 * if (isLoading) return <Skeleton />
 * if (!isPro) return <UpgradePrompt feature="Price history" />
 * return <PriceHistoryChart />
 *
 * @example — inline gate
 * const { ProGate } = useProGate()
 * return <ProGate feature="graded-cards"><GradedCardsSection /></ProGate>
 */

import { useSubscriptionStore } from '@/lib/store'
// Import from the client-safe constants file — NOT from lib/subscription (server-only)
import type { UserTier } from '@/lib/tierLimits'
import { TIER_LIMITS } from '@/lib/tierLimits'

// ─── Main hook ────────────────────────────────────────────────────────────────

export interface UseProGateResult {
  /** The user's current tier. 'free' while loading (safe default). */
  tier: UserTier
  /** True if the user is on the Pro plan. */
  isPro: boolean
  /** True while the subscription is being fetched (initial load only). */
  isLoading: boolean
  /**
   * Returns true if the user can access a feature that has a per-tier limit.
   * Useful for checking whether a user has reached a numeric cap.
   *
   * @example
   * const canAddList = canAccess('CUSTOM_LISTS', currentListCount + 1)
   */
  canAccess: (limitKey: keyof typeof TIER_LIMITS, currentCount?: number) => boolean
  /**
   * Returns the numeric limit for a given feature key for the current tier.
   * Returns Infinity for unlimited Pro features.
   *
   * @example
   * const max = getLimit('CUSTOM_LISTS')  // 2 (free) or Infinity (pro)
   */
  getLimit: (limitKey: keyof typeof TIER_LIMITS) => number
}

export function useProGate(): UseProGateResult {
  const { tier, isSubscriptionLoading } = useSubscriptionStore()
  const isPro = tier === 'pro'

  function getLimit(limitKey: keyof typeof TIER_LIMITS): number {
    const limitEntry = TIER_LIMITS[limitKey] as Record<UserTier, number>
    return limitEntry[tier]
  }

  function canAccess(limitKey: keyof typeof TIER_LIMITS, currentCount = 0): boolean {
    const limit = getLimit(limitKey)
    return currentCount < limit
  }

  return {
    tier,
    isPro,
    isLoading: isSubscriptionLoading,
    canAccess,
    getLimit,
  }
}

// ─── Convenience selector hooks ────────────────────────────────────────────────

/**
 * Lightweight hook — returns just the boolean isPro flag.
 * Prefer this over useProGate() when you only need the boolean.
 *
 * @example
 * const isPro = useIsPro()
 */
export function useIsPro(): boolean {
  return useSubscriptionStore((s) => s.tier === 'pro')
}

/**
 * Lightweight hook — returns the user's tier string.
 *
 * @example
 * const tier = useTier()  // 'free' | 'pro'
 */
export function useTier(): UserTier {
  return useSubscriptionStore((s) => s.tier)
}
