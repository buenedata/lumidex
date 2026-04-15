'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useSubscriptionStore } from '@/lib/store'

/**
 * /upgrade/success
 *
 * Landing page after a successful Stripe Checkout.
 * Triggers a subscription re-fetch so the UI immediately reflects Pro status
 * without requiring a full page reload.
 */
export default function UpgradeSuccessPage() {
  const fetchSubscription = useSubscriptionStore((s) => s.fetchSubscription)

  // Refresh tier in Zustand store — the webhook has already fired by the time
  // the user lands here, so the user_subscriptions row should be Pro.
  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">

        {/* ── Icon ──────────────────────────────────────────────────────────── */}
        <div className="text-6xl mb-6 animate-bounce">💎</div>

        {/* ── Headline ──────────────────────────────────────────────────────── */}
        <h1 className="text-2xl sm:text-3xl font-bold font-display mb-3">
          Welcome to Lumidex Pro!
        </h1>
        <p className="text-[#9191b0] mb-8">
          Your subscription is active. All Pro features are now unlocked.
        </p>

        {/* ── What just unlocked ────────────────────────────────────────────── */}
        <div className="bg-[#111118] border border-[rgba(109,95,255,0.3)] rounded-2xl p-6 mb-8 text-left
          shadow-[0_0_0_1px_rgba(109,95,255,0.2),0_8px_32px_rgba(109,95,255,0.1)]">
          <h2 className="text-sm font-bold text-[#a78bfa] uppercase tracking-widest mb-4">
            Now unlocked for you
          </h2>
          <ul className="space-y-2.5">
            {[
              '📈 Full price history charts (up to 1 year)',
              '💰 Portfolio value over time',
              '🔔 Price alerts',
              '🏅 Graded cards tracking',
              '📦 Sealed products tracking',
              '📋 Unlimited custom lists',
              '📤 Collection export (CSV / JSON)',
              '📊 Advanced analytics',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-[#9191b0]">
                <span className="text-[#34d399] flex-shrink-0">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center w-full py-3 rounded-xl text-sm font-bold text-white
            bg-[#6d5fff] hover:bg-[#8577ff]
            shadow-[0_0_0_1px_rgba(109,95,255,0.5),0_4px_24px_rgba(109,95,255,0.3)]
            hover:shadow-[0_0_0_1px_rgba(133,119,255,0.6),0_4px_32px_rgba(109,95,255,0.4)]
            transition-all duration-200 mb-4"
        >
          Go to Dashboard →
        </Link>

        <Link
          href="/collection"
          className="inline-flex items-center justify-center w-full py-2.5 rounded-xl text-sm font-medium
            text-[#9191b0] hover:text-white border border-[#2a2a3d] hover:border-[#3d3d56]
            transition-all duration-200"
        >
          View my Collection
        </Link>

        <p className="text-xs text-[#5a5a78] mt-6">
          A receipt has been sent to your email. Questions?{' '}
          <a href="mailto:support@lumidex.app" className="text-[#6d5fff] hover:underline">
            Contact support
          </a>
        </p>

      </div>
    </main>
  )
}
