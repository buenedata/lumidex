'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  /** The Pro feature the user was trying to access — used to personalise the modal copy */
  feature?: string
}

const PRO_FEATURES = [
  '14/30/90/365-day price history charts',
  'Portfolio value over time',
  'Price alerts when cards move',
  'Graded cards (PSA, BGS, CGC, TAG, ACE)',
  'Sealed products tracking',
  'Unlimited custom lists',
  'Collection export (CSV / JSON)',
  'Advanced analytics & Pro profile badge',
]

export function UpgradeModal({ isOpen, onClose, feature }: UpgradeModalProps) {
  const router = useRouter()
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="p-6">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">💎</div>
          <h2 className="text-xl font-bold text-white font-display">
            Unlock Lumidex Pro
          </h2>
          {feature ? (
            <p className="text-sm text-[#9191b0] mt-1">
              <span className="text-[#a78bfa] font-medium">{feature}</span> requires a Pro subscription.
            </p>
          ) : (
            <p className="text-sm text-[#9191b0] mt-1">
              Track where your collection has been — and where it's going.
            </p>
          )}
        </div>

        {/* ── Billing toggle ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-1 bg-[#111118] border border-[#2a2a3d] rounded-full p-1 mb-5 w-fit mx-auto">
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              period === 'monthly'
                ? 'bg-[#6d5fff] text-white shadow-[0_0_12px_rgba(109,95,255,0.4)]'
                : 'text-[#9191b0] hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPeriod('annual')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              period === 'annual'
                ? 'bg-[#6d5fff] text-white shadow-[0_0_12px_rgba(109,95,255,0.4)]'
                : 'text-[#9191b0] hover:text-white'
            }`}
          >
            Annual
            <span className="text-[10px] font-bold bg-[#34d399] text-[#0a0a0f] px-1.5 py-0.5 rounded-full">
              SAVE 33%
            </span>
          </button>
        </div>

        {/* ── Price display ─────────────────────────────────────────────────── */}
        <div className="text-center mb-5">
          {period === 'monthly' ? (
            <div>
              <span className="text-3xl font-bold text-white font-display">€4.99</span>
              <span className="text-[#9191b0] text-sm ml-1">/ month</span>
            </div>
          ) : (
            <div>
              <span className="text-3xl font-bold text-white font-display">€39.99</span>
              <span className="text-[#9191b0] text-sm ml-1">/ year</span>
              <div className="text-xs text-[#34d399] mt-0.5">€3.33/month — save €19.89 vs monthly</div>
            </div>
          )}
        </div>

        {/* ── Features list ─────────────────────────────────────────────────── */}
        <ul className="space-y-2 mb-6">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-[#9191b0]">
              <span className="text-[#34d399] flex-shrink-0">✓</span>
              <span className={f === feature ? 'text-white font-medium' : ''}>{f}</span>
            </li>
          ))}
        </ul>

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <p className="text-[#f87171] text-sm text-center mb-3 bg-[#3b0f0f] border border-[#f87171]/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
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
          {isLoading ? 'Redirecting to Stripe…' : `Upgrade to Pro — ${period === 'monthly' ? '€4.99/mo' : '€39.99/yr'}`}
        </button>

        {/* ── Footer note ───────────────────────────────────────────────────── */}
        <p className="text-center text-xs text-[#5a5a78] mt-3">
          Cancel any time · Secure payment by Stripe · VAT included
        </p>
      </div>
    </Modal>
  )
}
