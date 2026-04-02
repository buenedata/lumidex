'use client'

import Link from 'next/link'

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-base">
      <main className="max-w-screen-md mx-auto px-6 py-16 flex flex-col items-center text-center">

        {/* Decorative background glow */}
        <div
          className="fixed inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse at 50% 20%, rgba(52,211,153,0.10) 0%, transparent 60%)',
          }}
        />

        {/* Icon */}
        <div className="relative w-24 h-24 rounded-3xl bg-price/10 border border-price/30 flex items-center justify-center mb-6 shadow-xl">
          <span className="text-5xl" role="img" aria-label="Marketplace">🏪</span>
        </div>

        {/* Coming Soon badge */}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-price/30 text-price bg-price/10 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-price animate-pulse" />
          Coming Soon
        </span>

        {/* Heading */}
        <h1
          className="text-4xl sm:text-5xl font-bold text-primary mb-4"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Marketplace
        </h1>

        {/* Tagline */}
        <p className="text-xl text-secondary mb-6 max-w-md leading-relaxed">
          Buy and sell Pokémon cards directly on Lumidex.
        </p>

        {/* Body copy */}
        <div className="bg-elevated border border-price/20 rounded-2xl p-6 mb-8 max-w-lg text-left space-y-3">
          <h2
            className="text-sm font-semibold text-price uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            What to expect
          </h2>
          <ul className="space-y-2 text-sm text-secondary">
            <li className="flex items-start gap-2">
              <span className="text-price mt-0.5">•</span>
              List cards for sale directly from your collection with real-time price suggestions
            </li>
            <li className="flex items-start gap-2">
              <span className="text-price mt-0.5">•</span>
              Browse listings in your preferred local currency with no hidden fees
            </li>
            <li className="flex items-start gap-2">
              <span className="text-price mt-0.5">•</span>
              Price history charts so you know exactly what to pay or charge
            </li>
            <li className="flex items-start gap-2">
              <span className="text-price mt-0.5">•</span>
              Secure transactions between verified Lumidex members
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-price/10 border border-price/30 text-price/50 text-sm font-semibold cursor-not-allowed"
          >
            🔔 Notify Me When It&apos;s Live
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface border border-subtle text-secondary text-sm font-medium hover:text-primary hover:border-accent/50 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Footer line */}
        <p className="mt-12 text-xs text-muted">
          More features coming to Lumidex — stay tuned 🚀
        </p>
      </main>
    </div>
  )
}
