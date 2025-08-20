'use client'

import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition, Listbox } from '@headlessui/react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { PriceDisplay } from '@/components/PriceDisplay'
import { useToast } from '@/components/ui/ToastContainer'
import { profileService } from '@/lib/profile-service'
import { tradeService } from '@/lib/trade-service'
import Image from 'next/image'
import {
  X,
  Plus,
  Minus,
  ArrowLeftRight,
  Truck,
  Mail,
  Shield,
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Coins,
  Search,
  Filter,
  SortAsc,
  DollarSign,
  User
} from 'lucide-react'
import { CardDetailsModal } from '@/components/pokemon/CardDetailsModal'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { currencyService } from '@/lib/currency-service'
import { useI18n } from '@/contexts/I18nContext'

interface TradeModalProps {
  isOpen: boolean
  onClose: () => void
  recipientId: string
  recipientName: string
  recipientAvatar?: string
  initialCard?: {
    id: string
    name: string
    image_small: string
    price?: number
    set_name: string
  } | null
  initialCards?: Array<{
    id: string
    name: string
    image_small: string
    price?: number
    set_name: string
  }>
  counterOfferData?: {
    originalTradeId: string
    theirCards: Array<{
      id: string
      name: string
      image_small: string
      price?: number
      set_name: string
      quantity: number
      condition: string
    }>
    myOriginalCards?: Array<{
      id: string
      name: string
      image_small: string
      price?: number
      set_name: string
      quantity: number
      condition: string
    }>
    theirMoney: number
    myOriginalMoney?: number
    theirShippingIncluded: boolean
    myOriginalShippingIncluded?: boolean
  }
  onTradeCreated?: () => void
}

interface TradeCard {
  id: string
  name: string
  image_small: string
  price?: number | null
  set_name: string
  quantity: number
  condition: string
}

interface UserCard {
  id: string
  card_id: string
  quantity: number
  condition: string
  card: {
    id: string
    name: string
    image_small: string
    cardmarket_avg_sell_price?: number | null
    set: {
      name: string
    }[] | {
      name: string
    }
  }
}

const TRADE_METHODS = [
  { id: 'digital_first', name: 'Digital Payment First', icon: DollarSign, description: 'Money sent digitally, then cards shipped' },
  { id: 'simultaneous', name: 'Simultaneous Exchange', icon: ArrowLeftRight, description: 'Both parties send at the same time' },
  { id: 'meetup', name: 'In-Person Meetup', icon: Shield, description: 'Meet in person to exchange' },
  { id: 'escrow', name: 'Trusted Third Party', icon: Shield, description: 'Use a trusted intermediary' }
]

const CONDITIONS = [
  { id: 'mint', name: 'Mint' },
  { id: 'near_mint', name: 'Near Mint' },
  { id: 'lightly_played', name: 'Lightly Played' },
  { id: 'moderately_played', name: 'Moderately Played' },
  { id: 'heavily_played', name: 'Heavily Played' },
  { id: 'damaged', name: 'Damaged' }
]

