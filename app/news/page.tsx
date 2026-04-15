'use client'

import Link from 'next/link'
import { STORIES, type Story } from '@/data/stories'

// ── Sub-component: story card ─────────────────────────────────────────────────

function StoryCard({ story }: { story: Story }) {
  return (
    <Link
      href={`/news/${story.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl cursor-pointer h-72
                 transition-transform duration-200 hover:scale-[1.025]"
      style={{ background: story.gradient }}
    >
      {/* Noise texture */}
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
        <span
          className="pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                     bg-black/40 text-white border border-white/20 backdrop-blur-sm"
        >
          <span role="img" aria-label={story.category}>{story.categoryIcon}</span>
          {story.category}
        </span>
      </div>

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.55) 45%, transparent 100%)',
        }}
      />

      {/* Text — pinned to bottom */}
      <div className="relative mt-auto p-5 z-10">
        <h3
          className="text-white font-bold leading-snug text-lg mb-2"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {story.title}
        </h3>
        <p className="text-white/65 text-sm leading-relaxed line-clamp-2">
          {story.description}
        </p>
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-base">
      {/* Decorative glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(109,95,255,0.12) 0%, transparent 55%)',
        }}
      />

      <main className="max-w-screen-xl mx-auto px-6 py-10">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/dashboard"
                className="text-sm text-muted hover:text-secondary transition-colors duration-150 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
                Dashboard
              </Link>
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-primary flex items-center gap-3"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              <span>📰</span>
              Stories
            </h1>
            <p className="text-secondary mt-1.5 text-sm max-w-lg leading-relaxed">
              News, trivia and fun from the Pokémon TCG world — curated for collectors and trainers.
            </p>
          </div>
        </div>

        {/* ── Stories grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STORIES.map(story => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>

      </main>
    </div>
  )
}
