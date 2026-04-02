'use client'

import Link from 'next/link'

interface QuickActionsProps {
  /** User ID — used to build the profile link */
  userId: string
  /** Callback to open the Add Set modal */
  onAddSet: () => void
}

interface ActionPillProps {
  label: string
  emoji: string
  href?: string
  onClick?: () => void
}

function ActionPill({ label, emoji, href, onClick }: ActionPillProps) {
  const base =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-subtle ' +
    'text-sm font-medium text-secondary hover:text-primary hover:border-accent/50 hover:bg-elevated ' +
    'transition-all duration-150 cursor-pointer shrink-0'

  if (href) {
    return (
      <Link href={href} className={base}>
        <span role="img" aria-hidden>{emoji}</span>
        {label}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={base}>
      <span role="img" aria-hidden>{emoji}</span>
      {label}
    </button>
  )
}

export default function QuickActions({ userId, onAddSet }: QuickActionsProps) {
  return (
    <div className="mb-6">
      <p className="text-xs text-muted uppercase tracking-wider mb-3 font-medium">
        Quick Actions
      </p>
      {/* Horizontally scrollable on mobile, wraps on wider screens */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <ActionPill emoji="🔍" label="Find a Card"   href="/browse" />
        <ActionPill emoji="📦" label="Browse Sets"   href="/sets" />
        <ActionPill emoji="🗂️" label="My Collection" href="/collection" />
        <ActionPill emoji="👤" label="My Profile"    href={`/profile/${userId}`} />
        <ActionPill emoji="✨" label="Add Cards"     onClick={onAddSet} />
      </div>
    </div>
  )
}
