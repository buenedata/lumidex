'use client'

import { Achievement } from '@/types'
import { cn } from '@/lib/utils'

interface AchievementBadgeProps {
  achievement: Achievement
  unlocked: boolean
  unlockedAt?: string
}

export default function AchievementBadge({ achievement, unlocked, unlockedAt }: AchievementBadgeProps) {
  return (
    <div className="relative group flex items-center justify-center">

      {/* ── Badge icon ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center text-xl select-none cursor-default',
          'transition-all duration-200',
          unlocked
            ? 'bg-accent-dim border border-[rgba(109,95,255,0.4)] hover:border-[rgba(109,95,255,0.7)] hover:scale-110 hover:shadow-[0_0_10px_rgba(109,95,255,0.25)]'
            : 'bg-elevated border border-subtle opacity-35 grayscale'
        )}
        role="img"
        aria-label={`${achievement.name}${unlocked ? ' (earned)' : ' (locked)'}`}
      >
        {achievement.icon}
      </div>

      {/* ── Tooltip (floats above on hover) ──────────────────────────────── */}
      <div
        className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50',
          'w-48 p-3 rounded-xl',
          'bg-elevated border border-subtle shadow-xl',
          'pointer-events-none select-none',
          'opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100',
          'transition-all duration-150 origin-bottom'
        )}
      >
        {/* Caret arrow */}
        <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-elevated border-r border-b border-subtle rotate-45" />

        {/* Header row: icon + name */}
        <div className="flex items-start gap-2 mb-1.5">
          <span className="text-base leading-none shrink-0">{achievement.icon}</span>
          <p className={cn(
            'text-xs font-semibold leading-tight',
            unlocked ? 'text-primary' : 'text-secondary'
          )}>
            {achievement.name}
            {unlocked && (
              <span className="ml-1 text-[10px] text-accent font-bold">✓</span>
            )}
          </p>
        </div>

        {/* Description */}
        <p className="text-[11px] text-muted leading-snug">
          {achievement.description}
        </p>

        {/* Unlock date (if known) */}
        {unlocked && unlockedAt && (
          <p className="text-[10px] text-accent mt-1.5 font-medium">
            Earned {new Date(unlockedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}

        {/* Locked hint */}
        {!unlocked && (
          <p className="text-[10px] text-muted mt-1.5 italic">Not yet earned</p>
        )}
      </div>
    </div>
  )
}
