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
    'flex items-center gap-2 px-4 py-3 rounded-xl bg-surface border border-subtle ' +
    'text-sm font-medium text-secondary hover:text-primary hover:border-accent/50 hover:bg-elevated ' +
    'transition-all duration-150 cursor-pointer w-full'

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
      {/* 2-col grid on mobile → 3 on sm → 4 on md */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
