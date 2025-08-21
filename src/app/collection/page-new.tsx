'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navigation from '@/components/navigation/Navigation'
import { Tab } from '@headlessui/react'
import Link from 'next/link'
import Image from 'next/image'
import { useCollectionChunk, useUserSets, useUserCollectionCount } from '@/hooks/useSimpleData'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { currencyService } from '@/lib/currency-service'
import { useI18n } from '@/contexts/I18nContext'
import {
  Search,
  Filter,
  Grid3X3,
  List,
  BarChart3,
  Package2,
  TrendingUp,
  Award,
  Coins,
  Star,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

function CollectionContent() {
  const { user } = useAuth()
  const preferredCurrency = usePreferredCurrency()
  const { locale } = useI18n()
  
  // Local state for UI
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSet, setSelectedSet] = useState<string>('')
  const [selectedRarity, setSelectedRarity] = useState<string>('')
  const [sortBy, setSortBy] = useState<'name' | 'acquired_date' | 'value' | 'quantity'>('acquired_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  const pageSize = 24
  const offset = (currentPage - 1) * pageSize

  // Use new simplified data hooks
  const { 
    data: collection, 
    loading: collectionLoading, 
    error: collectionError,
    fromCache: collectionFromCache
  } = useCollectionChunk(user?.id || null, { 
    offset, 
    limit: pageSize,
    setId: selectedSet || undefined
  })

  const { 
    data: userSets,
    loading: setsLoading
  } = useUserSets(user?.id || null)

  const {
    data: totalCards,
    loading: countLoading
  } = useUserCollectionCount(user?.id || null)

  // Filter and sort collection data
  const filteredCollection = useMemo(() => {
    if (!collection) return []
    
    return collection
      .filter(item => {
        // Handle card data - it might be an array due to Supabase join
        const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
        const cardSets = Array.isArray(card?.sets) ? card.sets[0] : card?.sets
        
        // Search filter
        if (searchTerm && !(
          card?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cardSets?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        )) {
          return false
        }

        // Rarity filter
        if (selectedRarity && card?.rarity !== selectedRarity) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        let aValue: any, bValue: any
        
        // Handle card data properly
        const aCard = Array.isArray(a.cards) ? a.cards[0] : a.cards
        const bCard = Array.isArray(b.cards) ? b.cards[0] : b.cards

        switch (sortBy) {
          case 'name':
            aValue = aCard?.name || ''
            bValue = bCard?.name || ''
            break
          case 'value':
            aValue = aCard?.cardmarket_avg_sell_price || 0
            bValue = bCard?.cardmarket_avg_sell_price || 0
            break
          case 'quantity':
            aValue = a.quantity || 0
            bValue = b.quantity || 0
            break
          case 'acquired_date':
          default:
            aValue = new Date(a.created_at)
            bValue = new Date(b.created_at)
            break
        }

        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
        }
      })
  }, [collection, searchTerm, selectedRarity, sortBy, sortOrder])

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return 'N/A'
    
    // Convert EUR to user's preferred currency if needed
    let convertedPrice = price
    if (preferredCurrency === 'NOK') {
      convertedPrice = price * 11.5 // Convert EUR to NOK
    }
    
    return currencyService.formatCurrency(convertedPrice, preferredCurrency, locale)
  }

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'mint': return 'bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-xs'
      case 'near_mint': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded text-xs'
      case 'lightly_played': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-1 rounded text-xs'
      case 'moderately_played': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-1 rounded text-xs'
      case 'heavily_played': return 'bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded text-xs'
      case 'damaged': return 'bg-gray-500/20 text-gray-400 border border-gray-500/30 px-2 py-1 rounded text-xs'
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30 px-2 py-1 rounded text-xs'
    }
  }

  if (!user) {
    return (
      <Navigation>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
            <div className="text-4xl mb-4 opacity-50">🃏</div>
            <h1 className="text-2xl font-bold text-white mb-4">Please log in to view your collection</h1>
            <p className="text-gray-400 mb-6">Sign in to start building and managing your Pokemon card collection</p>
            <Link href="/auth" className="btn-gaming">
              Sign In
            </Link>
          </div>
        </div>
      </Navigation>
    )
  }

  const tabs = [
    {
      name: 'Cards',
      icon: Package2,
      count: totalCards || 0
    },
    {
      name: 'Statistics',
      icon: BarChart3,
      count: null
    }
  ]

  return (
    <Navigation>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-pokemon-gold/20 rounded-xl">
              <Package2 className="w-8 h-8 text-pokemon-gold" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">My Collection</h1>
              <p className="text-gray-400">Manage and track your Pokemon card collection</p>
            </div>
          </div>
        </div>

        {/* Cache and Error Indicators */}
        {collectionFromCache && (
          <div className="mb-4 text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
              Data loaded from cache - refreshing in background
            </div>
          </div>
        )}

        {collectionError && (
          <div className="mb-6 bg-red-900/50 border border-red-700 rounded-xl p-4">
            <div className="flex items-center">
              <div className="text-red-400 mr-3">⚠️</div>
              <div>
                <h3 className="text-sm font-medium text-red-300">Loading Error</h3>
                <div className="mt-1 text-sm text-red-400">{collectionError}</div>
                <div className="mt-2 text-xs text-red-300">Showing fallback data</div>
              </div>
            </div>
          </div>
        )}

        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-xl bg-pkmn-surface p-1 border border-gray-700/50 mb-8">
            {tabs.map((tab) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  classNames(
                    'w-full rounded-lg py-3 px-4 text-sm font-medium leading-5 transition-all duration-200',
                    'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-pokemon-gold text-white shadow'
                      : 'text-gray-400 hover:bg-pkmn-card hover:text-white'
                  )
                }
              >
                <div className="flex items-center justify-center space-x-2">
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                  {tab.count !== null && tab.count > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {tab.count}
                    </span>
                  )}
                </div>
              </Tab>
            ))}
          </Tab.List>

          <Tab.Panels>
            {/* Cards Panel */}
            <Tab.Panel>
              {/* Search and Filters */}
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
                {/* Search Input */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                      placeholder="Search your collection..."
                      className="input-gaming pl-10 w-full"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
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
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded ${viewMode === 'grid' ? 'bg-pokemon-gold text-black' : 'text-gray-400 hover:text-white'}`}
                      title="Grid view"
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded ${viewMode === 'list' ? 'bg-pokemon-gold text-black' : 'text-gray-400 hover:text-white'}`}
                      title="List view"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Filter Toggle */}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`btn-secondary flex items-center ${showFilters ? 'bg-pokemon-gold text-black' : ''}`}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                  </button>
                </div>
              </div>

              {/* Filters Panel */}
              {showFilters && (
                <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50 animate-slide-up mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white">Filters</h3>
                    <button onClick={() => setShowFilters(false)} className="p-1 text-gray-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Set Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Set</label>
                      <select
                        value={selectedSet}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          setSelectedSet(e.target.value)
                          setCurrentPage(1) // Reset to first page
                        }}
                        className="input-gaming"
                        disabled={setsLoading}
                      >
                        <option value="">All Sets</option>
                        {userSets?.map((set: any) => (
                          <option key={set.id} value={set.id}>{set.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Rarity Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Rarity</label>
                      <select
                        value={selectedRarity}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedRarity(e.target.value)}
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

                    {/* Sort */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
                      <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const [field, order] = e.target.value.split('-')
                          setSortBy(field as any)
                          setSortOrder(order as any)
                        }}
                        className="input-gaming"
                      >
                        <option value="acquired_date-desc">Newest First</option>
                        <option value="acquired_date-asc">Oldest First</option>
                        <option value="name-asc">Name A-Z</option>
                        <option value="name-desc">Name Z-A</option>
                        <option value="value-desc">Highest Value</option>
                        <option value="value-asc">Lowest Value</option>
                        <option value="quantity-desc">Most Quantity</option>
                        <option value="quantity-asc">Least Quantity</option>
                      </select>
                    </div>
                  </div>

                  {/* Clear Filters Button */}
                  <div className="mt-6 pt-4 border-t border-gray-700/50">
                    <button
                      onClick={() => {
                        setSearchTerm('')
                        setSelectedSet('')
                        setSelectedRarity('')
                        setSortBy('acquired_date')
                        setSortOrder('desc')
                        setCurrentPage(1)
                      }}
                      className="px-3 py-1 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-lg text-sm hover:bg-gray-500/30 transition-colors"
                    >
                      Clear All Filters
                    </button>
                  </div>
                </div>
              )}

              {/* Collection Display */}
              {collectionLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="text-center">
                    <div className="mb-8">
                      <div className="text-6xl mb-4 animate-bounce">🃏</div>
                      <div className="flex justify-center space-x-2">
                        <div className="w-3 h-3 bg-pokemon-gold rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-3 h-3 bg-pokemon-gold rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-3 h-3 bg-pokemon-gold rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Loading Your Collection...</h2>
                    <p className="text-gray-400">Gathering your Pokemon cards</p>
                  </div>
                </div>
              ) : filteredCollection.length === 0 ? (
                <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
                  <div className="text-4xl mb-4 opacity-50">🃏</div>
                  <h3 className="text-xl font-semibold text-white mb-2">No cards found</h3>
                  <p className="text-gray-400 mb-6">
                    {searchTerm || selectedSet || selectedRarity
                      ? 'Try adjusting your search or filters'
                      : 'Start building your collection by browsing cards'
                    }
                  </p>
                  <Link href="/cards" className="btn-gaming">
                    Browse Cards
                  </Link>
                </div>
              ) : (
                <>
                  {/* Collection Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {filteredCollection.map((item: any) => {
                      // Handle card data properly
                      const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
                      const cardSets = Array.isArray(card?.sets) ? card.sets[0] : card?.sets
                      
                      return (
                        <div key={`${item.card_id}-${item.id}`} className="bg-pkmn-card rounded-xl p-3 border border-gray-700/50 hover:border-pokemon-gold/50 transition-all duration-200 group">
                          <div className="relative mb-3">
                            <Link href={`/cards/${item.card_id}`}>
                              <Image
                                src={card?.image_small || '/placeholder-card.png'}
                                alt={card?.name || 'Pokemon Card'}
                                width={200}
                                height={280}
                                className="w-full h-auto rounded-lg group-hover:scale-105 transition-transform duration-200"
                              />
                            </Link>
                            <div className="absolute top-2 right-2 bg-black/70 rounded-lg px-2 py-1">
                              <span className="text-xs font-bold text-pokemon-gold">
                                {formatPrice(card?.cardmarket_avg_sell_price)}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Link href={`/cards/${item.card_id}`}>
                              <h3 className="text-sm font-medium text-white hover:text-pokemon-gold transition-colors line-clamp-2">
                                {card?.name || 'Unknown Card'}
                              </h3>
                            </Link>
                            <p className="text-xs text-gray-400">{cardSets?.name || 'Unknown Set'}</p>
                            <div className="flex items-center justify-between">
                              <span className={getConditionColor(item.condition)}>
                                {item.condition.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </Tab.Panel>

            {/* Statistics Panel */}
            <Tab.Panel>
              {countLoading ? (
                <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50 animate-pulse" />
                  <h3 className="text-xl font-semibold text-gray-400 mb-2">Loading Statistics...</h3>
                  <p className="text-gray-500">Calculating your collection data.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-400">Total Cards</h3>
                        <div className="text-2xl font-bold text-white">{totalCards || 0}</div>
                        <p className="text-xs text-gray-500">In your collection</p>
                      </div>
                      <Package2 className="w-8 h-8 text-pokemon-gold" />
                    </div>
                  </div>

                  <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-400">Estimated Value</h3>
                        <div className="text-2xl font-bold text-green-400">
                          {formatPrice((totalCards || 0) * 2.5)}
                        </div>
                        <p className="text-xs text-gray-500">Market estimate</p>
                      </div>
                      <Coins className="w-8 h-8 text-green-400" />
                    </div>
                  </div>

                  <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-400">Sets Represented</h3>
                        <div className="text-2xl font-bold text-purple-400">{userSets?.length || 0}</div>
                        <p className="text-xs text-gray-500">Different sets</p>
                      </div>
                      <Star className="w-8 h-8 text-purple-400" />
                    </div>
                  </div>

                  <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-400">Average Value</h3>
                        <div className="text-2xl font-bold text-blue-400">
                          {formatPrice(totalCards ? 2.5 : 0)}
                        </div>
                        <p className="text-xs text-gray-500">Per card</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-blue-400" />
                    </div>
                  </div>
                </div>
              )}
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </Navigation>
  )
}

export default function CollectionPage() {
  return (
    <ProtectedRoute>
      <CollectionContent />
    </ProtectedRoute>
  )
}