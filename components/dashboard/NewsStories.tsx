'use client'

import Link from 'next/link'
import { STORIES, type Story } from '@/data/stories'

// ── Sub-component: single story card ─────────────────────────────────────────

function NewsStoryCard({ story }: { story: Story }) {
  return (
    <Link
      href={`/news/${story.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl cursor-pointer
                 min-w-[220px] sm:min-w-0 h-64
                 transition-transform duration-200 hover:scale-[1.025]"
      style={{ background: story.gradient }}
    >
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
          <span role="img" aria-label={story.category}>{story.categoryIcon}</span>
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

// ── Main export ───────────────────────────────────────────────────────────────

export default function NewsStories() {
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
            Stories
          </h2>
          <p className="text-sm text-secondary mt-0.5">
            News, trivia and fun from the Pokémon TCG world.
          </p>
        </div>

        <Link
          href="/news"
          className="shrink-0 text-sm text-muted hover:text-accent transition-colors duration-150 flex items-center gap-1 mt-0.5"
        >
          View All
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* ── Card strip ───────────────────────────────────────────────────── */}
      {/*  Mobile: horizontal scroll  |  Desktop: 4-column grid            */}
      <div
        className="
          flex gap-3 overflow-x-auto pb-2
          sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0
          lg:grid-cols-4
          snap-x snap-mandatory sm:snap-none
          scrollbar-none
        "
        style={{ scrollbarWidth: 'none' }}
      >
        {STORIES.slice(0, 4).map(story => (
          <div key={story.id} className="snap-start shrink-0 w-[220px] sm:w-auto">
            <NewsStoryCard story={story} />
          </div>
        ))}
      </div>
    </section>
  )
}
