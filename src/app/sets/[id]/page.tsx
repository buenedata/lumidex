'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import { collectionService } from '@/lib/collection-service'
import { wishlistService } from '@/lib/wishlist-service'
import { achievementService } from '@/lib/achievement-service'
import { toastService } from '@/lib/toast-service'
import { PokemonCardGrid, PokemonCardList } from '@/components/pokemon/PokemonCard'
import { getAvailableVariants } from '@/components/pokemon/CollectionButtons'
import { CardDetailsModal } from '@/components/pokemon/CardDetailsModal'
import { VariantExplanation, getSetVariants } from '@/components/pokemon/VariantExplanation'
import { BulkWishlistSelectionModal } from '@/components/pokemon/BulkWishlistSelectionModal'
import { CardVariant } from '@/types/pokemon'
import MainNavBar from '@/components/navigation/MainNavBar'
import EnhancedMegaMenu from '@/components/navigation/EnhancedMegaMenu'
import { NavigationProvider } from '@/contexts/NavigationContext'
import { PriceDisplay } from '@/components/PriceDisplay'
import { calculateCardVariantValue } from '@/lib/variant-pricing'
import { FallbackImage } from '@/components/ui/FallbackImage'
import {
  ArrowLeft,
  Calendar,
  Package,
  TrendingUp,
  Star,
  Search,
  Grid3X3,
  List,
  BarChart3,
  ShoppingCart,
  Eye,
  Trash2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Hash,
  Type,
  Gem,
  DollarSign
} from 'lucide-react'

interface SetData {
  id: string
  name: string
  series: string
  total_cards: number
  release_date: string
  symbol_url?: string | null
  logo_url?: string | null
  background_url?: string | null
  ptcgo_code?: string | null
}

interface CardData {
  id: string
  name: string
  number: string
  rarity: string
  types: string[]
  image_small: string
  image_large: string
  cardmarket_avg_sell_price: number | null
  cardmarket_low_price: number | null
  cardmarket_trend_price: number | null
  cardmarket_reverse_holo_sell?: number | null
  cardmarket_reverse_holo_low?: number | null
  cardmarket_reverse_holo_trend?: number | null
}

function SetPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const setId = params.id as string
  const targetCardId = searchParams.get('cardId')
  const supabaseClientRef = useRef(supabase)

  const [setData, setSetData] = useState<SetData | null>(null)
  const [cards, setCards] = useState<CardData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'number' | 'name' | 'rarity' | 'price'>('number')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [userCollection, setUserCollection] = useState<Record<string, number>>({})
  const [userCollectionData, setUserCollectionData] = useState<Record<string, any>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null)
  const [collectionMode, setCollectionMode] = useState<'regular' | 'master'>('regular')
  const [filterMode, setFilterMode] = useState<'all' | 'need' | 'have' | 'duplicates'>('all')
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showBulkWishlistModal, setShowBulkWishlistModal] = useState(false)

  useEffect(() => {
    if (setId) {
      fetchSetData()
      fetchCards()
      if (user) {
        fetchUserCollection()
      }
    }
  }, [setId, user?.id])

  // Handle scrolling to target card
  useEffect(() => {
    if (targetCardId && cards.length > 0 && !loading) {
      // Set highlighted card
      setHighlightedCardId(targetCardId)
      
      // Scroll to card after a short delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const cardElement = document.querySelector(`[data-card-id="${targetCardId}"]`)
        if (cardElement) {
          cardElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          })
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            setHighlightedCardId(null)
          }, 3000)
        }
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [targetCardId, cards, loading])

  const fetchSetData = async () => {
    try {
      const { data, error } = await supabase
        .from('sets')
        .select('*')
        .eq('id', setId)
        .single()

      if (error) {
        console.error('Error fetching set data:', error)
        router.push('/cards')
        return
      }

      setSetData(data)
    } catch (error) {
      console.error('Error fetching set data:', error)
      router.push('/cards')
    }
  }

  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select(`
          id,
          name,
          number,
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
          set_id
        `)
        .eq('set_id', setId)
        .order('number', { ascending: true })

      if (error) {
        console.error('Error fetching cards:', error)
      } else {
        setCards(data || [])
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
        const simpleCollectionMap: Record<string, number> = {}
        
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
          simpleCollectionMap[cardId] = (simpleCollectionMap[cardId] || 0) + item.quantity
        })
        
        setUserCollectionData(collectionMap)
        setUserCollection(simpleCollectionMap)
      }
    } catch (error) {
      console.error('Error fetching user collection:', error)
    }
  }

  const handleToggleCollection = async (cardId: string) => {
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
          setUserCollection(prev => {
            const newData = { ...prev }
            delete newData[cardId]
            return newData
          })
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
          setUserCollection(prev => ({
            ...prev,
            [cardId]: 1
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
        }
      }
    } catch (error) {
      console.error('Error toggling collection:', error)
    } finally {
      setLoadingStates(prev => ({ ...prev, [cardId]: false }))
    }
  }

  const handleAddVariant = async (cardId: string, variant: CardVariant) => {
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
        .eq('variant', variant as any) // Temporary type assertion until DB types are updated
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
            variant: variant as any, // Temporary type assertion until DB types are updated
            quantity: 1,
            condition: 'near_mint',
            is_foil: false
          })

        if (error) throw error
      }

      // Update local state
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
      
      setUserCollection(prev => ({
        ...prev,
        [cardId]: (prev[cardId] || 0) + 1
      }))

      // Remove card from wishlist if it exists there
      try {
        const wishlistRemovalResult = await wishlistService.removeFromWishlistByCardId(user.id, cardId)
        if (wishlistRemovalResult.success) {
          console.log(`Card ${cardId} automatically removed from wishlist after adding variant ${variant}`)
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
  }

  const handleRemoveVariant = async (cardId: string, variant: CardVariant) => {
    if (!user) return

    setLoadingStates(prev => ({ ...prev, [cardId]: true }))
    
    try {
      // Find the specific variant entry
      const { data: variantEntry, error: findError } = await supabaseClientRef.current
        .from('user_collections')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', cardId)
        .eq('variant', variant as any) // Temporary type assertion until DB types are updated
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

      // Update local state
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
        setUserCollection(prev => {
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
        setUserCollection(prev => ({
          ...prev,
          [cardId]: newTotal
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
  }

  const handleResetSet = async () => {
    if (!user || !setId) return

    setIsResetting(true)
    
    try {
      // Get all cards in this set to find which ones the user has collected
      const cardsInSet = cards.map(card => card.id)
      
      // Delete all collection entries for this user and this set's cards
      const { error } = await supabaseClientRef.current
        .from('user_collections')
        .delete()
        .eq('user_id', user.id)
        .in('card_id', cardsInSet)

      if (error) {
        console.error('Error resetting set:', error)
        toastService.error('Failed to reset set', 'Please try again later')
        return
      }

      // Clear local state
      setUserCollectionData({})
      setUserCollection({})
      
      // Show success message
      toastService.success('Set Reset Complete', `All cards from ${setData?.name} have been removed from your collection`)
      
      // Close confirmation dialog
      setShowResetConfirmation(false)

      // Check for achievement revocations after reset
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
      console.error('Error resetting set:', error)
      toastService.error('Failed to reset set', 'Please try again later')
    } finally {
      setIsResetting(false)
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

  const handleSortToggle = (newSortBy: 'number' | 'name' | 'rarity' | 'price') => {
    if (sortBy === newSortBy) {
      // Toggle sort order if same sort type
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new sort type with ascending order
      setSortBy(newSortBy)
      setSortOrder('asc')
    }
  }

  const handleCollectionChange = (cardId: string, collectionData: any) => {
    if (collectionData === null) {
      // Card was removed from collection
      setUserCollectionData(prev => {
        const newData = { ...prev }
        delete newData[cardId]
        return newData
      })
      setUserCollection(prev => {
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
      setUserCollection(prev => ({
        ...prev,
        [cardId]: collectionData.totalQuantity
      }))
    }
  }

  // Helper function to check if a card is collected (regular mode - any variant)
  const isCardCollected = (card: CardData) => {
    if (!user || !userCollectionData[card.id]) return false
    return userCollectionData[card.id].totalQuantity > 0
  }

  // Helper function to check if all variants of a card are collected (master mode)
  const isCardComplete = (card: CardData) => {
    if (!user || !userCollectionData[card.id]) return false
    
    const collectionData = userCollectionData[card.id]
    const availableVariants = getAvailableVariants({
      ...card,
      set: {
        id: setId,
        name: setData?.name || '',
        releaseDate: setData?.release_date || ''
      }
    })
    
    // Check if user has at least one of each available variant
    for (const variant of availableVariants) {
      const variantKey = variant === 'reverse_holo' ? 'reverseHolo' :
                        variant === 'pokeball_pattern' ? 'pokeballPattern' :
                        variant === 'masterball_pattern' ? 'masterballPattern' :
                        variant === '1st_edition' ? 'firstEdition' : variant
      
      if (!collectionData[variantKey] || collectionData[variantKey] === 0) {
        return false
      }
    }
    
    return true
  }

  // Helper function to check if a card has duplicates (more than 1 of any single variant)
  const hasCardDuplicates = (card: CardData) => {
    if (!user || !userCollectionData[card.id]) return false
    
    const collectionData = userCollectionData[card.id]
    
    // Check if any individual variant has quantity > 1
    return (
      (collectionData.normal || 0) > 1 ||
      (collectionData.holo || 0) > 1 ||
      (collectionData.reverseHolo || 0) > 1 ||
      (collectionData.pokeballPattern || 0) > 1 ||
      (collectionData.masterballPattern || 0) > 1 ||
      (collectionData.firstEdition || 0) > 1
    )
  }

  // Helper function to count total duplicate cards for a specific card
  const getCardDuplicateCount = (card: CardData) => {
    if (!user || !userCollectionData[card.id]) return 0
    
    const collectionData = userCollectionData[card.id]
    let duplicateCount = 0
    
    // Count duplicates for each variant (quantity - 1 for each variant that has more than 1)
    if ((collectionData.normal || 0) > 1) {
      duplicateCount += (collectionData.normal - 1)
    }
    if ((collectionData.holo || 0) > 1) {
      duplicateCount += (collectionData.holo - 1)
    }
    if ((collectionData.reverseHolo || 0) > 1) {
      duplicateCount += (collectionData.reverseHolo - 1)
    }
    if ((collectionData.pokeballPattern || 0) > 1) {
      duplicateCount += (collectionData.pokeballPattern - 1)
    }
    if ((collectionData.masterballPattern || 0) > 1) {
      duplicateCount += (collectionData.masterballPattern - 1)
    }
    if ((collectionData.firstEdition || 0) > 1) {
      duplicateCount += (collectionData.firstEdition - 1)
    }
    
    return duplicateCount
  }

  // Helper function to determine if a card is completed based on current mode
  const isCardCompletedInMode = (card: CardData) => {
    if (collectionMode === 'master') {
      return isCardComplete(card)
    } else {
      return isCardCollected(card)
    }
  }

  const filteredAndSortedCards = cards
    .filter(card => {
      // First apply search filter
      const matchesSearch = card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           card.number.includes(searchQuery)
      
      if (!matchesSearch) return false
      
      // Then apply collection filter based on mode
      switch (filterMode) {
        case 'need':
          return !isCardCompletedInMode(card)
        case 'have':
          return isCardCompletedInMode(card)
        case 'duplicates':
          return hasCardDuplicates(card)
        case 'all':
        default:
          return true
      }
    })
    .sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'number':
          aValue = parseInt(a.number) || 0
          bValue = parseInt(b.number) || 0
          break
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'rarity':
          aValue = a.rarity || ''
          bValue = b.rarity || ''
          break
        case 'price':
          aValue = a.cardmarket_avg_sell_price || 0
          bValue = b.cardmarket_avg_sell_price || 0
          break
        default:
          return 0
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  const collectedCards = cards.filter(card => isCardCompletedInMode(card)).length
  const totalValue = cards.reduce((sum, card) => sum + (card.cardmarket_avg_sell_price || 0), 0)
  
  // Calculate user value based on actual variant quantities and their specific pricing
  const userValue = cards
    .filter(card => userCollectionData[card.id])
    .reduce((sum, card) => {
      const collectionData = userCollectionData[card.id]
      if (!collectionData) return sum
      
      const cardValue = calculateCardVariantValue(
        {
          cardmarket_avg_sell_price: card.cardmarket_avg_sell_price,
          cardmarket_low_price: card.cardmarket_low_price,
          cardmarket_trend_price: card.cardmarket_trend_price,
          cardmarket_reverse_holo_sell: (card as any).cardmarket_reverse_holo_sell,
          cardmarket_reverse_holo_low: (card as any).cardmarket_reverse_holo_low,
          cardmarket_reverse_holo_trend: (card as any).cardmarket_reverse_holo_trend,
        },
        {
          normal: collectionData.normal || 0,
          holo: collectionData.holo || 0,
          reverseHolo: collectionData.reverseHolo || 0,
          pokeballPattern: collectionData.pokeballPattern || 0,
          masterballPattern: collectionData.masterballPattern || 0,
          firstEdition: collectionData.firstEdition || 0,
        }
      )
      
      return sum + cardValue
    }, 0)

  // Calculate counts for filter buttons
  const needCount = cards.filter(card => !isCardCompletedInMode(card)).length
  const haveCount = cards.filter(card => isCardCompletedInMode(card)).length
  const duplicatesCount = cards.reduce((total, card) => total + getCardDuplicateCount(card), 0)

  // Get need cards for bulk wishlist
  const needCards = cards.filter(card => !isCardCompletedInMode(card))
  const needCardIds = needCards.map(card => card.id)

  const handleBulkAddToWishlist = () => {
    if (needCardIds.length === 0) {
      return
    }
    setShowBulkWishlistModal(true)
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🃏</div>
          <h2 className="text-2xl font-bold text-white mb-4">Loading Set...</h2>
          <p className="text-gray-400">Preparing your set experience</p>
        </div>
      </div>
    )
  }

  if (!setData) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-50">❌</div>
          <h3 className="text-xl font-semibold text-white mb-2">Set not found</h3>
          <p className="text-gray-400 mb-6">The requested set could not be found</p>
          <Link href="/dashboard" className="btn-gaming">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <NavigationProvider>
      <div className="min-h-screen bg-pkmn-dark">
        {/* Main Navigation */}
        <MainNavBar />
        
        {/* Enhanced Mega Menu */}
        <div className="relative">
          <EnhancedMegaMenu />
        </div>

      {/* Page Header with Back Button */}
      <header className="bg-pkmn-card border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/series" className="flex items-center text-white hover:text-gray-300 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Series
              </Link>
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
                onClick={() => setViewMode('table')}
                className={`p-2 rounded ${viewMode === 'table' ? 'bg-pokemon-gold text-black' : 'text-gray-400 hover:text-white'}`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Set Info Panel with Background */}
        <div className="relative mb-6 rounded-lg overflow-hidden">
          {/* Background Image with Blur */}
          {(setData.background_url || setData.logo_url || setData.id) && (
            <div className="absolute inset-0">
              <Image
                src={
                  setData.background_url ||
                  `/images/sets/backgrounds/${setData.id}.webp`
                }
                alt={`${setData.name} background`}
                fill
                className="object-cover opacity-30 blur-sm"
                sizes="(max-width: 1280px) 100vw, 1280px"
              />
              <div className="absolute inset-0 bg-pkmn-card/90 backdrop-blur-md"></div>
            </div>
          )}
          
          {/* Content */}
          <div className="relative card-container">
            {/* Set Header */}
            <div className="flex items-center space-x-4 mb-6 pb-6 border-b border-gray-600/50">
              {setData.symbol_url && (
                <Image
                  src={setData.symbol_url}
                  alt={setData.name}
                  width={48}
                  height={48}
                  className="rounded-lg"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">{setData.name}</h1>
                <p className="text-lg text-gray-300">{setData.series}</p>
              </div>
            </div>

            {/* Stats Grid - Now includes collection info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-pokemon-gold" />
                <div>
                  <p className="text-sm text-gray-400">Release Date</p>
                  <p className="text-white font-medium">
                    {new Date(setData.release_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Package className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-sm text-gray-400">Cards</p>
                  <p className="text-white font-medium">{setData.total_cards}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-sm text-gray-400">Full Set Market Value</p>
                  <p className="text-green-400 font-medium">
                    <PriceDisplay amount={totalValue} currency="EUR" showOriginal={false} />
                  </p>
                </div>
              </div>

              {user && (
                <>
                  <div className="flex items-center space-x-3">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-sm text-gray-400">Your Set Value</p>
                      <p className="text-purple-400 font-medium">
                        <PriceDisplay amount={userValue} currency="EUR" showOriginal={false} />
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Star className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-sm text-gray-400">Collection Progress</p>
                      <p className="text-white font-medium">
                        {collectedCards}/{cards.length} ({cards.length > 0 ? ((collectedCards / cards.length) * 100).toFixed(1) : 0}%)
                      </p>
                    </div>
                  </div>
                </>
              )}

              {setData.ptcgo_code && (
                <div className="flex items-center space-x-3">
                  <Star className="w-5 h-5 text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-400">PTCGO Code</p>
                    <p className="text-white font-medium">{setData.ptcgo_code}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Variant Explanation - Moved up */}
        <VariantExplanation
          availableVariants={getSetVariants(filteredAndSortedCards.map((card: any) => ({
            ...card,
            set: {
              id: setId,
              name: setData?.name || '',
              releaseDate: setData?.release_date || ''
            },
            availableVariants: getAvailableVariants({
              ...card,
              set: {
                id: setId,
                name: setData?.name || '',
                releaseDate: setData?.release_date || ''
              }
            })
          })))}
        />

        {/* Collection Mode Toggle */}
        {user && (
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
                  onClick={() => setCollectionMode(collectionMode === 'regular' ? 'master' : 'regular')}
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
        )}

        {/* Search and Controls */}
        <div className="mb-6">
          {/* Sort Buttons */}
          <div className="flex items-center justify-start gap-2 mb-4">
            <button
              onClick={() => handleSortToggle('number')}
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
              onClick={() => handleSortToggle('name')}
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
              onClick={() => handleSortToggle('price')}
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Name or Number..."
                  className="input-gaming pl-10 w-full"
                />
              </div>
            </div>

            {/* Bulk Add to Wishlist Button */}
            {user && needCount > 0 && (
              <button
                onClick={handleBulkAddToWishlist}
                className="flex items-center space-x-2 px-3 py-2 bg-pokemon-gold hover:bg-pokemon-gold/90 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:ring-offset-2 focus:ring-offset-pkmn-card"
                title={`Add all ${needCount} needed cards to wishlist`}
              >
                <Star className="w-4 h-4" />
                <span>Add {needCount} Need Cards to Wishlist</span>
              </button>
            )}

            {/* Reset Set Button - Moved here */}
            {user && collectedCards > 0 && (
              <button
                onClick={() => setShowResetConfirmation(true)}
                disabled={isResetting}
                className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-pkmn-card"
                title="Remove all cards from this set from your collection"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? 'Resetting...' : 'Reset Set'}</span>
              </button>
            )}
          </div>
          
          {/* Filter Buttons - Moved below search */}
          {user && (
            <div className="mt-4">
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-400 font-medium">Show:</span>
                <div className="flex bg-pkmn-surface rounded-lg p-1">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      filterMode === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    All ({cards.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('need')}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      filterMode === 'need'
                        ? 'bg-red-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Need ({needCount})
                  </button>
                  <button
                    onClick={() => setFilterMode('have')}
                    className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                      filterMode === 'have'
                        ? 'bg-green-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Have ({haveCount})
                  </button>
                  <button
                    onClick={() => setFilterMode('duplicates')}
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

        {/* Cards Display */}
        {viewMode === 'table' ? (
          <div className="card-container overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Number</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Rarity</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Price</th>
                  {user && <th className="text-left py-3 px-4 text-gray-300 font-medium">Owned</th>}
                  <th className="text-left py-3 px-4 text-gray-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedCards.map((card) => {
                  const cardComplete = isCardCompletedInMode(card)
                  const cardCollected = isCardCollected(card)
                  const cardMasterComplete = isCardComplete(card)
                  return (
                    <tr
                      key={card.id}
                      data-card-id={card.id}
                      className={`border-b border-gray-800 hover:bg-pkmn-surface/30 transition-colors ${
                        highlightedCardId === card.id ? 'bg-pokemon-gold/20 ring-2 ring-pokemon-gold ring-opacity-50' : ''
                      } ${cardComplete ? 'opacity-60' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-pokemon-gold font-medium">#{card.number}</span>
                          {cardComplete && (
                            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full font-medium">
                              ✓ {collectionMode === 'master' ? 'Master' : 'Complete'}
                            </span>
                          )}
                          {collectionMode === 'regular' && cardCollected && cardMasterComplete && (
                            <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-medium">
                              ★ Master
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <FallbackImage
                              src={card.image_small}
                              alt={card.name}
                              width={40}
                              height={56}
                              className={`rounded ${cardComplete ? 'grayscale' : ''}`}
                              fallbackSrc="/placeholder-card.png"
                            />
                            {cardComplete && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                  ✓
                                </div>
                              </div>
                            )}
                          </div>
                          <span className={`font-medium ${cardComplete ? 'text-gray-400' : 'text-white'}`}>
                            {card.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cardComplete ? 'text-gray-500' : 'text-gray-300'}>{card.rarity}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-medium ${cardComplete ? 'text-gray-500' : 'text-green-400'}`}>
                          <PriceDisplay
                            amount={card.cardmarket_avg_sell_price || 0}
                            currency="EUR"
                            showOriginal={false}
                          />
                        </span>
                      </td>
                      {user && (
                        <td className="py-3 px-4">
                          <span className={`font-medium ${userCollection[card.id] > 0 ? 'text-pokemon-gold' : 'text-gray-500'}`}>
                            {userCollection[card.id] || 0}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewDetails(card.id)}
                            className="p-2 text-gray-400 hover:text-pokemon-gold transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {user && (
                            <button
                              onClick={() => handleToggleCollection(card.id)}
                              className="p-2 text-gray-400 hover:text-green-400 transition-colors"
                              title="Add to collection"
                              disabled={loadingStates[card.id]}
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <PokemonCardGrid
            cards={filteredAndSortedCards.map((card: any) => ({
              id: card.id,
              name: card.name,
              number: card.number,
              set: {
                id: setId,
                name: setData?.name || '',
                releaseDate: setData?.release_date || ''
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
              availableVariants: getAvailableVariants(card),
              isComplete: isCardCompletedInMode(card)
            }))}
            collectionData={userCollectionData}
            onToggleCollection={handleToggleCollection}
            onAddVariant={handleAddVariant}
            onRemoveVariant={handleRemoveVariant}
            onViewDetails={handleViewDetails}
            currency="EUR"
            loading={loadingStates}
            className="animate-fade-in"
            highlightedCardId={highlightedCardId}
          />
        )}

        {filteredAndSortedCards.length === 0 && (
          <div className="card-container text-center py-20">
            <div className="text-4xl mb-4 opacity-50">🃏</div>
            <h3 className="text-xl font-semibold text-white mb-2">No cards found</h3>
            <p className="text-gray-400">Try adjusting your search</p>
          </div>
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

      {/* Bulk Wishlist Selection Modal */}
      <BulkWishlistSelectionModal
        isOpen={showBulkWishlistModal}
        onClose={() => setShowBulkWishlistModal(false)}
        cardIds={needCardIds}
        cardCount={needCount}
        setName={setData?.name || ''}
      />

      {/* Reset Set Confirmation Dialog */}
      {showResetConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-pkmn-card rounded-lg max-w-md w-full p-6 border border-gray-700">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Reset Set Collection</h3>
                <p className="text-sm text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-300 mb-3">
                Are you sure you want to remove all <strong>{collectedCards}</strong> cards from <strong>{setData?.name}</strong> from your collection?
              </p>
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
                <p className="text-red-300 text-sm">
                  <strong>Warning:</strong> This will permanently delete all variants and quantities of every card you own from this set.
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowResetConfirmation(false)}
                disabled={isResetting}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-pkmn-card"
              >
                Cancel
              </button>
              <button
                onClick={handleResetSet}
                disabled={isResetting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-pkmn-card flex items-center justify-center space-x-2"
              >
                {isResetting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Reset Set</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </NavigationProvider>
  )
}

export default function SetPage() {
  return (
    <ProtectedRoute>
      <SetPageContent />
    </ProtectedRoute>
  )
}
