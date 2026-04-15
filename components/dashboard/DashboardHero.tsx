'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { useProGate } from '@/hooks/useProGate'
import { ProBadge } from '@/components/upgrade/ProBadge'

interface DashboardHeroProps {
  totalCards: number
  setsTracked: number
  completedSets: number
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

interface TrainerRank {
  label: string
  emoji: string
  colour: string
  bgColour: string
}

function getTrainerRank(totalCards: number): TrainerRank {
  if (totalCards >= 1000) return { label: 'Master Trainer',  emoji: '🏆', colour: 'text-amber-400',  bgColour: 'bg-amber-400/10  border-amber-400/30'  }
  if (totalCards >=  500) return { label: 'Elite Trainer',   emoji: '💎', colour: 'text-purple-400', bgColour: 'bg-purple-400/10 border-purple-400/30' }
  if (totalCards >=  100) return { label: 'Veteran Trainer', emoji: '🔥', colour: 'text-orange-400', bgColour: 'bg-orange-400/10 border-orange-400/30' }
  if (totalCards >=    1) return { label: 'Rising Trainer',  emoji: '⚡', colour: 'text-accent',     bgColour: 'bg-accent/10     border-accent/30'     }
  return                         { label: 'New Trainer',     emoji: '🌱', colour: 'text-price',      bgColour: 'bg-price/10      border-price/30'      }
}

export default function DashboardHero({ totalCards, setsTracked, completedSets }: DashboardHeroProps) {
  const { user, profile } = useAuthStore()
  const { isPro } = useProGate()

  const displayName = profile?.display_name
    || (user as any)?.user_metadata?.username
    || (user as any)?.email?.split('@')[0]
    || 'Trainer'

  const greeting  = getGreeting()
  const rank      = getTrainerRank(totalCards)
  const avatarUrl = profile?.avatar_url ?? null

  return (
    <div className="relative overflow-hidden rounded-2xl bg-elevated border border-subtle mb-6">
      {/* Radial accent glow — top-right corner */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 85% 0%, rgba(109,95,255,0.20) 0%, transparent 65%)',
        }}
      />
      {/* Subtle dot-grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 sm:p-8">

        {/* ── Avatar ──────────────────────────────────── */}
        <div className="shrink-0">
          <div className="w-16 h-16 rounded-full ring-2 ring-accent/50 ring-offset-2 ring-offset-elevated overflow-hidden bg-surface flex items-center justify-center">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={64}
                height={64}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <span className="text-2xl font-bold text-accent">
                {displayName?.[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </div>
        </div>

        {/* ── Greeting + name + badges ─────────────────── */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-secondary mb-0.5 font-medium">
            {greeting} 👋
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="text-2xl sm:text-3xl font-bold text-primary truncate leading-tight"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {displayName}
            </h1>
            {isPro && <ProBadge size="sm" />}
          </div>

          {/* Rank badge + stat chips */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* Trainer rank pill */}
            <span
              className={`pill inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${rank.colour} ${rank.bgColour}`}
            >
              <span role="img" aria-label="rank">{rank.emoji}</span>
              {rank.label}
            </span>

            {totalCards > 0 && (
              <>
                <span className="pill inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surface border border-subtle text-secondary">
                  <span className="text-accent font-bold">{totalCards.toLocaleString()}</span>
                  &nbsp;cards
                </span>
                <span className="pill inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surface border border-subtle text-secondary">
                  <span className="text-accent font-bold">{setsTracked}</span>
                  &nbsp;{setsTracked === 1 ? 'set' : 'sets'}
                </span>
                <span className="pill inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-surface border border-subtle text-secondary">
                  <span className="text-price font-bold">{completedSets}</span>
                  &nbsp;{completedSets === 1 ? 'set complete' : 'sets complete'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Profile CTA ─────────────────────────────── */}
        {user && (
          <Link
            href={`/profile/${user.id}`}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-light text-white text-sm font-semibold transition-colors duration-150 shadow-lg shadow-accent/20"
          >
            View Profile
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  )
}
