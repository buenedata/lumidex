'use client'

import { useState, useEffect, Fragment } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navigation from '@/components/navigation/Navigation'
import { supabase } from '@/lib/supabase'
import { PriceDisplay } from '@/components/PriceDisplay'
import { Tab } from '@headlessui/react'
import { Listbox, Transition } from '@headlessui/react'
import Image from 'next/image'
import Link from 'next/link'
import { useTradeModal } from '@/contexts/TradeModalContext'
import { useToast } from '@/components/ui/ToastContainer'
import { useNotifications } from '@/hooks/useNotifications'
import { useConfirmation } from '@/contexts/ConfirmationContext'
import { tradeCompletionService } from '@/lib/trade-completion-service'
import { tradeService } from '@/lib/trade-service'
import { achievementService } from '@/lib/achievement-service'
import { toastService } from '@/lib/toast-service'
import MatchCardPreview from '@/components/trading/MatchCardPreview'
import CardSelectionModal from '@/components/trading/CardSelectionModal'
import { useTradeCounts, useTradesChunk } from '@/hooks/useSimpleData'
import {
  Users,
  Heart,
  TrendingUp,
  Filter,
  Trophy,
  Target,
  Gift,
  MessageCircle,
  ChevronsUpDown,
  Check,
  ArrowRightLeft,
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Package,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface WishlistMatch {
  card_id: string
  card_name: string
  card_image_small: string
  card_image_large: string
  card_price: number
  card_rarity: string
  card_number: string
  set_id: string
  set_name: string
  friend_id: string
  friend_username: string
  friend_display_name?: string
  friend_avatar_url?: string
}

interface MatchesSummary {
  total_matches: number
  i_want_they_have: number
  they_want_i_have: number
  friends: Array<{
    friend_id: string
    friend_username: string
    friend_display_name?: string
    friend_avatar_url?: string
    friend_match_count: number
    friend_i_want_count: number
    friend_they_want_count: number
  }>
}

interface Trade {
  id: string
  initiator_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
  initiator_message?: string | null
  recipient_message?: string | null
  initiator_money_offer?: number | null
  recipient_money_offer?: number | null
  trade_method?: string | null
  initiator_shipping_included?: boolean | null
  recipient_shipping_included?: boolean | null
  created_at: string
  updated_at: string
  expires_at: string
  initiator: {
    username: string
    display_name?: string | null
    avatar_url?: string | null
  }
  recipient: {
    username: string
    display_name?: string | null
    avatar_url?: string | null
  }
  trade_items: Array<{
    id: string
    user_id: string
    card_id: string
    quantity: number
    condition: string
    card: {
      name: string
      image_small: string
      cardmarket_avg_sell_price?: number | null
      set: {
        name: string
      }
    }
  }>
}

interface FilterOption {
  id: string
  name: string
}

function TradingContent() {
  const { user } = useAuth()

  // Use new data fetching hooks
  const {
    data: tradeCounts,
    loading: tradeCountsLoading,
    error: tradeCountsError,
    fromCache: tradeCountsFromCache
  } = useTradeCounts(user?.id || null)

  const {
    data: activeTradesData,
    loading: activeTradesLoading,
    error: activeTradesError,
    fromCache: activeTradesFromCache
  } = useTradesChunk(user?.id || null, { status: 'active', offset: 0, limit: 100 })

  const {
    data: tradeHistoryData,
    loading: tradeHistoryLoading,
    error: tradeHistoryError,
    fromCache: tradeHistoryFromCache
  } = useTradesChunk(user?.id || null, { status: 'completed', offset: 0, limit: 100 })

  // Legacy states for backwards compatibility and complex data
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasInitialData, setHasInitialData] = useState(false)
  
  // Legacy wishlist data (keeping complex RPC calls for now)
  const [summary, setSummary] = useState<MatchesSummary | null>(null)
  const [iWantMatches, setIWantMatches] = useState<WishlistMatch[]>([])
  const [theyWantMatches, setTheyWantMatches] = useState<WishlistMatch[]>([])
  
  // Transform new data to legacy format
  const [activeTrades, setActiveTrades] = useState<Trade[]>([])
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([])

  // Filter states
  const [selectedFriend, setSelectedFriend] = useState<FilterOption>({ id: 'all', name: 'All Friends' })
  const [selectedSort, setSelectedSort] = useState<FilterOption>({ id: 'name', name: 'Card Name' })

  // Global trade modal and toast
  const { openTradeModal, setOnTradeCreated } = useTradeModal()
  const { showSuccess, showError, showInfo } = useToast()
  const { refreshNotifications } = useNotifications()
  const { confirm } = useConfirmation()

  // Loading states for trade actions
  const [processingTrade, setProcessingTrade] = useState<string | null>(null)
  const [clearingHistory, setClearingHistory] = useState(false)
  
  // Current user profile for notifications
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    display_name?: string | null
    username?: string
  } | null>(null)
  
  // Expanded friend details state
  const [expandedFriends, setExpandedFriends] = useState<Set<string>>(new Set())
  
  // Card selection modal state
  const [showCardSelection, setShowCardSelection] = useState(false)
  const [cardSelectionData, setCardSelectionData] = useState<{
    friendId: string
    friendName: string
    friendAvatar?: string
    availableCards: WishlistMatch[]
  } | null>(null)

  const sortOptions: FilterOption[] = [
    { id: 'name', name: 'Card Name' },
    { id: 'rarity', name: 'Rarity' },
    { id: 'price', name: 'Price (High to Low)' }
  ]

  // Transform new hook data to legacy format
  useEffect(() => {
    if (activeTradesData && Array.isArray(activeTradesData)) {
      setActiveTrades(activeTradesData.map((trade: any) => ({
        id: trade.id,
        initiator_id: trade.initiator_id,
        recipient_id: trade.recipient_id,
        status: trade.status,
        created_at: trade.created_at,
        updated_at: trade.updated_at,
        // Add missing properties with sensible defaults
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        trade_items: [],
        initiator_money_offer: null,
        recipient_money_offer: null,
        trade_method: null,
        initiator_shipping_included: null,
        recipient_shipping_included: null,
        initiator_message: null,
        recipient_message: null,
        // Handle the profile arrays properly
        initiator: Array.isArray(trade.initiator) ? trade.initiator[0] : trade.initiator,
        recipient: Array.isArray(trade.recipient) ? trade.recipient[0] : trade.recipient
      } as Trade)))
    }
  }, [activeTradesData])

  useEffect(() => {
    if (tradeHistoryData && Array.isArray(tradeHistoryData)) {
      setTradeHistory(tradeHistoryData.map((trade: any) => ({
        id: trade.id,
        initiator_id: trade.initiator_id,
        recipient_id: trade.recipient_id,
        status: trade.status,
        created_at: trade.created_at,
        updated_at: trade.updated_at,
        // Add missing properties with sensible defaults
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        trade_items: [],
        initiator_money_offer: null,
        recipient_money_offer: null,
        trade_method: null,
        initiator_shipping_included: null,
        recipient_shipping_included: null,
        initiator_message: null,
        recipient_message: null,
        // Handle the profile arrays properly
        initiator: Array.isArray(trade.initiator) ? trade.initiator[0] : trade.initiator,
        recipient: Array.isArray(trade.recipient) ? trade.recipient[0] : trade.recipient
      } as Trade)))
    }
  }, [tradeHistoryData])

  // Update loading state based on new hooks
  useEffect(() => {
    const allLoading = tradeCountsLoading || activeTradesLoading || tradeHistoryLoading
    setLoading(allLoading)
    
    if (!allLoading) {
      setHasInitialData(true)
    }
    
    // Set error from any of the hooks
    const anyError = tradeCountsError || activeTradesError || tradeHistoryError
    setError(anyError)
  }, [tradeCountsLoading, activeTradesLoading, tradeHistoryLoading, tradeCountsError, activeTradesError, tradeHistoryError])

  useEffect(() => {
    if (user) {
      loadWishlistMatches() // Keep complex wishlist loading for now
      loadCurrentUserProfile()
      // Set up the callback for when trades are created
      setOnTradeCreated(async () => {
        // The hooks will automatically refresh
        await refreshNotifications()
      })
    }
    
    // Cleanup callback when component unmounts
    return () => {
      setOnTradeCreated(null)
    }
  }, [user, setOnTradeCreated])

  const loadCurrentUserProfile = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setCurrentUserProfile(data)
    } catch (error) {
      console.error('Error loading current user profile:', error)
    }
  }

  // Simplified loading function - now only handles wishlist data
  const loadWishlistData = async () => {
    if (!user) return

    try {
      await loadWishlistMatches()
    } catch (error) {
      console.error('Error loading wishlist data:', error)
      // Set fallback data
      setIWantMatches([])
      setTheyWantMatches([])
      setSummary({
        total_matches: 0,
        i_want_they_have: 0,
        they_want_i_have: 0,
        friends: []
      })
    }
  }

  const loadWishlistMatches = async () => {
    if (!user) return { success: false, error: 'No user' }

    try {
      // Get cards I want that my friends have
      const { data: iWantData, error: iWantError } = await (supabase as any)
        .rpc('get_cards_i_want_friends_have', { user_id_param: user.id })

      if (iWantError) throw iWantError

      // Get cards my friends want that I have
      const { data: theyWantData, error: theyWantError } = await (supabase as any)
        .rpc('get_cards_friends_want_i_have', { user_id_param: user.id })

      if (theyWantError) throw theyWantError

      // Get summary data
      const { data: summaryData, error: summaryError } = await (supabase as any)
        .rpc('get_wishlist_matching_summary', { user_id_param: user.id })

      if (summaryError) throw summaryError

      setIWantMatches(iWantData || [])
      setTheyWantMatches(theyWantData || [])

      // Process summary data
      if (summaryData && summaryData.length > 0) {
        const firstRow = summaryData[0]
        const friends = summaryData.map((row: any) => ({
          friend_id: row.friend_id,
          friend_username: row.friend_username,
          friend_display_name: row.friend_display_name,
          friend_avatar_url: row.friend_avatar_url,
          friend_match_count: row.friend_match_count,
          friend_i_want_count: row.friend_i_want_count,
          friend_they_want_count: row.friend_they_want_count
        }))

        setSummary({
          total_matches: firstRow.total_matches || 0,
          i_want_they_have: firstRow.i_want_they_have || 0,
          they_want_i_have: firstRow.they_want_i_have || 0,
          friends
        })
      } else {
        setSummary({
          total_matches: 0,
          i_want_they_have: 0,
          they_want_i_have: 0,
          friends: []
        })
      }

      return { success: true }
    } catch (error) {
      console.error('Error loading wishlist matches:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to load wishlist matches' }
    }
  }

  // Legacy function kept for trade action callbacks - now just refreshes hooks
  const loadTrades = async () => {
    // The hooks will automatically refresh
    return { success: true }
  }

  const sortMatches = (matches: WishlistMatch[]) => {
    return [...matches].sort((a, b) => {
      switch (selectedSort.id) {
        case 'name':
          return a.card_name.localeCompare(b.card_name)
        case 'rarity':
          return a.card_rarity.localeCompare(b.card_rarity)
        case 'price':
          return (b.card_price || 0) - (a.card_price || 0)
        default:
          return a.card_name.localeCompare(b.card_name)
      }
    })
  }

  const filterByFriend = (matches: WishlistMatch[]) => {
    if (selectedFriend.id === 'all') return matches
    return matches.filter(match => match.friend_id === selectedFriend.id)
  }

  const filteredIWantMatches = sortMatches(filterByFriend(iWantMatches))
  const filteredTheyWantMatches = sortMatches(filterByFriend(theyWantMatches))

  // Get unique friends for filter dropdown
  const allFriends: FilterOption[] = Array.from(
    new Set([
      ...iWantMatches.map(m => m.friend_id),
      ...theyWantMatches.map(m => m.friend_id)
    ])
  ).map(friendId => {
    const match = [...iWantMatches, ...theyWantMatches].find(m => m.friend_id === friendId)
    return {
      id: friendId,
      name: match?.friend_display_name || match?.friend_username || 'Unknown'
    }
  })

  const friendOptions: FilterOption[] = [
    { id: 'all', name: 'All Friends' },
    ...allFriends
  ]

  const handleTradeClick = (friendId: string, friendName: string, friendAvatar?: string, card?: WishlistMatch, availableCards?: WishlistMatch[]) => {
    // If multiple cards are available, show selection modal
    if (availableCards && availableCards.length > 1) {
      setCardSelectionData({
        friendId,
        friendName,
        friendAvatar,
        availableCards
      })
      setShowCardSelection(true)
    } else {
      // Single card or no specific card
      const initialCard = card ? {
        id: card.card_id,
        name: card.card_name,
        image_small: card.card_image_small,
        price: card.card_price,
        set_name: card.set_name
      } : undefined

      openTradeModal({
        recipientId: friendId,
        recipientName: friendName,
        recipientAvatar: friendAvatar,
        initialCard
      })
    }
  }

  const handleCardSelection = (selectedCards: Array<{
    id: string
    name: string
    image_small: string
    price?: number
    set_name: string
  }>) => {
    if (!cardSelectionData) return

    if (selectedCards.length === 1) {
      // Single card selected
      openTradeModal({
        recipientId: cardSelectionData.friendId,
        recipientName: cardSelectionData.friendName,
        recipientAvatar: cardSelectionData.friendAvatar,
        initialCard: selectedCards[0]
      })
    } else if (selectedCards.length > 1) {
      // Multiple cards selected
      openTradeModal({
        recipientId: cardSelectionData.friendId,
        recipientName: cardSelectionData.friendName,
        recipientAvatar: cardSelectionData.friendAvatar,
        initialCards: selectedCards
      })
    }
  }

  const closeCardSelection = () => {
    setShowCardSelection(false)
    setCardSelectionData(null)
  }

  const toggleFriendExpansion = (friendId: string) => {
    setExpandedFriends(prev => {
      const newSet = new Set(prev)
      if (newSet.has(friendId)) {
        newSet.delete(friendId)
      } else {
        newSet.add(friendId)
      }
      return newSet
    })
  }

  const getFriendCards = (friendId: string) => {
    const iWantCards = iWantMatches.filter(match => match.friend_id === friendId)
    const theyWantCards = theyWantMatches.filter(match => match.friend_id === friendId)
    return { iWantCards, theyWantCards }
  }

  const handleAcceptTrade = async (trade: Trade) => {
    if (!user) return

    setProcessingTrade(trade.id)
    try {
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id)

      if (error) throw error

      // Show success toast
      showSuccess(
        'Trade Accepted!',
        `You have accepted the trade offer from ${trade.initiator.display_name || trade.initiator.username}.`
      )

      // Reload trades to update the UI
      await loadTrades()

      // Refresh notifications to update the notification count
      await refreshNotifications()

      // Send notification to trade initiator
      await tradeService.sendTradeAcceptedNotification(
        trade.id,
        user.id,
        trade.initiator_id,
        currentUserProfile?.display_name || currentUserProfile?.username || 'Someone'
      )
      
    } catch (error) {
      console.error('Error accepting trade:', error)
      showError(
        'Failed to Accept Trade',
        'There was an error accepting the trade. Please try again.'
      )
    } finally {
      setProcessingTrade(null)
    }
  }

  const handleDeclineTrade = async (trade: Trade) => {
    if (!user) return

    setProcessingTrade(trade.id)
    try {
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'declined',
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id)

      if (error) throw error

      // Show info toast
      showInfo(
        'Trade Declined',
        `You have declined the trade offer from ${trade.initiator.display_name || trade.initiator.username}.`
      )

      // Reload trades to update the UI
      await loadTrades()

      // Refresh notifications to update the notification count
      await refreshNotifications()

      // Send notification to trade initiator
      await tradeService.sendTradeDeclinedNotification(
        trade.id,
        user.id,
        trade.initiator_id,
        currentUserProfile?.display_name || currentUserProfile?.username || 'Someone'
      )
      
    } catch (error) {
      console.error('Error declining trade:', error)
      showError(
        'Failed to Decline Trade',
        'There was an error declining the trade. Please try again.'
      )
    } finally {
      setProcessingTrade(null)
    }
  }

  const handleCounterOffer = (trade: Trade) => {
    if (!user) return

    // Prepare the original trade data for the counter offer
    const theirCards = trade.trade_items
      .filter(item => item.user_id === trade.initiator_id)
      .map(item => ({
        id: item.card_id,
        name: item.card.name,
        image_small: item.card.image_small,
        price: item.card.cardmarket_avg_sell_price || 0,
        set_name: item.card.set.name,
        quantity: item.quantity,
        condition: item.condition
      }))

    // Prepare the recipient's original cards (what they offered, which Doffen wants)
    const myOriginalCards = trade.trade_items
      .filter(item => item.user_id === trade.recipient_id)
      .map(item => ({
        id: item.card_id,
        name: item.card.name,
        image_small: item.card.image_small,
        price: item.card.cardmarket_avg_sell_price || 0,
        set_name: item.card.set.name,
        quantity: item.quantity,
        condition: item.condition
      }))

    // Open trade modal with the original trade data
    openTradeModal({
      recipientId: trade.initiator_id,
      recipientName: trade.initiator.display_name || trade.initiator.username,
      recipientAvatar: trade.initiator.avatar_url || undefined,
      counterOfferData: {
        originalTradeId: trade.id,
        theirCards,
        myOriginalCards,
        theirMoney: trade.initiator_money_offer || 0,
        myOriginalMoney: trade.recipient_money_offer || 0,
        theirShippingIncluded: trade.initiator_shipping_included || true,
        myOriginalShippingIncluded: trade.recipient_shipping_included || true
      }
    })

    showInfo(
      'Counter Offer',
      'Review their original offer and create your counter proposal.'
    )
  }

  const handleCancelTrade = async (trade: Trade) => {
    if (!user) return

    setProcessingTrade(trade.id)
    try {
      const { error } = await supabase
        .from('trades')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id)

      if (error) throw error

      // Show info toast
      showInfo(
        'Trade Cancelled',
        `You have cancelled your trade offer to ${trade.recipient.display_name || trade.recipient.username}.`
      )

      // Reload trades to update the UI
      await loadTrades()

      // Refresh notifications to update the notification count
      await refreshNotifications()

      // Send notification to trade recipient
      await tradeService.sendTradeCancelledNotification(
        trade.id,
        user.id,
        trade.recipient_id,
        currentUserProfile?.display_name || currentUserProfile?.username || 'Someone'
      )
      
    } catch (error) {
      console.error('Error cancelling trade:', error)
      showError(
        'Failed to Cancel Trade',
        'There was an error cancelling the trade. Please try again.'
      )
    } finally {
      setProcessingTrade(null)
    }
  }

  const handleCompleteTrade = async (trade: Trade) => {
    if (!user) return

    // Show beautiful confirmation modal
    const confirmed = await confirm({
      title: 'Complete Trade',
      message: 'Are you sure you want to mark this trade as completed? This will:\n\n• Remove traded cards from your collection\n• Add received cards to your collection\n• Remove received cards from your wishlist (if present)\n• Mark the trade as completed\n\nThis action cannot be undone.',
      type: 'warning',
      confirmText: 'Complete Trade'
    })

    if (!confirmed) return

    setProcessingTrade(trade.id)
    try {
      const result = await tradeCompletionService.completeTrade(trade.id, user.id)

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete trade')
      }

      // Show detailed success message
      let successMessage = 'Trade completed successfully!'
      
      if (result.addedToCollection && result.addedToCollection.length > 0) {
        successMessage += `\n\nAdded to your collection:\n${result.addedToCollection.join('\n')}`
      }
      
      if (result.removedFromWishlist && result.removedFromWishlist.length > 0) {
        successMessage += `\n\nRemoved from your wishlist:\n${result.removedFromWishlist.join('\n')}`
      }

      showSuccess(
        'Trade Completed!',
        successMessage
      )

      // Reload trades to update the UI
      await loadTrades()

      // Refresh notifications to update the notification count
      await refreshNotifications()

      // Send notification to trade partner
      const partnerId = trade.initiator_id === user.id ? trade.recipient_id : trade.initiator_id
      await tradeService.sendTradeCompletedNotification(
        trade.id,
        user.id,
        partnerId,
        currentUserProfile?.display_name || currentUserProfile?.username || 'Someone'
      )

      // Check for achievements after completing trade for both users
      try {
        // Check achievements for current user
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

        // Check achievements for trade partner (but don't show toasts for them)
        const partnerAchievementResult = await achievementService.checkAchievements(partnerId)
        if (!partnerAchievementResult.success) {
          console.warn('Failed to check achievements for trade partner:', partnerAchievementResult.error)
        }
      } catch (achievementError) {
        console.warn('Failed to check achievements after trade completion:', achievementError)
      }
      
    } catch (error) {
      console.error('Error completing trade:', error)
      showError(
        'Failed to Complete Trade',
        error instanceof Error ? error.message : 'There was an error completing the trade. Please try again.'
      )
    } finally {
      setProcessingTrade(null)
    }
  }

  const handleClearHistory = async () => {
    if (!user) return

    // Check if there's any history to clear
    if (tradeHistory.length === 0) {
      showInfo(
        'No History to Clear',
        'You don\'t have any trade history to clear.'
      )
      return
    }

    // Show beautiful confirmation modal
    const confirmed = await confirm({
      title: 'Clear Trade History',
      message: 'Are you sure you want to clear your trade history? This will permanently delete all completed, declined, and cancelled trades. This action cannot be undone.',
      type: 'danger',
      confirmText: 'Clear History'
    })

    if (!confirmed) return

    setClearingHistory(true)
    try {
      const tradeIds = tradeHistory.map(t => t.id)
      
      console.log('Clear history debug info:', {
        tradeHistoryLength: tradeHistory.length,
        tradeIds: tradeIds,
        userId: user.id,
        tradeStatuses: tradeHistory.map(t => ({ id: t.id, status: t.status, initiator: t.initiator_id, recipient: t.recipient_id }))
      })
      
      // Only proceed if we have trade IDs to delete
      if (tradeIds.length > 0) {
        // First, set parent_trade_id to NULL for any trades that reference trades we're about to delete
        // This breaks the foreign key constraint temporarily
        const { error: updateError } = await (supabase as any)
          .from('trades')
          .update({ parent_trade_id: null })
          .in('parent_trade_id', tradeIds)

        if (updateError) {
          console.error('Error updating parent_trade_id references:', updateError)
          throw new Error(`Failed to update trade references: ${updateError.message}`)
        }

        // Now delete all trades in history status
        // This will automatically cascade delete the trade_items due to ON DELETE CASCADE
        const { error: tradesError } = await supabase
          .from('trades')
          .delete()
          .in('id', tradeIds)

        if (tradesError) throw tradesError
      }

      // Show success toast
      showSuccess(
        'History Cleared',
        'Your trade history has been successfully cleared.'
      )

      // Reload trades to update the UI
      await loadTrades()

      // Refresh notifications to update the notification count
      await refreshNotifications()
      
    } catch (error) {
      console.error('Error clearing trade history:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
        tradeHistoryLength: tradeHistory.length
      })
      
      // Show more detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      showError(
        'Failed to Clear History',
        `There was an error clearing your trade history: ${errorMessage}. Please check the console for more details and try again.`
      )
    } finally {
      setClearingHistory(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'declined':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400'
      case 'accepted':
        return 'text-green-400'
      case 'completed':
        return 'text-green-400'
      case 'declined':
        return 'text-red-400'
      case 'cancelled':
        return 'text-gray-400'
      default:
        return 'text-gray-400'
    }
  }

  if (loading && !hasInitialData) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-pokemon-gold border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading trading data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
          <ArrowRightLeft className="w-8 h-8 mr-3 text-pokemon-gold" />
          Trading Center
        </h1>
        <p className="text-gray-400 text-lg">
          Discover trading opportunities, manage active trades, and view your trading history
        </p>
      </div>

      {/* Data Loading Indicators */}
      {(tradeCountsFromCache || activeTradesFromCache || tradeHistoryFromCache) && (
        <div className="mb-4 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm">
            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
            Trading data loaded from cache - refreshing in background
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-900/50 border border-red-700 rounded-xl p-4">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-300">Loading Error</h3>
              <div className="mt-1 text-sm text-red-400">{error}</div>
              <div className="mt-2 text-xs text-red-300">Showing fallback data</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-pkmn-surface p-1 mb-8">
          <Tab
            className={({ selected }) =>
              `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200 ${
                selected
                  ? 'bg-pokemon-gold text-white shadow'
                  : 'text-gray-400 hover:bg-pkmn-card hover:text-white'
              }`
            }
          >
            <div className="flex items-center justify-center space-x-2">
              <Heart className="w-4 h-4" />
              <span>Discover</span>
              {summary && summary.total_matches > 0 && (
                <span className="bg-white text-black text-xs px-2 py-0.5 rounded-full font-bold">
                  {summary.total_matches}
                </span>
              )}
            </div>
          </Tab>
          <Tab
            className={({ selected }) =>
              `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200 ${
                selected
                  ? 'bg-pokemon-gold text-white shadow'
                  : 'text-gray-400 hover:bg-pkmn-card hover:text-white'
              }`
            }
          >
            <div className="flex items-center justify-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Active Trades</span>
              {(tradeCounts?.active || activeTrades.length) > 0 && (
                <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {tradeCounts?.active || activeTrades.length}
                </span>
              )}
            </div>
          </Tab>
          <Tab
            className={({ selected }) =>
              `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200 ${
                selected
                  ? 'bg-pokemon-gold text-white shadow'
                  : 'text-gray-400 hover:bg-pkmn-card hover:text-white'
              }`
            }
          >
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>History</span>
              {(tradeCounts?.completed || tradeHistory.length) > 0 && (
                <span className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {tradeCounts?.completed || tradeHistory.length}
                </span>
              )}
            </div>
          </Tab>
        </Tab.List>

        <Tab.Panels>
          {/* Discover Panel - Wishlist Matches */}
          <Tab.Panel>
            <Tab.Group>
              <Tab.List className="flex space-x-1 rounded-xl bg-pkmn-card p-1 mb-6">
                <Tab
                  className={({ selected }) =>
                    `w-full rounded-lg py-2 text-sm font-medium leading-5 transition-all duration-200 ${
                      selected
                        ? 'bg-pokemon-gold text-white shadow'
                        : 'text-gray-400 hover:bg-pkmn-surface hover:text-white'
                    }`
                  }
                >
                  <div className="flex items-center justify-center space-x-2">
                    <TrendingUp className="w-4 h-4" />
                    <span>Overview</span>
                  </div>
                </Tab>
                <Tab
                  className={({ selected }) =>
                    `w-full rounded-lg py-2 text-sm font-medium leading-5 transition-all duration-200 ${
                      selected
                        ? 'bg-pokemon-gold text-white shadow'
                        : 'text-gray-400 hover:bg-pkmn-surface hover:text-white'
                    }`
                  }
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Gift className="w-4 h-4" />
                    <span>I Want</span>
                    {iWantMatches.length > 0 && (
                      <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                        {iWantMatches.length}
                      </span>
                    )}
                  </div>
                </Tab>
                <Tab
                  className={({ selected }) =>
                    `w-full rounded-lg py-2 text-sm font-medium leading-5 transition-all duration-200 ${
                      selected
                        ? 'bg-pokemon-gold text-white shadow'
                        : 'text-gray-400 hover:bg-pkmn-surface hover:text-white'
                    }`
                  }
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Target className="w-4 h-4" />
                    <span>They Want</span>
                    {theyWantMatches.length > 0 && (
                      <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                        {theyWantMatches.length}
                      </span>
                    )}
                  </div>
                </Tab>
              </Tab.List>

              <Tab.Panels>
                {/* Overview Panel */}
                <Tab.Panel>
                  <div className="space-y-6">
                    {summary && summary.total_matches > 0 ? (
                      <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-6 border border-gray-700/50">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-3xl font-bold text-pokemon-gold mb-1">
                                  {summary.total_matches}
                                </div>
                                <div className="text-sm text-gray-400">Total Matches</div>
                                <div className="text-xs text-gray-500 mt-1">Wishlist opportunities</div>
                              </div>
                              <div className="p-3 bg-pokemon-gold/20 rounded-lg">
                                <Heart className="w-8 h-8 text-pokemon-gold" />
                              </div>
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-6 border border-gray-700/50">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-3xl font-bold text-green-400 mb-1">
                                  {summary.i_want_they_have}
                                </div>
                                <div className="text-sm text-gray-400">I Want</div>
                                <div className="text-xs text-gray-500 mt-1">Cards friends have</div>
                              </div>
                              <div className="p-3 bg-green-500/20 rounded-lg">
                                <Gift className="w-8 h-8 text-green-400" />
                              </div>
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-6 border border-gray-700/50">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-3xl font-bold text-blue-400 mb-1">
                                  {summary.they_want_i_have}
                                </div>
                                <div className="text-sm text-gray-400">They Want</div>
                                <div className="text-xs text-gray-500 mt-1">Cards I have</div>
                              </div>
                              <div className="p-3 bg-blue-500/20 rounded-lg">
                                <Target className="w-8 h-8 text-blue-400" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Top Trading Partners */}
                        {summary.friends.length > 0 && (
                          <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                              <Trophy className="w-5 h-5 mr-2 text-pokemon-gold" />
                              Best Trading Partners
                            </h3>
                            <div className="space-y-4">
                              {summary.friends.slice(0, 5).map((friendData) => {
                                const isExpanded = expandedFriends.has(friendData.friend_id)
                                const { iWantCards, theyWantCards } = getFriendCards(friendData.friend_id)
                                
                                return (
                                  <div key={friendData.friend_id} className="bg-pkmn-surface/30 rounded-lg p-4 hover:bg-pkmn-surface/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-4">
                                        <div className="flex-shrink-0">
                                          {friendData.friend_avatar_url ? (
                                            <Image
                                              src={friendData.friend_avatar_url}
                                              alt={friendData.friend_display_name || friendData.friend_username}
                                              width={48}
                                              height={48}
                                              className="w-12 h-12 rounded-full border-2 border-pokemon-gold/30"
                                            />
                                          ) : (
                                            <div className="w-12 h-12 rounded-full bg-pokemon-gold/20 flex items-center justify-center border-2 border-pokemon-gold/30">
                                              <span className="text-lg font-bold text-pokemon-gold">
                                                {(friendData.friend_display_name || friendData.friend_username).charAt(0).toUpperCase()}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <div>
                                          <div className="text-lg font-medium text-white">
                                            {friendData.friend_display_name || friendData.friend_username}
                                          </div>
                                          <div className="text-sm text-yellow-400 font-medium">
                                            {friendData.friend_match_count} total matches
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-6">
                                        <div className="text-center">
                                          <div className="text-lg font-bold text-green-400">{friendData.friend_i_want_count}</div>
                                          <div className="text-xs text-gray-400">I want</div>
                                        </div>
                                        <div className="text-center">
                                          <div className="text-lg font-bold text-blue-400">{friendData.friend_they_want_count}</div>
                                          <div className="text-xs text-gray-400">They want</div>
                                        </div>
                                        <div className="flex space-x-2">
                                          <button
                                            onClick={() => {
                                              // Get all cards I want from this friend
                                              const cardsIWant = iWantMatches.filter(match => match.friend_id === friendData.friend_id)
                                              const cardsTheyWant = theyWantMatches.filter(match => match.friend_id === friendData.friend_id)
                                              
                                              // Combine all available cards for trading
                                              const allAvailableCards = [...cardsIWant, ...cardsTheyWant]
                                              
                                              if (allAvailableCards.length > 1) {
                                                // Multiple cards available, let user choose
                                                handleTradeClick(
                                                  friendData.friend_id,
                                                  friendData.friend_display_name || friendData.friend_username,
                                                  friendData.friend_avatar_url || undefined,
                                                  undefined, // No specific card
                                                  allAvailableCards // Pass all available cards
                                                )
                                              } else {
                                                // Single card or no cards, use the first one
                                                const firstCard = cardsIWant[0] || cardsTheyWant[0]
                                                handleTradeClick(
                                                  friendData.friend_id,
                                                  friendData.friend_display_name || friendData.friend_username,
                                                  friendData.friend_avatar_url || undefined,
                                                  firstCard
                                                )
                                              }
                                            }}
                                            className="px-3 py-1.5 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 rounded-lg transition-colors flex items-center space-x-1.5"
                                            title="Propose Trade"
                                          >
                                            <ArrowRightLeft className="w-4 h-4 text-white" />
                                            <span className="text-xs font-medium text-white">Trade</span>
                                          </button>
                                          <button
                                            className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors flex items-center space-x-1.5"
                                            title="Message"
                                          >
                                            <MessageCircle className="w-4 h-4 text-blue-400" />
                                            <span className="text-xs font-medium text-blue-400">Message</span>
                                          </button>
                                          <button
                                            onClick={() => toggleFriendExpansion(friendData.friend_id)}
                                            className="px-3 py-1.5 bg-gray-500/20 hover:bg-gray-500/30 rounded-lg transition-colors flex items-center space-x-1.5"
                                            title={isExpanded ? "Hide Cards" : "Show Cards"}
                                          >
                                            {isExpanded ? (
                                              <ChevronUp className="w-4 h-4 text-gray-400" />
                                            ) : (
                                              <ChevronDown className="w-4 h-4 text-gray-400" />
                                            )}
                                            <span className="text-xs font-medium text-gray-400">
                                              {isExpanded ? "Hide" : "Show"} Cards
                                            </span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Expandable Card Preview */}
                                    {isExpanded && (iWantCards.length > 0 || theyWantCards.length > 0) && (
                                      <div className="mt-4 pt-4 border-t border-gray-600">
                                        <MatchCardPreview
                                          friendId={friendData.friend_id}
                                          friendName={friendData.friend_username}
                                          friendDisplayName={friendData.friend_display_name}
                                          friendAvatar={friendData.friend_avatar_url}
                                          iWantCards={iWantCards}
                                          theyWantCards={theyWantCards}
                                          onTradeClick={handleTradeClick}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4 opacity-50">💝</div>
                        <h3 className="text-xl font-medium text-gray-300 mb-2">No wishlist matches found</h3>
                        <p className="text-gray-500 mb-4">Add cards to your wishlist and connect with friends to find trading opportunities!</p>
                        <div className="flex justify-center space-x-4">
                          <Link href="/wishlist" className="btn-gaming">
                            Manage Wishlist
                          </Link>
                          <Link href="/friends" className="btn-gaming-outline">
                            Find Friends
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </Tab.Panel>

                {/* I Want Panel */}
                <Tab.Panel>
                  <div className="space-y-6">
                    {/* Filters */}
                    <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                      <div className="flex items-center space-x-4 mb-4">
                        <Filter className="w-5 h-5 text-pokemon-gold" />
                        <h3 className="text-lg font-semibold text-white">Cards I Want That Friends Have</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Friend
                          </label>
                          <Listbox value={selectedFriend} onChange={setSelectedFriend}>
                            <div className="relative">
                              <Listbox.Button className="relative w-full cursor-default rounded-lg bg-pkmn-surface border border-gray-600 py-2 pl-3 pr-10 text-left text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold">
                                <span className="block truncate">{selectedFriend.name}</span>
                                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                  <ChevronsUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </span>
                              </Listbox.Button>
                              <Transition
                                as={Fragment}
                                leave="transition ease-in duration-100"
                                leaveFrom="opacity-100"
                                leaveTo="opacity-0"
                              >
                                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-pkmn-surface border border-gray-600 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                  {friendOptions.map((friend) => (
                                    <Listbox.Option
                                      key={friend.id}
                                      className={({ active }) =>
                                        `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                          active ? 'bg-pokemon-gold/20 text-pokemon-gold' : 'text-white'
                                        }`
                                      }
                                      value={friend}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                            {friend.name}
                                          </span>
                                          {selected ? (
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-pokemon-gold">
                                              <Check className="h-5 w-5" aria-hidden="true" />
                                            </span>
                                          ) : null}
                                        </>
                                      )}
                                    </Listbox.Option>
                                  ))}
                                </Listbox.Options>
                              </Transition>
                            </div>
                          </Listbox>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Sort by
                          </label>
                          <Listbox value={selectedSort} onChange={setSelectedSort}>
                            <div className="relative">
                              <Listbox.Button className="relative w-full cursor-default rounded-lg bg-pkmn-surface border border-gray-600 py-2 pl-3 pr-10 text-left text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold">
                                <span className="block truncate">{selectedSort.name}</span>
                                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                  <ChevronsUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </span>
                              </Listbox.Button>
                              <Transition
                                as={Fragment}
                                leave="transition ease-in duration-100"
                                leaveFrom="opacity-100"
                                leaveTo="opacity-0"
                              >
                                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-pkmn-surface border border-gray-600 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                  {sortOptions.map((option) => (
                                    <Listbox.Option
                                      key={option.id}
                                      className={({ active }) =>
                                        `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                          active ? 'bg-pokemon-gold/20 text-pokemon-gold' : 'text-white'
                                        }`
                                      }
                                      value={option}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                            {option.name}
                                          </span>
                                          {selected ? (
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-pokemon-gold">
                                              <Check className="h-5 w-5" aria-hidden="true" />
                                            </span>
                                          ) : null}
                                        </>
                                      )}
                                    </Listbox.Option>
                                  ))}
                                </Listbox.Options>
                              </Transition>
                            </div>
                          </Listbox>
                        </div>
                      </div>
                    </div>

                    {/* Cards Grid */}
                    {filteredIWantMatches.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {filteredIWantMatches.map((match, index) => (
                          <div key={`${match.card_id}-${match.friend_id}-${index}`} className="bg-pkmn-card rounded-xl p-3 border border-gray-700/50 hover:border-pokemon-gold/50 transition-all duration-200 group">
                            <div className="relative mb-3">
                              <Link href={`/cards/${match.card_id}`}>
                                <Image
                                  src={match.card_image_small}
                                  alt={match.card_name}
                                  width={200}
                                  height={280}
                                  className="w-full h-auto rounded-lg group-hover:scale-105 transition-transform duration-200"
                                />
                              </Link>
                              <div className="absolute top-2 right-2 bg-black/70 rounded-lg px-2 py-1">
                                <PriceDisplay
                                  amount={match.card_price}
                                  currency="EUR"
                                  showConversion={true}
                                  showOriginal={false}
                                  className="text-xs font-bold card-price-yellow"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Link href={`/cards/${match.card_id}`}>
                                <h3 className="text-sm font-medium text-white hover:text-pokemon-gold transition-colors line-clamp-2">
                                  {match.card_name}
                                </h3>
                              </Link>
                              <p className="text-xs text-gray-400">{match.set_name}</p>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  {match.friend_avatar_url ? (
                                    <Image
                                      src={match.friend_avatar_url}
                                      alt={match.friend_display_name || match.friend_username}
                                      width={20}
                                      height={20}
                                      className="w-5 h-5 rounded-full border border-pokemon-gold/30"
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-pokemon-gold/20 flex items-center justify-center border border-pokemon-gold/30">
                                      <span className="text-xs font-bold text-pokemon-gold">
                                        {(match.friend_display_name || match.friend_username).charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <span className="text-xs text-gray-400 truncate">
                                    {match.friend_display_name || match.friend_username}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleTradeClick(
                                  match.friend_id,
                                  match.friend_display_name || match.friend_username,
                                  match.friend_avatar_url || undefined,
                                  match
                                )}
                                className="w-full px-2 py-1.5 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 rounded-lg transition-colors flex items-center justify-center space-x-1.5"
                                title="Propose Trade"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-white" />
                                <span className="text-xs font-medium text-white">Trade</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4 opacity-50">🎯</div>
                        <h3 className="text-xl font-medium text-gray-300 mb-2">No matches found</h3>
                        <p className="text-gray-500">No cards you want are available from your friends.</p>
                      </div>
                    )}
                  </div>
                </Tab.Panel>

                {/* They Want Panel */}
                <Tab.Panel>
                  <div className="space-y-6">
                    {/* Cards Grid */}
                    {filteredTheyWantMatches.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {filteredTheyWantMatches.map((match, index) => (
                          <div key={`${match.card_id}-${match.friend_id}-${index}`} className="bg-pkmn-card rounded-xl p-3 border border-gray-700/50 hover:border-pokemon-gold/50 transition-all duration-200 group">
                            <div className="relative mb-3">
                              <Link href={`/cards/${match.card_id}`}>
                                <Image
                                  src={match.card_image_small}
                                  alt={match.card_name}
                                  width={200}
                                  height={280}
                                  className="w-full h-auto rounded-lg group-hover:scale-105 transition-transform duration-200"
                                />
                              </Link>
                              <div className="absolute top-2 right-2 bg-black/70 rounded-lg px-2 py-1">
                                <PriceDisplay
                                  amount={match.card_price}
                                  currency="EUR"
                                  showConversion={true}
                                  showOriginal={false}
                                  className="text-xs font-bold card-price-yellow"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Link href={`/cards/${match.card_id}`}>
                                <h3 className="text-sm font-medium text-white hover:text-pokemon-gold transition-colors line-clamp-2">
                                  {match.card_name}
                                </h3>
                              </Link>
                              <p className="text-xs text-gray-400">{match.set_name}</p>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  {match.friend_avatar_url ? (
                                    <Image
                                      src={match.friend_avatar_url}
                                      alt={match.friend_display_name || match.friend_username}
                                      width={20}
                                      height={20}
                                      className="w-5 h-5 rounded-full border border-pokemon-gold/30"
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-pokemon-gold/20 flex items-center justify-center border border-pokemon-gold/30">
                                      <span className="text-xs font-bold text-pokemon-gold">
                                        {(match.friend_display_name || match.friend_username).charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <span className="text-xs text-gray-400 truncate">
                                    {match.friend_display_name || match.friend_username}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleTradeClick(
                                  match.friend_id,
                                  match.friend_display_name || match.friend_username,
                                  match.friend_avatar_url || undefined,
                                  match
                                )}
                                className="w-full px-2 py-1.5 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 rounded-lg transition-colors flex items-center justify-center space-x-1.5"
                                title="Propose Trade"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-white" />
                                <span className="text-xs font-medium text-white">Trade</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4 opacity-50">💎</div>
                        <h3 className="text-xl font-medium text-gray-300 mb-2">No matches found</h3>
                        <p className="text-gray-500">None of your friends want cards you have.</p>
                      </div>
                    )}
                  </div>
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
          </Tab.Panel>

          {/* Active Trades Panel */}
          <Tab.Panel>
            <div className="space-y-6">
              {activeTrades.length > 0 ? (
                <div className="space-y-4">
                  {activeTrades.map((trade) => (
                    <div key={trade.id} className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(trade.status)}
                            <span className={`text-sm font-medium ${getStatusColor(trade.status)}`}>
                              {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            {new Date(trade.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">
                          Trade #{trade.id.slice(0, 8)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Initiator's Offer */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            {trade.initiator_id === user?.id ? 'You offer' : `${trade.initiator.display_name || trade.initiator.username}'s Offer`}
                          </h4>
                          <div className="space-y-2">
                            {/* Show initiator's cards */}
                            {trade.trade_items
                              .filter(item => item.user_id === trade.initiator_id)
                              .map((item) => (
                                <div key={item.id} className="flex items-center space-x-3 bg-pkmn-surface/30 rounded-lg p-3">
                                  <Image
                                    src={item.card.image_small}
                                    alt={item.card.name}
                                    width={40}
                                    height={56}
                                    className="w-10 h-14 rounded object-cover"
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-white">{item.card.name}</div>
                                    <div className="text-xs text-gray-400">{item.card.set.name}</div>
                                    <div className="text-xs text-gray-500">Qty: {item.quantity}</div>
                                  </div>
                                  {item.card.cardmarket_avg_sell_price && (
                                    <PriceDisplay
                                      amount={item.card.cardmarket_avg_sell_price}
                                      currency="EUR"
                                      showConversion={true}
                                      showOriginal={false}
                                      className="text-lg font-bold card-price-yellow"
                                    />
                                  )}
                                </div>
                              ))}
                            
                            {/* Show initiator's money offer if any */}
                            {trade.initiator_money_offer != null && trade.initiator_money_offer > 0 && (
                              <div className="bg-pkmn-surface/30 rounded-lg p-3">
                                <div className="text-sm font-medium text-white mb-1">Money Offer</div>
                                <div className="text-lg font-bold text-pokemon-gold">
                                  <PriceDisplay
                                    amount={trade.initiator_money_offer}
                                    currency="NOK"
                                    showConversion={true}
                                    showOriginal={false}
                                    className="text-lg font-bold card-price-yellow"
                                  />
                                </div>
                                <div className="text-xs text-gray-500">
                                  {trade.initiator_shipping_included ? 'Shipping included' : 'Shipping separate'}
                                </div>
                              </div>
                            )}

                            {/* Show placeholder if no cards or money */}
                            {trade.trade_items.filter(item => item.user_id === trade.initiator_id).length === 0 &&
                             (trade.initiator_money_offer == null || trade.initiator_money_offer <= 0) && (
                              <div className="bg-pkmn-surface/30 rounded-lg p-4 text-center">
                                <div className="text-sm text-gray-400">No offer details available</div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Recipient's Offer (what they're offering in return) */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            {trade.recipient_id === user?.id ? 'You offer' : `${trade.recipient.display_name || trade.recipient.username}'s Offer`}
                          </h4>
                          <div className="space-y-2">
                            {/* Show recipient's cards */}
                            {trade.trade_items
                              .filter(item => item.user_id === trade.recipient_id)
                              .map((item) => (
                                <div key={item.id} className="flex items-center space-x-3 bg-pkmn-surface/30 rounded-lg p-3">
                                  <Image
                                    src={item.card.image_small}
                                    alt={item.card.name}
                                    width={40}
                                    height={56}
                                    className="w-10 h-14 rounded object-cover"
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-white">{item.card.name}</div>
                                    <div className="text-xs text-gray-400">{item.card.set.name}</div>
                                    <div className="text-xs text-gray-500">Qty: {item.quantity}</div>
                                  </div>
                                  {item.card.cardmarket_avg_sell_price && (
                                    <PriceDisplay
                                      amount={item.card.cardmarket_avg_sell_price}
                                      currency="EUR"
                                      showConversion={true}
                                      showOriginal={false}
                                      className="text-lg font-bold card-price-yellow"
                                    />
                                  )}
                                </div>
                              ))}
                            
                            {/* Show recipient's money offer if any */}
                            {trade.recipient_money_offer != null && trade.recipient_money_offer > 0 && (
                              <div className="bg-pkmn-surface/30 rounded-lg p-3">
                                <div className="text-sm font-medium text-white mb-1">Money Offer</div>
                                <div className="text-lg font-bold text-pokemon-gold">
                                  <PriceDisplay
                                    amount={trade.recipient_money_offer}
                                    currency="NOK"
                                    showConversion={true}
                                    showOriginal={false}
                                    className="text-lg font-bold card-price-yellow"
                                  />
                                </div>
                                <div className="text-xs text-gray-500">
                                  {trade.recipient_shipping_included ? 'Shipping included' : 'Shipping separate'}
                                </div>
                              </div>
                            )}

                            {/* Show placeholder if no cards or money from recipient yet */}
                            {trade.trade_items.filter(item => item.user_id === trade.recipient_id).length === 0 &&
                             (trade.recipient_money_offer == null || trade.recipient_money_offer <= 0) && (
                              <div className="bg-pkmn-surface/30 rounded-lg p-4 text-center">
                                <div className="text-sm text-gray-400 mb-1">No offer details available</div>
                                <div className="text-xs text-gray-500">
                                  {trade.recipient_id === user?.id
                                    ? 'You haven\'t added any cards or money to this trade'
                                    : 'Waiting for them to add cards or money to the trade'
                                  }
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Action buttons for pending trades */}
                      {trade.status === 'pending' && trade.recipient_id === user?.id && (
                        <div className="mt-4 flex space-x-3">
                          <button
                            onClick={() => handleAcceptTrade(trade)}
                            disabled={processingTrade === trade.id}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex items-center space-x-2"
                          >
                            {processingTrade === trade.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                <span>Processing...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span>Accept Trade</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeclineTrade(trade)}
                            disabled={processingTrade === trade.id}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex items-center space-x-2"
                          >
                            {processingTrade === trade.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                <span>Processing...</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4" />
                                <span>Decline Trade</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleCounterOffer(trade)}
                            disabled={processingTrade === trade.id}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex items-center space-x-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>Counter Offer</span>
                          </button>
                        </div>
                      )}

                      {/* Status message and cancel option for pending trades initiated by current user */}
                      {trade.status === 'pending' && trade.initiator_id === user?.id && (
                        <div className="mt-4 space-y-3">
                          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-yellow-400" />
                              <span className="text-sm text-yellow-300">
                                Waiting for {trade.recipient.display_name || trade.recipient.username} to respond
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleCancelTrade(trade)}
                              disabled={processingTrade === trade.id}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex items-center space-x-2"
                            >
                              {processingTrade === trade.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                  <span>Cancelling...</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4" />
                                  <span>Cancel Trade</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Status message and complete button for accepted trades */}
                      {trade.status === 'accepted' && (
                        <div className="mt-4 space-y-3">
                          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-green-300">
                                Trade accepted! Contact each other to arrange the exchange.
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleCompleteTrade(trade)}
                              disabled={processingTrade === trade.id}
                              className="px-4 py-2 bg-pokemon-gold hover:bg-pokemon-gold/90 disabled:bg-pokemon-gold/50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex items-center space-x-2"
                              title="Mark trade as completed - this will transfer cards and remove them from wishlists"
                            >
                              {processingTrade === trade.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                                  <span>Completing...</span>
                                </>
                              ) : (
                                <>
                                  <Package className="w-4 h-4" />
                                  <span>Mark as Completed</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 opacity-50">⏳</div>
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No active trades</h3>
                  <p className="text-gray-500">You don't have any pending or accepted trades.</p>
                </div>
              )}
            </div>
          </Tab.Panel>

          {/* History Panel */}
          <Tab.Panel>
            <div className="space-y-6">
              {tradeHistory.length > 0 ? (
                <>
                  {/* Clear History Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleClearHistory}
                      disabled={clearingHistory}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                      {clearingHistory ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Clearing...</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          <span>Clear History</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {tradeHistory.map((trade) => (
                    <div key={trade.id} className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50 opacity-75">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(trade.status)}
                            <span className={`text-sm font-medium ${getStatusColor(trade.status)}`}>
                              {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            {new Date(trade.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">
                          Trade #{trade.id.slice(0, 8)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            {trade.initiator_id === user?.id ? 'You offered' : `${trade.initiator.display_name || trade.initiator.username} offered`}
                          </h4>
                          <div className="space-y-2">
                            {trade.trade_items
                              .filter(item => item.user_id === trade.initiator_id)
                              .slice(0, 3)
                              .map((item) => (
                                <div key={item.id} className="flex items-center space-x-3 bg-pkmn-surface/20 rounded-lg p-3">
                                  <Image
                                    src={item.card.image_small}
                                    alt={item.card.name}
                                    width={32}
                                    height={44}
                                    className="w-8 h-11 rounded object-cover"
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-300">{item.card.name}</div>
                                    <div className="text-xs text-gray-500">Qty: {item.quantity}</div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            {trade.recipient_id === user?.id ? 'You traded away' : `${trade.recipient.display_name || trade.recipient.username} traded away`}
                          </h4>
                          <div className="space-y-2">
                            {trade.trade_items
                              .filter(item => item.user_id === trade.recipient_id)
                              .slice(0, 3)
                              .map((item) => (
                                <div key={item.id} className="flex items-center space-x-3 bg-pkmn-surface/20 rounded-lg p-3">
                                  <Image
                                    src={item.card.image_small}
                                    alt={item.card.name}
                                    width={32}
                                    height={44}
                                    className="w-8 h-11 rounded object-cover"
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-300">{item.card.name}</div>
                                    <div className="text-xs text-gray-500">Qty: {item.quantity}</div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 opacity-50">📜</div>
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No trade history</h3>
                  <p className="text-gray-500">You haven't completed any trades yet.</p>
                </div>
              )}
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Card Selection Modal */}
      {cardSelectionData && (
        <CardSelectionModal
          isOpen={showCardSelection}
          onClose={closeCardSelection}
          cards={cardSelectionData.availableCards.map(card => ({
            id: card.card_id,
            name: card.card_name,
            image_small: card.card_image_small,
            price: card.card_price,
            set_name: card.set_name
          }))}
          recipientName={cardSelectionData.friendName}
          onSelectCards={handleCardSelection}
        />
      )}

    </div>
  )
}

export default function TradingPage() {
  return (
    <ProtectedRoute>
      <Navigation>
        <TradingContent />
      </Navigation>
    </ProtectedRoute>
  )
}
                                