'use client'

import { useState, useEffect, useCallback } from 'react'
import { XMarkIcon, BookOpenIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import {
  CollectionGoal,
  COLLECTION_GOAL_LABELS,
} from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface BinderStats {
  normalCount:       number
  mastersetCount:    number
  grandmasterCount:  number
}

interface BinderCalculatorModalProps {
  isOpen:       boolean
  onClose:      () => void
  setId:        string
  setName:      string
  currentGoal:  CollectionGoal
  hasPromos:    boolean
}

// ── Binder size data ──────────────────────────────────────────────────────────

/**
 * standardSizes: real binder page counts available for that pocket format, sorted ascending.
 * Each entry maps to a product that actually exists in the market.
 *
 *   12-pocket (3×4)  →  40 pages only  (480 card capacity)
 *    9-pocket (3×3)  →  20 or 40 pages (180 / 360 card capacity)
 *    4-pocket (2×2)  →  40 pages only  (160 card capacity)
 */
const POCKET_SIZES: { label: string; perPage: number; standardSizes: number[] }[] = [
  { label: '12-pocket pages (3×4)', perPage: 12, standardSizes: [40]     },
  { label: '9-pocket pages (3×3)',  perPage: 9,  standardSizes: [20, 40] },
  { label: '4-pocket pages (2×2)',  perPage: 4,  standardSizes: [40]     },
]

const GOAL_ICONS: Record<CollectionGoal, string> = {
  normal:         '📦',
  masterset:      '⭐',
  grandmasterset: '👑',
}

const GOAL_DESCRIPTIONS: Record<CollectionGoal, string> = {
  normal:         '1 of any variant per card',
  masterset:      'All variants, excl. promos',
  grandmasterset: 'All variants, incl. promos',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pagesNeeded(cardCount: number, perPage: number): number {
  return Math.ceil(cardCount / perPage)
}

/**
 * Returns the smallest available binder size (in pages) that fits `pagesRequired`,
 * or null if it exceeds all sizes in the list.
 */
function recommendedBinderPages(pagesRequired: number, standardSizes: number[]): number | null {
  return standardSizes.find(size => size >= pagesRequired) ?? null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BinderCalculatorModal({
  isOpen,
  onClose,
  setId,
  setName,
  currentGoal,
  hasPromos,
}: BinderCalculatorModalProps) {
  const [stats,        setStats]        = useState<BinderStats | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [selectedGoal, setSelectedGoal] = useState<CollectionGoal>(currentGoal)

  // Lazy-fetch: only once per modal mount (subsequent opens reuse cached state)
  const fetchStats = useCallback(async () => {
    if (stats) return   // already fetched
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sets/${setId}/binder-stats`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: BinderStats = await res.json()
      setStats(data)
    } catch (err) {
      console.error('[BinderCalculatorModal] fetch failed:', err)
      setError('Failed to load binder stats. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [setId, stats])

  useEffect(() => {
    if (isOpen) {
      fetchStats()
      setSelectedGoal(currentGoal)
    }
  }, [isOpen, fetchStats, currentGoal])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // ── Derived values ─────────────────────────────────────────────────────────

  const activeCount: number | null = stats
    ? selectedGoal === 'normal'
      ? stats.normalCount
      : selectedGoal === 'masterset'
        ? stats.mastersetCount
        : stats.grandmasterCount
    : null

  const visibleGoals: CollectionGoal[] = hasPromos
    ? ['normal', 'masterset', 'grandmasterset']
    : ['normal', 'masterset']

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      {/* Modal panel — stop click propagation so the panel itself doesn't close */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-subtle shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg-elevated, #111118)' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Binder Guide"
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-subtle"
          style={{ backgroundColor: 'var(--color-bg-surface, #18181f)' }}
        >
          <div className="flex items-center gap-2.5">
            <BookOpenIcon className="w-5 h-5 text-accent shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-primary">Binder Guide</h2>
              <p className="text-xs text-muted leading-none mt-0.5 truncate max-w-[260px]">{setName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:text-primary hover:bg-surface transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-4 flex flex-col gap-5">

          {/* Goal summary cards */}
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-2.5">Cards to store by goal</p>
            <div className={cn('grid gap-2', hasPromos ? 'grid-cols-3' : 'grid-cols-2')}>
              {visibleGoals.map(goal => {
                const count = stats
                  ? goal === 'normal'
                    ? stats.normalCount
                    : goal === 'masterset'
                      ? stats.mastersetCount
                      : stats.grandmasterCount
                  : null
                const isActive = goal === selectedGoal

                return (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setSelectedGoal(goal)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 flex flex-col gap-1 transition-colors text-left',
                      'cursor-pointer hover:border-accent/60',
                      isActive
                        ? 'border-accent bg-accent/10'
                        : 'border-subtle bg-surface hover:bg-surface/80'
                    )}
                  >
                    <span className="text-base leading-none">{GOAL_ICONS[goal]}</span>
                    <span
                      className={cn(
                        'text-xs font-medium leading-tight',
                        isActive ? 'text-accent' : 'text-secondary'
                      )}
                    >
                      {COLLECTION_GOAL_LABELS[goal]}
                    </span>
                    <span className={cn('text-lg font-bold leading-none', isActive ? 'text-primary' : 'text-secondary')}>
                      {loading
                        ? <span className="inline-block w-10 h-5 rounded bg-surface animate-pulse" />
                        : count != null
                          ? `${count.toLocaleString()}`
                          : '—'
                      }
                    </span>
                    <span className="text-xs text-muted leading-tight">{GOAL_DESCRIPTIONS[goal]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          {/* Pages needed + binder recommendation */}
          {(loading || stats) && !error && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-2.5">
                Pages needed ·{' '}
                <span className="text-secondary normal-case font-medium">
                  {GOAL_ICONS[selectedGoal]} {COLLECTION_GOAL_LABELS[selectedGoal]}
                  {activeCount != null && !loading && ` (${activeCount.toLocaleString()} cards)`}
                </span>
              </p>

              <div className="rounded-lg border border-subtle overflow-hidden mb-3">
                <table className="w-full text-sm">
                  <tbody>
                    {POCKET_SIZES.map(({ label, perPage }, i) => {
                      const pages = activeCount != null ? pagesNeeded(activeCount, perPage) : null
                      return (
                        <tr
                          key={perPage}
                          className={cn(
                            'border-subtle',
                            i < POCKET_SIZES.length - 1 && 'border-b'
                          )}
                        >
                          <td className="px-3.5 py-2.5 text-secondary">{label}</td>
                          <td className="px-3.5 py-2.5 text-right font-semibold text-primary">
                            {loading
                              ? <span className="inline-block w-12 h-4 rounded bg-surface animate-pulse" />
                              : pages != null
                                ? `${pages.toLocaleString()} pages`
                                : '—'
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Binder recommendations */}
              {!loading && activeCount != null && (
                <div className="flex flex-col gap-1.5">
                  {POCKET_SIZES.map(({ label: pocketLabel, perPage, standardSizes }) => {
                    const pages = pagesNeeded(activeCount, perPage)
                    const recommended = recommendedBinderPages(pages, standardSizes)
                    const shortLabel = pocketLabel.split(' ')[0] // "12-pocket", "9-pocket", or "4-pocket"

                    if (recommended) {
                      return (
                        <div key={perPage} className="flex items-start gap-2 text-sm">
                          <span className="text-emerald-400 mt-px shrink-0">✅</span>
                          <span className="text-secondary">
                            A{' '}
                            <span className="font-medium text-primary">
                              {recommended}-page {shortLabel} binder
                            </span>{' '}
                            fits your {COLLECTION_GOAL_LABELS[selectedGoal].toLowerCase()}{' '}
                            <span className="text-muted">
                              ({pages} of {recommended} pages used)
                            </span>
                          </span>
                        </div>
                      )
                    }

                    const largestStandard = standardSizes[standardSizes.length - 1]
                    const bindersNeeded = Math.ceil(pages / largestStandard)
                    return (
                      <div key={perPage} className="flex items-start gap-2 text-sm">
                        <span className="text-amber-400 mt-px shrink-0">⚠️</span>
                        <span className="text-secondary">
                          {shortLabel}: needs{' '}
                          <span className="font-medium text-primary">{pages} pages</span>
                          {' '}— consider{' '}
                          <span className="font-medium text-primary">
                            {bindersNeeded}×{largestStandard}-page binders
                          </span>{' '}
                          <span className="text-muted">(or a custom/ring binder)</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Hint */}
          <p className="text-xs text-muted border-t border-subtle pt-3 -mb-1">
            💡 Click a goal above to preview calculations for that format.
          </p>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end px-5 py-3 border-t border-subtle" style={{ backgroundColor: 'var(--color-bg-surface, #18181f)' }}>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-surface border border-subtle text-secondary hover:text-primary hover:border-accent/50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
