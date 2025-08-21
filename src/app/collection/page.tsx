'use client'

import { useState, useEffect, Fragment } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navigation from '@/components/navigation/Navigation'
import { Tab } from '@headlessui/react'
import { useCollectionOperations } from '@/hooks/useServices'
import type { CollectionStats } from '@/types/domains/collection'
import type { UserCollectionWithCard } from '@/lib/repositories/collection-repository'
import { CardVariant } from '@/types/pokemon'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { getAvailableVariants } from '@/components/pokemon/CollectionButtons'
import { PokemonCardGrid } from '@/components/pokemon/PokemonCard'
import { CardDetailsModal } from '@/components/pokemon/CardDetailsModal'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { currencyService } from '@/lib/currency-service'
import { useI18n } from '@/contexts/I18nContext'
import { useCollectionChunk, useCacheInvalidation } from '@/hooks/useSimpleData'
import { CollectionFiltersPanel } from '@/components/collection/CollectionFiltersPanel'
import { CollectionStatisticsPanel } from '@/components/collection/CollectionStatisticsPanel'
import { CollectionSearchAndControls } from '@/components/collection/CollectionSearchAndControls'
import {
  Package2,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

// Extended interface for collection items with variant data
interface ExtendedCollectionItem extends UserCollectionWithCard {
  normal?: number
  holo?: number
  reverse_holo?: number
  pokeball_pattern?: number
  masterball_pattern?: number
  '1st_edition'?: number
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

function CollectionContent() {
  const { user } = useAuth()
  const preferredCurrency = usePreferredCurrency()
  const { locale } = useI18n()
  const { getCollectionStats, addToCollection, removeFromCollection, repository } = useCollectionOperations()
  const { invalidateUserCache } = useCacheInvalidation()

  // Use new data fetching hook for main collection data
  const {
    data: collectionData,
    loading: collectionLoading,
    error: collectionError,
    fromCache: collectionFromCache,
    refetch: refetchCollection
  } = useCollectionChunk(user?.id || null, {
    offset: 0,
    limit: 1000 // Load all for now since existing UI expects all data
  })

  // Legacy state for backwards compatibility
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
  
  // Modal and loading states
  const [userCollectionData, setUserCollectionData] = useState<Record<string, any>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const pageSize = 24

  // Update legacy state when new data arrives
  useEffect(() => {
    if (collectionData && Array.isArray(collectionData)) {
      const transformedCards = collectionData.map((item: any) => ({
        id: item.id || `${item.card_id}-${item.variant}`,
        user_id: item.user_id,
        card_id: item.card_id,
        quantity: item.quantity || 0,
        condition: item.condition,
        is_foil: item.is_foil,
        acquired_date: item.created_at,
        notes: item.notes,
        created_at: item.created_at,
        updated_at: item.updated_at,
        cards: item.cards,
        // Variant quantities - simplified for now
        normal: item.variant === 'normal' ? item.quantity : 0,
        holo: item.variant === 'holo' ? item.quantity : 0,
        reverse_holo: item.variant === 'reverse_holo' ? item.quantity : 0,
        pokeball_pattern: item.variant === 'pokeball_pattern' ? item.quantity : 0,
        masterball_pattern: item.variant === 'masterball_pattern' ? item.quantity : 0,
        '1st_edition': item.variant === '1st_edition' ? item.quantity : 0
      }))
      
      // Group by card_id and aggregate variants
      const collectionMap: Record<string, ExtendedCollectionItem> = {}
      
      transformedCards.forEach((item: any) => {
        const cardId = item.card_id
        
        if (!collectionMap[cardId]) {
          collectionMap[cardId] = {
            ...item,
            normal: 0,
            holo: 0,
            reverse_holo: 0,
            pokeball_pattern: 0,
            masterball_pattern: 0,
            '1st_edition': 0,
            quantity: 0
          }
        }
        
        // Add quantities to variants and total
        collectionMap[cardId].normal += item.normal || 0
        collectionMap[cardId].holo += item.holo || 0
        collectionMap[cardId].reverse_holo += item.reverse_holo || 0
        collectionMap[cardId].pokeball_pattern += item.pokeball_pattern || 0
        collectionMap[cardId].masterball_pattern += item.masterball_pattern || 0
        collectionMap[cardId]['1st_edition'] += item['1st_edition'] || 0
        collectionMap[cardId].quantity += item.quantity || 0
      })
      
      setCollection(Object.values(collectionMap))
      setHasInitialData(true)
    }
  }, [collectionData])

  // Update loading state
  useEffect(() => {
    setLoading(collectionLoading)
  }, [collectionLoading])

  // Load additional data when user is available
  useEffect(() => {
    if (user) {
      loadStats()
      loadAvailableSets()
      loadAvailableTypes()
    }
  }, [user])

  // Force cache invalidation and refresh when component mounts
  useEffect(() => {
    if (user && collectionFromCache) {
      console.log('🔄 Collection page: Data from cache detected, invalidating and refreshing...')
      invalidateUserCache(user.id)
      // Force a fresh fetch after a short delay
      setTimeout(() => {
        refetchCollection()
      }, 100)
    }
  }, [user, collectionFromCache, invalidateUserCache, refetchCollection])

  const loadStats = async () => {
    if (!user) return

    try {
      const result = await getCollectionStats(user.id)
      if (result.success && result.data) {
        // Transform the collection data into stats format
        const collectionData = result.data
        // TODO: Implement proper stats calculation from collection data
        // For now, set to null to avoid type error
        setStats(null)
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

  const handleAddVariant = async (cardId: string, variant: CardVariant) => {
    console.log('🟢 Collection Page: handleAddVariant called', {
      cardId,
      variant,
      userId: user?.id,
      hasUser: !!user
    });

    if (!user) {
      console.log('🟢 Collection Page: No user found, returning early');
      return;
    }

    console.log('🟢 Collection Page: Setting loading state for card', cardId);
    setLoadingStates(prev => ({ ...prev, [cardId]: true }))

    try {
      console.log('🟢 Collection Page: Looking for existing variant to update:', {
        userId: user.id,
        cardId,
        variant,
        condition: 'near_mint'
      });

      // First, check if this specific variant already exists
      const entryResult = await repository.findByCardAndVariant(
        user.id,
        cardId,
        'near_mint',
        variant
      );

      console.log('🟢 Collection Page: findByCardAndVariant result:', entryResult);

      if (entryResult.success && entryResult.data) {
        // Update existing entry
        console.log('🟢 Collection Page: Updating existing variant quantity from', entryResult.data.quantity, 'to', entryResult.data.quantity + 1);
        const updateResult = await repository.updateQuantity(entryResult.data.id, entryResult.data.quantity + 1);
        console.log('🟢 Collection Page: updateQuantity result:', updateResult);
        
        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Failed to update variant quantity');
        }
      } else {
        // Create new entry
        console.log('🟢 Collection Page: Creating new variant entry');
        const result = await addToCollection(user.id, cardId, {
          quantity: 1,
          condition: 'near_mint',
          variant
        });

        console.log('🟢 Collection Page: addToCollection result:', result);

        if (!result.success) {
          throw new Error(result.error || 'Failed to add card')
        }
      }

      console.log('🟢 Collection Page: Successfully added variant, updating local state');
      
      // Update the local collection state immediately
      setCollection(prevCollection => {
        const existingItemIndex = prevCollection.findIndex(item => item.card_id === cardId);
        
        if (existingItemIndex >= 0) {
          // Update existing item
          return prevCollection.map((item, index) => {
            if (index === existingItemIndex) {
              const updatedItem = { ...item };
              
              // Update the specific variant quantity
              switch (variant) {
                case 'normal':
                  updatedItem.normal = (updatedItem.normal || 0) + 1;
                  break;
                case 'holo':
                  updatedItem.holo = (updatedItem.holo || 0) + 1;
                  break;
                case 'reverse_holo':
                  updatedItem.reverse_holo = (updatedItem.reverse_holo || 0) + 1;
                  break;
                case 'pokeball_pattern':
                  updatedItem.pokeball_pattern = (updatedItem.pokeball_pattern || 0) + 1;
                  break;
                case 'masterball_pattern':
                  updatedItem.masterball_pattern = (updatedItem.masterball_pattern || 0) + 1;
                  break;
                case '1st_edition':
                  updatedItem['1st_edition'] = (updatedItem['1st_edition'] || 0) + 1;
                  break;
              }
              
              // Recalculate total quantity
              updatedItem.quantity = (updatedItem.normal || 0) + (updatedItem.holo || 0) +
                (updatedItem.reverse_holo || 0) + (updatedItem.pokeball_pattern || 0) +
                (updatedItem.masterball_pattern || 0) + (updatedItem['1st_edition'] || 0);
              
              console.log('🟢 Collection Page: Updated existing item quantities:', {
                cardId,
                variant,
                newQuantities: {
                  normal: updatedItem.normal,
                  holo: updatedItem.holo,
                  reverseHolo: updatedItem.reverse_holo,
                  pokeballPattern: updatedItem.pokeball_pattern,
                  masterballPattern: updatedItem.masterball_pattern,
                  firstEdition: updatedItem['1st_edition'],
                  total: updatedItem.quantity
                }
              });
              
              return updatedItem;
            }
            return item;
          });
        } else {
          console.log('🟢 Collection Page: Card not found in collection state - this should not happen in collection page');
          // If for some reason the card isn't in the collection state, force a refresh
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          return prevCollection;
        }
      });
      
      // Also refresh stats for accuracy
      await loadStats()
    } catch (error) {
      console.error('🟢 Collection Page: Error adding variant:', error)
    } finally {
      console.log('🟢 Collection Page: Clearing loading state for card', cardId);
      setLoadingStates(prev => ({ ...prev, [cardId]: false }))
    }
  }

  const handleRemoveVariant = async (cardId: string, variant: CardVariant) => {
    console.log('🔵 Collection Page: handleRemoveVariant called', {
      cardId,
      variant,
      userId: user?.id,
      hasUser: !!user,
      hasRepository: !!repository
    });

    if (!user) {
      console.log('🔵 Collection Page: No user found, returning early');
      return;
    }

    console.log('🔵 Collection Page: Setting loading state for card', cardId);
    setLoadingStates(prev => ({ ...prev, [cardId]: true }))

    try {
      console.log('🔵 Collection Page: Looking for collection entry with params:', {
        userId: user.id,
        cardId,
        condition: 'near_mint',
        variant
      });

      // First, let's see what entries exist for this card regardless of condition/variant
      console.log('🔵 Collection Page: Checking all entries for card', cardId);
      const { data: allEntries, error: allEntriesError } = await supabase
        .from('user_collections')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', cardId);
      
      console.log('🔵 Collection Page: All entries for this card:', {
        allEntries,
        allEntriesError,
        count: allEntries?.length || 0
      });

      // Find the collection entry for this specific card and variant
      const entryResult = await repository.findByCardAndVariant(
        user.id,
        cardId,
        'near_mint', // Default condition - you might want to make this configurable
        variant
      )

      console.log('🔵 Collection Page: findByCardAndVariant result:', entryResult);

      if (!entryResult.success || !entryResult.data) {
        console.log('🔵 Collection Page: No collection entry found for this variant');
        return
      }

      const entry = entryResult.data
      console.log('🔵 Collection Page: Found entry:', entry);
      
      if (entry.quantity > 1) {
        console.log('🔵 Collection Page: Reducing quantity from', entry.quantity, 'to', entry.quantity - 1);
        // Reduce quantity by 1
        const updateResult = await repository.updateQuantity(entry.id, entry.quantity - 1)
        console.log('🔵 Collection Page: updateQuantity result:', updateResult);
        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Failed to update quantity')
        }
      } else {
        console.log('🔵 Collection Page: Deleting entry entirely (quantity was 1)');
        // Remove the entry entirely if quantity is 1
        const deleteResult = await repository.delete(entry.id)
        console.log('🔵 Collection Page: delete result:', deleteResult);
        if (!deleteResult.success) {
          throw new Error(deleteResult.error || 'Failed to remove card')
        }
      }

      console.log('🔵 Collection Page: Successfully removed/reduced variant, updating local state');
      
      // Update the local collection state immediately
      setCollection(prevCollection => {
        return prevCollection.map(item => {
          if (item.card_id === cardId) {
            const updatedItem = { ...item };
            
            // Update the specific variant quantity
            switch (variant) {
              case 'normal':
                updatedItem.normal = Math.max(0, (updatedItem.normal || 0) - 1);
                break;
              case 'holo':
                updatedItem.holo = Math.max(0, (updatedItem.holo || 0) - 1);
                break;
              case 'reverse_holo':
                updatedItem.reverse_holo = Math.max(0, (updatedItem.reverse_holo || 0) - 1);
                break;
              case 'pokeball_pattern':
                updatedItem.pokeball_pattern = Math.max(0, (updatedItem.pokeball_pattern || 0) - 1);
                break;
              case 'masterball_pattern':
                updatedItem.masterball_pattern = Math.max(0, (updatedItem.masterball_pattern || 0) - 1);
                break;
              case '1st_edition':
                updatedItem['1st_edition'] = Math.max(0, (updatedItem['1st_edition'] || 0) - 1);
                break;
            }
            
            // Recalculate total quantity
            updatedItem.quantity = (updatedItem.normal || 0) + (updatedItem.holo || 0) +
              (updatedItem.reverse_holo || 0) + (updatedItem.pokeball_pattern || 0) +
              (updatedItem.masterball_pattern || 0) + (updatedItem['1st_edition'] || 0);
            
            console.log('🔵 Collection Page: Updated item quantities:', {
              cardId,
              variant,
              newQuantities: {
                normal: updatedItem.normal,
                holo: updatedItem.holo,
                reverseHolo: updatedItem.reverse_holo,
                pokeballPattern: updatedItem.pokeball_pattern,
                masterballPattern: updatedItem.masterball_pattern,
                firstEdition: updatedItem['1st_edition'],
                total: updatedItem.quantity
              }
            });
            
            return updatedItem;
          }
          return item;
        }).filter(item => item.quantity > 0); // Remove items with 0 total quantity
      });
      
      // Also refresh stats for accuracy
      await loadStats()
    } catch (error) {
      console.error('🔵 Collection Page: Error removing variant:', error)
    } finally {
      console.log('🔵 Collection Page: Clearing loading state for card', cardId);
      setLoadingStates(prev => ({ ...prev, [cardId]: false }))
    }
  }

  const handleToggleCollection = async (cardId: string) => {
    // For collection page, we don't need toggle - cards are already in collection
    return
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
      setUserCollectionData(prev => {
        const newData = { ...prev }
        delete newData[cardId]
        return newData
      })
    } else {
      setUserCollectionData(prev => ({
        ...prev,
        [cardId]: collectionData
      }))
    }
  }

  const handleClearFilters = () => {
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
  }

  // Filtered collection logic
  const filteredCollection = collection.filter(item => {
    // Search filter
    if (searchTerm && !(
      item.card?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.card?.sets?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )) {
      return false
    }

    // Set filter
    if (selectedSet && item.card?.set_id !== selectedSet) {
      return false
    }

    // Rarity filter
    if (selectedRarity && item.card?.rarity !== selectedRarity) {
      return false
    }

    // Condition filter
    if (selectedCondition && item.condition !== selectedCondition) {
      return false
    }

    // Type filter
    if (selectedType && !((item.card as any)?.types?.includes(selectedType))) {
      return false
    }

    // Value range filter - keep in EUR for consistent comparison
    let cardValue = (item.card as any)?.cardmarket_avg_sell_price || 0
    
    // Note: Value comparisons are done in EUR since that's the base currency
    // Users should enter filter values in EUR regardless of their display preference
    
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
        aValue = a.card?.name || ''
        bValue = b.card?.name || ''
        break
      case 'set':
        aValue = a.card?.sets?.name || ''
        bValue = b.card?.sets?.name || ''
        break
      case 'value':
        aValue = (a.card as any)?.cardmarket_avg_sell_price || 0
        bValue = (b.card as any)?.cardmarket_avg_sell_price || 0
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
              {/* Search and Controls */}
              <CollectionSearchAndControls
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters(!showFilters)}
              />

              {/* Filters Panel */}
              <CollectionFiltersPanel
                isOpen={showFilters}
                onClose={() => setShowFilters(false)}
                selectedSet={selectedSet}
                setSelectedSet={setSelectedSet}
                selectedRarity={selectedRarity}
                setSelectedRarity={setSelectedRarity}
                selectedCondition={selectedCondition}
                setSelectedCondition={setSelectedCondition}
                selectedType={selectedType}
                setSelectedType={setSelectedType}
                minValue={minValue}
                setMinValue={setMinValue}
                maxValue={maxValue}
                setMaxValue={setMaxValue}
                dateFrom={dateFrom}
                setDateFrom={setDateFrom}
                dateTo={dateTo}
                setDateTo={setDateTo}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                availableSets={availableSets}
                availableTypes={availableTypes}
                preferredCurrency={preferredCurrency}
                onClearFilters={handleClearFilters}
              />

              {/* Data Loading Indicators */}
              {collectionFromCache && (
                <div className="mb-4 text-center">
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                    Collection data loaded from cache - refreshing in background
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
                  {/* Collection Grid */}
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
                      types: item.cards?.types || [],
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
                        types: item.cards?.types || [],
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
              <CollectionStatisticsPanel
                stats={stats}
                preferredCurrency={preferredCurrency}
                locale={locale}
                onViewDetails={handleViewDetails}
              />
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