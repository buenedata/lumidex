/**
 * Skeleton loading state for the artist detail page.
 * Shown by Next.js while the server component (page.tsx) is streaming.
 */
export default function ArtistDetailLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="max-w-screen-2xl mx-auto px-6 py-8">

        {/* ── Breadcrumb skeleton ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-3 w-14 rounded bg-elevated animate-pulse" />
          <div className="h-3 w-2 rounded bg-elevated animate-pulse" />
          <div className="h-3 w-12 rounded bg-elevated animate-pulse" />
          <div className="h-3 w-2 rounded bg-elevated animate-pulse" />
          <div className="h-3 w-32 rounded bg-elevated animate-pulse" />
        </div>

        {/* ── Hero skeleton ────────────────────────────────────────────────── */}
        <div className="mb-10 p-6 rounded-2xl bg-elevated border border-subtle">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {/* Icon placeholder */}
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-surface animate-pulse" />

            <div className="flex-1 min-w-0 space-y-4">
              {/* Name + badge row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-8 w-52 rounded-lg bg-surface animate-pulse" />
                <div className="h-7 w-24 rounded-full bg-surface animate-pulse" />
              </div>

              {/* Bio lines */}
              <div className="space-y-2">
                <div className="h-4 rounded bg-surface animate-pulse w-full" />
                <div className="h-4 rounded bg-surface animate-pulse w-11/12" />
                <div className="h-4 rounded bg-surface animate-pulse w-4/5" />
                <div className="h-4 rounded bg-surface animate-pulse w-full mt-2" />
                <div className="h-4 rounded bg-surface animate-pulse w-3/4" />
              </div>
            </div>
          </div>

          {/* Back link placeholder */}
          <div className="mt-5 pt-4 border-t border-subtle">
            <div className="h-4 w-32 rounded bg-surface animate-pulse" />
          </div>
        </div>

        {/* ── Section heading skeleton ─────────────────────────────────────── */}
        <div className="mb-4">
          <div className="h-5 w-48 rounded bg-elevated animate-pulse" />
        </div>

        {/* ── Card grid skeleton ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col rounded-xl overflow-hidden bg-elevated border border-subtle"
            >
              {/* Card image placeholder — 2.5:3.5 aspect ratio */}
              <div className="aspect-[2.5/3.5] bg-surface animate-pulse" />

              {/* Info placeholder */}
              <div className="px-3 py-2.5 space-y-2">
                <div className="h-3.5 rounded bg-surface animate-pulse w-4/5" />
                <div className="h-3 rounded bg-surface animate-pulse w-2/3" />
                <div className="h-3 rounded-full bg-surface animate-pulse w-1/2 mt-1" />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
