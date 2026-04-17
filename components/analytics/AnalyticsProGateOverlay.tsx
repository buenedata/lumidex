'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/analytics/AnalyticsProGateOverlay.tsx
//
// Renders children as a blurred mockup with a centered pro-gate overlay on top.
// Free users see the blurred analytics content beneath and a CTA to upgrade.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import type { ReactNode } from 'react'
import { UpgradeModal } from '@/components/upgrade/UpgradeModal'
import { ProBadge } from '@/components/upgrade/ProBadge'

interface AnalyticsProGateOverlayProps {
  children: ReactNode
}

export default function AnalyticsProGateOverlay({ children }: AnalyticsProGateOverlayProps) {
  const [showUpgrade, setShowUpgrade] = useState(false)

  return (
    <div className="relative rounded-xl overflow-hidden">

      {/* ── Blurred content beneath ── */}
      <div
        className="blur-sm pointer-events-none select-none"
        aria-hidden="true"
      >
        {children}
      </div>

      {/* ── Overlay ── */}
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10 rounded-xl">
        <div className="text-center px-6 py-8 max-w-xs">

          {/* Pro badge */}
          <div className="flex justify-center mb-4">
            <ProBadge size="md" />
          </div>

          {/* Heading */}
          <h3
            className="text-lg font-bold text-white mb-2 leading-tight"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Pro Analytics
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Unlock advanced insights about your collection — top valuable cards,
            performance tracking, and more.
          </p>

          {/* CTA */}
          <button
            onClick={() => setShowUpgrade(true)}
            className="w-full py-2.5 px-5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-semibold text-sm rounded-xl transition-colors duration-150 shadow-[0_0_16px_rgba(139,92,246,0.3)]"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>

      {/* ── Upgrade modal ── */}
      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Pro Analytics"
      />
    </div>
  )
}
