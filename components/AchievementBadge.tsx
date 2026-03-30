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
    <div
      className={cn(
        'relative flex flex-col items-center text-center gap-2 p-3',
        'bg-surface rounded-xl transition-all duration-200',
        unlocked
          ? 'border border-[rgba(109,95,255,0.3)] hover:border-[rgba(109,95,255,0.5)]'
          : 'border border-subtle opacity-40 grayscale'
      )}
    >
      {/* Icon */}
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center text-xl',
        unlocked ? 'bg-accent-dim' : 'bg-elevated'
      )}>
        {achievement.icon}
      </div>

      {/* Name */}
      <h3 className={cn(
        'text-xs font-semibold leading-tight',
        unlocked ? 'text-primary' : 'text-secondary'
      )}>
        {achievement.name}
      </h3>

      {/* Description */}
      <p className="text-[11px] text-muted leading-tight line-clamp-2">
        {achievement.description}
      </p>

      {/* Unlock date */}
      {unlocked && unlockedAt && (
        <p className="text-[10px] text-accent">
          {new Date(unlockedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </p>
      )}

      {/* Unlocked indicator dot */}
      {unlocked && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />
      )}
    </div>
  )
}
