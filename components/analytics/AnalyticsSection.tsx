'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/analytics/AnalyticsSection.tsx
//
// Top-level section component for Pro Analytics on the collection page.
//
//  - Uses useProGate() to check subscription status.
//  - Pro users:      rendered full analytics UI (portfolio chart + tabs)
//  - Free users:     renders same content but wrapped in AnalyticsProGateOverlay
//                    so the analytics appear blurred with an upgrade CTA on top.
//
//  Portfolio history is fetched HERE (not inside PortfolioValueChart) so the
//  range state can be managed centrally and the chart receives typed props.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useProGate } from '@/hooks/useProGate'
import { ProBadge } from '@/components/upgrade/ProBadge'
import PortfolioValueChart from './PortfolioValueChart'
import CollectionAnalytics from './CollectionAnalytics'
import AnalyticsProGateOverlay from './AnalyticsProGateOverlay'
import type { PortfolioHistoryPoint } from './types'

// ── API response type ─────────────────────────────────────────────────────────

interface ApiSnapshot {
  date: string
  totalValueEur: number
  cardCount: number
  setCount: number
}

interface PortfolioHistoryResponse {
  snapshots: ApiSnapshot[]
  change: {
    valueEur: number
    changePercent: number
    direction: 'up' | 'down' | 'flat'
  }
  currency: 'EUR'
}

type RangeOption = '7d' | '30d' | '90d' | '1y'

// ── Helper: map API camelCase snapshots to component snake_case type ──────────

function mapSnapshots(snapshots: ApiSnapshot[]): PortfolioHistoryPoint[] {
  return snapshots.map(s => ({
    date:            s.date,
    total_value_eur: s.totalValueEur,
    card_count:      s.cardCount,
  }))
}

// ── Loading skeleton (shown while isPro status resolves) ─────────────────────

function SectionSkeleton() {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-6">
        <div className="animate-pulse bg-gray-700 rounded h-7 w-52" />
        <div className="animate-pulse bg-gray-700 rounded h-5 w-20" />
      </div>
      <div className="animate-pulse bg-gray-700 rounded-xl h-72 mb-6" />
      <div className="animate-pulse bg-gray-700 rounded h-10 w-full mb-4" />
      <div className="animate-pulse bg-gray-700 rounded-xl h-56" />
    </section>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AnalyticsSection() {
  const { isPro, isLoading: proLoading } = useProGate()

  const [range, setRange]                     = useState<RangeOption>('30d')
  const [portfolioData, setPortfolioData]     = useState<PortfolioHistoryPoint[]>([])
  const [portfolioLoading, setPortfolioLoading] = useState(true)
  const [portfolioError, setPortfolioError]   = useState<string | null>(null)

  useEffect(() => {
    // Don't fetch while we still don't know the pro status
    if (proLoading) return

    // For free users we still render the blurred mockup, but skip the fetch
    // (it would return 402 anyway). The chart will show its "no data" state.
    if (!isPro) {
      setPortfolioLoading(false)
      return
    }

    let cancelled = false
    setPortfolioLoading(true)
    setPortfolioError(null)

    fetch(`/api/analytics/portfolio-history?range=${range}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? `Request failed (${res.status})`)
        }
        return res.json() as Promise<PortfolioHistoryResponse>
      })
      .then(data => {
        if (!cancelled) setPortfolioData(mapSnapshots(data.snapshots))
      })
      .catch(err => {
        if (!cancelled) {
          setPortfolioError(err instanceof Error ? err.message : 'Failed to load history')
        }
      })
      .finally(() => {
        if (!cancelled) setPortfolioLoading(false)
      })

    return () => { cancelled = true }
  }, [isPro, proLoading, range])

  // Still resolving subscription status
  if (proLoading) return <SectionSkeleton />

  // ── Content tree (shared between pro/free renders) ────────────────────────

  const analyticsContent = (
    <>
      {/* Portfolio Value Over Time */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Portfolio Value Over Time
        </h3>
        {portfolioError ? (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 text-sm text-gray-400 text-center">
            Failed to load portfolio history: {portfolioError}
          </div>
        ) : (
          <PortfolioValueChart
            data={portfolioData}
            range={range}
            onRangeChange={r => setRange(r as RangeOption)}
            isLoading={portfolioLoading}
          />
        )}
      </div>

      {/* Collection Analytics tabs */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <CollectionAnalytics />
      </div>
    </>
  )

  return (
    <section className="mt-10">

      {/* ── Section header ── */}
      <div className="flex items-center gap-2.5 mb-6">
        <h2
          className="text-xl font-bold text-white"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          📊 Collection Analytics
        </h2>
        <ProBadge size="sm" />
      </div>

      {/* ── Pro / Free render ── */}
      {isPro ? (
        analyticsContent
      ) : (
        <AnalyticsProGateOverlay>
          {analyticsContent}
        </AnalyticsProGateOverlay>
      )}
    </section>
  )
}
