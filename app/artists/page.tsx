import type { Metadata } from 'next'
import ArtistsPageClient from '@/components/ArtistsPageClient'

export const metadata: Metadata = {
  title:       'Card Artists | Lumidex',
  description: 'Browse all Pokémon TCG card artists and illustrators. Discover the talented creators behind the artwork on your favorite cards.',
}

// Artist data is fetched client-side; no server-side auth needed.
export const dynamic = 'force-static'

export default function ArtistsPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="max-w-screen-2xl mx-auto px-6 py-8">

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="mb-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted mb-3">
            <a href="/browse" className="hover:text-accent transition-colors">Browse</a>
            <span>/</span>
            <span className="text-secondary">Artists</span>
          </nav>

          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="mt-0.5 w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl shrink-0">
              🎨
            </div>

            <div>
              <h1
                className="text-3xl font-bold mb-1"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Card Artists
              </h1>
              <p className="text-secondary text-sm max-w-xl">
                Celebrating the talented illustrators behind every Pokémon TCG card.
                From classic watercolors to modern digital art — meet the creators.
              </p>
            </div>
          </div>
        </div>

        {/* ── Client component (data fetching + interactivity) ──────────── */}
        <ArtistsPageClient />
      </div>
    </div>
  )
}
