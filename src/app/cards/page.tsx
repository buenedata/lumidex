'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navigation from '@/components/navigation/Navigation'
import { supabase } from '@/lib/supabase'
import { recoverSupabaseConnection } from '@/lib/supabase-recovery'
import { PokemonCardGrid, PokemonCardList } from '@/components/pokemon/PokemonCard'
import { getAvailableVariants } from '@/components/pokemon/CollectionButtons'
import { CardDetailsModal } from '@/components/pokemon/CardDetailsModal'
import { CardVariant } from '@/types/pokemon'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { useI18n } from '@/contexts/I18nContext'
import { currencyService } from '@/lib/currency-service'
import { achievementService } from '@/lib/achievement-service'
import { toastService } from '@/lib/toast-service'
import { wishlistService } from '@/lib/wishlist-service'
import {
  Search,
  Filter,
  Grid3X3,
  List,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
  Heart,
  Package2,
  BarChart3,
  TrendingUp,
  Award,
  Coins,
  HelpCircle,
  Keyboard
} from 'lucide-react'

interface CardFilters {
  search: string
  setId: string
  rarity: string
  type: string
  priceMin: number
  priceMax: number
  sortBy: 'name' | 'number' | 'price' | 'release_date'
  sortOrder: 'asc' | 'desc'
  showOnlyCollection: boolean
}

function CardsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const preferredCurrency = usePreferredCurrency()
  const { locale } = useI18n()
  const [cards, setCards] = useState<any[]>([])
  const [sets, setSets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const supabaseClientRef = useRef(supabase)
  const [filters, setFilters] = useState<CardFilters>({
    search: '',
    setId: '',
    rarity: '',
    type: '',
    priceMin: 0,
    priceMax: 1000,
    sortBy: 'name',
    sortOrder: 'asc',
    showOnlyCollection: false
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCards, setTotalCards] = useState(0)
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [userCollectionData, setUserCollectionData] = useState<Record<string, any>>({})
  const [mounted, setMounted] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [availableRarities, setAvailableRarities] = useState<string[]>([])
  const [availableTypes, setAvailableTypes] = useState<string[]>([])
  const [quickStats, setQuickStats] = useState({ totalSets: 0, totalCards: 0, avgPrice: 0 })
  const [collectionStats, setCollectionStats] = useState({
    totalCards: 0,
    uniqueCards: 0,
    totalValue: 0,
    avgValue: 0,
    completionPercentage: 0
  })
  const cardsPerPage = 24

  useEffect(() => {
    setMounted(true)
    
    // Parse URL parameters and set initial filters
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const urlSort = url.searchParams.get('sort')
      const urlOrder = url.searchParams.get('order')
      const urlSearch = url.searchParams.get('search')
      const urlSet = url.searchParams.get('set')
      const urlRarity = url.searchParams.get('rarity')
      const urlTypes = url.searchParams.get('types')
      
      console.log('Full URL:', window.location.href)
      console.log('URL Search Params:', url.searchParams.toString())
      console.log('URL Parameters detected:', { urlSort, urlOrder, urlSearch, urlSet, urlRarity, urlTypes })
      
      // Set filters based on URL parameters
      setFilters(prevFilters => {
        let sortBy = prevFilters.sortBy
        let sortOrder = prevFilters.sortOrder
        
        // Handle different sort types
        if (urlSort === 'release_date' || urlSort === 'price' || urlSort === 'number' || urlSort === 'name') {
          sortBy = urlSort as CardFilters['sortBy']
        } else if (urlSort === 'popularity') {
          // Map popularity to price descending (assuming popular = expensive)
          sortBy = 'price'
          sortOrder = 'desc'
        }
        
        // Handle sort order
        if (urlOrder === 'desc' || urlOrder === 'asc') {
          sortOrder = urlOrder as CardFilters['sortOrder']
        }
        
        const newFilters = {
          ...prevFilters,
          sortBy,
          sortOrder,
          search: urlSearch || prevFilters.search,
          setId: urlSet || prevFilters.setId,
          rarity: urlRarity || prevFilters.rarity,
          type: urlTypes || prevFilters.type
        }
        
        console.log('🎯 Applied filters from URL:', {
          sortBy,
          sortOrder,
          rarity: newFilters.rarity,
          search: newFilters.search
        })
        
        return newFilters
      })
      
      // Restore modal state from URL parameters
      const cardParam = url.searchParams.get('card')
      
      if (cardParam) {
        console.log('Restoring modal state from URL on mount:', cardParam)
        setSelectedCardId(cardParam)
        setIsModalOpen(true)
      } else {
        // Fallback: check sessionStorage for modal state (in case of tab restoration)
        try {
          const storedState = sessionStorage.getItem('pokemon-modal-state')
          if (storedState) {
            const { cardId, timestamp } = JSON.parse(storedState)
            // Only restore if the stored state is recent (within 5 minutes)
            if (Date.now() - timestamp < 5 * 60 * 1000) {
              console.log('Restoring modal state from sessionStorage:', cardId)
              setSelectedCardId(cardId)
              setIsModalOpen(true)
              // Update URL to match restored state
              const newUrl = new URL(window.location.href)
              newUrl.searchParams.set('card', cardId)
              window.history.replaceState({ cardId }, '', newUrl.toString())
            } else {
              // Clean up old stored state
              sessionStorage.removeItem('pokemon-modal-state')
            }
          }
        } catch (error) {
          console.error('Error restoring modal state from sessionStorage:', error)
          sessionStorage.removeItem('pokemon-modal-state')
        }
      }
    }
  }, [])

  // Handle browser back/forward navigation
  useEffect(() => {
    if (!mounted) return

    const handlePopState = (event: PopStateEvent) => {
      const url = new URL(window.location.href)
      const cardParam = url.searchParams.get('card')
      
      if (cardParam) {
        setSelectedCardId(cardParam)
        setIsModalOpen(true)
      } else {
        setIsModalOpen(false)
        setSelectedCardId(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [mounted])

  // Listen for URL changes to re-parse parameters when using quick actions
  useEffect(() => {
    if (!mounted) return

    const handleUrlChange = () => {
      const url = new URL(window.location.href)
      const urlSort = url.searchParams.get('sort')
      const urlOrder = url.searchParams.get('order')
      const urlSearch = url.searchParams.get('search')
      const urlSet = url.searchParams.get('set')
      const urlRarity = url.searchParams.get('rarity')
      const urlTypes = url.searchParams.get('types')
      
      console.log('🔄 URL changed, re-parsing parameters:', { urlSort, urlOrder, urlRarity })
      
      setFilters(prevFilters => {
        let sortBy: CardFilters['sortBy'] = 'name'
        let sortOrder: CardFilters['sortOrder'] = 'asc'
        
        // Handle different sort types
        if (urlSort === 'release_date' || urlSort === 'price' || urlSort === 'number' || urlSort === 'name') {
          sortBy = urlSort as CardFilters['sortBy']
        } else if (urlSort === 'popularity') {
          sortBy = 'price'
          sortOrder = 'desc'
        }
        
        // Handle sort order
        if (urlOrder === 'desc' || urlOrder === 'asc') {
          sortOrder = urlOrder as CardFilters['sortOrder']
        }
        
        return {
          search: urlSearch || '',
          setId: urlSet || '',
          rarity: urlRarity || '',
          type: urlTypes || '',
          priceMin: 0,
          priceMax: 1000,
          sortBy,
          sortOrder,
          showOnlyCollection: false
        }
      })
      
      // Reset to first page when filters change
      setCurrentPage(1)
    }

    // Use popstate for browser navigation
    window.addEventListener('popstate', handleUrlChange)
    
    // Also check for URL changes periodically (for programmatic navigation)
    let lastCheckedUrl = window.location.href
    const interval = setInterval(() => {
      const currentUrl = window.location.href
      if (currentUrl !== lastCheckedUrl) {
        lastCheckedUrl = currentUrl
        handleUrlChange()
      }
    }, 100)

    return () => {
      window.removeEventListener('popstate', handleUrlChange)
      clearInterval(interval)
    }
  }, [mounted])

  // Handle tab switching and page visibility changes
  useEffect(() => {
    if (!mounted) return

    // Shared function to test and recover Supabase connection smoothly
    const testAndRecoverConnection = async () => {
      try {
        console.log('Testing Supabase connection after tab switch...')
        const recoveredClient = await recoverSupabaseConnection(supabaseClientRef.current)
        
        // Update the client reference if a new one was created
        if (recoveredClient !== supabaseClientRef.current) {
          console.log('Updated to fresh Supabase client')
          supabaseClientRef.current = recoveredClient
        }
        
        console.log('Supabase connection verified and ready')
      } catch (error) {
        console.error('Failed to recover Supabase connection:', error)
        // Only fall back to page reload if smooth recovery completely fails
        console.log('Falling back to page reload as last resort')
        window.location.reload()
      }
    }

    const handleVisibilityChange = () => {
      // When tab becomes visible again, check if modal state needs restoration
      if (!document.hidden) {
        console.log('Page became visible, checking connection and modal state')
        
        // Use setTimeout to ensure this runs after any other state updates
        setTimeout(async () => {
          await testAndRecoverConnection()
          
          const url = new URL(window.location.href)
          const cardParam = url.searchParams.get('card')
          
          // Only restore modal if URL has card parameter but modal is not open
          if (cardParam && !isModalOpen) {
            console.log('Restoring modal state from URL on tab visibility:', cardParam)
            setSelectedCardId(cardParam)
            setIsModalOpen(true)
          }
          // If modal is open but URL doesn't have card parameter, close it
          else if (!cardParam && isModalOpen) {
            console.log('Closing modal due to missing URL parameter on tab visibility')
            setIsModalOpen(false)
            setSelectedCardId(null)
          }
        }, 200) // Delay to allow for smooth connection recovery
      }
    }

    const handleWindowFocus = () => {
      // Similar to visibility change, but for window focus events
      setTimeout(async () => {
        // Test and recover connection on window focus as well
        await testAndRecoverConnection()
        
        const url = new URL(window.location.href)
        const cardParam = url.searchParams.get('card')
        
        if (cardParam && !isModalOpen) {
          console.log('Restoring modal state from URL on window focus:', cardParam)
          setSelectedCardId(cardParam)
          setIsModalOpen(true)
        } else if (!cardParam && isModalOpen) {
          console.log('Closing modal due to missing URL parameter on window focus')
          setIsModalOpen(false)
          setSelectedCardId(null)
        }
      }, 200)
    }

    // Add event listeners for tab switching scenarios
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [mounted, isModalOpen])

  // Additional effect to handle page focus/blur with more aggressive restoration
  useEffect(() => {
    if (!mounted) return

    const handlePageShow = (event: PageTransitionEvent) => {
      // This handles browser back/forward cache restoration
      console.log('Page show event triggered, persisted:', event.persisted)
      setTimeout(() => {
        const url = new URL(window.location.href)
        const cardParam = url.searchParams.get('card')
        
        if (cardParam && !isModalOpen) {
          console.log('Restoring modal state from URL on page show:', cardParam)
          setSelectedCardId(cardParam)
          setIsModalOpen(true)
        }
      }, 150)
    }

    const handleBeforeUnload = () => {
      // Store modal state in sessionStorage as backup
      if (isModalOpen && selectedCardId) {
        sessionStorage.setItem('pokemon-modal-state', JSON.stringify({
          cardId: selectedCardId,
          timestamp: Date.now()
        }))
      } else {
        sessionStorage.removeItem('pokemon-modal-state')
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [mounted, isModalOpen, selectedCardId])

  useEffect(() => {
    if (mounted) {
      fetchSets()
      fetchQuickStats()
      fetchAvailableRarities()
      fetchAvailableTypes()
      fetchCards()
      if (user) {
        fetchUserCollection()
      }
    }
  }, [filters, currentPage, user?.id, mounted])

  // Calculate collection stats when userCollectionData changes
  useEffect(() => {
    if (user && Object.keys(userCollectionData).length > 0) {
      console.log('Calculating collection stats...')
      calculateCollectionStats()
    } else {
      setCollectionStats({
        totalCards: 0,
        uniqueCards: 0,
        totalValue: 0,
        avgValue: 0,
        completionPercentage: 0
      })
    }
  }, [user, userCollectionData, quickStats.totalCards])

  // Separate effect for initial data that doesn't change with filters
  useEffect(() => {
    if (mounted) {
      fetchQuickStats()
      fetchAvailableRarities()
      fetchAvailableTypes()
    }
  }, [mounted])

  // Removed problematic loading timeout that was causing external link issues

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (currentPage > 1) {
            e.preventDefault()
            setCurrentPage(currentPage - 1)
          }
          break
        case 'ArrowRight':
          if (currentPage < totalPages) {
            e.preventDefault()
            setCurrentPage(currentPage + 1)
          }
          break
        case 'Home':
          if (currentPage !== 1) {
            e.preventDefault()
            setCurrentPage(1)
          }
          break
        case 'End':
          if (currentPage !== totalPages) {
            e.preventDefault()
            setCurrentPage(totalPages)
          }
          break
        case 'f':
        case 'F':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            // Focus search input
            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
            if (searchInput) {
              searchInput.focus()
            }
          } else {
            e.preventDefault()
            setShowFilters(!showFilters)
          }
          break
        case 's':
        case 'S':
          if (user && collectionStats.uniqueCards > 0) {
            e.preventDefault()
            setShowStats(!showStats)
          }
          break
        case 'c':
        case 'C':
          if (user) {
            e.preventDefault()
            setFilters({ ...filters, showOnlyCollection: !filters.showOnlyCollection })
          }
          break
        case 'g':
        case 'G':
          e.preventDefault()
          setViewMode(viewMode === 'grid' ? 'list' : 'grid')
          break
        case '?':
        case '/':
          e.preventDefault()
          setShowHelp(!showHelp)
          break
        case 'Escape':
          e.preventDefault()
          if (showHelp) setShowHelp(false)
          if (showFilters) setShowFilters(false)
          if (showStats) setShowStats(false)
          break
      }
    }

    if (mounted) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mounted, currentPage, showFilters, showStats, showHelp, filters.showOnlyCollection, viewMode, user, collectionStats.uniqueCards])

  const totalPages = useMemo(() => Math.ceil(totalCards / cardsPerPage), [totalCards])

  const fetchSets = async () => {
    try {
      const { data, error } = await supabaseClientRef.current
        .from('sets')
        .select('*')
        .order('release_date', { ascending: false })

      if (error) {
        console.error('Error fetching sets:', error.message)
      } else {
        setSets(data || [])
      }
    } catch (error) {
      console.error('Error fetching sets:', error)
    }
  }

  const fetchQuickStats = async () => {
    try {
      // Get total sets count
      const { count: setsCount } = await supabaseClientRef.current
        .from('sets')
        .select('*', { count: 'exact', head: true })

      // Get total cards count
      const { count: cardsCount } = await supabaseClientRef.current
        .from('cards')
        .select('*', { count: 'exact', head: true })

      // Get average price
      const { data: avgPriceData } = await supabaseClientRef.current
        .from('cards')
        .select('cardmarket_avg_sell_price')
        .not('cardmarket_avg_sell_price', 'is', null)

      const avgPrice = (avgPriceData && avgPriceData.length > 0)
        ? avgPriceData.reduce((sum, card) => sum + (card.cardmarket_avg_sell_price || 0), 0) / avgPriceData.length
        : 0

      setQuickStats({
        totalSets: setsCount || 0,
        totalCards: cardsCount || 0,
        avgPrice: Number(avgPrice.toFixed(2))
      })
    } catch (error) {
      console.error('Error fetching quick stats:', error)
    }
  }

  const fetchAvailableRarities = async () => {
    try {
      const { data, error } = await supabaseClientRef.current
        .from('cards')
        .select('rarity')
        .not('rarity', 'is', null)

      if (error) {
        console.error('Error fetching rarities:', error)
      } else {
        const uniqueRarities = new Set(data?.map(card => card.rarity) || [])
        const rarities = Array.from(uniqueRarities)
          .filter(Boolean)
          .sort()
        setAvailableRarities(rarities)
      }
    } catch (error) {
      console.error('Error fetching rarities:', error)
    }
  }

  const fetchAvailableTypes = async () => {
    try {
      const { data, error } = await supabaseClientRef.current
        .from('cards')
        .select('types')
        .not('types', 'is', null)

      if (error) {
        console.error('Error fetching types:', error)
      } else {
        const allTypes = new Set<string>()
        data?.forEach(card => {
          if (Array.isArray(card.types)) {
            card.types.forEach(type => allTypes.add(type))
          }
        })
        const types = Array.from(allTypes)
          .filter(Boolean)
          .sort()
        setAvailableTypes(types)
      }
    } catch (error) {
      console.error('Error fetching types:', error)
    }
  }

  const calculateCollectionStats = async () => {
    try {
      const collectionCardIds = Object.keys(userCollectionData)
      if (collectionCardIds.length === 0) return

      // Get card data for collection statistics
      const { data: collectionCards, error } = await supabaseClientRef.current
        .from('cards')
        .select('id, cardmarket_avg_sell_price')
        .in('id', collectionCardIds)

      if (error) {
        console.error('Error fetching collection card data:', error)
        return
      }

      let totalCards = 0
      let totalValue = 0
      const uniqueCards = collectionCardIds.length

      collectionCardIds.forEach(cardId => {
        const collectionData = userCollectionData[cardId]
        const cardData = collectionCards?.find(card => card.id === cardId)
        
        if (collectionData && cardData) {
          totalCards += collectionData.totalQuantity
          const cardPrice = cardData.cardmarket_avg_sell_price || 0
          totalValue += cardPrice * collectionData.totalQuantity
        }
      })

      const avgValue = totalCards > 0 ? totalValue / totalCards : 0
      const completionPercentage = quickStats.totalCards > 0
        ? (uniqueCards / quickStats.totalCards) * 100
        : 0

      setCollectionStats({
        totalCards,
        uniqueCards,
        totalValue,
        avgValue,
        completionPercentage
      })
    } catch (error) {
      console.error('Error calculating collection stats:', error)
    }
  }

  const fetchCards = async () => {
    try {
      setLoading(true)
      console.log('🔄 Fetching cards with filters:', filters)

      let query = supabaseClientRef.current
        .from('cards')
        .select(`
          id,
          name,
          number,
          set_id,
          rarity,
          types,
          image_small,
          image_large,
          cardmarket_avg_sell_price,
          cardmarket_low_price,
          cardmarket_trend_price,
          cardmarket_reverse_holo_sell,
          cardmarket_reverse_holo_low,
          cardmarket_reverse_holo_trend,
          created_at,
          sets(name, symbol_url, release_date)
        `, { count: 'exact' })

      // Apply search filters
      if (filters.search) {
        const searchTerm = filters.search.trim()
        
        // Check if search looks like a pure card number (contains # or is purely numeric)
        if (searchTerm.includes('#') || /^\d+$/.test(searchTerm)) {
          const numberSearch = searchTerm.replace('#', '')
          query = query.ilike('number', `%${numberSearch}%`)
        }
        // Check if search contains both text and numbers (e.g., "groudon 17")
        else if (/\w+\s+\d+/.test(searchTerm)) {
          const parts = searchTerm.split(/\s+/)
          const nameParts = parts.filter(part => !/^\d+$/.test(part))
          const numberParts = parts.filter(part => /^\d+$/.test(part))
          
          if (nameParts.length > 0 && numberParts.length > 0) {
            const nameSearch = nameParts.join(' ')
            const numberSearch = numberParts[0] // Use first number found
            
            // Search for cards that match both name and number
            query = query
              .ilike('name', `%${nameSearch}%`)
              .ilike('number', `%${numberSearch}%`)
          } else {
            // Fallback to name search if parsing fails
            query = query.ilike('name', `%${searchTerm}%`)
          }
        }
        else {
          // Search by card name (most common use case)
          query = query.ilike('name', `%${searchTerm}%`)
        }
      }

      if (filters.setId) {
        query = query.eq('set_id', filters.setId)
      }

      if (filters.rarity) {
        query = query.eq('rarity', filters.rarity)
      }

      if (filters.type) {
        // Filter cards that contain the selected type
        query = query.contains('types', [filters.type])
      }

      if (filters.priceMin > 0) {
        query = query.gte('cardmarket_avg_sell_price', filters.priceMin)
      }

      if (filters.priceMax < 1000) {
        query = query.lte('cardmarket_avg_sell_price', filters.priceMax)
      }

      // Temporarily disable collection filter to debug
      // if (filters.showOnlyCollection && user) {
      //   const collectionCardIds = Object.keys(userCollectionData).filter(cardId =>
      //     userCollectionData[cardId]?.totalQuantity > 0
      //   )
      //
      //   if (collectionCardIds.length === 0) {
      //     // User has no cards in collection, return empty result
      //     setCards([])
      //     setTotalCards(0)
      //     setLoading(false)
      //     return
      //   }
      //
      //   query = query.in('id', collectionCardIds)
      // }

      // Apply sorting
      let appliedSort = { column: '', ascending: filters.sortOrder === 'asc' }
      
      if (filters.sortBy === 'release_date') {
        // Sort by sets.release_date using the referencedTable.column syntax
        appliedSort.column = 'sets(release_date)'
        query = query.order('sets(release_date)', { ascending: filters.sortOrder === 'asc' })
      } else if (filters.sortBy === 'price') {
        // Sort by price (cardmarket_avg_sell_price) and filter out cards without pricing
        appliedSort.column = 'cardmarket_avg_sell_price'
        query = query
          .not('cardmarket_avg_sell_price', 'is', null)
          .gt('cardmarket_avg_sell_price', 0)
          .order('cardmarket_avg_sell_price', { ascending: filters.sortOrder === 'asc' })
      } else if (filters.sortBy === 'name') {
        appliedSort.column = 'name'
        query = query.order('name', { ascending: filters.sortOrder === 'asc' })
      } else if (filters.sortBy === 'number') {
        appliedSort.column = 'number'
        query = query.order('number', { ascending: filters.sortOrder === 'asc' })
      } else {
        // Default fallback
        appliedSort.column = 'name'
        query = query.order('name', { ascending: true })
      }
      
      console.log('📊 Applying sort:', {
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        dbColumn: appliedSort.column,
        ascending: appliedSort.ascending
      })

      // Apply pagination
      const from = (currentPage - 1) * cardsPerPage
      const to = from + cardsPerPage - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      console.log('✅ Query result:', {
        cardsFound: data?.length,
        totalCount: count,
        hasError: !!error
      })

      if (error) {
        console.error('Error fetching cards:', error.message, error)
        setCards([])
        setTotalCards(0)
      } else {
        // Transform cards to match Pokemon card component format
        let transformedCards = (data || []).map((card: any) => ({
          id: card.id,
          name: card.name,
          number: card.number,
          set: {
            id: card.set_id,
            name: card.sets?.name || '',
            releaseDate: card.sets?.release_date || card.created_at || ''
          },
          rarity: card.rarity,
          types: card.types || [],
          images: {
            small: card.image_small || '',
            large: card.image_large || ''
          },
          cardmarket: {
            prices: {
              averageSellPrice: card.cardmarket_avg_sell_price || 0,
              lowPrice: card.cardmarket_low_price || 0,
              trendPrice: card.cardmarket_trend_price || 0
            }
          },
          availableVariants: getAvailableVariants(card)
        }))
        
        console.log('🎴 Final cards sample:', transformedCards.slice(0, 3).map(card => ({
          name: card.name,
          set: card.set.name,
          releaseDate: card.set.releaseDate,
          price: card.cardmarket?.prices?.averageSellPrice
        })))
        
        setCards(transformedCards)
        setTotalCards(count || 0)
      }
    } catch (error) {
      console.error('Error fetching cards:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserCollection = async () => {
    if (!user) return

    try {
      const { data, error } = await supabaseClientRef.current
        .from('user_collections')
        .select('*')
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching user collection:', error)
      } else if (data) {
        const collectionMap: Record<string, any> = {}
        
        // Group by card_id and aggregate variants
        data.forEach((item: any) => {
          const cardId = item.card_id
          
          if (!collectionMap[cardId]) {
            collectionMap[cardId] = {
              cardId,
              userId: user.id,
              normal: 0,
              holo: 0,
              reverseHolo: 0,
              pokeballPattern: 0,
              masterballPattern: 0,
              firstEdition: 0,
              totalQuantity: 0,
              dateAdded: item.created_at,
              lastUpdated: item.updated_at
            }
          }

          // Update the earliest date and latest update
          if (item.created_at < collectionMap[cardId].dateAdded) {
            collectionMap[cardId].dateAdded = item.created_at
          }
          if (item.updated_at > collectionMap[cardId].lastUpdated) {
            collectionMap[cardId].lastUpdated = item.updated_at
          }

          // Add quantity to the appropriate variant
          const variant = item.variant || 'normal'
          switch (variant) {
            case 'normal':
              collectionMap[cardId].normal += item.quantity
              break
            case 'holo':
              collectionMap[cardId].holo += item.quantity
              break
            case 'reverse_holo':
              collectionMap[cardId].reverseHolo += item.quantity
              break
            case 'pokeball_pattern':
              collectionMap[cardId].pokeballPattern += item.quantity
              break
            case 'masterball_pattern':
              collectionMap[cardId].masterballPattern += item.quantity
              break
            case '1st_edition':
              collectionMap[cardId].firstEdition += item.quantity
              break
          }
          
          collectionMap[cardId].totalQuantity += item.quantity
        })
        
        setUserCollectionData(collectionMap)
      }
    } catch (error) {
      console.error('Error fetching user collection:', error)
    }
  }

  const handleToggleCollection = useCallback(async (cardId: string) => {
    if (!user) {
      router.push('/auth/signin')
      return
    }

    setLoadingStates(prev => ({ ...prev, [cardId]: true }))
    
    try {
      const isInCollection = userCollectionData[cardId]?.totalQuantity > 0
      
      if (isInCollection) {
        // Remove from collection
        const { error } = await supabaseClientRef.current
          .from('user_collections')
          .delete()
          .eq('user_id', user.id)
          .eq('card_id', cardId)

        if (!error) {
          setUserCollectionData(prev => {
            const newData = { ...prev }
            delete newData[cardId]
            return newData
          })

          // Check for achievement revocations after removing from collection
          try {
            const achievementResult = await achievementService.checkAchievements(user.id)
            if (achievementResult.success) {
              // Show toasts for revoked achievements
              if (achievementResult.revokedAchievements && achievementResult.revokedAchievements.length > 0) {
                achievementResult.revokedAchievements.forEach(achievementType => {
                  const definition = achievementService.getAchievementDefinition(achievementType)
                  if (definition) {
                    toastService.warning(`Achievement Revoked: ${definition.name}`, 'Collection no longer meets requirements')
                  }
                })
              }
            }
          } catch (achievementError) {
            console.warn('Failed to check achievements:', achievementError)
          }
        }
      } else {
        // Add to collection
        const { error } = await supabaseClientRef.current
          .from('user_collections')
          .insert({
            user_id: user.id,
            card_id: cardId,
            variant: 'normal',
            quantity: 1,
            condition: 'near_mint',
            is_foil: false
          })

        if (!error) {
          setUserCollectionData(prev => ({
            ...prev,
            [cardId]: {
              cardId,
              userId: user.id,
              normal: 1,
              holo: 0,
              reverseHolo: 0,
              pokeballPattern: 0,
              masterballPattern: 0,
              firstEdition: 0,
              totalQuantity: 1,
              dateAdded: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            }
          }))

          // Remove card from wishlist if it exists there
          try {
            const wishlistRemovalResult = await wishlistService.removeFromWishlistByCardId(user.id, cardId)
            if (wishlistRemovalResult.success) {
              console.log(`Card ${cardId} automatically removed from wishlist after being added to collection`)
            }
          } catch (wishlistError) {
            console.warn('Failed to remove card from wishlist:', wishlistError)
            // Don't fail the collection operation if wishlist removal fails
          }

          // Check for achievements after adding to collection
          try {
            const achievementResult = await achievementService.checkAchievements(user.id)
            if (achievementResult.success) {
              // Show toasts for new achievements
              if (achievementResult.newAchievements && achievementResult.newAchievements.length > 0) {
                achievementResult.newAchievements.forEach(achievement => {
                  const definition = achievementService.getAchievementDefinition(achievement.achievement_type)
                  if (definition) {
                    toastService.achievement(`Achievement Unlocked: ${definition.name}`, definition.description, definition.icon)
                  }
                })
              }
            }
          } catch (achievementError) {
            console.warn('Failed to check achievements:', achievementError)
          }
        }
      }
    } catch (error) {
      console.error('Error toggling collection:', error)
    } finally {
      setLoadingStates(prev => ({ ...prev, [cardId]: false }))
    }
  }, [user, userCollectionData, router])

  const handleAddVariant = useCallback(async (cardId: string, variant: CardVariant) => {
    if (!user) {
      router.push('/auth/signin')
      return
    }

    setLoadingStates(prev => ({ ...prev, [cardId]: true }))
    
    try {
      // Check if this variant already exists
      const { data: existingVariant, error: checkError } = await supabaseClientRef.current
        .from('user_collections')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', cardId)
        .eq('variant', variant as any)
        .eq('condition', 'near_mint')
        .eq('is_foil', false)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      if (existingVariant) {
        // Update existing variant quantity
        const { error } = await supabaseClientRef.current
          .from('user_collections')
          .update({
            quantity: existingVariant.quantity + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingVariant.id)

        if (error) throw error
      } else {
        // Insert new variant
        const { error } = await supabaseClientRef.current
          .from('user_collections')
          .insert({
            user_id: user.id,
            card_id: cardId,
            variant: variant as any,
            quantity: 1,
            condition: 'near_mint',
            is_foil: false
          })

        if (error) throw error
      }

      // Update local state instead of refetching to avoid infinite loops
      const current = userCollectionData[cardId] || {
        cardId,
        userId: user.id,
        normal: 0,
        holo: 0,
        reverseHolo: 0,
        pokeballPattern: 0,
        masterballPattern: 0,
        firstEdition: 0,
        totalQuantity: 0,
        dateAdded: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }
      
      const variantKey = variant === 'reverse_holo' ? 'reverseHolo' :
                        variant === 'pokeball_pattern' ? 'pokeballPattern' :
                        variant === 'masterball_pattern' ? 'masterballPattern' :
                        variant === '1st_edition' ? 'firstEdition' : variant
      
      setUserCollectionData(prev => ({
        ...prev,
        [cardId]: {
          ...current,
          [variantKey]: (current[variantKey] || 0) + 1,
          totalQuantity: (current.totalQuantity || 0) + 1,
          lastUpdated: new Date().toISOString()
        }
      }))

      // Remove card from wishlist if it exists there
      try {
        const wishlistRemovalResult = await wishlistService.removeFromWishlistByCardId(user.id, cardId)
        if (wishlistRemovalResult.success) {
          console.log(`Card ${cardId} automatically removed from wishlist after being added to collection`)
        }
      } catch (wishlistError) {
        console.warn('Failed to remove card from wishlist:', wishlistError)
        // Don't fail the collection operation if wishlist removal fails
      }

      // Check for achievements after adding variant
      try {
        const achievementResult = await achievementService.checkAchievements(user.id)
        if (achievementResult.success) {
          // Show toasts for new achievements
          if (achievementResult.newAchievements && achievementResult.newAchievements.length > 0) {
            achievementResult.newAchievements.forEach(achievement => {
              const definition = achievementService.getAchievementDefinition(achievement.achievement_type)
              if (definition) {
                toastService.achievement(`Achievement Unlocked: ${definition.name}`, definition.description, definition.icon)
              }
            })
          }
        }
      } catch (achievementError) {
        console.warn('Failed to check achievements:', achievementError)
      }
    } catch (error) {
      console.error('Error adding variant:', error)
    } finally {
      setLoadingStates(prev => ({ ...prev, [cardId]: false }))
    }
  }, [user, userCollectionData, router])

  const handleRemoveVariant = useCallback(async (cardId: string, variant: CardVariant) => {
    if (!user) return

    setLoadingStates(prev => ({ ...prev, [cardId]: true }))
    
    try {
      // Find the specific variant entry
      const { data: variantEntry, error: findError } = await supabaseClientRef.current
        .from('user_collections')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', cardId)
        .eq('variant', variant as any)
        .single()

      if (findError) {
        console.error('Error finding variant:', findError)
        return
      }

      if (variantEntry.quantity > 1) {
        // Decrease quantity
        const { error } = await supabaseClientRef.current
          .from('user_collections')
          .update({
            quantity: variantEntry.quantity - 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', variantEntry.id)

        if (error) throw error
      } else {
        // Remove the variant entry completely
        const { error } = await supabaseClientRef.current
          .from('user_collections')
          .delete()
          .eq('id', variantEntry.id)

        if (error) throw error
      }

      // Update local state instead of refetching to avoid infinite loops
      const current = userCollectionData[cardId]
      if (!current) return
      
      const variantKey = variant === 'reverse_holo' ? 'reverseHolo' :
                        variant === 'pokeball_pattern' ? 'pokeballPattern' :
                        variant === 'masterball_pattern' ? 'masterballPattern' :
                        variant === '1st_edition' ? 'firstEdition' : variant
      
      const newQuantity = Math.max(0, (current[variantKey] || 0) - 1)
      const newTotal = Math.max(0, (current.totalQuantity || 0) - 1)
      
      if (newTotal === 0) {
        // Remove from collection data
        setUserCollectionData(prev => {
          const newData = { ...prev }
          delete newData[cardId]
          return newData
        })
      } else {
        setUserCollectionData(prev => ({
          ...prev,
          [cardId]: {
            ...current,
            [variantKey]: newQuantity,
            totalQuantity: newTotal,
            lastUpdated: new Date().toISOString()
          }
        }))
      }

      // Check for achievement revocations after removing variant
      try {
        const achievementResult = await achievementService.checkAchievements(user.id)
        if (achievementResult.success) {
          // Show toasts for revoked achievements
          if (achievementResult.revokedAchievements && achievementResult.revokedAchievements.length > 0) {
            achievementResult.revokedAchievements.forEach(achievementType => {
              const definition = achievementService.getAchievementDefinition(achievementType)
              if (definition) {
                toastService.warning(`Achievement Revoked: ${definition.name}`, 'Collection no longer meets requirements')
              }
            })
          }
        }
      } catch (achievementError) {
        console.warn('Failed to check achievements:', achievementError)
      }
    } catch (error) {
      console.error('Error removing variant:', error)
    } finally {
      setLoadingStates(prev => ({ ...prev, [cardId]: false }))
    }
  }, [user, userCollectionData])

  const handleViewDetails = useCallback((cardId: string) => {
    // Prevent duplicate modal opens
    if (selectedCardId === cardId && isModalOpen) {
      return
    }
    
    setSelectedCardId(cardId)
    setIsModalOpen(true)
    
    // Update URL to persist modal state
    const url = new URL(window.location.href)
    url.searchParams.set('card', cardId)
    window.history.pushState({ cardId }, '', url.toString())
  }, [selectedCardId, isModalOpen])

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedCardId(null)
    
    // Remove card parameter from URL
    const url = new URL(window.location.href)
    url.searchParams.delete('card')
    window.history.pushState({}, '', url.toString())
    
    // Clean up sessionStorage
    sessionStorage.removeItem('pokemon-modal-state')
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

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      setId: '',
      rarity: '',
      type: '',
      priceMin: 0,
      priceMax: 1000,
      sortBy: 'name',
      sortOrder: 'asc',
      showOnlyCollection: false
    })
    setCurrentPage(1)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <Navigation>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Title and Stats */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white">
              Browse Cards
            </h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                {totalCards.toLocaleString()} cards found
                {quickStats.totalCards > 0 && (
                  <span className="ml-2 text-xs text-gray-500">
                    • {quickStats.totalSets} sets • Avg {currencyService.formatCurrency(quickStats.avgPrice, preferredCurrency || 'EUR', locale)}
                  </span>
                )}
              </div>
              
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
              
              {/* Help Toggle */}
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={`btn-secondary flex items-center ${showHelp ? 'bg-pokemon-gold text-black' : ''}`}
                title="Keyboard shortcuts (Press ? for help)"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Help
              </button>
            </div>
          </div>
        </div>
        {/* Advanced Search Bar with Action Buttons */}
        <div className="mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search by name, set, or card number (e.g., 'Pikachu', 'Base Set', '#25')..."
                  className="input-gaming pl-10 w-full"
                />
                {filters.search && (
                  <button
                    onClick={() => setFilters({ ...filters, search: '' })}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Search Tips */}
              {filters.search === '' && (
                <div className="mt-2 text-xs text-gray-500">
                  <span className="font-medium">Search tips:</span> Use card names (Charizard), set names (Base Set), or numbers (#6, 25) for better results
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
              {/* Collection Filter Toggle */}
              {user && (
                <button
                  onClick={() => setFilters({ ...filters, showOnlyCollection: !filters.showOnlyCollection })}
                  className={`btn-secondary flex items-center ${filters.showOnlyCollection ? 'bg-pokemon-gold text-black' : ''}`}
                  title="Show only cards in your collection"
                >
                  <Heart className="w-4 h-4 mr-2" />
                  My Collection
                </button>
              )}

              {/* Stats Toggle */}
              {user && collectionStats.uniqueCards > 0 && (
                <button
                  onClick={() => setShowStats(!showStats)}
                  className={`btn-secondary flex items-center ${showStats ? 'bg-pokemon-gold text-black' : ''}`}
                  title="Show collection statistics"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Stats
                </button>
              )}
              
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
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="card-container mb-6 animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Filters</h3>
              <div className="flex items-center space-x-2">
                <button onClick={clearFilters} className="btn-outline btn-sm">
                  Clear All
                </button>
                <button onClick={() => setShowFilters(false)} className="p-1 text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Set Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Set</label>
                <select
                  value={filters.setId}
                  onChange={(e) => setFilters({ ...filters, setId: e.target.value })}
                  className="input-gaming"
                >
                  <option value="">All Sets</option>
                  {sets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rarity Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rarity</label>
                <select
                  value={filters.rarity}
                  onChange={(e) => setFilters({ ...filters, rarity: e.target.value })}
                  className="input-gaming"
                >
                  <option value="">All Rarities</option>
                  {availableRarities.map((rarity) => (
                    <option key={rarity} value={rarity}>
                      {rarity}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="input-gaming"
                >
                  <option value="">All Types</option>
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
                <select
                  value={`${filters.sortBy}-${filters.sortOrder}`}
                  onChange={(e) => {
                    const [sortBy, sortOrder] = e.target.value.split('-')
                    setFilters({ 
                      ...filters, 
                      sortBy: sortBy as CardFilters['sortBy'], 
                      sortOrder: sortOrder as CardFilters['sortOrder'] 
                    })
                  }}
                  className="input-gaming"
                >
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="number-asc">Number Low-High</option>
                  <option value="number-desc">Number High-Low</option>
                  <option value="price-asc">Price Low-High</option>
                  <option value="price-desc">Price High-Low</option>
                  <option value="release_date-desc">Release Date (Newest)</option>
                  <option value="release_date-asc">Release Date (Oldest)</option>
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Price Range ({currencyService.getCurrencySymbol(preferredCurrency || 'EUR')})</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={filters.priceMin}
                    onChange={(e) => setFilters({ ...filters, priceMin: Number(e.target.value) })}
                    placeholder="Min"
                    min="0"
                    step="0.01"
                    className="input-gaming w-full"
                  />
                  <input
                    type="number"
                    value={filters.priceMax}
                    onChange={(e) => setFilters({ ...filters, priceMax: Number(e.target.value) })}
                    placeholder="Max"
                    min="0"
                    step="0.01"
                    className="input-gaming w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Collection Statistics Panel */}
        {showStats && user && collectionStats.uniqueCards > 0 && (
          <div className="card-container mb-6 animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-pokemon-gold" />
                Collection Statistics
              </h3>
              <button onClick={() => setShowStats(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Cards */}
              <div className="bg-pkmn-surface rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Cards</p>
                    <p className="text-2xl font-bold text-white">{collectionStats.totalCards}</p>
                  </div>
                  <Package2 className="w-8 h-8 text-pokemon-gold" />
                </div>
              </div>

              {/* Unique Cards */}
              <div className="bg-pkmn-surface rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Unique Cards</p>
                    <p className="text-2xl font-bold text-white">{collectionStats.uniqueCards}</p>
                  </div>
                  <Award className="w-8 h-8 text-blue-400" />
                </div>
              </div>

              {/* Total Value */}
              <div className="bg-pkmn-surface rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Value</p>
                    <p className="text-2xl font-bold text-green-400">{currencyService.formatCurrency(collectionStats.totalValue, preferredCurrency || 'EUR', locale)}</p>
                  </div>
                  <Coins className="w-8 h-8 text-green-400" />
                </div>
              </div>

              {/* Completion */}
              <div className="bg-pkmn-surface rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Completion</p>
                    <p className="text-2xl font-bold text-purple-400">{collectionStats.completionPercentage.toFixed(1)}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-400" />
                </div>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-pkmn-surface rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Average Card Value</h4>
                <p className="text-xl font-bold text-pokemon-gold">{currencyService.formatCurrency(collectionStats.avgValue, preferredCurrency || 'EUR', locale)}</p>
              </div>
              <div className="bg-pkmn-surface rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Collection Progress</h4>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-pokemon-gold h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, collectionStats.completionPercentage)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {collectionStats.uniqueCards} of {quickStats.totalCards} cards collected
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Help Modal */}
        {showHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-pkmn-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white flex items-center">
                    <Keyboard className="w-6 h-6 mr-2 text-pokemon-gold" />
                    Keyboard Shortcuts
                  </h3>
                  <button onClick={() => setShowHelp(false)} className="p-1 text-gray-400 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Navigation */}
                  <div>
                    <h4 className="text-lg font-semibold text-pokemon-gold mb-3">Navigation</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Previous page</span>
                        <kbd className="px-2 py-1 bg-pkmn-surface rounded text-sm">←</kbd>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Next page</span>
                        <kbd className="px-2 py-1 bg-pkmn-surface rounded text-sm">→</kbd>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">First page</span>
                        <kbd className="px-2 py-1 bg-pkmn-surface rounded text-sm">Home</kbd>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Last page</span>
                        <kbd className="px-2 py-1 bg-pkmn-surface rounded text-sm">End</kbd>
                      </div>
                    </div>
                  </div>

                  {/* Interface */}
                  <div>
                    <h4 className="text-lg font-semibold text-pokemon-gold mb-3">Interface</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Toggle filters</span>
                        <kbd className="px-2 py-1 bg-pkmn-surface rounded text-sm">F</kbd>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Focus search</span>
                        <kbd className="px-2 py-1 bg-pkmn-surface rounded text-sm">Ctrl+F</kbd>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Toggle view mode</span>
                        <kbd className="px-2 py-1 bg-pkmn-surface rounded text-sm">G</kbd>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Show help</span>
                        <kbd className="px-2 py-1 bg-pkmn-surface rounded text-sm">?</kbd>
                      </div>
                    </div>
                  </div>

                  {/* Collection */}
                  {user && (
                    <div>
                      <h4 className="text-lg font-semibold text-pokemon-gold mb-3">Collection</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">My collection filter</span>
                          <kbd className="px-2 py-1 bg-pkmn-surface rounded text-sm">C</kbd>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Toggle statistics</span>
                          <kbd className="px-2 py-1 bg-pkmn-surface rounded text-sm">S</kbd>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* General */}
                  <div>
                    <h4 className="text-lg font-semibold text-pokemon-gold mb-3">General</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Close panels</span>
                        <kbd className="px-2 py-1 bg-pkmn-surface rounded text-sm">Esc</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-pkmn-surface rounded-lg">
                  <p className="text-sm text-gray-400">
                    <strong>Tip:</strong> Keyboard shortcuts work when you're not typing in an input field.
                    Press <kbd className="px-1 py-0.5 bg-pkmn-card rounded text-xs">Esc</kbd> to close any open panels.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cards Display */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              {/* Loading Animation */}
              <div className="mb-8">
                <div className="text-6xl mb-4 animate-bounce">🃏</div>
                <div className="flex justify-center space-x-2">
                  <div className="w-3 h-3 bg-pokemon-gold rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-3 h-3 bg-pokemon-gold rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-3 h-3 bg-pokemon-gold rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
              
              {/* Loading Text */}
              <h2 className="text-2xl font-bold text-white mb-4">
                Loading Pokemon Cards...
              </h2>
              <p className="text-gray-400">
                Preparing your collection experience
              </p>
              
              {/* Decorative Elements */}
              <div className="mt-12 opacity-20">
                <div className="flex justify-center space-x-4 text-2xl">
                  <span className="animate-pulse" style={{ animationDelay: '0s' }}>⚡</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>🔥</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>💧</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.6s' }}>🌿</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.8s' }}>🌟</span>
                </div>
              </div>
            </div>
          </div>
        ) : cards.length === 0 ? (
          <div className="card-container text-center py-20">
            <div className="text-4xl mb-4 opacity-50">🃏</div>
            <h3 className="text-xl font-semibold text-white mb-2">No cards found</h3>
            <p className="text-gray-400 mb-6">Try adjusting your search or filters</p>
            <button onClick={clearFilters} className="btn-gaming">
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <PokemonCardGrid
                cards={cards}
                collectionData={userCollectionData}
                onToggleCollection={handleToggleCollection}
                onAddVariant={handleAddVariant}
                onRemoveVariant={handleRemoveVariant}
                onViewDetails={handleViewDetails}
                currency={preferredCurrency}
                loading={loadingStates}
                className="animate-fade-in"
              />
            ) : (
              <PokemonCardList
                cards={cards}
                collectionData={userCollectionData}
                onToggleCollection={handleToggleCollection}
                onAddVariant={handleAddVariant}
                onRemoveVariant={handleRemoveVariant}
                onViewDetails={handleViewDetails}
                currency={preferredCurrency}
                loading={loadingStates}
                className="animate-fade-in"
              />
            )}

            {/* Enhanced Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mt-8">
                {/* Previous Button */}
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center space-x-2">
                  {/* First page */}
                  {currentPage > 3 && (
                    <>
                      <button
                        onClick={() => setCurrentPage(1)}
                        className="w-10 h-10 rounded-lg font-medium transition-colors bg-pkmn-surface text-gray-400 hover:text-white hover:bg-gray-600"
                      >
                        1
                      </button>
                      {currentPage > 4 && <span className="text-gray-400">...</span>}
                    </>
                  )}
                  
                  {/* Current page range */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + Math.max(1, currentPage - 2)
                    if (page > totalPages || (currentPage > 3 && page === 1)) return null
                    
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          page === currentPage
                            ? 'bg-pokemon-gold text-black'
                            : 'bg-pkmn-surface text-gray-400 hover:text-white hover:bg-gray-600'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
                  
                  {/* Last page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="text-gray-400">...</span>}
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className="w-10 h-10 rounded-lg font-medium transition-colors bg-pkmn-surface text-gray-400 hover:text-white hover:bg-gray-600"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
                
                {/* Jump to Page */}
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-gray-400">Go to:</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value)
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page)
                      }
                    }}
                    className="w-16 px-2 py-1 bg-pkmn-surface border border-gray-600 rounded text-white text-center focus:border-pokemon-gold focus:outline-none"
                  />
                  <span className="text-gray-400">of {totalPages}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Card Details Modal */}
      <CardDetailsModal
        cardId={selectedCardId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onCollectionChange={handleCollectionChange}
        supabaseClient={supabaseClientRef.current}
      />
    </Navigation>
  )
}

export default function CardsPage() {
  return (
    <ProtectedRoute>
      <CardsContent />
    </ProtectedRoute>
  )
}