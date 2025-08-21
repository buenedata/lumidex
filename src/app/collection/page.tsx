'use client'

import { useState, useEffect, Fragment } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTabVisibility } from '@/hooks/useTabVisibility'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navigation from '@/components/navigation/Navigation'
import { Tab } from '@headlessui/react'
import { collectionService, UserCollectionWithCard, CollectionStats } from '@/lib/collection-service'
import { Card } from '@/types'
import { CardVariant, CardCollectionData } from '@/types/pokemon'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'
import { CollectionButtons, getAvailableVariants } from '@/components/pokemon/CollectionButtons'
import { PokemonCardGrid } from '@/components/pokemon/PokemonCard'
import { CardDetailsModal } from '@/components/pokemon/CardDetailsModal'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { currencyService } from '@/lib/currency-service'
import { useI18n } from '@/contexts/I18nContext'
import { loadingStateManager } from '@/lib/loading-state-manager'

// Extended interface for collection items with variant data
interface ExtendedCollectionItem extends UserCollectionWithCard {
  normal?: number
  holo?: number
  reverse_holo?: number
  pokeball_pattern?: number
  masterball_pattern?: number
  '1st_edition'?: number
}
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
  ChevronRight,
  Heart,
  Trash2
} from 'lucide-react'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

function CollectionContent() {
  const { user } = useAuth()
  const { isVisible } = useTabVisibility()
  const preferredCurrency = usePreferredCurrency()
  const { locale } = useI18n()
  const [collection, setCollection] = useState<ExtendedCollectionItem[]>([])
  const [stats, setStats] = useState<CollectionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasInitialData, setHasInitialData] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSet, setSelectedSet] = useState<string>('')
  const [selectedRarity, setSelectedRarity] = useState<string>('')
  const [selectedCondition, setSelectedCondition] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [minValue, setMinValue] = useState<string>('')
  const [maxValue, setMaxValue] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [sortBy, setSortBy] = useState<'name' | 'acquired_date' | 'value' | 'quantity' | 'set'>('acquired_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [availableSets, setAvailableSets] = useState<Array<{id: string, name: string}>>([])
  const [availableTypes, setAvailableTypes] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Add state variables like the set page
  const [userCollectionData, setUserCollectionData] = useState<Record<string, any>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const pageSize = 24

  useEffect(() => {
    if (user) {
      loadCollection()
      loadStats()
      loadAvailableSets()
      loadAvailableTypes()
    }
  }, [user])

  // Refresh data when tab becomes visible again, but don't show loading state
  useEffect(() => {
    if (isVisible && hasInitialData && user) {
      // Add debouncing to prevent race conditions
      const refreshTimer = setTimeout(() => {
        loadCollection(false)
        loadStats()
      }, 500)
      
      return () => clearTimeout(refreshTimer)
    }
  }, [isVisible, hasInitialData, user])

  useEffect(() => {
    if (user) {
      loadCollection()
    }
  }, [user, currentPage, selectedSet, selectedRarity, selectedCondition, selectedType, minValue, maxValue, dateFrom, dateTo, sortBy, sortOrder])

  const loadCollection = async (forceRefresh = true) => {
    if (!user) return

    const loadingKey = `collection-${user.id}`
    
    // Only show loading if we don't have initial data yet or force refresh
    if (!hasInitialData || forceRefresh) {
      setLoading(true)
    }
    
    const result = await loadingStateManager.executeWithTimeout(
      loadingKey,
      async () => {
        // FAST PATH: Try simple query first for immediate loading
        console.log('Attempting fast collection load...')
        
        const { data, error } = await supabase
          .from('user_collections')
          .select(`
            id,
            user_id,
            card_id,
            quantity,
            condition,
            variant,
            created_at,
            cards!inner(
              id,
              name,
              set_id,
              number,
              rarity,
              image_small,
              cardmarket_avg_sell_price,
              sets!inner(name)
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100) // Limit for faster loading

        if (error) {
          console.warn('Fast collection query failed, using minimal fallback:', error)
          // FALLBACK: Return minimal data to prevent infinite loading
          return []
        }

        return data || []
      },
      {
        timeout: 3000, // Shorter timeout for faster UX
        maxRetries: 1
      }
    )

    try {
      if (result.success && result.data) {
        const data = result.data
        
        // Group by card_id and aggregate variants
        const collectionMap: Record<string, ExtendedCollectionItem> = {}
        
        data.forEach((item: any) => {
          const cardId = item.card_id
          
          if (!collectionMap[cardId]) {
            collectionMap[cardId] = {
              id: item.id,
              user_id: item.user_id,
              card_id: cardId,
              quantity: 0,
              condition: item.condition,
              is_foil: item.is_foil,
              acquired_date: item.created_at,
              notes: item.notes,
              created_at: item.created_at,
              updated_at: item.updated_at,
              cards: item.cards,
              // Variant quantities
              normal: 0,
              holo: 0,
              reverse_holo: 0,
              pokeball_pattern: 0,
              masterball_pattern: 0,
              '1st_edition': 0
            }
          }

          // Add quantity to the appropriate variant and total
          const variant = item.variant || 'normal'
          switch (variant) {
            case 'normal':
              collectionMap[cardId].normal = (collectionMap[cardId].normal || 0) + item.quantity
              break
            case 'holo':
              collectionMap[cardId].holo = (collectionMap[cardId].holo || 0) + item.quantity
              break
            case 'reverse_holo':
              collectionMap[cardId].reverse_holo = (collectionMap[cardId].reverse_holo || 0) + item.quantity
              break
            case 'pokeball_pattern':
              collectionMap[cardId].pokeball_pattern = (collectionMap[cardId].pokeball_pattern || 0) + item.quantity
              break
            case 'masterball_pattern':
              collectionMap[cardId].masterball_pattern = (collectionMap[cardId].masterball_pattern || 0) + item.quantity
              break
            case '1st_edition':
              collectionMap[cardId]['1st_edition'] = (collectionMap[cardId]['1st_edition'] || 0) + item.quantity
              break
          }
          
          collectionMap[cardId].quantity += item.quantity
        })
        
        setCollection(Object.values(collectionMap))
        setUserCollectionData(collectionMap)
        setTotalPages(1) // For now, disable pagination since we're loading all
        
        // Mark that we have initial data
        setHasInitialData(true)
      } else {
        console.error('Collection loading failed:', result.error)
        // Show error state but don't prevent UI from working
        setHasInitialData(true)
      }
    } catch (error) {
      console.error('Error processing collection data:', error)
      setHasInitialData(true)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    if (!user) return

    try {
      const result = await collectionService.getCollectionStats(user.id)
      if (result.success && result.data) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadAvailableSets = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_collections')
        .select(`
          cards!inner(
            set_id,
            sets!inner(id, name)
          )
        `)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error loading available sets:', error)
      } else if (data) {
        const uniqueSets = new Map()
        data.forEach((item: any) => {
          const set = item.cards?.sets
          if (set) {
            uniqueSets.set(set.id, { id: set.id, name: set.name })
          }
        })
        setAvailableSets(Array.from(uniqueSets.values()).sort((a, b) => a.name.localeCompare(b.name)))
      }
    } catch (error) {
      console.error('Error loading available sets:', error)
    }
  }

  const loadAvailableTypes = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_collections')
        .select(`
          cards!inner(types)
        `)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error loading available types:', error)
      } else if (data) {
        const allTypes = new Set<string>()
        data.forEach((item: any) => {
          const types = item.cards?.types
          if (Array.isArray(types)) {
            types.forEach(type => allTypes.add(type))
          }
        })
        setAvailableTypes(Array.from(allTypes).sort())
      }
    } catch (error) {
      console.error('Error loading available types:', error)
    }
  }

  const handleRemoveCard = async (cardId: string, condition: string) => {
    if (!user) return

    try {
      const result = await collectionService.removeFromCollection(user.id, cardId, {
        condition: condition as any,
        quantity: 1
      })

      if (result.success) {
        loadCollection()
        loadStats()
      }
    } catch (error) {
      console.error('Error removing card:', error)
    }
  }

  const handleAddCard = async (cardId: string, condition: string) => {
    if (!user) return

    try {
      const result = await collectionService.addToCollection(user.id, cardId, {
        condition: condition as any,
        quantity: 1
      })

      if (result.success) {
        loadCollection()
        loadStats()
      }
    } catch (error) {
      console.error('Error adding card:', error)
    }
  }

  // Collection button handlers for the CollectionButtons component
  const handleToggleCollection = async (cardId: string) => {
    // For collection page, we don't need toggle - cards are already in collection
    return
  }

  const handleAddVariant = async (cardId: string, variant: CardVariant) => {
    if (!user) return

    console.log(`➕ Adding variant: ${variant} to card: ${cardId}`)
    setLoadingStates(prev => ({ ...prev, [cardId]: true }))
    
    try {
      // Use collection service to ensure achievement checking happens
      const result = await collectionService.addToCollection(user.id, cardId, {
        quantity: 1,
        condition: 'near_mint'
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to add card')
      }

      // Reload collection and stats to get updated data
      await loadCollection()
      await loadStats()
      
    } catch (error) {
      console.error('Error adding variant:', error)
      // On error, reload to restore correct state
      await loadCollection()
    } finally {
      setLoadingStates(prev => ({ ...prev, [cardId]: false }))
    }
  }

  const handleRemoveVariant = async (cardId: string, variant: CardVariant) => {
    if (!user) return

    console.log(`🗑️ Removing variant: ${variant} from card: ${cardId}`)
    setLoadingStates(prev => ({ ...prev, [cardId]: true }))
    
    try {
      // Use collection service to ensure achievement checking happens
      const result = await collectionService.removeFromCollection(user.id, cardId, {
        quantity: 1,
        condition: 'near_mint'
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to remove card')
      }

      // Reload collection and stats to get updated data
      await loadCollection()
      await loadStats()
      
    } catch (error) {
      console.error('Error removing variant:', error)
      // On error, reload to restore correct state
      await loadCollection()
    } finally {
      setLoadingStates(prev => ({ ...prev, [cardId]: false }))
    }
  }

  const handleViewDetails = (cardId: string) => {
    setSelectedCardId(cardId)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedCardId(null)
  }

  const handleCollectionChange = (cardId: string, collectionData: any) => {
    if (collectionData === null) {
      // Card was removed from collection
      setUserCollectionData(prev => {
        const newData = { ...prev }
        delete newData[cardId]
        return newData
      })
    } else {
      // Card was added or updated in collection
      setUserCollectionData(prev => ({
        ...prev,
        [cardId]: collectionData
      }))
    }
  }

  // Transform collection data to match CollectionButtons expected format
  const getCollectionData = (item: ExtendedCollectionItem): CardCollectionData => {
    return {
      cardId: item.card_id,
      userId: user?.id || '',
      totalQuantity: item.quantity || 0,
      normal: item.normal || 0,
      holo: item.holo || 0,
      reverseHolo: item.reverse_holo || 0,
      pokeballPattern: item.pokeball_pattern || 0,
      masterballPattern: item.masterball_pattern || 0,
      firstEdition: item['1st_edition'] || 0,
      dateAdded: item.acquired_date || new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }
  }

  // Transform ExtendedCollectionItem to PokemonCard format for CollectionButtons
  const transformToPokemonCard = (item: ExtendedCollectionItem) => {
    return {
      id: item.card_id,
      name: item.cards?.name || '',
      number: item.cards?.number || '',
      set: {
        id: item.cards?.set_id || '',
        name: item.cards?.sets?.name || '',
        releaseDate: ''
      },
      rarity: item.cards?.rarity || '',
      types: [], // We don't have types in the current data structure
      images: {
        small: item.cards?.image_small || '',
        large: item.cards?.image_large || ''
      }
    }
  }

  const filteredCollection = collection.filter(item => {
    // Search filter
    if (searchTerm && !(
      item.cards?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cards?.sets?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )) {
      return false
    }

    // Set filter
    if (selectedSet && item.cards?.set_id !== selectedSet) {
      return false
    }

    // Rarity filter
    if (selectedRarity && item.cards?.rarity !== selectedRarity) {
      return false
    }

    // Condition filter
    if (selectedCondition && item.condition !== selectedCondition) {
      return false
    }

    // Type filter
    if (selectedType && !((item.cards as any)?.types?.includes(selectedType))) {
      return false
    }

    // Value range filter
    let cardValue = item.cards?.cardmarket_avg_sell_price || 0
    
    // Convert EUR to user's preferred currency for comparison
    if (preferredCurrency === 'NOK' && cardValue > 0) {
      cardValue = cardValue * 11.5 // Convert EUR to NOK (approximate rate)
    }
    
    if (minValue && cardValue < parseFloat(minValue)) {
      return false
    }
    if (maxValue && cardValue > parseFloat(maxValue)) {
      return false
    }

    // Date range filter
    if (dateFrom && new Date(item.acquired_date || item.created_at) < new Date(dateFrom)) {
      return false
    }
    if (dateTo && new Date(item.acquired_date || item.created_at) > new Date(dateTo)) {
      return false
    }

    return true
  }).sort((a, b) => {
    let aValue: any, bValue: any

    switch (sortBy) {
      case 'name':
        aValue = a.cards?.name || ''
        bValue = b.cards?.name || ''
        break
      case 'set':
        aValue = a.cards?.sets?.name || ''
        bValue = b.cards?.sets?.name || ''
        break
      case 'value':
        aValue = a.cards?.cardmarket_avg_sell_price || 0
        bValue = b.cards?.cardmarket_avg_sell_price || 0
        break
      case 'quantity':
        aValue = a.quantity || 0
        bValue = b.quantity || 0
        break
      case 'acquired_date':
      default:
        aValue = new Date(a.acquired_date || a.created_at)
        bValue = new Date(b.acquired_date || b.created_at)
        break
    }

    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    }
  })

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
      count: collection.length
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* Set Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Set</label>
                      <select
                        value={selectedSet}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSet(e.target.value)}
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

                    {/* Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                      <select
                        value={selectedType}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedType(e.target.value)}
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
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCondition(e.target.value)}
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
                      <label className="block text-sm font-medium text-gray-300 mb-2">Value Range ({currencyService.getCurrencySymbol(preferredCurrency)})</label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          placeholder="Min"
                          value={minValue}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinValue(e.target.value)}
                          className="input-gaming flex-1"
                          min="0"
                          step="0.01"
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={maxValue}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxValue(e.target.value)}
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
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)}
                          className="input-gaming flex-1"
                        />
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)}
                          className="input-gaming flex-1"
                        />
                      </div>
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
                        onClick={() => {
                          setMinValue(preferredCurrency === 'NOK' ? '100' : '10')
                        }}
                        className="px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-sm hover:bg-purple-500/30 transition-colors"
                      >
                        High Value Cards ({preferredCurrency === 'NOK' ? '100kr+' : '€10+'})
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRarity('')
                          setSelectedType('')
                          setSelectedCondition('mint')
                        }}
                        className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
                      >
                        Mint Condition
                      </button>
                      <button
                        onClick={() => {
                          const lastWeek = new Date()
                          lastWeek.setDate(lastWeek.getDate() - 7)
                          setDateFrom(lastWeek.toISOString().split('T')[0])
                          setDateTo('')
                        }}
                        className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/30 transition-colors"
                      >
                        Added This Week
                      </button>
                      <button
                        onClick={() => {
                          setSearchTerm('')
                          setSelectedSet('')
                          setSelectedRarity('')
                          setSelectedCondition('')
                          setSelectedType('')
                          setMinValue('')
                          setMaxValue('')
                          setDateFrom('')
                          setDateTo('')
                          setSortBy('acquired_date')
                          setSortOrder('desc')
                        }}
                        className="px-3 py-1 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-lg text-sm hover:bg-gray-500/30 transition-colors"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Collection Display */}
              {loading && !hasInitialData ? (
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
                    {searchTerm || selectedSet || selectedRarity || selectedCondition || selectedType || minValue || maxValue || dateFrom || dateTo
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
                  {/* Collection Grid - Use same component as set page */}
                  <PokemonCardGrid
                    cards={filteredCollection.map((item: any) => ({
                      id: item.card_id,
                      name: item.cards?.name || '',
                      number: item.cards?.number || '',
                      set: {
                        id: item.cards?.set_id || '',
                        name: item.cards?.sets?.name || '',
                        releaseDate: ''
                      },
                      rarity: item.cards?.rarity || '',
                      types: item.cards?.types || [], // Now properly fetched from database
                      images: {
                        small: item.cards?.image_small || '',
                        large: item.cards?.image_large || ''
                      },
                      cardmarket: {
                        prices: {
                          averageSellPrice: item.cards?.cardmarket_avg_sell_price || 0,
                          lowPrice: 0,
                          trendPrice: item.cards?.cardmarket_trend_price || 0
                        }
                      },
                      availableVariants: getAvailableVariants({
                        ...item.cards,
                        rarity: item.cards?.rarity || '',
                        types: item.cards?.types || [], // Now properly available
                        set: {
                          id: item.cards?.set_id || '',
                          name: item.cards?.sets?.name || ''
                        }
                      })
                    }))}
                    collectionData={Object.fromEntries(
                      filteredCollection.map((item: ExtendedCollectionItem) => [
                        item.card_id,
                        {
                          cardId: item.card_id,
                          userId: item.user_id || user?.id || '',
                          totalQuantity: item.quantity || 0,
                          normal: item.normal || 0,
                          holo: item.holo || 0,
                          reverseHolo: item.reverse_holo || 0,
                          pokeballPattern: item.pokeball_pattern || 0,
                          masterballPattern: item.masterball_pattern || 0,
                          firstEdition: item['1st_edition'] || 0,
                          dateAdded: item.created_at || new Date().toISOString(),
                          lastUpdated: item.updated_at || new Date().toISOString()
                        }
                      ])
                    )}
                    onToggleCollection={handleToggleCollection}
                    onAddVariant={handleAddVariant}
                    onRemoveVariant={handleRemoveVariant}
                    onViewDetails={handleViewDetails}
                    currency={preferredCurrency}
                    loading={loadingStates}
                    className="animate-fade-in"
                  />

                  {/* Enhanced Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mt-8">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="btn-secondary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </button>
                      
                      <span className="text-sm text-gray-400">
                        Page {currentPage} of {totalPages}
                      </span>
                      
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="btn-secondary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </Tab.Panel>

            {/* Statistics Panel */}
            <Tab.Panel>
              {stats ? (
                <>
                  {/* Stats Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-400">Total Cards</h3>
                          <div className="text-2xl font-bold text-white">{stats.totalCards}</div>
                          <p className="text-xs text-gray-500">{stats.uniqueCards} unique cards</p>
                        </div>
                        <Package2 className="w-8 h-8 text-pokemon-gold" />
                      </div>
                    </div>

                    <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-400">Collection Value</h3>
                          <div className="text-2xl font-bold text-green-400">{formatPrice(stats.totalValue)}</div>
                          <p className="text-xs text-gray-500">Market prices</p>
                        </div>
                        <Coins className="w-8 h-8 text-green-400" />
                      </div>
                    </div>

                    <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-400">Rarity Breakdown</h3>
                          <div className="space-y-1 mt-2">
                            {Object.entries(stats.rarityBreakdown).slice(0, 3).map(([rarity, count]) => (
                              <div key={rarity} className="flex justify-between text-sm">
                                <span className="capitalize text-gray-300">{rarity}</span>
                                <span className="text-white">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Star className="w-8 h-8 text-purple-400" />
                      </div>
                    </div>

                    <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-400">Recent Additions</h3>
                          <div className="text-2xl font-bold text-blue-400">{stats.recentAdditions.length}</div>
                          <p className="text-xs text-gray-500">Last 10 cards added</p>
                        </div>
                        <Calendar className="w-8 h-8 text-blue-400" />
                      </div>
                    </div>
                  </div>

                  {/* Detailed Stats */}
                  <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                    <h3 className="text-xl font-semibold text-white mb-4">Collection Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-3">Rarity Distribution</h4>
                        <div className="space-y-2">
                          {Object.entries(stats.rarityBreakdown).map(([rarity, count]) => (
                            <div key={rarity} className="flex items-center justify-between">
                              <span className="capitalize text-gray-300">{rarity}</span>
                              <div className="flex items-center space-x-2">
                                <div className="w-20 bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-pokemon-gold h-2 rounded-full" 
                                    style={{ width: `${(count / stats.totalCards) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-white text-sm w-8 text-right">{count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Activity</h4>
                        <div className="space-y-2">
                          {stats.recentAdditions.slice(0, 5).map((addition, index) => (
                            <div key={index} className="flex items-center space-x-3 p-2 bg-pkmn-surface rounded-lg hover:bg-pkmn-card transition-colors">
                              {/* Card Image */}
                              {addition.cards?.image_small && (
                                <div className="flex-shrink-0">
                                  <Image
                                    src={addition.cards.image_small}
                                    alt={addition.cards.name || 'Card'}
                                    width={32}
                                    height={44}
                                    className="rounded border border-gray-600"
                                  />
                                </div>
                              )}
                              
                              {/* Card Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col">
                                  <button
                                    onClick={() => addition.cards?.id && handleViewDetails(addition.cards.id)}
                                    className="text-left text-sm text-white hover:text-yellow-400 transition-colors truncate"
                                  >
                                    {addition.cards?.name || 'Unknown Card'}
                                  </button>
                                  <button
                                    onClick={() => addition.cards?.id && handleViewDetails(addition.cards.id)}
                                    className="text-left text-xs text-gray-400 hover:text-yellow-400 transition-colors truncate"
                                  >
                                    {addition.cards?.sets?.name || 'Unknown Set'}
                                  </button>
                                </div>
                              </div>
                              
                              {/* Date */}
                              <span className="text-gray-500 text-xs flex-shrink-0">
                                {(addition.acquired_date || addition.created_at) ? new Date(addition.acquired_date || addition.created_at).toLocaleDateString() : 'Unknown date'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                  <h3 className="text-xl font-semibold text-gray-400 mb-2">No Statistics Available</h3>
                  <p className="text-gray-500">Start adding cards to see your collection statistics.</p>
                </div>
              )}
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>

      {/* Card Details Modal */}
      <CardDetailsModal
        cardId={selectedCardId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onCollectionChange={handleCollectionChange}
        supabaseClient={supabase}
      />
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