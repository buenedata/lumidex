'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale } from '@/contexts/LocaleContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StorySummary {
  id:              string
  slug:            string
  category:        string
  category_icon:   string
  title:           string
  description:     string
  gradient:        string
  cover_image_url: string | null
}

// ── Sub-component: single story card ─────────────────────────────────────────

function NewsStoryCard({ story }: { story: StorySummary }) {
  return (
    <Link
      href={`/news/${story.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl cursor-pointer
                 w-full h-64
                 transition-transform duration-200 hover:scale-[1.025]"
      style={{ background: story.gradient }}
    >
      {/* Optional cover image */}
      {story.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={story.cover_image_url}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
      )}

      {/* Noise texture overlay — very subtle depth */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          backgroundSize: '128px 128px',
        }}
      />

      {/* Category badge — top left */}
      <div className="absolute top-3 left-3 z-10">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm
                     bg-black/40 border border-white/20 backdrop-blur-sm"
        >
          <span role="img" aria-label={story.category}>{story.category_icon}</span>
        </div>
      </div>

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 45%, transparent 100%)',
        }}
      />

      {/* Text content — pinned to bottom */}
      <div className="relative mt-auto p-4 z-10">
        <h3
          className="text-white font-bold leading-tight text-[1.05rem] mb-1.5"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {story.title}
        </h3>
        <p className="text-white/65 text-xs leading-relaxed line-clamp-2">
          {story.description}
        </p>
      </div>
    </Link>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function StoryCardSkeleton() {
  return <div className="w-full h-64 rounded-2xl bg-white/5 animate-pulse" />
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function NewsStories() {
  const { t } = useLocale()
  const [stories, setStories] = useState<StorySummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stories?limit=4')
      .then(r => r.json())
      .then(j => setStories(j.stories ?? []))
      .catch(() => {/* silently fail — dashboard shouldn't break */})
      .finally(() => setLoading(false))
  }, [])

  // Don't render the section at all if there are no stories and we're not loading
  if (!loading && stories.length === 0) return null

  return (
    <section className="mb-10">
      {/* ── Section header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2
            className="text-lg font-bold text-primary flex items-center gap-2"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            <span className="text-base">📰</span>
            {t('news_heading')}
          </h2>
          <p className="text-sm text-secondary mt-0.5">
            {t('news_subtitle')}
          </p>
        </div>

        <Link
          href="/news"
          className="shrink-0 text-sm text-muted hover:text-accent transition-colors duration-150 flex items-center gap-1 mt-0.5"
        >
          {t('news_view_all')}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* ── Card grid ────────────────────────────────────────────────────── */}
      {/*  1-col on mobile → 2-col on sm → 3-col on lg                     */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <StoryCardSkeleton key={i} />
            ))
          : stories.map(story => (
              <NewsStoryCard key={story.id} story={story} />
            ))
        }
      </div>
    </section>
  )
}
