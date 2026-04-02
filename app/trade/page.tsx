'use client'

import Link from 'next/link'

export default function TradePage() {
  return (
    <div className="min-h-screen bg-base">
      <main className="max-w-screen-md mx-auto px-6 py-16 flex flex-col items-center text-center">

        {/* Decorative background glow */}
        <div
          className="fixed inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse at 50% 20%, rgba(251,191,36,0.10) 0%, transparent 60%)',
          }}
        />

        {/* Icon */}
        <div className="relative w-24 h-24 rounded-3xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mb-6 shadow-xl">
          <span className="text-5xl" role="img" aria-label="Trade Hub">🔄</span>
        </div>

        {/* Coming Soon badge */}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-amber-400/30 text-amber-400 bg-amber-400/10 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Coming Soon
        </span>

        {/* Heading */}
        <h1
          className="text-4xl sm:text-5xl font-bold text-primary mb-4"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Trade Hub
        </h1>

        {/* Tagline */}
        <p className="text-xl text-secondary mb-6 max-w-md leading-relaxed">
          Trade cards with your friends — directly on Lumidex.
        </p>

        {/* Body copy */}
        <div className="bg-elevated border border-amber-400/20 rounded-2xl p-6 mb-8 max-w-lg text-left space-y-3">
          <h2
            className="text-sm font-semibold text-amber-400 uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            What to expect
          </h2>
          <ul className="space-y-2 text-sm text-secondary">
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              List your duplicate cards as trade offers in seconds
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              Browse your friends&apos; collections and wish lists to find matching trades
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              Automated wishlist-to-offer matching so you never miss a deal
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              No middlemen, no fees — just trainers trading with trainers
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400/50 text-sm font-semibold cursor-not-allowed"
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
