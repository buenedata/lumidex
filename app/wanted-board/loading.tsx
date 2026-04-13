export default function WantedBoardLoading() {
  return (
    <div className="min-h-screen bg-base">
      <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
        {/* Page header */}
        <div className="skeleton h-12 w-56 rounded-xl" />

        {/* Filter row */}
        <div className="flex gap-2">
          <div className="skeleton h-10 flex-1 rounded-xl" />
          <div className="skeleton h-10 w-32 rounded-xl" />
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
