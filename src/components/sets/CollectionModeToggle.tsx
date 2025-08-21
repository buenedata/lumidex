'use client'

interface CollectionModeToggleProps {
  collectionMode: 'regular' | 'master'
  onModeChange: (mode: 'regular' | 'master') => void
}

export function CollectionModeToggle({
  collectionMode,
  onModeChange
}: CollectionModeToggleProps) {
  return (
    <div className="mb-6">
      <div className="card-container">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-400 font-medium">Collection Mode:</span>
            <div className="text-sm text-gray-300">
              {collectionMode === 'master' ? (
                <span><strong>Master Set:</strong> Need all variants of each card</span>
              ) : (
                <span><strong>Regular Set:</strong> One variant per card is enough</span>
              )}
            </div>
          </div>
          
          {/* Toggle Switch */}
          <button
            onClick={() => onModeChange(collectionMode === 'regular' ? 'master' : 'regular')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:ring-offset-2 focus:ring-offset-pkmn-card ${
              collectionMode === 'master' ? 'bg-pokemon-gold' : 'bg-gray-600'
            }`}
            title={`Switch to ${collectionMode === 'regular' ? 'Master' : 'Regular'} Set mode`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                collectionMode === 'master' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}