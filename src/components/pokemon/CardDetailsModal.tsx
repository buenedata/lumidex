'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Dialog, Transition, Tab } from '@headlessui/react'
import { Fragment } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { currencyService } from '@/lib/currency-service'
import { useI18n } from '@/contexts/I18nContext'
import { supabase } from '@/lib/supabase'
import { CollectionButtons, getAvailableVariants } from './CollectionButtons'
import { PriceGraph } from './PriceGraph'
import { CardVariant, CardCollectionData } from '@/types/pokemon'
import { cardSocialService, FriendCardOwnership, WishlistItem } from '@/lib/card-social-service'
import { FriendsWithCardModal } from './FriendsWithCardModal'
import { WishlistSelectionModal } from './WishlistSelectionModal'
import { useToast } from '@/components/ui/ToastContainer'
import { achievementService } from '@/lib/achievement-service'
import { toastService } from '@/lib/toast-service'
import { wishlistService } from '@/lib/wishlist-service'
import { PriceDisplay } from '@/components/PriceDisplay'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import {
  X,
  ExternalLink,
  Calendar,
  Hash,
  Star,
  TrendingUp,
  DollarSign,
  Package,
  Loader2,
  BarChart3,
  Users,
  Heart,
  Bell,
  Share2,
  ArrowLeftRight,
  Eye,
  StickyNote
} from 'lucide-react'

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null

  const debounced = ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }) as T & { cancel: () => void }

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return debounced
}

// Types
interface CardData {
  id: string
  name: string
  number: string
  set_id: string
  rarity: string
  types: string[]
  image_small: string
  image_large: string
  cardmarket_url: string | null
  cardmarket_avg_sell_price: number | null
  cardmarket_low_price: number | null
  cardmarket_trend_price: number | null
  cardmarket_reverse_holo_sell: number | null
  cardmarket_reverse_holo_low: number | null
  cardmarket_reverse_holo_trend: number | null
  cardmarket_avg_7_days: number | null
  cardmarket_avg_30_days: number | null
  created_at: string
  sets?: {
    name: string
    symbol_url: string | null
    release_date: string
  }
}

interface CardDetailsModalProps {
  cardId: string | null
  isOpen: boolean
  onClose: () => void
  onCollectionChange?: (cardId: string, collectionData: CardCollectionData | null) => void
  onWishlistChange?: () => void
  supabaseClient?: any
}

// Loading states enum
enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

