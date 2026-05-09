'use client'

import Link from 'next/link'
import { useLocale } from '@/contexts/LocaleContext'

interface QuickActionsProps {
  /** User ID — used to build the profile link */
  userId: string
}

interface ActionPillProps {
  label: string
  emoji: string
  href: string
}

function ActionPill({ label, emoji, href }: ActionPillProps) {
  const base =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-subtle ' +
    'text-sm font-medium text-secondary hover:text-primary hover:border-accent/50 hover:bg-elevated ' +
    'transition-all duration-150 cursor-pointer shrink-0'

  return (
    <Link href={href} className={base}>
      <span role="img" aria-hidden>{emoji}</span>
      {label}
    </Link>
  )
}

export default function QuickActions({ userId }: QuickActionsProps) {
  const { t } = useLocale()

  return (
    <div className="mb-6">
      <p className="text-xs text-muted uppercase tracking-wider mb-3 font-medium">
        {t('quick_actions_title')}
      </p>
      {/* Horizontally scrollable on mobile, wraps on wider screens */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <ActionPill emoji="🔍" label={t('quick_find_card')}    href="/browse" />
        <ActionPill emoji="📦" label={t('quick_browse_sets')}  href="/sets" />
        <ActionPill emoji="🗂️" label={t('quick_my_collection')} href="/collection" />
        <ActionPill emoji="👤" label={t('quick_my_profile')}   href={`/profile/${userId}`} />
        <ActionPill emoji="⭐" label={t('quick_wanted_list')}  href="/wanted" />
        <ActionPill emoji="🔄" label={t('quick_wanted_board')} href="/wanted-board" />
      </div>
    </div>
  )
}
