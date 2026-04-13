export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-base">
      {/* Banner */}
      <div className="skeleton h-48 w-full rounded-none" />

      <div className="max-w-screen-xl mx-auto px-6">
        {/* Avatar + name row */}
        <div className="flex items-end gap-4 -mt-12 mb-6">
          <div className="skeleton w-24 h-24 rounded-full border-4 border-base shrink-0" />
          <div className="space-y-2 pb-2">
            <div className="skeleton h-6 w-40 rounded-lg" />
            <div className="skeleton h-4 w-24 rounded-lg" />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-20 rounded-lg" />
          ))}
        </div>

        {/* Sets grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
