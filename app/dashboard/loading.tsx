export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-base">
      <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
        {/* Hero banner */}
        <div className="skeleton h-32 rounded-2xl" />

        {/* Quick actions row */}
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-28 rounded-xl shrink-0" />
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>

        {/* Collection spotlight */}
        <div className="skeleton h-52 rounded-2xl" />

        {/* Wanted board header + cards */}
        <div className="skeleton h-12 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-36 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
