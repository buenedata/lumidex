'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  CollectionGoal,
  COLLECTION_GOAL_LABELS,
  COLLECTION_GOAL_DESCRIPTIONS,
} from '@/types'

interface CollectionGoalSelectorProps {
  setId: string
  /** Currently active goal */
  value: CollectionGoal
  /** Whether the Grandmaster Set option should be shown (requires promo cards in the set) */
  hasPromos: boolean
  /** Whether the user is authenticated — unauthenticated users see the picker but cannot save */
  isAuthenticated: boolean
  /** Called after a successful persistence to the server */
  onChange: (goal: CollectionGoal) => void
}

const GOALS: CollectionGoal[] = ['normal', 'masterset', 'grandmasterset']

// Small icon for each tier
const GOAL_ICONS: Record<CollectionGoal, string> = {
  normal:         '📦',
  masterset:      '⭐',
  grandmasterset: '👑',
}

export default function CollectionGoalSelector({
  setId,
  value,
  hasPromos,
  isAuthenticated,
  onChange,
}: CollectionGoalSelectorProps) {
  const [saving, setSaving] = useState<CollectionGoal | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const visibleGoals = hasPromos ? GOALS : GOALS.filter(g => g !== 'grandmasterset')

  const handleSelect = async (goal: CollectionGoal) => {
    if (goal === value) return
    if (!isAuthenticated) return // silently blocked — shown via tooltip + disabled state

    setSaving(goal)
    setSaveError(null)

    try {
      const res = await fetch('/api/user-sets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setId, collection_goal: goal }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      onChange(goal)
    } catch (err) {
      console.error('Failed to save collection goal:', err)
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted uppercase tracking-wider select-none">
        Collection Goal
      </span>

      <div className="flex items-center gap-1">
        {visibleGoals.map(goal => {
          const isActive  = value === goal
          const isSaving  = saving === goal
          const isDisabled = !isAuthenticated || (saving !== null && !isSaving)

          return (
            <button
              key={goal}
              onClick={() => handleSelect(goal)}
              disabled={isDisabled}
              title={
                !isAuthenticated
                  ? 'Log in to set a collection goal'
                  : COLLECTION_GOAL_DESCRIPTIONS[goal]
              }
              aria-pressed={isActive}
              className={cn(
                // Base
                'relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
                'border transition-all duration-150 select-none',
                // Active state
                isActive
                  ? 'bg-accent/20 border-accent text-primary shadow-sm shadow-accent/20'
                  : 'bg-surface border-subtle text-secondary hover:border-accent/50 hover:text-primary',
                // Disabled / saving
                isDisabled && !isActive
                  ? 'opacity-40 cursor-not-allowed'
                  : 'cursor-pointer',
              )}
            >
              <span className="text-base leading-none" aria-hidden>
                {isSaving ? '…' : GOAL_ICONS[goal]}
              </span>
              <span>{COLLECTION_GOAL_LABELS[goal]}</span>

              {/* Active indicator pill */}
              {isActive && (
                <span className="sr-only">(selected)</span>
              )}
            </button>
          )
        })}

        {/* Unauthenticated hint */}
        {!isAuthenticated && (
          <span className="ml-2 text-xs text-muted italic">
            Log in to customise
          </span>
        )}
      </div>

      {/* Inline save error */}
      {saveError && (
        <p className="text-xs text-red-400">{saveError}</p>
      )}
    </div>
  )
}