export function CardDetailsModal({ cardId, isOpen, onClose, onCollectionChange, onWishlistChange, supabaseClient }: CardDetailsModalProps) {
  const { user } = useAuth()
  const router = useRouter()
  const preferredCurrency = usePreferredCurrency()
  const { locale } = useI18n()
  
  // Use provided client or fall back to default
  const activeSupabase = supabaseClient || supabase
  
  // Consolidated state
  const [cardState, setCardState] = useState<{
    data: CardData | null
    loadingState: LoadingState
    error: string | null
  }>({
    data: null,
    loadingState: LoadingState.IDLE,
    error: null
  })

  const [collectionState, setCollectionState] = useState<{
    data: CardCollectionData | null
    loading: boolean
  }>({
    data: null,
    loading: false
  })

  // Social features state
  const [socialState, setSocialState] = useState<{
    friendsWithCard: FriendCardOwnership[]
    wishlistItem: WishlistItem | null
    loadingFriends: boolean
    loadingWishlist: boolean
  }>({
    friendsWithCard: [],
    wishlistItem: null,
    loadingFriends: false,
    loadingWishlist: false
  })

  // Modal states
  const [showFriendsModal, setShowFriendsModal] = useState(false)
  const [showWishlistModal, setShowWishlistModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'remove' | 'add'
    cardName: string
    onConfirm: () => void
  } | null>(null)
  
  // Toast hook
  const { showToast } = useToast()

  // Debounced fetch function
  const fetchCard = useCallback(async (id: string, retryCount = 0) => {
    console.log('CardDetailsModal: Starting fetch for card:', id, 'Retry:', retryCount)
    setCardState(prev => ({
      ...prev,
      loadingState: LoadingState.LOADING,
      error: null,
      data: null
    }))

    try {
      // Add a small delay to ensure Supabase connection is ready after tab switching
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
      }

      // Test connection first with a timeout to detect staleness quickly
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout - possible stale connection')), 2000)
      )

      const queryPromise = activeSupabase
        .from('cards')
        .select(`
          *,
          sets!inner(name, symbol_url, release_date)
        `)
        .eq('id', id)
        .single()

      const result = await Promise.race([queryPromise, timeoutPromise])
      const { data, error } = result

      if (error) {
        console.error('CardDetailsModal: Supabase error:', error)
        throw error
      }

      if (!data) {
        throw new Error('No data returned from query')
      }

      console.log('CardDetailsModal: Successfully fetched card:', data.name)
      setCardState({
        data,
        loadingState: LoadingState.SUCCESS,
        error: null
      })
    } catch (error: any) {
      console.error('CardDetailsModal: Error fetching card:', error, 'Retry count:', retryCount)
      
      // Check if this looks like a connection staleness issue
      const isConnectionIssue = error.message?.includes('timeout') ||
                               error.message?.includes('Connection') ||
                               error.code === 'PGRST301' ||
                               error.code === 'PGRST116'
      
      if (isConnectionIssue && retryCount === 0) {
        console.log('CardDetailsModal: Connection issue detected, suggesting page refresh')
        setCardState({
          data: null,
          loadingState: LoadingState.ERROR,
          error: 'Connection issue detected. Please refresh the page to restore functionality.'
        })
        return
      }
      
      // Retry up to 2 times with increasing delays for other errors
      if (retryCount < 2 && !isConnectionIssue) {
        console.log('CardDetailsModal: Retrying fetch in', (retryCount + 1) * 1000, 'ms')
        setTimeout(() => {
          fetchCard(id, retryCount + 1)
        }, (retryCount + 1) * 1000)
      } else {
        setCardState({
          data: null,
          loadingState: LoadingState.ERROR,
          error: `Failed to load card details: ${error.message || 'Unknown error'}`
        })
      }
    }
  }, [])

  // Memoized debounced fetch
  const debouncedFetchCard = useMemo(
    () => debounce(fetchCard, 300),
    [fetchCard]
  )

  // Fetch user collection data
  const fetchUserCollection = useCallback(async (id: string) => {
    if (!user) return

    setCollectionState(prev => ({ ...prev, loading: true }))

    try {
      const { data, error } = await activeSupabase
        .from('user_collections')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', id)

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data && data.length > 0) {
        // Aggregate variants
        const variants = {
          normal: 0,
          holo: 0,
          reverseHolo: 0,
          pokeballPattern: 0,
          masterballPattern: 0,
          firstEdition: 0
        }

        let totalQuantity = 0
        let earliestDate = data[0].created_at
        let latestUpdate = data[0].updated_at

        data.forEach((item: any) => {
          totalQuantity += item.quantity
          if (item.created_at < earliestDate) earliestDate = item.created_at
          if (item.updated_at > latestUpdate) latestUpdate = item.updated_at

          switch (item.variant) {
            case 'normal':
              variants.normal += item.quantity
              break
            case 'holo':
              variants.holo += item.quantity
              break
            case 'reverse_holo':
              variants.reverseHolo += item.quantity
              break
            case 'pokeball_pattern':
              variants.pokeballPattern += item.quantity
              break
            case 'masterball_pattern':
              variants.masterballPattern += item.quantity
              break
            case '1st_edition':
              variants.firstEdition += item.quantity
              break
          }
        })

        setCollectionState({
          data: {
            cardId: id,
            userId: user.id,
            ...variants,
            totalQuantity,
            dateAdded: earliestDate,
            lastUpdated: latestUpdate
          },
          loading: false
        })
      } else {
        setCollectionState({
          data: null,
          loading: false
        })
      }
    } catch (error) {
      console.error('Error fetching user collection:', error)
      setCollectionState({
        data: null,
        loading: false
      })
    }
  }, [user])

  // Fetch social data (friends with card, wishlist status)
  const fetchSocialData = useCallback(async (cardId: string) => {
    if (!user) return

    setSocialState(prev => ({ ...prev, loadingFriends: true, loadingWishlist: true }))

    try {
      // Check friends who have this card
      const friendsResult = await cardSocialService.getFriendsWithCard(user.id, cardId)
      
      // Check if card is in user's wishlist
      const wishlistResult = await cardSocialService.isInWishlist(user.id, cardId)

      setSocialState({
        friendsWithCard: friendsResult.success ? friendsResult.data || [] : [],
        wishlistItem: wishlistResult.success && wishlistResult.inWishlist ? wishlistResult.data || null : null,
        loadingFriends: false,
        loadingWishlist: false
      })
    } catch (error) {
      console.error('Error fetching social data:', error)
      setSocialState(prev => ({
        ...prev,
        loadingFriends: false,
        loadingWishlist: false
      }))
    }
  }, [user])

  // Social action handlers
  const handleCheckFriendsWithCard = async (cardId: string) => {
    if (!user) {
      router.push('/auth/signin')
      return
    }

    console.log('🔍 DEBUG: Checking friends with card', { userId: user.id, cardId })
    setSocialState(prev => ({ ...prev, loadingFriends: true }))
    
    try {
      const result = await cardSocialService.getFriendsWithCard(user.id, cardId)
      
      console.log('🔍 DEBUG: Service result', result)
      
      if (result.success) {
        const friendsWithCard = result.data?.filter(f => f.owns_card) || []
        
        setSocialState(prev => ({
          ...prev,
          friendsWithCard: friendsWithCard,
          loadingFriends: false
        }))
        
        console.log('🔍 DEBUG: Friends who own card', friendsWithCard)
        
        if (friendsWithCard.length > 0) {
          // Show professional modal with trade options
          setShowFriendsModal(true)
        } else {
          // Show toast notification
          showToast('No friends have this card', 'None of your friends have this card in their collection yet.', 'info')
        }
      } else {
        console.error('🔍 DEBUG: Service error', result.error)
        showToast('Error checking friends', result.error || 'Failed to check friends', 'error')
        setSocialState(prev => ({ ...prev, loadingFriends: false }))
      }
    } catch (error) {
      console.error('🔍 DEBUG: Exception caught:', error)
      showToast('Error checking friends', 'Failed to check friends', 'error')
      setSocialState(prev => ({ ...prev, loadingFriends: false }))
    }
  }

  const handleToggleWishlist = async (cardId: string) => {
    if (!user) {
      router.push('/auth/signin')
      return
    }

    const isCurrentlyInWishlist = socialState.wishlistItem !== null
    const cardName = cardState.data?.name || 'this card'
    
    if (isCurrentlyInWishlist) {
      // Show confirmation modal for removal
      setConfirmAction({
        type: 'remove',
        cardName,
        onConfirm: () => performWishlistRemoval(cardId)
      })
      setShowConfirmModal(true)
    } else {
      // Open wishlist selection modal for adding
      setShowWishlistModal(true)
    }
  }

  const performWishlistRemoval = async (cardId: string) => {
    if (!user) return
    
    setSocialState(prev => ({ ...prev, loadingWishlist: true }))
    
    try {
      const result = await cardSocialService.removeFromWishlist(user.id, cardId)
      
      if (result.success) {
        setSocialState(prev => ({
          ...prev,
          wishlistItem: null,
          loadingWishlist: false
        }))
        showToast('Removed from wishlist!', 'Card has been removed from your wishlist', 'success')
        // Notify parent component about wishlist change
        onWishlistChange?.()
      } else {
        showToast('Error removing from wishlist', result.error || 'Please try again later', 'error')
        setSocialState(prev => ({ ...prev, loadingWishlist: false }))
      }
    } catch (error) {
      console.error('Error removing from wishlist:', error)
      showToast('Failed to update wishlist', 'An unexpected error occurred', 'error')
      setSocialState(prev => ({ ...prev, loadingWishlist: false }))
    } finally {
      setShowConfirmModal(false)
      setConfirmAction(null)
    }
  }

  const handleWishlistModalClose = () => {
    setShowWishlistModal(false)
    // Refresh social data to check if card was added to wishlist
    if (cardState.data) {
      fetchSocialData(cardState.data.id)
    }
    // Notify parent component about potential wishlist change
    onWishlistChange?.()
  }

  const handleShareCard = async (cardId: string, cardName: string) => {
    try {
      const result = await cardSocialService.shareCard(cardId, 'link')
      
      if (result.success && result.shareData) {
        // Try to use Web Share API if available
        if (navigator.share) {
          await navigator.share({
            title: result.shareData.title,
            text: result.shareData.description,
            url: result.shareData.url
          })
        } else {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(result.shareData.url)
          alert('Card link copied to clipboard!')
        }
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error sharing card:', error)
      alert('Failed to share card')
    }
  }

  const handleSetPriceAlert = async (cardId: string) => {
    if (!user) {
      router.push('/auth/signin')
      return
    }

    // Simple prompt for now - could be enhanced with a proper modal
    const targetPrice = prompt('Enter target price in EUR (you\'ll be notified when the price drops below this):')
    
    if (targetPrice && !isNaN(Number(targetPrice))) {
      try {
        const result = await cardSocialService.setPriceAlert(user.id, cardId, Number(targetPrice))
        
        if (result.success) {
          alert('Price alert set successfully!')
        } else {
          alert(`Error: ${result.error}`)
        }
      } catch (error) {
        console.error('Error setting price alert:', error)
        alert('Failed to set price alert')
      }
    }
  }


  // Effects
  useEffect(() => {
    if (isOpen && cardId) {
      // Always fetch if cardId is different from current data, or if we don't have data
      const needsFetch = !cardState.data || cardState.data.id !== cardId
      
      if (needsFetch) {
        console.log('CardDetailsModal: Fetching new card data:', cardId, 'Previous card:', cardState.data?.id)
        setCardState({
          data: null,
          loadingState: LoadingState.LOADING, // Set to LOADING immediately
          error: null
        })
        setCollectionState({
          data: null,
          loading: false
        })

        // Fetch card data immediately (no debounce for initial load)
        fetchCard(cardId)
        
        // Fetch collection data if user is logged in
        if (user) {
          fetchUserCollection(cardId)
          fetchSocialData(cardId)
        }
      } else {
        console.log('CardDetailsModal: Card data already loaded for:', cardId)
        // If we already have the correct card data, just ensure we're in success state
        if (cardState.loadingState !== LoadingState.SUCCESS) {
          setCardState(prev => ({
            ...prev,
            loadingState: LoadingState.SUCCESS
          }))
        }
      }
    }

    // Cleanup on close
    if (!isOpen) {
      debouncedFetchCard.cancel()
      console.log('CardDetailsModal: Modal closed, cleaning up')
      // Clear the card state when modal is closed to ensure fresh fetch next time
      setCardState({
        data: null,
        loadingState: LoadingState.IDLE,
        error: null
      })
    }

    return () => {
      debouncedFetchCard.cancel()
    }
  }, [isOpen, cardId, user, fetchCard, fetchUserCollection, debouncedFetchCard])

  // Additional effect to handle tab switching restoration and stuck loading states
  useEffect(() => {
    if (isOpen && cardId && cardState.loadingState === LoadingState.LOADING) {
      // Set a timeout to detect if we're stuck in loading state
      const timeoutId = setTimeout(() => {
        console.log('CardDetailsModal: Detected stuck loading state, suggesting page refresh for card:', cardId)
        // Instead of retrying, suggest page refresh for connection staleness
        setCardState({
          data: null,
          loadingState: LoadingState.ERROR,
          error: 'Loading timeout. The connection may be stale after tab switching. Please refresh the page.'
        })
      }, 3000) // 3 second timeout

      return () => clearTimeout(timeoutId)
    }
  }, [isOpen, cardId, cardState.loadingState])

  // Effect to handle when modal opens with different card while previous card data exists
  useEffect(() => {
    if (isOpen && cardId && cardState.data && cardState.data.id !== cardId) {
      console.log('CardDetailsModal: Card ID mismatch detected, clearing stale data and fetching:', cardId)
      setCardState({
        data: null,
        loadingState: LoadingState.LOADING,
        error: null
      })
      fetchCard(cardId)
    }
  }, [isOpen, cardId, cardState.data, fetchCard])

  // Collection management functions
  const handleToggleCollection = async (cardId: string) => {
    if (!user) {
      router.push('/auth/signin')
      return
    }

    setCollectionState(prev => ({ ...prev, loading: true }))
    
    try {
      const isInCollection = (collectionState.data?.totalQuantity ?? 0) > 0
      
      if (isInCollection) {
        // Remove from collection
        const { error } = await activeSupabase
          .from('user_collections')
          .delete()
          .eq('user_id', user.id)
          .eq('card_id', cardId)

        if (!error) {
          setCollectionState({ data: null, loading: false })
          onCollectionChange?.(cardId, null)
          
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
        const { error } = await activeSupabase
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
          const newCollectionData: CardCollectionData = {
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
          setCollectionState({ data: newCollectionData, loading: false })
          onCollectionChange?.(cardId, newCollectionData)
          
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
      setCollectionState(prev => ({ ...prev, loading: false }))
    }
  }

  const handleAddVariant = async (cardId: string, variant: CardVariant) => {
    if (!user) {
      router.push('/auth/signin')
      return
    }

    setCollectionState(prev => ({ ...prev, loading: true }))
    
    try {
      // Check if variant exists
      const { data: existingVariant, error: checkError } = await activeSupabase
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
        // Update quantity
        const { error } = await activeSupabase
          .from('user_collections')
          .update({
            quantity: existingVariant.quantity + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingVariant.id)

        if (error) throw error
      } else {
        // Insert new variant
        const { error } = await activeSupabase
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
      const current = collectionState.data || {
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
      
      const updatedData = {
        ...current,
        [variantKey]: (current[variantKey] || 0) + 1,
        totalQuantity: (current.totalQuantity || 0) + 1,
        lastUpdated: new Date().toISOString()
      }
      
      setCollectionState({ data: updatedData, loading: false })
      onCollectionChange?.(cardId, updatedData)

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
      setCollectionState(prev => ({ ...prev, loading: false }))
    }
  }

  const handleRemoveVariant = async (cardId: string, variant: CardVariant) => {
    if (!user) return

    setCollectionState(prev => ({ ...prev, loading: true }))
    
    try {
      const { data: variantEntry, error: findError } = await activeSupabase
        .from('user_collections')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', cardId)
        .eq('variant', variant as any)
        .single()

      if (findError) {
        console.error('Error finding variant:', findError)
        setCollectionState(prev => ({ ...prev, loading: false }))
        return
      }

      if (variantEntry.quantity > 1) {
        // Decrease quantity
        const { error } = await activeSupabase
          .from('user_collections')
          .update({
            quantity: variantEntry.quantity - 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', variantEntry.id)

        if (error) throw error
      } else {
        // Remove variant completely
        const { error } = await activeSupabase
          .from('user_collections')
          .delete()
          .eq('id', variantEntry.id)

        if (error) throw error
      }

      // Update local state
      const current = collectionState.data
      if (!current) {
        setCollectionState({ data: null, loading: false })
        return
      }
      
      const variantKey = variant === 'reverse_holo' ? 'reverseHolo' :
                        variant === 'pokeball_pattern' ? 'pokeballPattern' :
                        variant === 'masterball_pattern' ? 'masterballPattern' :
                        variant === '1st_edition' ? 'firstEdition' : variant
      
      const newQuantity = Math.max(0, (current[variantKey] || 0) - 1)
      const newTotal = Math.max(0, (current.totalQuantity || 0) - 1)
      
      if (newTotal === 0) {
        setCollectionState({ data: null, loading: false })
        onCollectionChange?.(cardId, null)
      } else {
        const updatedData = {
          ...current,
          [variantKey]: newQuantity,
          totalQuantity: newTotal,
          lastUpdated: new Date().toISOString()
        }
        setCollectionState({ data: updatedData, loading: false })
        onCollectionChange?.(cardId, updatedData)
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
      }
    } catch (error) {
      console.error('Error removing variant:', error)
      setCollectionState(prev => ({ ...prev, loading: false }))
    }
  }

  // Utility functions - keeping simple for non-price formatting
  const formatPrice = (price: number | null | undefined, currency?: string): string => {
    if (!price) return 'N/A'
    const targetCurrency = currency || preferredCurrency
    return currencyService.formatCurrency(price, targetCurrency as any, locale)
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getCardMarketUrl = (card: CardData): string => {
    if (card.cardmarket_url) {
      return card.cardmarket_url
    }
    
    if (card.name) {
      return `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(card.name)}`
    }
    
    return `https://www.cardmarket.com/en/Pokemon/Products/Singles`
  }

  // Render loading state
  const renderLoading = () => (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-pokemon-gold mx-auto mb-4" />
        <p className="text-gray-400">Loading card details...</p>
      </div>
    </div>
  )

  // Render error state
  const renderError = () => (
    <div className="flex items-center justify-center py-20">
      <div className="text-center max-w-md mx-auto">
        <div className="text-6xl mb-4 opacity-50">🃏</div>
        <h1 className="text-2xl font-bold text-white mb-2">Unable to Load Card</h1>
        <p className="text-gray-400 mb-4">{cardState.error || 'The requested card could not be found.'}</p>
        {cardState.error?.includes('refresh') && (
          <button
            onClick={() => window.location.reload()}
            className="btn-gaming"
          >
            Refresh Page
          </button>
        )}
      </div>
    </div>
  )

  // Render card content
  const renderCardContent = () => {
    const { data: card } = cardState
    if (!card) return null

    return (
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card Image */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-md">
              <div className="aspect-[2.5/3.5] relative">
                <FallbackImage
                  src={card.image_large}
                  alt={card.name}
                  fill
                  className="object-contain rounded-lg shadow-2xl transition-opacity duration-300"
                  sizes="(max-width: 768px) 90vw, (max-width: 1024px) 45vw, 35vw"
                  priority
                  fallbackSrc="/placeholder-card.png"
                />
              </div>
            </div>
          </div>

          {/* Card Details */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">{card.name}</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-2">
                  <Hash className="w-5 h-5 text-pokemon-gold" />
                  <span className="text-gray-400">Number:</span>
                  <span className="text-white font-medium">#{card.number}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-pokemon-gold" />
                  <span className="text-gray-400">Rarity:</span>
                  <span className="text-white font-medium">{card.rarity}</span>
                </div>
                
                {card.sets && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Package className="w-5 h-5 text-pokemon-gold" />
                      <span className="text-gray-400">Set:</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/sets/${card.set_id}`)
                        }}
                        className="text-white font-medium hover:text-yellow-400 transition-colors underline decoration-dotted underline-offset-2"
                        title={`View ${card.sets.name} set`}
                      >
                        {card.sets.name}
                      </button>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-pokemon-gold" />
                      <span className="text-gray-400">Released:</span>
                      <span className="text-white font-medium">
                        {formatDate(card.sets.release_date)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Collection Management */}
              <div className="mb-6">
                <div className="bg-pkmn-surface rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Add to Your Collection</h3>
                  
                  <div onClick={(e) => e.stopPropagation()}>
                    <CollectionButtons
                      card={{
                        id: card.id,
                        name: card.name,
                        number: card.number,
                        set: {
                          id: card.set_id,
                          name: card.sets?.name || '',
                          releaseDate: card.sets?.release_date || ''
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
                      }}
                      collectionData={collectionState.data || undefined}
                      onToggleCollection={handleToggleCollection}
                      onAddVariant={handleAddVariant}
                      onRemoveVariant={handleRemoveVariant}
                      loading={collectionState.loading}
                    />
                  </div>
                  
                  {collectionState.data && (
                    <div className="mt-4 p-3 bg-pkmn-card rounded-lg">
                      <div className="text-sm text-gray-400 mb-2">In your collection:</div>
                      <div className="text-lg font-semibold text-white">
                        {collectionState.data.totalQuantity} card{collectionState.data.totalQuantity !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Added: {formatDate(collectionState.data.dateAdded)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                
                <div className="space-y-3">
                  
                  {/* Social Actions */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCheckFriendsWithCard(card.id)
                    }}
                    disabled={socialState.loadingFriends}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    {socialState.loadingFriends ? 'Checking...' : 'Check Friends'}
                  </button>

                  {/* Wishlist & Tracking */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleWishlist(card.id)
                      }}
                      disabled={socialState.loadingWishlist}
                      className={`flex items-center justify-center gap-2 px-3 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
                        socialState.wishlistItem
                          ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                          : 'bg-pink-600 hover:bg-pink-700 disabled:bg-pink-400'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${socialState.wishlistItem ? 'fill-current' : ''}`} />
                      {socialState.loadingWishlist
                        ? 'Loading...'
                        : socialState.wishlistItem
                          ? 'Remove from Wishlist'
                          : 'Add to Wishlist'
                      }
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSetPriceAlert(card.id)
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Bell className="w-4 h-4" />
                      Price Alert
                    </button>
                  </div>

                  {/* Utility Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleShareCard(card.id, card.name)
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        alert('Notes functionality coming soon! This will let you add personal notes about cards.')
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <StickyNote className="w-4 h-4" />
                      Notes
                    </button>
                  </div>

                  {/* Market Analysis */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      alert('Market analysis coming soon! This will show detailed price trends and market insights.')
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Market Analysis
                  </button>
                </div>
              </div>
            </div>

            {/* Pricing with Tabs */}
            <div className="bg-pkmn-surface rounded-lg p-4">
              <Tab.Group>
                <Tab.List className="flex space-x-1 rounded-xl bg-pkmn-card p-1 mb-4">
                  <Tab
                    className={({ selected }) =>
                      `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all
                       ${selected
                         ? 'bg-pokemon-gold text-white shadow'
                         : 'text-gray-300 hover:bg-gray-600 hover:text-white'
                       }`
                    }
                  >
                    <div className="flex items-center justify-center">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Current Prices
                    </div>
                  </Tab>
                  <Tab
                    className={({ selected }) =>
                      `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all
                       ${selected
                         ? 'bg-pokemon-gold text-white shadow'
                         : 'text-gray-300 hover:bg-gray-600 hover:text-white'
                       }`
                    }
                  >
                    <div className="flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Price History
                    </div>
                  </Tab>
                </Tab.List>
                
                <Tab.Panels>
                  <Tab.Panel>
                    {/* Get available variants for this card */}
                    {(() => {
                      const availableVariants = getAvailableVariants(card)
                      const variantPricing: Array<{
                        name: string
                        color: string
                        gradient: boolean
                        average: number | null
                        low: number | null
                        trend: number | null
                        note?: string
                        currency: 'EUR' | 'USD'
                      }> = []

                      // Show ALL available variants, not just those with pricing
                      availableVariants.forEach(variant => {
                        switch (variant) {
                          case 'normal':
                            if (card.cardmarket_avg_sell_price || card.cardmarket_low_price || card.cardmarket_trend_price) {
                              variantPricing.push({
                                name: 'Normal',
                                color: 'bg-yellow-500',
                                gradient: false,
                                average: card.cardmarket_avg_sell_price,
                                low: card.cardmarket_low_price,
                                trend: card.cardmarket_trend_price,
                                currency: 'EUR'
                              })
                            }
                            break

                          case 'holo':
                            if (card.cardmarket_avg_sell_price || card.cardmarket_low_price || card.cardmarket_trend_price) {
                              variantPricing.push({
                                name: 'Holo',
                                color: 'bg-purple-500',
                                gradient: false,
                                average: card.cardmarket_avg_sell_price,
                                low: card.cardmarket_low_price,
                                trend: card.cardmarket_trend_price,
                                currency: 'EUR'
                              })
                            }
                            break

                          case 'reverse_holo':
                            // Try CardMarket reverse holo first
                            if (card.cardmarket_reverse_holo_sell || card.cardmarket_reverse_holo_low || card.cardmarket_reverse_holo_trend) {
                              variantPricing.push({
                                name: 'Reverse Holo',
                                color: 'bg-blue-500',
                                gradient: false,
                                average: card.cardmarket_reverse_holo_sell,
                                low: card.cardmarket_reverse_holo_low,
                                trend: card.cardmarket_reverse_holo_trend,
                                currency: 'EUR'
                              })
                            }
                            // Fallback to TCGPlayer if CardMarket not available
                            else if ((card as any).tcgplayer_reverse_foil_market || (card as any).tcgplayer_reverse_foil_low) {
                              variantPricing.push({
                                name: 'Reverse Holo',
                                color: 'bg-blue-500',
                                gradient: false,
                                average: (card as any).tcgplayer_reverse_foil_market,
                                low: (card as any).tcgplayer_reverse_foil_low,
                                trend: (card as any).tcgplayer_reverse_foil_mid,
                                note: 'TCGPlayer USD pricing',
                                currency: 'USD'
                              })
                            }
                            // Show variant even without pricing data
                            else {
                              variantPricing.push({
                                name: 'Reverse Holo',
                                color: 'bg-blue-500',
                                gradient: false,
                                average: null,
                                low: null,
                                trend: null,
                                note: 'No pricing data available',
                                currency: 'EUR'
                              })
                            }
                            break

                          case '1st_edition':
                            // Try CardMarket 1st Edition pricing first (if exists)
                            if ((card as any).cardmarket_1st_edition_avg || (card as any).cardmarket_1st_edition_low) {
                              variantPricing.push({
                                name: '1st Edition',
                                color: 'bg-green-500',
                                gradient: false,
                                average: (card as any).cardmarket_1st_edition_avg,
                                low: (card as any).cardmarket_1st_edition_low,
                                trend: (card as any).cardmarket_1st_edition_trend,
                                currency: 'EUR'
                              })
                            }
                            // Then try TCGPlayer data
                            else if ((card as any).tcgplayer_1st_edition_normal_market || (card as any).tcgplayer_1st_edition_holofoil_market || (card as any).tcgplayer_1st_edition_normal_low || (card as any).tcgplayer_1st_edition_holofoil_low) {
                              // Add 1st Edition Holo if available (prefer holo over normal)
                              if ((card as any).tcgplayer_1st_edition_holofoil_market || (card as any).tcgplayer_1st_edition_holofoil_low) {
                                variantPricing.push({
                                  name: '1st Edition Holo',
                                  color: 'bg-gradient-to-r from-green-500 to-purple-500',
                                  gradient: true,
                                  average: (card as any).tcgplayer_1st_edition_holofoil_market,
                                  low: (card as any).tcgplayer_1st_edition_holofoil_low,
                                  trend: (card as any).tcgplayer_1st_edition_holofoil_mid,
                                  note: 'TCGPlayer USD pricing',
                                  currency: 'USD'
                                })
                              }
                              
                              // Add 1st Edition Normal if available and different from holo
                              if ((card as any).tcgplayer_1st_edition_normal_market || (card as any).tcgplayer_1st_edition_normal_low) {
                                variantPricing.push({
                                  name: '1st Edition Normal',
                                  color: 'bg-green-500',
                                  gradient: false,
                                  average: (card as any).tcgplayer_1st_edition_normal_market,
                                  low: (card as any).tcgplayer_1st_edition_normal_low,
                                  trend: (card as any).tcgplayer_1st_edition_normal_mid,
                                  note: 'TCGPlayer USD pricing',
                                  currency: 'USD'
                                })
                              }
                            }
                            // Only show if no actual pricing data available
                            else {
                              variantPricing.push({
                                name: '1st Edition',
                                color: 'bg-green-500',
                                gradient: false,
                                average: null,
                                low: null,
                                trend: null,
                                note: 'No pricing data available',
                                currency: 'EUR'
                              })
                            }
                            break

                          case 'pokeball_pattern':
                            // Only show if actual TCGPlayer pricing data exists for this pattern
                            // Currently no specific pricing fields exist, so show no pricing
                            variantPricing.push({
                              name: 'Poké Ball Pattern',
                              color: 'bg-gradient-to-r from-red-500 to-white',
                              gradient: true,
                              average: null,
                              low: null,
                              trend: null,
                              note: 'No pricing data available',
                              currency: 'EUR'
                            })
                            break

                          case 'masterball_pattern':
                            // Only show if actual TCGPlayer pricing data exists for this pattern
                            // Currently no specific pricing fields exist, so show no pricing
                            variantPricing.push({
                              name: 'Master Ball Pattern',
                              color: 'bg-gradient-to-r from-purple-600 to-blue-600',
                              gradient: true,
                              average: null,
                              low: null,
                              trend: null,
                              note: 'No pricing data available',
                              currency: 'EUR'
                            })
                            break
                        }
                      })

                      if (variantPricing.length === 0) {
                        return (
                          <div className="text-center py-6 text-gray-400">
                            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No pricing data available</p>
                          </div>
                        )
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            {/* Table Header */}
                            <thead>
                              <tr className="border-b border-gray-600">
                                <th className="text-left py-3 px-2 text-sm font-medium text-gray-300">Variant</th>
                                <th className="text-center py-3 px-2 text-sm font-medium text-gray-300">Average</th>
                                <th className="text-center py-3 px-2 text-sm font-medium text-gray-300">Low Price</th>
                                <th className="text-center py-3 px-2 text-sm font-medium text-gray-300 flex items-center justify-center">
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  Trend
                                </th>
                              </tr>
                            </thead>
                            {/* Table Body */}
                            <tbody>
                              {variantPricing.map((variant, index) => (
                                <tr key={variant.name} className="border-b border-gray-700/50 hover:bg-pkmn-card/30 transition-colors">
                                  {/* Variant Name */}
                                  <td className="py-3 px-2">
                                    <div className="flex items-center">
                                      <span className={`w-3 h-3 rounded-full mr-3 ${variant.color} ${variant.gradient ? '' : 'bg-current'}`}></span>
                                      <div>
                                        <div className={`text-sm font-medium ${variant.name === 'Normal' ? 'text-yellow-400' : variant.name === 'Reverse Holo' ? 'text-blue-400' : variant.name.includes('1st Edition') ? 'text-green-400' : 'text-purple-400'}`}>
                                          {variant.name}
                                        </div>
                                        {variant.note && (
                                          <div className="text-xs text-gray-500 italic mt-0.5">
                                            {variant.note}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  
                                  {/* Average Price */}
                                  <td className="py-3 px-2 text-center">
                                    <div className={`text-sm font-semibold ${variant.name === 'Normal' ? 'text-yellow-400' : variant.name === 'Reverse Holo' ? 'text-blue-400' : variant.name.includes('1st Edition') ? 'text-green-400' : 'text-purple-400'}`}>
                                      {variant.average ? (
                                        <PriceDisplay
                                          amount={variant.average}
                                          currency={variant.currency as any || 'EUR'}
                                          showConversion={true}
                                          showOriginal={false}
                                          size="sm"
                                          className="!text-current"
                                        />
                                      ) : (
                                        <span className="text-gray-500">N/A</span>
                                      )}
                                    </div>
                                  </td>
                                  
                                  {/* Low Price */}
                                  <td className="py-3 px-2 text-center">
                                    <div className="text-sm font-semibold text-green-400">
                                      {variant.low ? (
                                        <PriceDisplay
                                          amount={variant.low}
                                          currency={variant.currency as any || 'EUR'}
                                          showConversion={true}
                                          showOriginal={false}
                                          size="sm"
                                          className="!text-current"
                                        />
                                      ) : (
                                        <span className="text-gray-500">N/A</span>
                                      )}
                                    </div>
                                  </td>
                                  
                                  {/* Trend Price */}
                                  <td className="py-3 px-2 text-center">
                                    <div className="text-sm font-semibold text-blue-400">
                                      {variant.trend ? (
                                        <PriceDisplay
                                          amount={variant.trend}
                                          currency={variant.currency as any || 'EUR'}
                                          showConversion={true}
                                          showOriginal={false}
                                          size="sm"
                                          className="!text-current"
                                        />
                                      ) : (
                                        <span className="text-gray-500">N/A</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}

                    {/* Fallback if no pricing data */}
                    {(() => {
                      const availableVariants = getAvailableVariants(card)
                      const hasAnyPricing = card.cardmarket_avg_sell_price || card.cardmarket_low_price ||
                                          card.cardmarket_trend_price || card.cardmarket_reverse_holo_sell ||
                                          card.cardmarket_reverse_holo_low || card.cardmarket_reverse_holo_trend

                      if (!hasAnyPricing) {
                        return (
                          <div className="text-center py-6 text-gray-400">
                            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No pricing data available</p>
                            <p className="text-xs mt-1">Available variants: {availableVariants.join(', ')}</p>
                          </div>
                        )
                      }
                      return null
                    })()}
                  </Tab.Panel>
                  
                  <Tab.Panel>
                    <PriceGraph
                      currentPrice={card.cardmarket_avg_sell_price}
                      reverseHoloPrice={card.cardmarket_reverse_holo_sell}
                      avg7Days={card.cardmarket_avg_7_days}
                      avg30Days={card.cardmarket_avg_30_days}
                      cardName={card.name}
                      availableVariants={getAvailableVariants(card)}
                    />
                  </Tab.Panel>
                </Tab.Panels>
              </Tab.Group>
            </div>


            {/* External Links */}
            <div className="bg-pkmn-surface rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">External Links</h3>
              
              <a
                href={getCardMarketUrl(card)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-pkmn-card border border-gray-600 rounded-lg hover:bg-gray-600 hover:border-gray-500 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-white">View on Cardmarket</span>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-75" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="pokemon-card-modal w-full max-w-7xl transform overflow-hidden rounded-2xl bg-pkmn-card p-6 text-left align-middle shadow-xl transition-all">
                  {/* Close Button */}
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-pkmn-surface rounded-full text-gray-400 hover:text-white hover:bg-gray-600 transition-colors focus-visible"
                    aria-label="Close modal"
                  >
                    <X className="w-6 h-6" />
                  </button>

                  {/* Content */}
                  {cardState.loadingState === LoadingState.LOADING && renderLoading()}
                  {cardState.loadingState === LoadingState.ERROR && renderError()}
                  {cardState.loadingState === LoadingState.SUCCESS && renderCardContent()}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Friends Modal */}
      {cardState.data && (
        <FriendsWithCardModal
          isOpen={showFriendsModal}
          onClose={() => setShowFriendsModal(false)}
          friends={socialState.friendsWithCard}
          cardName={cardState.data.name}
          cardImage={cardState.data.image_small}
        />
      )}

      {/* Wishlist Selection Modal */}
      {cardState.data && (
        <WishlistSelectionModal
          isOpen={showWishlistModal}
          onClose={handleWishlistModalClose}
          cardId={cardState.data.id}
          cardName={cardState.data.name}
          cardImage={cardState.data.image_small || cardState.data.image_large}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false)
          setConfirmAction(null)
        }}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        title={confirmAction?.type === 'remove' ? 'Remove from Wishlist' : 'Add to Wishlist'}
        message={
          confirmAction?.type === 'remove'
            ? `Are you sure you want to remove "${confirmAction.cardName}" from your wishlist?`
            : `Add "${confirmAction?.cardName}" to your wishlist?`
        }
        confirmText={confirmAction?.type === 'remove' ? 'Remove' : 'Add'}
        cancelText="Cancel"
        type={confirmAction?.type === 'remove' ? 'warning' : 'info'}
        isLoading={socialState.loadingWishlist}
      />
    </>
  )
}