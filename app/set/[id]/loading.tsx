/**
 * loading.tsx — shown instantly when the user clicks a set card.
 *
 * Without this file Next.js App Router blocks the browser navigation until
 * the full server render completes (1–2 s). With it, the browser navigates
 * immediately and shows this skeleton while the server fetches data.
 */
export default function SetPageLoading() {
  return (
    <div style={{ backgroundColor: 'var(--color-bg-base)' }} className="min-h-screen">

      {/* ── Hero skeleton ─────────────────────────────────────────────── */}
      <div className="relative w-full h-48 bg-elevated overflow-hidden">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-elevated via-surface to-elevated" />
        {/* Back link placeholder */}
        <div className="absolute top-4 left-6 h-4 w-24 bg-surface/60 rounded animate-pulse" />
        {/* Logo + title row at bottom */}
        <div className="absolute bottom-6 left-6 flex items-end gap-6">
          <div className="h-16 w-36 bg-surface/60 rounded-lg animate-pulse" />
          <div className="flex flex-col gap-2">
            <div className="h-3 w-20 bg-surface/60 rounded animate-pulse" />
            <div className="h-7 w-48 bg-surface/60 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* ── Stats strip skeleton ───────────────────────────────────────── */}
      <div className="border-b border-subtle">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          <div className="flex items-center gap-8 flex-wrap">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="h-2.5 w-14 bg-elevated rounded animate-pulse" />
                <div className="h-4 w-24 bg-elevated rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Controls skeleton (goal selector + binder) ────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-6 pt-5 pb-4 border-b border-subtle">
        <div className="flex flex-wrap items-start gap-6">
          {/* Goal selector */}
          <div className="flex flex-col gap-1.5">
            <div className="h-2.5 w-28 bg-elevated rounded animate-pulse" />
            <div className="flex gap-2 mt-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 w-24 bg-elevated rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
          {/* Binder button — right-aligned */}
          <div className="ml-auto flex flex-col gap-1.5">
            <div className="h-2.5 w-10 bg-elevated rounded animate-pulse" />
            <div className="h-8 w-32 bg-elevated rounded-md animate-pulse" />
          </div>
        </div>
      </div>

      {/* ── Search + sort + tabs skeleton ─────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center gap-3">
        <div className="h-9 w-52 bg-elevated rounded-lg animate-pulse" />
      </div>
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="flex items-center gap-0 border-b border-subtle">
          <div className="h-10 w-28 bg-elevated rounded animate-pulse mr-2" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-20 bg-elevated rounded animate-pulse mx-1" />
          ))}
        </div>
      </div>

      {/* ── Card grid skeleton ─────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
        >
          {Array.from({ length: 32 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden bg-surface border border-subtle"
              style={{ opacity: 1 - i * 0.015 }}
            >
              {/* Card image area */}
              <div className="relative bg-elevated animate-pulse" style={{ aspectRatio: '5/7' }} />
              {/* Card info */}
              <div className="p-2 flex flex-col gap-2">
                <div className="h-3 w-3/4 bg-elevated rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-elevated rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