export default function TradeModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  recipientAvatar,
  initialCard,
  initialCards,
  counterOfferData,
  onTradeCreated
}: TradeModalProps) {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const { locale } = useI18n()
  const preferredCurrency = usePreferredCurrency()
  const [loading, setLoading] = useState(false)
  const [userCards, setUserCards] = useState<UserCard[]>([])
  const [recipientCards, setRecipientCards] = useState<UserCard[]>([])
  const [selectedTradeMethod, setSelectedTradeMethod] = useState(TRADE_METHODS[0])
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    avatar_url?: string
    display_name?: string
    username?: string
  } | null>(null)
  
  // Counter offer editing state
  const [isEditingTheirOffer, setIsEditingTheirOffer] = useState(false)
  const [showRecipientCardSelector, setShowRecipientCardSelector] = useState(false)
  
  // Trade offer state
  const [myOffer, setMyOffer] = useState<{
    cards: TradeCard[]
    money: number
    shippingIncluded: boolean
  }>({
    cards: [],
    money: 0,
    shippingIncluded: true
  })
  
  const [theirOffer, setTheirOffer] = useState<{
    cards: TradeCard[]
    money: number
    shippingIncluded: boolean
  }>({
    cards: [],
    money: 0,
    shippingIncluded: true
  })

  const [showCardSelector, setShowCardSelector] = useState(false)
  const [message, setMessage] = useState('')
  
  // Card selector filters
  const [searchQuery, setSearchQuery] = useState('')
  const [showSimilarValue, setShowSimilarValue] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'set'>('name')
  
  // Card details modal state
  const [selectedCardForDetails, setSelectedCardForDetails] = useState<string | null>(null)
  const [showCardDetailsModal, setShowCardDetailsModal] = useState(false)

  useEffect(() => {
    if (isOpen && user) {
      loadUserCards()
      loadCurrentUserProfile()
      
      // Handle counter offer data
      if (counterOfferData) {
        // Enable editing mode for counter offers
        setIsEditingTheirOffer(true)
        
        // Load recipient's cards for counter offer editing
        loadRecipientCards()
        
        setTheirOffer(prev => ({
          ...prev,
          cards: counterOfferData.theirCards.map(card => ({
            id: card.id,
            name: card.name,
            image_small: card.image_small,
            price: card.price || 0,
            set_name: card.set_name,
            quantity: card.quantity,
            condition: card.condition
          })),
          money: counterOfferData.theirMoney,
          shippingIncluded: counterOfferData.theirShippingIncluded
        }))

        // Populate "Your Offer" with the original cards you offered (that they want)
        if (counterOfferData.myOriginalCards) {
          setMyOffer(prev => ({
            ...prev,
            cards: counterOfferData.myOriginalCards!.map(card => ({
              id: card.id,
              name: card.name,
              image_small: card.image_small,
              price: card.price || 0,
              set_name: card.set_name,
              quantity: card.quantity,
              condition: card.condition
            })),
            money: counterOfferData.myOriginalMoney || 0,
            shippingIncluded: counterOfferData.myOriginalShippingIncluded || true
          }))
        }
      }
      // Add initial card(s) if provided (and not a counter offer)
      else if (initialCards && initialCards.length > 0) {
        setIsEditingTheirOffer(false)
        setTheirOffer(prev => ({
          ...prev,
          cards: initialCards.map(card => ({
            id: card.id,
            name: card.name,
            image_small: card.image_small,
            price: card.price || 0,
            set_name: card.set_name,
            quantity: 1,
            condition: 'near_mint'
          }))
        }))
      }
      else if (initialCard) {
        setIsEditingTheirOffer(false)
        setTheirOffer(prev => ({
          ...prev,
          cards: [{
            id: initialCard.id,
            name: initialCard.name,
            image_small: initialCard.image_small,
            price: initialCard.price || 0, // Ensure price is not undefined
            set_name: initialCard.set_name,
            quantity: 1,
            condition: 'near_mint'
          }]
        }))
      }
    }
  }, [isOpen, user, initialCard, initialCards, counterOfferData])

  const loadUserCards = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_collections')
        .select(`
          id,
          card_id,
          quantity,
          condition,
          card:cards (
            id,
            name,
            image_small,
            cardmarket_avg_sell_price,
            set:sets (
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .gt('quantity', 0)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Transform the data to fix card array issue
      const transformedData = (data || []).map(item => ({
        ...item,
        card: Array.isArray(item.card) ? item.card[0] : item.card
      }))
      
      setUserCards(transformedData)
    } catch (error) {
      console.error('Error loading user cards:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentUserProfile = async () => {
    if (!user) return
    
    try {
      const result = await profileService.getProfileData(user.id)
      if (result.success && result.data) {
        setCurrentUserProfile({
          avatar_url: result.data.profile.avatar_url,
          display_name: result.data.profile.display_name,
          username: result.data.profile.username
        })
      }
    } catch (error) {
      console.error('Error loading current user profile:', error)
    }
  }

  const loadRecipientCards = async () => {
    if (!recipientId) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_collections')
        .select(`
          id,
          card_id,
          quantity,
          condition,
          card:cards (
            id,
            name,
            image_small,
            cardmarket_avg_sell_price,
            set:sets (
              name
            )
          )
        `)
        .eq('user_id', recipientId)
        .gt('quantity', 0)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Transform the data to fix card array issue
      const transformedData = (data || []).map(item => ({
        ...item,
        card: Array.isArray(item.card) ? item.card[0] : item.card
      }))
      
      setRecipientCards(transformedData)
    } catch (error) {
      console.error('Error loading recipient cards:', error)
    } finally {
      setLoading(false)
    }
  }

  const addCardToMyOffer = (userCard: UserCard & { totalQuantity: number }) => {
    const existingCard = myOffer.cards.find(c => c.id === userCard.card.id)
    
    if (existingCard) {
      // Increase quantity if not exceeding available
      if (existingCard.quantity < userCard.totalQuantity) {
        setMyOffer(prev => ({
          ...prev,
          cards: prev.cards.map(c =>
            c.id === userCard.card.id
              ? { ...c, quantity: c.quantity + 1 }
              : c
          )
        }))
      }
    } else {
      // Add new card - store EUR price, conversion happens in calculateOfferValue
      setMyOffer(prev => ({
        ...prev,
        cards: [...prev.cards, {
          id: userCard.card.id,
          name: userCard.card.name,
          image_small: userCard.card.image_small,
          price: userCard.card.cardmarket_avg_sell_price || 0, // Store EUR price
          set_name: Array.isArray(userCard.card.set) ? userCard.card.set[0]?.name || 'Unknown Set' : userCard.card.set.name,
          quantity: 1,
          condition: userCard.condition
        }]
      }))
    }
    setShowCardSelector(false)
  }

  const removeCardFromMyOffer = (cardId: string) => {
    setMyOffer(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== cardId)
    }))
  }

  const updateCardQuantity = (cardId: string, change: number) => {
    setMyOffer(prev => ({
      ...prev,
      cards: prev.cards.map(c => {
        if (c.id === cardId) {
          const newQuantity = Math.max(1, c.quantity + change)
          // Calculate total available quantity for this card
          const totalAvailable = userCards
            .filter(uc => uc.card.id === cardId)
            .reduce((sum, uc) => sum + uc.quantity, 0)
          return { ...c, quantity: Math.min(newQuantity, totalAvailable) }
        }
        return c
      })
    }))
  }

  const addCardToTheirOffer = (userCard: UserCard & { totalQuantity: number }) => {
    const existingCard = theirOffer.cards.find(c => c.id === userCard.card.id)
    
    if (existingCard) {
      // Increase quantity if not exceeding available
      if (existingCard.quantity < userCard.totalQuantity) {
        setTheirOffer(prev => ({
          ...prev,
          cards: prev.cards.map(c =>
            c.id === userCard.card.id
              ? { ...c, quantity: c.quantity + 1 }
              : c
          )
        }))
      }
    } else {
      // Add new card
      setTheirOffer(prev => ({
        ...prev,
        cards: [...prev.cards, {
          id: userCard.card.id,
          name: userCard.card.name,
          image_small: userCard.card.image_small,
          price: userCard.card.cardmarket_avg_sell_price || 0,
          set_name: Array.isArray(userCard.card.set) ? userCard.card.set[0]?.name || 'Unknown Set' : userCard.card.set.name,
          quantity: 1,
          condition: userCard.condition
        }]
      }))
    }
    setShowRecipientCardSelector(false)
  }

  const removeCardFromTheirOffer = (cardId: string) => {
    setTheirOffer(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== cardId)
    }))
  }

  const updateTheirCardQuantity = (cardId: string, change: number) => {
    setTheirOffer(prev => ({
      ...prev,
      cards: prev.cards.map(c => {
        if (c.id === cardId) {
          const newQuantity = Math.max(1, c.quantity + change)
          // Calculate total available quantity for this card from recipient's collection
          const totalAvailable = recipientCards
            .filter(uc => uc.card.id === cardId)
            .reduce((sum, uc) => sum + uc.quantity, 0)
          return { ...c, quantity: Math.min(newQuantity, totalAvailable) }
        }
        return c
      })
    }))
  }

  const calculateOfferValue = (offer: typeof myOffer) => {
    const cardValue = offer.cards.reduce((sum, card) => {
      // Convert EUR to NOK (11.5x rate) if price is in EUR
      const priceInNOK = (card.price || 0) * 11.5
      return sum + priceInNOK * card.quantity
    }, 0)
    return cardValue + offer.money
  }

  const handleSubmitTrade = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const isCounterOffer = !!counterOfferData
      
      console.log('Creating trade with data:', {
        initiator_id: user.id,
        recipient_id: recipientId,
        status: 'pending',
        initiator_message: message,
        cards: myOffer.cards,
        money: myOffer.money,
        shippingIncluded: myOffer.shippingIncluded,
        isCounterOffer,
        originalTradeId: counterOfferData?.originalTradeId
      })

      // Create trade record
      const tradeData: any = {
        initiator_id: user.id,
        recipient_id: recipientId,
        status: 'pending',
        initiator_message: message,
        initiator_money_offer: myOffer.money,
        recipient_money_offer: theirOffer.money,
        trade_method: selectedTradeMethod.id,
        initiator_shipping_included: myOffer.shippingIncluded,
        recipient_shipping_included: theirOffer.shippingIncluded,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      }

      // If this is a counter offer, mark the original trade as superseded
      if (isCounterOffer) {
        tradeData.parent_trade_id = counterOfferData.originalTradeId
        
        // Update the original trade status to 'declined' (superseded by counter offer)
        const { error: updateError } = await supabase
          .from('trades')
          .update({ status: 'declined' })
          .eq('id', counterOfferData.originalTradeId)
        
        if (updateError) {
          console.error('Error updating original trade:', updateError)
          throw updateError
        }
      }

      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .insert(tradeData)
        .select()
        .single()

      if (tradeError) {
        console.error('Trade creation error:', tradeError)
        throw tradeError
      }

      console.log('Trade created successfully:', trade)

      // Add trade items for my offer
      const myTradeItems = myOffer.cards.map(card => ({
        trade_id: trade.id,
        user_id: user.id,
        card_id: card.id,
        quantity: card.quantity,
        condition: card.condition,
        is_foil: false // TODO: Add foil support
      }))

      // Add trade items for their offer
      const theirTradeItems = theirOffer.cards.map(card => ({
        trade_id: trade.id,
        user_id: recipientId,
        card_id: card.id,
        quantity: card.quantity,
        condition: card.condition,
        is_foil: false // TODO: Add foil support
      }))

      // Insert all trade items
      const allTradeItems = [...myTradeItems, ...theirTradeItems]
      
      if (allTradeItems.length > 0) {
        console.log('Adding trade items:', allTradeItems)
        const { error: itemsError } = await supabase
          .from('trade_items')
          .insert(allTradeItems)

        if (itemsError) {
          console.error('Trade items error:', itemsError)
          throw itemsError
        }
        console.log('Trade items added successfully')
      }

      console.log('Trade creation completed successfully')
      
      // Close modal and show success
      onClose()
      
      // Call the callback to refresh trades list
      if (onTradeCreated) {
        onTradeCreated()
      } else {
        // Fallback: refresh the page if no callback provided
        window.location.reload()
      }
      
      const successMessage = isCounterOffer
        ? `Your counter offer has been sent to ${recipientName}. They will be notified and can accept, decline, or make another counter offer.`
        : `Your trade offer has been sent to ${recipientName}. ${theirOffer.cards.length > 0 ? `You're requesting their ${theirOffer.cards[0].name} in exchange.` : ''} They will be notified and can accept, decline, or make a counter offer.`
      
      showSuccess(
        isCounterOffer ? 'Counter Offer Sent!' : 'Trade Offer Sent!',
        successMessage
      )

      // Send notification for counter offers
      if (isCounterOffer && currentUserProfile) {
        await tradeService.sendCounterOfferNotification(
          trade.id,
          user.id,
          recipientId,
          currentUserProfile.display_name || currentUserProfile.username || 'Someone'
        )
      }
      
    } catch (error: any) {
      console.error('Error creating trade:', error)
      showError(
        'Failed to Send Trade Offer',
        error?.message || 'An unexpected error occurred while creating the trade. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const myOfferValue = calculateOfferValue(myOffer)
  const theirOfferValue = calculateOfferValue(theirOffer)

  // Filter and sort user cards for card selector
  const getFilteredAndSortedCards = () => {
    // First, group cards by card_id to get unique cards with total quantities
    const uniqueCardsMap = new Map<string, UserCard & { totalQuantity: number }>()
    
    userCards.forEach(userCard => {
      const cardId = userCard.card.id
      if (uniqueCardsMap.has(cardId)) {
        // Add to existing quantity
        const existing = uniqueCardsMap.get(cardId)!
        existing.totalQuantity += userCard.quantity
      } else {
        // Add new unique card
        uniqueCardsMap.set(cardId, {
          ...userCard,
          totalQuantity: userCard.quantity
        })
      }
    })

    let filtered = Array.from(uniqueCardsMap.values())

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(card =>
        card.card.name.toLowerCase().includes(query) ||
        (Array.isArray(card.card.set) ? card.card.set[0]?.name || '' : card.card.set.name).toLowerCase().includes(query)
      )
    }

    // Similar value filter
    if (showSimilarValue && initialCard?.price) {
      const targetPrice = initialCard.price * 11.5 // Convert EUR to NOK
      const tolerance = targetPrice * 0.3 // 30% tolerance
      filtered = filtered.filter(card => {
        const cardPrice = (card.card.cardmarket_avg_sell_price || 0) * 11.5
        return Math.abs(cardPrice - targetPrice) <= tolerance
      })
    }

    // Sort cards
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.card.name.localeCompare(b.card.name)
        case 'price':
          const priceA = (a.card.cardmarket_avg_sell_price || 0) * 11.5
          const priceB = (b.card.cardmarket_avg_sell_price || 0) * 11.5
          return priceB - priceA // Highest price first
        case 'set':
          const setNameA = Array.isArray(a.card.set) ? a.card.set[0]?.name || '' : a.card.set.name
          const setNameB = Array.isArray(b.card.set) ? b.card.set[0]?.name || '' : b.card.set.name
          return setNameA.localeCompare(setNameB)
        default:
          return 0
      }
    })

    return filtered
  }

  const filteredCards = getFilteredAndSortedCards()

  // Filter and sort recipient cards for their card selector
  const getFilteredAndSortedRecipientCards = () => {
    // First, group cards by card_id to get unique cards with total quantities
    const uniqueCardsMap = new Map<string, UserCard & { totalQuantity: number }>()
    
    recipientCards.forEach(userCard => {
      const cardId = userCard.card.id
      if (uniqueCardsMap.has(cardId)) {
        // Add to existing quantity
        const existing = uniqueCardsMap.get(cardId)!
        existing.totalQuantity += userCard.quantity
      } else {
        // Add new unique card
        uniqueCardsMap.set(cardId, {
          ...userCard,
          totalQuantity: userCard.quantity
        })
      }
    })

    let filtered = Array.from(uniqueCardsMap.values())

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(card =>
        card.card.name.toLowerCase().includes(query) ||
        (Array.isArray(card.card.set) ? card.card.set[0]?.name || '' : card.card.set.name).toLowerCase().includes(query)
      )
    }

    // Sort cards
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.card.name.localeCompare(b.card.name)
        case 'price':
          const priceA = (a.card.cardmarket_avg_sell_price || 0) * 11.5
          const priceB = (b.card.cardmarket_avg_sell_price || 0) * 11.5
          return priceB - priceA // Highest price first
        case 'set':
          const setNameA = Array.isArray(a.card.set) ? a.card.set[0]?.name || '' : a.card.set.name
          const setNameB = Array.isArray(b.card.set) ? b.card.set[0]?.name || '' : b.card.set.name
          return setNameA.localeCompare(setNameB)
        default:
          return 0
      }
    })

    return filtered
  }

  const filteredRecipientCards = getFilteredAndSortedRecipientCards()

  // Reset filters when modal opens
  const handleOpenCardSelector = () => {
    setSearchQuery('')
    setShowSimilarValue(false)
    setSortBy('name')
    setShowCardSelector(true)
  }

  const handleOpenRecipientCardSelector = () => {
    setSearchQuery('')
    setShowSimilarValue(false)
    setSortBy('name')
    setShowRecipientCardSelector(true)
  }

  // Avatar component for displaying user avatars
  const UserAvatar = ({
    avatarUrl,
    displayName,
    username,
    size = 'md'
  }: {
    avatarUrl?: string
    displayName?: string
    username?: string
    size?: 'sm' | 'md' | 'lg'
  }) => {
    const sizeClasses = {
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
      lg: 'w-12 h-12'
    }
    
    const iconSizes = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6'
    }

    return (
      <div className="flex items-center space-x-2">
        <div
          className={`${sizeClasses[size]} rounded-full border-2 border-pokemon-gold/30 bg-pkmn-surface flex items-center justify-center overflow-hidden`}
          style={{
            backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {!avatarUrl && (
            <User className={`${iconSizes[size]} text-gray-400`} />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">
            {displayName || username || 'User'}
          </span>
          {displayName && username && displayName !== username && (
            <span className="text-xs text-gray-400">@{username}</span>
          )}
        </div>
      </div>
    )
  }

  return (
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
          <div className="fixed inset-0 bg-black/75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-pkmn-dark border border-gray-700 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-2xl font-bold text-white flex items-center">
                    <ArrowLeftRight className="w-6 h-6 mr-3 text-pokemon-gold" />
                    Trading with {recipientName}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Trade Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                  {/* My Offer */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-white">Your Offer</h3>
                      <UserAvatar
                        avatarUrl={currentUserProfile?.avatar_url}
                        displayName={currentUserProfile?.display_name}
                        username={currentUserProfile?.username}
                        size="md"
                      />
                    </div>
                    
                    {/* Card Grid */}
                    <div className="bg-pkmn-card rounded-xl p-4 border border-gray-700">
                      <div className="grid grid-cols-3 gap-4 min-h-[400px]">
                        {Array.from({ length: 6 }).map((_, index) => {
                          const card = myOffer.cards[index]
                          return (
                            <div
                              key={index}
                              className="aspect-[3/4] bg-pkmn-surface border-2 border-gray-600 rounded-lg flex flex-col relative group"
                            >
                              {card ? (
                                <>
                                  <div className="flex-1 p-2">
                                    <div
                                      className="relative w-full h-full cursor-pointer"
                                      onClick={() => {
                                        setSelectedCardForDetails(card.id)
                                        setShowCardDetailsModal(true)
                                      }}
                                    >
                                      <Image
                                        src={card.image_small || '/placeholder-card.png'}
                                        alt={card.name}
                                        fill
                                        className="object-contain rounded-lg hover:scale-105 transition-transform duration-200"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.src = '/placeholder-card.png';
                                        }}
                                      />
                                      {card.quantity > 1 && (
                                        <div className="absolute top-1 right-1 bg-black/70 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                                          {card.quantity}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="p-2 bg-pkmn-dark/50 rounded-b-lg">
                                    <div className="text-xs font-medium text-white truncate mb-1">{card.name}</div>
                                    <div className="text-xs text-gray-400 truncate">{card.set_name}</div>
                                    <div className="flex justify-between items-center mt-1">
                                      <span className="text-xs text-white">Qty: {card.quantity}</span>
                                      {card.price && card.price > 0 && (
                                        <span className="text-xs font-bold text-white">
                                          {((card.price || 0) * 11.5 * card.quantity).toFixed(0)} NOK
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                    <div className="flex space-x-1">
                                      <button
                                        onClick={() => updateCardQuantity(card.id, -1)}
                                        className="p-2 bg-red-500 hover:bg-red-600 rounded text-white"
                                      >
                                        <Minus className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => updateCardQuantity(card.id, 1)}
                                        className="p-2 bg-green-500 hover:bg-green-600 rounded text-white"
                                      >
                                        <Plus className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => removeCardFromMyOffer(card.id)}
                                        className="p-2 bg-gray-500 hover:bg-gray-600 rounded text-white"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <button
                                  onClick={handleOpenCardSelector}
                                  className="w-full h-full flex items-center justify-center text-gray-500 hover:text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors"
                                >
                                  <Plus className="w-8 h-8" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Money Offer */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Coins className="w-5 h-5 text-pokemon-gold" />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={myOffer.money || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            if (value === '') {
                              setMyOffer(prev => ({ ...prev, money: 0 }))
                            } else {
                              const numValue = parseFloat(value)
                              if (!isNaN(numValue) && numValue >= 0) {
                                setMyOffer(prev => ({ ...prev, money: numValue }))
                              }
                            }
                          }}
                          className="flex-1 bg-pkmn-surface border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold"
                          placeholder="Add money to offer (NOK)"
                        />
                      </div>
                      
                      {/* Shipping Options */}
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-gray-400">Shipping:</span>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="shipping"
                            checked={myOffer.shippingIncluded}
                            onChange={() => setMyOffer(prev => ({ ...prev, shippingIncluded: true }))}
                            className="w-4 h-4 text-pokemon-gold bg-pkmn-surface border-gray-600 focus:ring-pokemon-gold focus:ring-2"
                          />
                          <span className="text-white">Included</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="shipping"
                            checked={!myOffer.shippingIncluded}
                            onChange={() => setMyOffer(prev => ({ ...prev, shippingIncluded: false }))}
                            className="w-4 h-4 text-pokemon-gold bg-pkmn-surface border-gray-600 focus:ring-pokemon-gold focus:ring-2"
                          />
                          <span className="text-white">Separate</span>
                        </label>
                      </div>
                    </div>

                    {/* My Offer Value */}
                    <div className="text-center">
                      <div className="text-sm text-gray-400">Total Value</div>
                      <div className="text-lg font-bold text-pokemon-gold">
                        {myOfferValue.toFixed(2)} NOK
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {myOffer.shippingIncluded ? 'Shipping included' : 'Shipping separate'}
                      </div>
                    </div>
                  </div>

                  {/* Their Offer */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-white">
                        {recipientName}'s Offer
                        {isEditingTheirOffer && (
                          <span className="text-sm text-pokemon-gold ml-2">(Editable)</span>
                        )}
                      </h3>
                      <UserAvatar
                        avatarUrl={recipientAvatar}
                        displayName={recipientName}
                        username={recipientName}
                        size="md"
                      />
                    </div>
                    
                    {/* Card Grid */}
                    <div className="bg-pkmn-card rounded-xl p-4 border border-gray-700">
                      <div className="grid grid-cols-3 gap-4 min-h-[400px]">
                        {Array.from({ length: 6 }).map((_, index) => {
                          const card = theirOffer.cards[index]
                          return (
                            <div
                              key={index}
                              className={`aspect-[3/4] bg-pkmn-surface border-2 border-gray-600 rounded-lg flex flex-col relative ${isEditingTheirOffer ? 'group' : ''}`}
                            >
                              {card ? (
                                <>
                                  <div className="flex-1 p-2">
                                    <div
                                      className="relative w-full h-full cursor-pointer"
                                      onClick={() => {
                                        setSelectedCardForDetails(card.id)
                                        setShowCardDetailsModal(true)
                                      }}
                                    >
                                      <Image
                                        src={card.image_small || '/placeholder-card.png'}
                                        alt={card.name}
                                        fill
                                        className="object-contain rounded-lg hover:scale-105 transition-transform duration-200"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.src = '/placeholder-card.png';
                                        }}
                                      />
                                      {card.quantity > 1 && (
                                        <div className="absolute top-1 right-1 bg-black/70 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                                          {card.quantity}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="p-2 bg-pkmn-dark/50 rounded-b-lg">
                                    <div className="text-xs font-medium text-white truncate mb-1">{card.name}</div>
                                    <div className="text-xs text-gray-400 truncate">{card.set_name}</div>
                                    <div className="flex justify-between items-center mt-1">
                                      <span className="text-xs text-white">Qty: {card.quantity}</span>
                                      {card.price && card.price > 0 && (
                                        <span className="text-xs font-bold text-white">
                                          {((card.price || 0) * 11.5 * card.quantity).toFixed(0)} NOK
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {isEditingTheirOffer && (
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                      <div className="flex space-x-1">
                                        <button
                                          onClick={() => updateTheirCardQuantity(card.id, -1)}
                                          className="p-2 bg-red-500 hover:bg-red-600 rounded text-white"
                                        >
                                          <Minus className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => updateTheirCardQuantity(card.id, 1)}
                                          className="p-2 bg-green-500 hover:bg-green-600 rounded text-white"
                                        >
                                          <Plus className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => removeCardFromTheirOffer(card.id)}
                                          className="p-2 bg-gray-500 hover:bg-gray-600 rounded text-white"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-600">
                                  {isEditingTheirOffer ? (
                                    <button
                                      onClick={handleOpenRecipientCardSelector}
                                      className="w-full h-full flex items-center justify-center text-gray-500 hover:text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors"
                                    >
                                      <Plus className="w-8 h-8" />
                                    </button>
                                  ) : (
                                    <Plus className="w-8 h-8" />
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Their Money Offer */}
                    <div className="flex items-center space-x-3">
                      <Coins className="w-5 h-5 text-pokemon-gold" />
                      {isEditingTheirOffer ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={theirOffer.money || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            if (value === '') {
                              setTheirOffer(prev => ({ ...prev, money: 0 }))
                            } else {
                              const numValue = parseFloat(value)
                              if (!isNaN(numValue) && numValue >= 0) {
                                setTheirOffer(prev => ({ ...prev, money: numValue }))
                              }
                            }
                          }}
                          className="flex-1 bg-pkmn-surface border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold"
                          placeholder="Add money to their offer (NOK)"
                        />
                      ) : (
                        <div className="flex-1 bg-pkmn-surface border border-gray-600 rounded-lg px-3 py-2 text-gray-400">
                          {theirOffer.money > 0 ? `${theirOffer.money.toFixed(2)} NOK` : 'No money offered'}
                        </div>
                      )}
                    </div>

                    {/* Their Offer Value */}
                    <div className="text-center">
                      <div className="text-sm text-gray-400">Total Value</div>
                      <div className="text-lg font-bold text-blue-400">
                        {theirOfferValue.toFixed(2)} NOK
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trade Method Selection */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-white mb-3">Exchange Method</h4>
                  <Listbox value={selectedTradeMethod} onChange={setSelectedTradeMethod}>
                    <div className="relative">
                      <Listbox.Button className="relative w-full cursor-default rounded-lg bg-pkmn-surface border border-gray-600 py-3 pl-3 pr-10 text-left text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold">
                        <div className="flex items-center space-x-3">
                          <selectedTradeMethod.icon className="w-5 h-5 text-pokemon-gold" />
                          <div>
                            <div className="font-medium">{selectedTradeMethod.name}</div>
                            <div className="text-sm text-gray-400">{selectedTradeMethod.description}</div>
                          </div>
                        </div>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronsUpDown className="h-5 w-5 text-gray-400" />
                        </span>
                      </Listbox.Button>
                      <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-pkmn-surface border border-gray-600 py-1 shadow-lg">
                          {TRADE_METHODS.map((method) => (
                            <Listbox.Option
                              key={method.id}
                              className={({ active }) =>
                                `relative cursor-default select-none py-3 pl-3 pr-9 ${
                                  active ? 'bg-pokemon-gold/20 text-pokemon-gold' : 'text-white'
                                }`
                              }
                              value={method}
                            >
                              {({ selected }) => (
                                <>
                                  <div className="flex items-center space-x-3">
                                    <method.icon className="w-5 h-5" />
                                    <div>
                                      <div className="font-medium">{method.name}</div>
                                      <div className="text-sm opacity-75">{method.description}</div>
                                    </div>
                                  </div>
                                  {selected && (
                                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-pokemon-gold">
                                      <Check className="h-5 w-5" />
                                    </span>
                                  )}
                                </>
                              )}
                            </Listbox.Option>
                          ))}
                        </Listbox.Options>
                      </Transition>
                    </div>
                  </Listbox>
                  
                  {/* Trade Method Guidance */}
                  <div className="mt-3 p-3 bg-pkmn-card rounded-lg">
                    <div className="text-xs text-gray-400 mb-2">Recommended for your offer:</div>
                    <div className="text-sm text-gray-300">
                      {myOffer.cards.length > 0 && myOffer.money > 0 && (
                        <span>💳 Cards + Money: Consider "Digital Payment First" or "Trusted Third Party"</span>
                      )}
                      {myOffer.cards.length > 0 && myOffer.money === 0 && (
                        <span>🃏 Cards Only: "Simultaneous Exchange" or "In-Person Meetup" work well</span>
                      )}
                      {myOffer.cards.length === 0 && myOffer.money > 0 && (
                        <span>💰 Money Only: "Digital Payment First" is most suitable</span>
                      )}
                      {myOffer.cards.length === 0 && myOffer.money === 0 && (
                        <span>⚠️ Add cards or money to your offer</span>
                      )}
                    </div>
                    {(myOffer.cards.length > 0 || myOffer.money > 0) && (
                      <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-600">
                        💡 Tip: {myOffer.shippingIncluded ? 'Shipping costs are included in your offer' : 'Remember to discuss shipping costs separately'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Message */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Message (Optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="w-full bg-pkmn-surface border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold resize-none"
                    placeholder="Add a message to your trade offer..."
                    maxLength={500}
                  />
                  <div className="text-xs text-gray-500 mt-1">{message.length}/500</div>
                </div>

                {/* Safety Notice */}
                <div className="mb-6 bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                      <h5 className="font-medium text-yellow-300">Trading Safety</h5>
                      <p className="text-sm text-yellow-200 mt-1">
                        Always verify card conditions and use secure payment methods. Meet in public places for in-person trades.
                        The platform is not responsible for trade disputes.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitTrade}
                    disabled={loading || (myOffer.cards.length === 0 && myOffer.money === 0)}
                    className="px-6 py-2 bg-pokemon-gold hover:bg-pokemon-gold/90 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating Trade...' : 'Send Trade Offer'}
                  </button>
                </div>

                {/* Enhanced Card Selector Modal */}
                {showCardSelector && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-pkmn-dark rounded-xl p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                      {/* Header */}
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Select Cards from Your Collection</h3>
                        <button
                          onClick={() => setShowCardSelector(false)}
                          className="p-2 hover:bg-gray-700 rounded-lg"
                        >
                          <X className="w-5 h-5 text-gray-400" />
                        </button>
                      </div>

                      {/* Filters and Search */}
                      <div className="space-y-4 mb-6">
                        {/* Search Bar */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search cards by name or set..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-pkmn-surface border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold"
                          />
                        </div>

                        {/* Filter Options */}
                        <div className="flex flex-wrap gap-4 items-center">
                          {/* Similar Value Filter */}
                          {initialCard?.price && (
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showSimilarValue}
                                onChange={(e) => setShowSimilarValue(e.target.checked)}
                                className="w-4 h-4 text-pokemon-gold bg-pkmn-surface border-gray-600 rounded focus:ring-pokemon-gold focus:ring-2"
                              />
                              <span className="text-sm text-white flex items-center space-x-1">
                                <DollarSign className="w-4 h-4 text-pokemon-gold" />
                                <span>Similar value (~{(initialCard.price * 11.5).toFixed(0)} NOK)</span>
                              </span>
                            </label>
                          )}

                          {/* Sort Options */}
                          <div className="flex items-center space-x-2">
                            <SortAsc className="w-4 h-4 text-gray-400" />
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as 'name' | 'price' | 'set')}
                              className="bg-pkmn-surface border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pokemon-gold"
                            >
                              <option value="name">Sort by Name</option>
                              <option value="price">Sort by Price</option>
                              <option value="set">Sort by Set</option>
                            </select>
                          </div>

                          {/* Results Count */}
                          <div className="text-sm text-gray-400">
                            {filteredCards.length} of {userCards.length} cards
                          </div>
                        </div>
                      </div>

                      {/* Cards Grid */}
                      <div className="flex-1 overflow-y-auto">
                        {filteredCards.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pb-4">
                            {filteredCards.map((userCard) => {
                              const cardPrice = (userCard.card.cardmarket_avg_sell_price || 0) * 11.5
                              return (
                                <div
                                  key={userCard.id}
                                  onClick={() => addCardToMyOffer(userCard)}
                                  className="bg-pkmn-card rounded-lg p-3 cursor-pointer hover:bg-pkmn-surface transition-colors border border-gray-700 hover:border-pokemon-gold/50"
                                >
                                  <div className="relative mb-2">
                                    <Image
                                      src={userCard.card.image_small || '/placeholder-card.png'}
                                      alt={userCard.card.name}
                                      width={120}
                                      height={168}
                                      className="w-full aspect-[3/4] object-cover rounded-lg"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = '/placeholder-card.png';
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-white truncate font-medium">{userCard.card.name}</div>
                                    <div className="text-xs text-gray-400 truncate">
                                      {Array.isArray(userCard.card.set) ? userCard.card.set[0]?.name || 'Unknown Set' : userCard.card.set.name}
                                    </div>
                                    {cardPrice > 0 && (
                                      <div className="text-center">
                                        <span className="text-xs font-bold text-white">
                                          {cardPrice.toFixed(0)} NOK
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Filter className="w-12 h-12 text-gray-500 mb-4" />
                            <h4 className="text-lg font-medium text-gray-300 mb-2">No cards found</h4>
                            <p className="text-gray-500 mb-4">
                              {searchQuery ? 'Try adjusting your search terms' : 'Try different filter options'}
                            </p>
                            <button
                              onClick={() => {
                                setSearchQuery('')
                                setShowSimilarValue(false)
                                setSortBy('name')
                              }}
                              className="px-4 py-2 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 text-pokemon-gold rounded-lg transition-colors"
                            >
                              Clear Filters
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recipient Card Selector Modal */}
                {showRecipientCardSelector && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-pkmn-dark rounded-xl p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                      {/* Header */}
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Select Cards from {recipientName}'s Collection</h3>
                        <button
                          onClick={() => setShowRecipientCardSelector(false)}
                          className="p-2 hover:bg-gray-700 rounded-lg"
                        >
                          <X className="w-5 h-5 text-gray-400" />
                        </button>
                      </div>

                      {/* Filters and Search */}
                      <div className="space-y-4 mb-6">
                        {/* Search Bar */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search cards by name or set..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-pkmn-surface border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold"
                          />
                        </div>

                        {/* Filter Options */}
                        <div className="flex flex-wrap gap-4 items-center">
                          {/* Sort Options */}
                          <div className="flex items-center space-x-2">
                            <SortAsc className="w-4 h-4 text-gray-400" />
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as 'name' | 'price' | 'set')}
                              className="bg-pkmn-surface border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pokemon-gold"
                            >
                              <option value="name">Sort by Name</option>
                              <option value="price">Sort by Price</option>
                              <option value="set">Sort by Set</option>
                            </select>
                          </div>

                          {/* Results Count */}
                          <div className="text-sm text-gray-400">
                            {filteredRecipientCards.length} of {recipientCards.length} cards
                          </div>
                        </div>
                      </div>

                      {/* Cards Grid */}
                      <div className="flex-1 overflow-y-auto">
                        {filteredRecipientCards.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pb-4">
                            {filteredRecipientCards.map((userCard) => {
                              const cardPrice = (userCard.card.cardmarket_avg_sell_price || 0) * 11.5
                              return (
                                <div
                                  key={userCard.id}
                                  onClick={() => addCardToTheirOffer(userCard)}
                                  className="bg-pkmn-card rounded-lg p-3 cursor-pointer hover:bg-pkmn-surface transition-colors border border-gray-700 hover:border-pokemon-gold/50"
                                >
                                  <div className="relative mb-2">
                                    <Image
                                      src={userCard.card.image_small || '/placeholder-card.png'}
                                      alt={userCard.card.name}
                                      width={120}
                                      height={168}
                                      className="w-full aspect-[3/4] object-cover rounded-lg"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = '/placeholder-card.png';
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-white truncate font-medium">{userCard.card.name}</div>
                                    <div className="text-xs text-gray-400 truncate">
                                      {Array.isArray(userCard.card.set) ? userCard.card.set[0]?.name || 'Unknown Set' : userCard.card.set.name}
                                    </div>
                                    {cardPrice > 0 && (
                                      <div className="text-center">
                                        <span className="text-xs font-bold text-white">
                                          {cardPrice.toFixed(0)} NOK
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Filter className="w-12 h-12 text-gray-500 mb-4" />
                            <h4 className="text-lg font-medium text-gray-300 mb-2">No cards found</h4>
                            <p className="text-gray-500 mb-4">
                              {searchQuery ? 'Try adjusting your search terms' : 'Try different filter options'}
                            </p>
                            <button
                              onClick={() => {
                                setSearchQuery('')
                                setSortBy('name')
                              }}
                              className="px-4 py-2 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 text-pokemon-gold rounded-lg transition-colors"
                            >
                              Clear Filters
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>

      {/* Card Details Modal */}
      <CardDetailsModal
        cardId={selectedCardForDetails}
        isOpen={showCardDetailsModal}
        onClose={() => {
          setShowCardDetailsModal(false)
          setSelectedCardForDetails(null)
        }}
      />
    </Transition>
  )
}