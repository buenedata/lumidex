export default function CollectionLoading() {
  return (
    <div className="min-h-screen bg-base">
      <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
        {/* Page header */}
        <div className="skeleton h-24 rounded-2xl" />

        {/* Search + filter row */}
        <div className="flex gap-3">
          <div className="skeleton h-10 flex-1 rounded-xl" />
          <div className="skeleton h-10 w-28 rounded-xl" />
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>

        {/* Sets grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
