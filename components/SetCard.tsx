'use client'

import { memo } from 'react'
import Link from 'next/link'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import type { PokemonSet, SetProgress } from '@/types'

interface SetCardProps {
  set: PokemonSet
  progress?: SetProgress
  onRemove?: () => void
  isFavorited?: boolean
  onFavorite?: () => void
}

function SetCard({ set, progress, onRemove, isFavorited, onFavorite }: SetCardProps) {
  const isComingSoon = set.release_date
    ? new Date(set.release_date) > new Date()
    : false

  return (
    <div className="flex flex-col h-full">
      <Link
        href={`/set/${encodeURIComponent(set.id)}`}
        className={cn(
          'group relative flex flex-col flex-1 rounded-xl overflow-hidden',
          'bg-surface border border-subtle',
          'hover:border-accent/50 hover:shadow-[0_0_20px_rgba(109,95,255,0.15)]',
          'transition-all duration-200 cursor-pointer'
        )}
      >
        {/* Set image area */}
        <div className="relative h-36 bg-elevated overflow-hidden">
          {/* Background blur — CSS background-image on a div re-uses the same in-memory
              image cache as the foreground <Image> below, avoiding a second network request
              to Supabase Storage entirely. */}
          {set.logo_url && (
            <div
              className="absolute inset-0 scale-110 opacity-30 blur-xl bg-cover bg-center"
              style={{ backgroundImage: `url(${set.logo_url})` }}
              aria-hidden
            />
          )}

          {/* Bottom-to-top gradient: black → transparent (reveals bg-elevated above) */}
          <div className="absolute inset-0 z-[5] bg-gradient-to-t from-black via-black/40 to-transparent" />

          {/* Set logo centered — served through Next.js image optimizer so the response
              is cached at the edge and not fetched from Supabase Storage on every request. */}
          <div className="relative z-10 flex items-center justify-center h-full p-4">
            {set.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={set.logo_url}
                alt={set.name}
                width={160}
                height={80}
                loading="lazy"
                className="object-contain max-h-20 w-auto drop-shadow-lg group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-accent-dim flex items-center justify-center">
                <span className="text-accent text-2xl font-bold">{set.name?.[0]}</span>
              </div>
            )}
          </div>

          {/* Set symbol badge — bottom-right corner, served via Next.js image optimizer. */}
          {set.symbol_url && (
            <div className="absolute bottom-1.5 right-1.5 z-20">
              <div className="w-9 h-9 rounded bg-black/50 backdrop-blur-sm p-1 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={set.symbol_url}
                  alt={`${set.name} symbol`}
                  width={28}
                  height={28}
                  className="object-contain w-full h-full"
                />
              </div>
            </div>
          )}

          {/* Favorite button — only rendered when user is logged in */}
          {onFavorite && (
            <button
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                onFavorite()
              }}
              className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all"
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorited ? (
                <StarIconSolid className="w-4 h-4 text-yellow-400" />
              ) : (
                <StarIconOutline className="w-4 h-4 text-white/70" />
              )}
            </button>
          )}
        </div>

        {/* Card info */}
        <div className="p-3 flex flex-col flex-1 gap-1">
          <h3
            className="font-semibold text-sm text-primary leading-tight line-clamp-1"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {set.name}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{set.series}</span>
            {set.total != null && (
              <span className="text-xs text-muted">{set.total} cards</span>
            )}
          </div>

          {/* Release date or Coming Soon badge */}
          {set.release_date && (
            isComingSoon ? (
              <span className="pill inline-flex w-fit items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-accent border border-accent/30">
                Coming soon
              </span>
            ) : (
              <span className="text-xs text-muted/70">
                {new Date(set.release_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                })}
              </span>
            )
          )}

          {/* Progress bar — hidden for unreleased sets */}
          {progress && !isComingSoon && (
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex justify-between text-xs text-muted">
                <span>{progress.owned_cards} / {progress.total_cards}</span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </Link>

      {onRemove && (
        <button
          onClick={onRemove}
          className="mt-2 w-full py-1.5 px-3 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all"
        >
          Remove Set
        </button>
      )}
    </div>
  )
}

export default memo(SetCard)
