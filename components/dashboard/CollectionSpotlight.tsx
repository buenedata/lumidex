'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { PokemonSet, SetProgress } from '@/types'

interface CollectionSpotlightProps {
  sets: PokemonSet[]
  getProgress: (setId: string) => SetProgress
}

export default function CollectionSpotlight({ sets, getProgress }: CollectionSpotlightProps) {
  if (sets.length === 0) return null

  // Find the set with the highest completion percentage
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

  // SVG circle ring values
  const radius      = 20
  const circumference = 2 * Math.PI * radius
  const dashOffset   = circumference - (progress.percentage / 100) * circumference

  return (
    <div className="relative overflow-hidden rounded-2xl bg-elevated border border-subtle p-5 flex flex-col gap-4 h-full">
      {/* Radial accent glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 10% 90%, rgba(109,95,255,0.15) 0%, transparent 60%)',
        }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider font-medium">
            Collection Spotlight
          </p>
          <h3
            className="text-sm font-semibold text-primary mt-0.5"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Your Best Set
          </h3>
        </div>
        {/* Completion ring */}
        <div className="relative w-12 h-12 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
            {/* Track */}
            <circle
              cx="24" cy="24" r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="4"
            />
            {/* Fill */}
            <circle
              cx="24" cy="24" r={radius}
              fill="none"
              stroke="#6d5fff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          {/* Percentage inside ring */}
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-accent">
            {progress.percentage}%
          </span>
        </div>
      </div>

      {/* Set logo */}
      <div className="relative flex items-center justify-center h-24 rounded-xl bg-surface border border-subtle overflow-hidden">
        {set.logo_url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={set.logo_url}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-20"
            />
            <Image
              src={set.logo_url}
              alt={set.name}
              width={160}
              height={72}
              unoptimized
              className="relative z-10 object-contain max-h-16 w-auto drop-shadow-lg"
            />
          </>
        )}
      </div>

      {/* Set name + progress copy */}
      <div className="relative flex-1">
        <p
          className="font-semibold text-primary text-sm leading-tight"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {set.name}
        </p>
        <p className="text-xs text-secondary mt-1">
          {progress.owned_cards} / {progress.total_cards} cards collected
        </p>
        {cardsToGo > 0 ? (
          <p className="text-xs text-muted mt-0.5">
            <span className="text-accent font-semibold">{cardsToGo}</span> card{cardsToGo !== 1 ? 's' : ''} to go
          </p>
        ) : (
          <p className="text-xs text-price font-semibold mt-0.5">🎉 Set complete!</p>
        )}
      </div>

      {/* CTA */}
      <Link
        href={`/set/${set.id}`}
        className="relative inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-accent/15 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/25 transition-colors duration-150"
      >
        Continue collecting
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  )
}
