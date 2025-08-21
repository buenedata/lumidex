'use client'

import { Search, Filter, Grid3X3, List, X } from 'lucide-react'

interface CollectionSearchAndControlsProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  showFilters: boolean
  onToggleFilters: () => void
}

export function CollectionSearchAndControls({
  searchTerm,
  onSearchChange,
  viewMode,
  onViewModeChange,
  showFilters,
  onToggleFilters
}: CollectionSearchAndControlsProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
      {/* Search Input */}
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search your collection..."
            className="input-gaming pl-10 w-full"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {/* View Mode Toggle */}
        <div className="flex items-center bg-pkmn-surface rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-pokemon-gold text-black' : 'text-gray-400 hover:text-white'}`}
            title="Grid view"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-pokemon-gold text-black' : 'text-gray-400 hover:text-white'}`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
        
        {/* Filter Toggle */}
        <button
          onClick={onToggleFilters}
          className={`btn-secondary flex items-center ${showFilters ? 'bg-pokemon-gold text-black' : ''}`}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </button>
      </div>
    </div>
  )
}