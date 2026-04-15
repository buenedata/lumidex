'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useIsPro } from '@/hooks/useProGate'

// ─── Feature data ─────────────────────────────────────────────────────────────

const FREE_FEATURES = [
  'Unlimited collection tracking (all variants)',
  'All 3 collection goals (Normal, Masterset, Grandmaster)',
  'All 36 achievements',
  'Today\'s card prices (TCGPlayer + CardMarket)',
  '7-day price history chart',
  'Today\'s total portfolio value',
  'Wanted list + 2 custom lists',
  'Friends, trades & social features',
  'Binder calculator',
  'Public profile',
]

const PRO_FEATURES = [
  { text: '14 / 30 / 90 / 365-day price history', highlight: true },
  { text: 'Portfolio value over time (historical chart)', highlight: true },
  { text: 'Price alerts — get notified when prices move', highlight: true },
  { text: 'Graded cards (PSA, BGS, CGC, TAG, ACE)', highlight: false },
  { text: 'Sealed products tracking', highlight: false },
  { text: 'Unlimited custom lists', highlight: false },
  { text: 'Collection export (CSV / JSON)', highlight: false },
  { text: 'Advanced analytics & collection insights', highlight: false },
  { text: '💎 Pro badge on your public profile', highlight: false },
  { text: 'Priority price sync (fresher data)', highlight: false },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UpgradePage() {
  const isPro = useIsPro()
  const [period, setPeriod] = useState<'monthly' | 'annual'>('annual')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start checkout')
      window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  async function handleManageBilling() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to open billing portal')
      window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white py-16 px-4">
      <div className="max-w-5xl mx-auto">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="text-center mb-14">
          <div className="text-5xl mb-4">💎</div>
          <h1 className="text-3xl sm:text-4xl font-bold font-display mb-3">
            Your collection deserves more than a snapshot.
          </h1>
          <p className="text-[#9191b0] text-lg max-w-xl mx-auto">
            Track where your cards have been, where they're going, and know the moment prices move.
          </p>
        </div>

        {/* ── Pro: already subscribed ───────────────────────────────────────── */}
        {isPro && (
          <div className="max-w-md mx-auto mb-10 text-center bg-[rgba(109,95,255,0.1)] border border-[rgba(109,95,255,0.3)] rounded-2xl p-6">
            <div className="text-3xl mb-2">✅</div>
            <h2 className="text-lg font-bold font-display mb-1">You're on Lumidex Pro</h2>
            <p className="text-[#9191b0] text-sm mb-4">All Pro features are unlocked. Manage or cancel your subscription below.</p>
            <button
              onClick={handleManageBilling}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-[#2a2a3d] text-[#9191b0]
                hover:border-[#6d5fff] hover:text-white transition-all duration-200
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Opening portal…' : 'Manage Subscription'}
            </button>
            {error && <p className="text-[#f87171] text-xs mt-2">{error}</p>}
          </div>
        )}

        {/* ── Billing toggle ────────────────────────────────────────────────── */}
        {!isPro && (
          <div className="flex items-center justify-center gap-1 bg-[#111118] border border-[#2a2a3d] rounded-full p-1 mb-10 w-fit mx-auto">
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                period === 'monthly'
                  ? 'bg-[#6d5fff] text-white shadow-[0_0_16px_rgba(109,95,255,0.4)]'
                  : 'text-[#9191b0] hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPeriod('annual')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                period === 'annual'
                  ? 'bg-[#6d5fff] text-white shadow-[0_0_16px_rgba(109,95,255,0.4)]'
                  : 'text-[#9191b0] hover:text-white'
              }`}
            >
              Annual
              <span className="text-[11px] font-bold bg-[#34d399] text-[#0a0a0f] px-2 py-0.5 rounded-full">
                SAVE 33%
              </span>
            </button>
          </div>
        )}

        {/* ── Tier cards ────────────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">

          {/* Free */}
          <div className="bg-[#111118] border border-[#2a2a3d] rounded-2xl p-7 flex flex-col">
            <div className="mb-6">
              <div className="text-xs font-bold text-[#5a5a78] uppercase tracking-widest mb-2">Free</div>
              <div className="text-3xl font-bold font-display">€0</div>
              <div className="text-[#9191b0] text-sm mt-0.5">Forever</div>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[#9191b0]">
                  <span className="text-[#5a5a78] mt-0.5 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="text-center py-2.5 rounded-xl border border-[#2a2a3d] text-[#5a5a78] text-sm font-medium">
              {isPro ? 'Included in your Plan' : 'Current Plan'}
            </div>
          </div>

          {/* Pro */}
          <div className="relative bg-[#111118] border border-[#6d5fff] rounded-2xl p-7 flex flex-col
            shadow-[0_0_0_1px_rgba(109,95,255,0.3),0_8px_48px_rgba(109,95,255,0.15)]">

            {/* Popular badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="bg-[#6d5fff] text-white text-[11px] font-bold px-3 py-1 rounded-full
                shadow-[0_0_12px_rgba(109,95,255,0.5)]">
                MOST POPULAR
              </span>
            </div>

            <div className="mb-6">
              <div className="text-xs font-bold text-[#a78bfa] uppercase tracking-widest mb-2">Pro</div>
              {period === 'monthly' ? (
                <>
                  <div className="text-3xl font-bold font-display">€4.99</div>
                  <div className="text-[#9191b0] text-sm mt-0.5">per month · billed monthly</div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold font-display">€39.99</div>
                  <div className="text-[#9191b0] text-sm mt-0.5">per year </div>
                  <div className="text-[#34d399] text-xs mt-1">€3.33/month — you save €19.89</div>
                </>
              )}
            </div>

            <div className="text-xs font-semibold text-[#5a5a78] uppercase tracking-widest mb-3">
              Everything in Free, plus:
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {PRO_FEATURES.map((f) => (
                <li key={f.text} className="flex items-start gap-2 text-sm">
                  <span className="text-[#34d399] mt-0.5 flex-shrink-0">✓</span>
                  <span className={f.highlight ? 'text-white font-medium' : 'text-[#9191b0]'}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>

            {/* Error */}
            {error && !isPro && (
              <p className="text-[#f87171] text-xs mb-3 bg-[#3b0f0f] border border-[#f87171]/30 rounded-lg px-3 py-2 text-center">
                {error}
              </p>
            )}

            {/* CTA */}
            {!isPro ? (
              <button
                onClick={handleUpgrade}
                disabled={isLoading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white
                  bg-[#6d5fff] hover:bg-[#8577ff]
                  shadow-[0_0_0_1px_rgba(109,95,255,0.5),0_4px_24px_rgba(109,95,255,0.3)]
                  hover:shadow-[0_0_0_1px_rgba(133,119,255,0.6),0_4px_32px_rgba(109,95,255,0.4)]
                  transition-all duration-200
                  disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? 'Redirecting to Stripe…'
                  : `Upgrade to Pro — ${period === 'monthly' ? '€4.99/mo' : '€39.99/yr'}`}
              </button>
            ) : (
              <div className="text-center py-2.5 rounded-xl bg-[rgba(109,95,255,0.1)] border border-[rgba(109,95,255,0.3)] text-[#a78bfa] text-sm font-bold">
                💎 Your Current Plan
              </div>
            )}
          </div>
        </div>

        {/* ── Trust strip ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#5a5a78] mb-12">
          <span>🔒 Secure payment by Stripe</span>
          <span>·</span>
          <span>🇪🇺 VAT included for EU customers</span>
          <span>·</span>
          <span>↩️ Cancel any time</span>
          <span>·</span>
          <span>📦 Your free data is yours forever</span>
        </div>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto space-y-5">
          <h2 className="text-lg font-bold font-display text-center mb-6">Common questions</h2>
          {[
            {
              q: 'What happens to my data if I cancel?',
              a: 'All your collection data — cards, sets, achievements, friends — stays exactly as-is. You lose access to Pro features, but nothing is deleted.',
            },
            {
              q: 'Will I be charged immediately?',
              a: "Yes. Your first charge is today. For annual plans, you're charged once per year. For monthly, once per month. Stripe sends a receipt to your email.",
            },
            {
              q: 'Can I switch between monthly and annual?',
              a: 'Yes. Open the billing portal via your profile settings to change your plan. If you switch to annual mid-cycle, Stripe will prorate the remaining value.',
            },
            {
              q: 'Why is price history a Pro feature?',
              a: "Storing and querying a year of price data for hundreds of thousands of card/variant combinations is expensive infrastructure. It's the feature that most directly pays for the servers.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-[#111118] border border-[#2a2a3d] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-1.5">{q}</h3>
              <p className="text-sm text-[#9191b0]">{a}</p>
            </div>
          ))}
        </div>

        {/* ── Back link ─────────────────────────────────────────────────────── */}
        <div className="text-center mt-12">
          <Link href="/dashboard" className="text-sm text-[#5a5a78] hover:text-[#9191b0] transition-colors">
            ← Back to Dashboard
          </Link>
        </div>

      </div>
    </main>
  )
}
