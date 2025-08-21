'use client'

import { Search, Hash, Type, DollarSign, ArrowUp, ArrowDown, Star, Trash2 } from 'lucide-react'

interface SetSearchAndControlsProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  sortBy: 'number' | 'name' | 'rarity' | 'price'
  sortOrder: 'asc' | 'desc'
  onSortToggle: (sortBy: 'number' | 'name' | 'rarity' | 'price') => void
  filterMode: 'all' | 'need' | 'have' | 'duplicates'
  onFilterChange: (mode: 'all' | 'need' | 'have' | 'duplicates') => void
  user?: any
  totalCards: number
  needCount: number
  haveCount: number
  duplicatesCount: number
  collectedCards: number
  onBulkAddToWishlist: () => void
  onResetSet: () => void
  isResetting: boolean
}

export function SetSearchAndControls({
  searchQuery,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortToggle,
  filterMode,
  onFilterChange,
  user,
  totalCards,
  needCount,
  haveCount,
  duplicatesCount,
  collectedCards,
  onBulkAddToWishlist,
  onResetSet,
  isResetting
}: SetSearchAndControlsProps) {
  return (
    <div className="mb-6">
      {/* Sort Buttons */}
      <div className="flex items-center justify-start gap-2 mb-4">
        <button
          onClick={() => onSortToggle('number')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-pkmn-card ${
            sortBy === 'number'
              ? 'bg-pokemon-gold text-white focus:ring-pokemon-gold'
              : 'bg-pkmn-surface text-gray-300 hover:text-white hover:bg-pkmn-surface/80 focus:ring-gray-500'
          }`}
          title={`Sort by number ${sortBy === 'number' ? (sortOrder === 'asc' ? '(ascending)' : '(descending)') : ''}`}
        >
          <Hash className="w-4 h-4" />
          <span>Number</span>
          {sortBy === 'number' && (
            sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
          )}
        </button>
        
        <button
          onClick={() => onSortToggle('name')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-pkmn-card ${
            sortBy === 'name'
              ? 'bg-pokemon-gold text-white focus:ring-pokemon-gold'
              : 'bg-pkmn-surface text-gray-300 hover:text-white hover:bg-pkmn-surface/80 focus:ring-gray-500'
          }`}
          title={`Sort by name ${sortBy === 'name' ? (sortOrder === 'asc' ? '(A-Z)' : '(Z-A)') : ''}`}
        >
          <Type className="w-4 h-4" />
          <span>Name</span>
          {sortBy === 'name' && (
            sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
          )}
        </button>
        
        <button
          onClick={() => onSortToggle('price')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-pkmn-card ${
            sortBy === 'price'
              ? 'bg-pokemon-gold text-white focus:ring-pokemon-gold'
              : 'bg-pkmn-surface text-gray-300 hover:text-white hover:bg-pkmn-surface/80 focus:ring-gray-500'
          }`}
          title={`Sort by price ${sortBy === 'price' ? (sortOrder === 'asc' ? '(low to high)' : '(high to low)') : ''}`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Price</span>
          {sortBy === 'price' && (
            sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Name or Number..."
              className="input-gaming pl-10 w-full"
            />
          </div>
        </div>

        {/* Bulk Add to Wishlist Button */}
        {user && needCount > 0 && (
          <button
            onClick={onBulkAddToWishlist}
            className="flex items-center space-x-2 px-3 py-2 bg-pokemon-gold hover:bg-pokemon-gold/90 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:ring-offset-2 focus:ring-offset-pkmn-card"
            title={`Add all ${needCount} needed cards to wishlist`}
          >
            <Star className="w-4 h-4" />
            <span>Add {needCount} Need Cards to Wishlist</span>
          </button>
        )}

        {/* Reset Set Button */}
        {user && collectedCards > 0 && (
          <button
            onClick={onResetSet}
            disabled={isResetting}
            className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-pkmn-card"
            title="Remove all cards from this set from your collection"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isResetting ? 'Resetting...' : 'Reset Set'}</span>
          </button>
        )}
      </div>
      
      {/* Filter Buttons */}
      {user && (
        <div className="mt-4">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-400 font-medium">Show:</span>
            <div className="flex bg-pkmn-surface rounded-lg p-1">
              <button
                onClick={() => onFilterChange('all')}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  filterMode === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All ({totalCards})
              </button>
              <button
                onClick={() => onFilterChange('need')}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  filterMode === 'need'
                    ? 'bg-red-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Need ({needCount})
              </button>
              <button
                onClick={() => onFilterChange('have')}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  filterMode === 'have'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Have ({haveCount})
              </button>
              <button
                onClick={() => onFilterChange('duplicates')}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  filterMode === 'duplicates'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Duplicates ({duplicatesCount})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}