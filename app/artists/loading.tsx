export default function ArtistsLoading() {
  return (
    <div className="min-h-screen bg-base">
      <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">

        {/* Breadcrumb */}
        <div className="skeleton h-4 w-32 rounded" />

        {/* Page header */}
        <div className="flex items-start gap-4">
          <div className="skeleton w-12 h-12 rounded-2xl shrink-0" />
          <div className="space-y-2">
            <div className="skeleton h-9 w-52 rounded-xl" />
            <div className="skeleton h-4 w-80 rounded" />
          </div>
        </div>

        {/* Stats banner */}
        <div className="skeleton h-20 rounded-2xl" />

        {/* Search + sort bar */}
        <div className="flex gap-3">
          <div className="skeleton h-10 w-64 rounded-lg" />
          <div className="skeleton h-10 w-40 rounded-lg" />
        </div>

        {/* Artist card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="skeleton h-52 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
