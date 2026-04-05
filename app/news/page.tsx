'use client'

import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Story {
  id: string
  category: string
  categoryIcon: string
  title: string
  description: string
  href: string
  gradient: string
}

// ── Static mock stories ───────────────────────────────────────────────────────
// Mirrors the dashboard strip + extras. Replace with a fetch when the API is ready.

const ALL_STORIES: Story[] = [
  {
    id: 'top-10-value',
    category: 'Value',
    categoryIcon: '💎',
    title: 'Top 10 most valuable cards right now',
    description:
      'From ex to alt arts — these are the cards driving the market in 2026. Whether you are buying, selling or holding, here is where the value sits.',
    href: '#',
    gradient:
      'linear-gradient(145deg, #2e1065 0%, #4c1d95 35%, #6d28d9 70%, #7c3aed 100%)',
  },
  {
    id: 'did-you-know',
    category: 'Trivia',
    categoryIcon: '✦',
    title: 'Did you know…',
    description:
      'There are Pokémon cards that have never been officially graded — find out which ones and why they remain shrouded in mystery.',
    href: '#',
    gradient:
      'linear-gradient(145deg, #78350f 0%, #b45309 40%, #d97706 75%, #f59e0b 100%)',
  },
  {
    id: 'new-set-reveal',
    category: 'Sets',
    categoryIcon: '🔥',
    title: "Mega Evolution — what's coming next?",
    description:
      'The upcoming expansion is set to shake up both the competitive and collector meta. Here is everything we know so far.',
    href: '#',
    gradient:
      'linear-gradient(145deg, #164e63 0%, #0e7490 40%, #0891b2 75%, #22d3ee 100%)',
  },
  {
    id: 'illustrator-spotlight',
    category: 'Art',
    categoryIcon: '🎨',
    title: 'Illustrator Spotlight: Ken Sugimori',
    description:
      'The legend behind the original 151 — Ken Sugimori\'s rarest works are absolute collector holy grails.',
    href: '#',
    gradient:
      'linear-gradient(145deg, #500724 0%, #9d174d 40%, #be185d 75%, #f472b6 100%)',
  },
  {
    id: 'price-movers',
    category: 'Market',
    categoryIcon: '📈',
    title: 'Biggest price movers this week',
    description:
      'Seven cards that moved significantly in value over the last seven days — and the stories behind each spike.',
    href: '#',
    gradient:
      'linear-gradient(145deg, #064e3b 0%, #065f46 40%, #047857 75%, #10b981 100%)',
  },
  {
    id: 'tournament-results',
    category: 'Competitive',
    categoryIcon: '🏆',
    title: 'Regional Championship results',
    description:
      'Breakdown of the winning decks, standout cards and meta shifts from the latest Regional Championship.',
    href: '#',
    gradient:
      'linear-gradient(145deg, #1c1917 0%, #44403c 40%, #78716c 75%, #a8a29e 100%)',
  },
]

// ── Sub-component: story card ─────────────────────────────────────────────────

function StoryCard({ story }: { story: Story }) {
  return (
    <Link
      href={story.href}
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
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
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

          {/* Coming Soon badge */}
          <span className="shrink-0 mt-1 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-accent/30 text-accent bg-accent/10">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Live soon
          </span>
        </div>

        {/* ── Stories grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALL_STORIES.map(story => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <p className="mt-10 text-center text-xs text-muted">
          Stories are placeholders — live content is on its way 🚀
        </p>

      </main>
    </div>
  )
}
