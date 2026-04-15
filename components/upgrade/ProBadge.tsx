'use client'

/**
 * ProBadge — small inline badge shown next to Pro user names/profiles.
 *
 * Usage:
 *   <ProBadge />                    → default gem pill
 *   <ProBadge size="sm" />          → smaller variant for tight layouts
 */

interface ProBadgeProps {
  size?: 'sm' | 'md'
  className?: string
}

export function ProBadge({ size = 'md', className = '' }: ProBadgeProps) {
  if (size === 'sm') {
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold
          bg-[rgba(109,95,255,0.15)] text-[#a78bfa] border border-[rgba(109,95,255,0.3)]
          shadow-[0_0_8px_rgba(109,95,255,0.2)] ${className}`}
        title="Lumidex Pro subscriber"
      >
        💎 Pro
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold
        bg-[rgba(109,95,255,0.15)] text-[#a78bfa] border border-[rgba(109,95,255,0.3)]
        shadow-[0_0_12px_rgba(109,95,255,0.25)] ${className}`}
      title="Lumidex Pro subscriber"
    >
      💎 Lumidex Pro
    </span>
  )
}
