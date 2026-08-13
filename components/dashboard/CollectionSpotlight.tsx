'use client'

import Link from 'next/link'
import type { PokemonSet, SetProgress } from '@/types'
import { useLocale } from '@/contexts/LocaleContext'

interface CollectionSpotlightProps {
  sets: PokemonSet[]
  getProgress: (setId: string) => SetProgress
  completedSets: number
  totalCardsToComplete: number
}

export default function CollectionSpotlight({
  sets,
  getProgress,
  completedSets,
  totalCardsToComplete,
}: CollectionSpotlightProps) {
  const { t } = useLocale()

  if (sets.length === 0) return null

  const spotlight = sets.reduce<{ set: PokemonSet; progress: SetProgress } | null>(
    (best, set) => {
      const progress = getProgress(set.id)
      if (!best || progress.percentage > best.progress.percentage) {
        return { set, progress }
      }
      return best
    },
    null
  )

  if (!spotlight) return null

  const { set, progress } = spotlight
  const cardsToGo = (progress.total_cards ?? 0) - (progress.owned_cards ?? 0)

  const radius       = 22
  const circumference = 2 * Math.PI * radius
  const dashOffset   = circumference - (progress.percentage / 100) * circumference

  return (
    <div className="relative overflow-hidden rounded-2xl bg-elevated border border-subtle p-5 lg:p-6">
      {/* Radial accent glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 5% 100%, rgba(109,95,255,0.18) 0%, transparent 55%)',
        }}
      />

      {/* Section label */}
      <p className="relative text-xs text-muted uppercase tracking-wider font-medium mb-4">
        {t('spotlight_title')}
      </p>

      {/* ── Main horizontal layout ────────────────────────────────────── */}
      <div className="relative flex flex-col lg:flex-row gap-5 lg:gap-6">

        {/* ── Left: Set logo ─────────────────────────────────────────── */}
        <div className="relative flex items-center justify-center lg:w-52 shrink-0 rounded-xl bg-surface border border-subtle overflow-hidden h-32 lg:h-auto">
          {set.logo_url && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={set.logo_url}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-20"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={set.logo_url}
                alt={set.name}
                width={180}
                height={80}
                className="relative z-10 object-contain max-h-20 w-auto drop-shadow-lg"
              />
            </>
          )}
        </div>

        {/* ── Center: Progress info ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-between min-w-0 gap-4">
          {/* Top: name + ring */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3
                className="text-xl font-bold text-primary leading-tight truncate"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {set.name}
              </h3>
              <p className="text-sm text-secondary mt-1">
                {t('spotlight_cards_collected', { owned: progress.owned_cards, total: progress.total_cards })}
              </p>
              {cardsToGo > 0 ? (
                <p className="text-xs text-muted mt-0.5">
                  {cardsToGo === 1 ? t('spotlight_card_to_go', { n: cardsToGo }) : t('spotlight_cards_to_go', { n: cardsToGo })}
                </p>
              ) : (
                <p className="text-xs text-price font-semibold mt-0.5">{t('spotlight_set_complete')}</p>
              )}
            </div>

            {/* Completion ring */}
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 52 52">
                <circle
                  cx="26" cy="26" r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="4"
                />
                <circle
                  cx="26" cy="26" r={radius}
                  fill="none"
                  stroke="#6d5fff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-accent">
                {progress.percentage}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-surface border border-subtle overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          {/* CTA */}
          <Link
            href={`/set/${encodeURIComponent(set.id)}`}
            className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-accent/15 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/25 transition-colors duration-150"
          >
            {t('spotlight_continue')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* ── Right: Stats ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-2 lg:w-80 xl:w-96 gap-3 content-start shrink-0">

          {/* ── Sets Complete ─────────────────────────────────────────── */}
          <div className="rounded-xl bg-surface border border-subtle p-3 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm leading-none" role="img" aria-hidden>🎯</span>
              <p className="text-[10px] text-muted uppercase tracking-wider font-medium truncate leading-none">
                {t('spotlight_sets_complete')}
              </p>
            </div>
            <p className="text-sm font-bold text-primary truncate leading-tight">{completedSets}</p>
            <p className="text-xs text-muted truncate leading-tight">
              {completedSets === 1 ? t('spotlight_1_set_finished') : t('spotlight_n_sets_finished', { n: completedSets })}
            </p>
          </div>

          {/* ── Cards Needed ──────────────────────────────────────────── */}
          <div className="rounded-xl bg-surface border border-subtle p-3 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm leading-none" role="img" aria-hidden>📋</span>
              <p className="text-[10px] text-muted uppercase tracking-wider font-medium truncate leading-none">
                {t('spotlight_cards_needed')}
              </p>
            </div>
            <p className="text-sm font-bold text-primary truncate leading-tight">{totalCardsToComplete.toLocaleString()}</p>
            <p className="text-xs text-muted truncate leading-tight">
              {totalCardsToComplete === 0
                ? t('spotlight_all_complete')
                : t('spotlight_to_finish')}
            </p>
          </div>

        </div>

      </div>
    </div>
  )
}
