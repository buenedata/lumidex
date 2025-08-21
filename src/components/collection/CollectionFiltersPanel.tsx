'use client'

import { X } from 'lucide-react'
import { currencyService } from '@/lib/currency-service'

interface CollectionFiltersPanelProps {
  isOpen: boolean
  onClose: () => void
  // Filter states
  selectedSet: string
  setSelectedSet: (value: string) => void
  selectedRarity: string
  setSelectedRarity: (value: string) => void
  selectedCondition: string
  setSelectedCondition: (value: string) => void
  selectedType: string
  setSelectedType: (value: string) => void
  minValue: string
  setMinValue: (value: string) => void
  maxValue: string
  setMaxValue: (value: string) => void
  dateFrom: string
  setDateFrom: (value: string) => void
  dateTo: string
  setDateTo: (value: string) => void
  sortBy: 'name' | 'acquired_date' | 'value' | 'quantity' | 'set'
  setSortBy: (value: 'name' | 'acquired_date' | 'value' | 'quantity' | 'set') => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (value: 'asc' | 'desc') => void
  // Options
  availableSets: Array<{id: string, name: string}>
  availableTypes: string[]
  preferredCurrency: string
  // Actions
  onClearFilters: () => void
}

export function CollectionFiltersPanel({
  isOpen,
  onClose,
  selectedSet,
  setSelectedSet,
  selectedRarity,
  setSelectedRarity,
  selectedCondition,
  setSelectedCondition,
  selectedType,
  setSelectedType,
  minValue,
  setMinValue,
  maxValue,
  setMaxValue,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  availableSets,
  availableTypes,
  preferredCurrency,
  onClearFilters
}: CollectionFiltersPanelProps) {
  if (!isOpen) return null

  const handleSortChange = (value: string) => {
    const [field, order] = value.split('-')
    setSortBy(field as any)
    setSortOrder(order as any)
  }

  const handleQuickFilter = (type: 'highValue' | 'mint' | 'recent') => {
    switch (type) {
      case 'highValue':
        setMinValue(preferredCurrency === 'NOK' ? '100' : '10')
        break
      case 'mint':
        setSelectedRarity('')
        setSelectedType('')
        setSelectedCondition('mint')
        break
      case 'recent':
        const lastWeek = new Date()
        lastWeek.setDate(lastWeek.getDate() - 7)
        setDateFrom(lastWeek.toISOString().split('T')[0])
        setDateTo('')
        break
    }
  }

  return (
    <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50 animate-slide-up mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Filters</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Set Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Set</label>
          <select
            value={selectedSet}
            onChange={(e) => setSelectedSet(e.target.value)}
            className="input-gaming"
          >
            <option value="">All Sets</option>
            {availableSets.map((set) => (
              <option key={set.id} value={set.id}>{set.name}</option>
            ))}
          </select>
        </div>

        {/* Rarity Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Rarity</label>
          <select
            value={selectedRarity}
            onChange={(e) => setSelectedRarity(e.target.value)}
            className="input-gaming"
          >
            <option value="">All Rarities</option>
            <option value="Common">Common</option>
            <option value="Uncommon">Uncommon</option>
            <option value="Rare">Rare</option>
            <option value="Rare Holo">Rare Holo</option>
            <option value="Rare Holo EX">Rare Holo EX</option>
            <option value="Rare Holo GX">Rare Holo GX</option>
            <option value="Rare Holo V">Rare Holo V</option>
            <option value="Rare Holo VMAX">Rare Holo VMAX</option>
            <option value="Rare Secret">Rare Secret</option>
            <option value="Rare Rainbow">Rare Rainbow</option>
            <option value="Rare Ultra">Rare Ultra</option>
            <option value="Promo">Promo</option>
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="input-gaming"
          >
            <option value="">All Types</option>
            {availableTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Condition Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Condition</label>
          <select
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value)}
            className="input-gaming"
          >
            <option value="">All Conditions</option>
            <option value="mint">Mint</option>
            <option value="near_mint">Near Mint</option>
            <option value="lightly_played">Lightly Played</option>
            <option value="moderately_played">Moderately Played</option>
            <option value="heavily_played">Heavily Played</option>
            <option value="damaged">Damaged</option>
          </select>
        </div>
      </div>

      {/* Value Range and Date Range Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {/* Value Range */}
        <div className="md:col-span-2 lg:col-span-1">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Value Range ({currencyService.getCurrencySymbol(preferredCurrency as any)})
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              placeholder="Min"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              className="input-gaming flex-1"
              min="0"
              step="0.01"
            />
            <input
              type="number"
              placeholder="Max"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              className="input-gaming flex-1"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Date Range */}
        <div className="md:col-span-2 lg:col-span-1">
          <label className="block text-sm font-medium text-gray-300 mb-2">Date Added</label>
          <div className="flex space-x-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-gaming flex-1"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-gaming flex-1"
            />
          </div>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => handleSortChange(e.target.value)}
            className="input-gaming"
          >
            <option value="acquired_date-desc">Newest First</option>
            <option value="acquired_date-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="set-asc">Set A-Z</option>
            <option value="set-desc">Set Z-A</option>
            <option value="value-desc">Highest Value</option>
            <option value="value-asc">Lowest Value</option>
            <option value="quantity-desc">Most Quantity</option>
            <option value="quantity-asc">Least Quantity</option>
          </select>
        </div>
      </div>

      {/* Quick Filter Buttons */}
      <div className="mt-6 pt-4 border-t border-gray-700/50">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Quick Filters</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleQuickFilter('highValue')}
            className="px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-sm hover:bg-purple-500/30 transition-colors"
          >
            High Value Cards ({preferredCurrency === 'NOK' ? '100kr+' : '€10+'})
          </button>
          <button
            onClick={() => handleQuickFilter('mint')}
            className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
          >
            Mint Condition
          </button>
          <button
            onClick={() => handleQuickFilter('recent')}
            className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/30 transition-colors"
          >
            Added This Week
          </button>
          <button
            onClick={onClearFilters}
            className="px-3 py-1 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-lg text-sm hover:bg-gray-500/30 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      </div>
    </div>
  )
}