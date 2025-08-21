'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useCollectionOperations } from '@/hooks/useServices'
import { wishlistService } from '@/lib/wishlist-service'
import { achievementService } from '@/lib/achievement-service'
import { toastService } from '@/lib/toast-service'
import { getAvailableVariants } from '@/components/pokemon/CollectionButtons'
import { CardVariant } from '@/types/pokemon'
import { calculateCardVariantValue } from '@/lib/variant-pricing'

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

export function useSetPage(setId: string, targetCardId: string | null, user: any) {
  const router = useRouter()
  const supabaseClientRef = useRef(supabase)
  const { addToCollection, removeFromCollection } = useCollectionOperations()

  // State management
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

  // Data fetching functions
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

  // Collection handlers
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
      }

      // Check for achievements after adding variant
      try {
        const achievementResult = await achievementService.checkAchievements(user.id)
        if (achievementResult.success) {
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

  // Helper functions
  const isCardCollected = (card: CardData) => {
    if (!user || !userCollectionData[card.id]) return false
    return userCollectionData[card.id].totalQuantity > 0
  }

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

  const isCardCompletedInMode = (card: CardData) => {
    if (collectionMode === 'master') {
      return isCardComplete(card)
    } else {
      return isCardCollected(card)
    }
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

  // Computed values
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

  const handleViewDetails = (cardId: string) => {
    setSelectedCardId(cardId)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedCardId(null)
  }

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

  // Initial data loading
  useEffect(() => {
    if (setId) {
      fetchSetData()
      fetchCards()
      if (user) {
        fetchUserCollection()
      }
    }
  }, [setId, user?.id])

  return {
    // State
    setData,
    cards,
    loading,
    searchQuery,
    setSearchQuery,
    sortBy,
    sortOrder,
    viewMode,
    setViewMode,
    userCollection,
    userCollectionData,
    loadingStates,
    selectedCardId,
    isModalOpen,
    highlightedCardId,
    collectionMode,
    setCollectionMode,
    filterMode,
    setFilterMode,
    showResetConfirmation,
    setShowResetConfirmation,
    isResetting,
    showBulkWishlistModal,
    setShowBulkWishlistModal,
    
    // Computed values
    filteredAndSortedCards,
    collectedCards,
    totalValue,
    userValue,
    needCount,
    haveCount,
    duplicatesCount,
    needCardIds,
    
    // Handlers
    handleToggleCollection,
    handleAddVariant,
    handleRemoveVariant,
    handleResetSet,
    handleCollectionChange,
    handleSortToggle,
    handleBulkAddToWishlist,
    handleViewDetails,
    handleCloseModal,
    
    // Helper functions
    isCardCollected,
    isCardComplete,
    hasCardDuplicates,
    getCardDuplicateCount,
    isCardCompletedInMode
  }
}