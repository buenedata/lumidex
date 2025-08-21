'use client'

import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition, Listbox } from '@headlessui/react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/ToastContainer'
import { wantedBoardTradeService } from '@/lib/wanted-board-trade-service'
import { WantedBoardPost } from '@/lib/wanted-board-service'
import { PriceDisplay } from '@/components/PriceDisplay'
import Image from 'next/image'
import {
  X,
  Plus,
  Minus,
  ArrowLeftRight,
  Coins,
  Check,
  ChevronsUpDown,
  DollarSign,
  User,
  AlertTriangle,
  Search,
  Filter,
  SortAsc
} from 'lucide-react'

interface WantedBoardTradeModalProps {
  isOpen: boolean
  onClose: () => void
  post: WantedBoardPost
  selectedCards: Array<{
    id: string
    name: string
    image_small: string
    price?: number
    set_name: string
  }>
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
    }
  }
}

const TRADE_METHODS = [
  { id: 'digital_first', name: 'Digital Payment First', icon: DollarSign, description: 'Money sent digitally, then cards shipped' },
  { id: 'simultaneous', name: 'Simultaneous Exchange', icon: ArrowLeftRight, description: 'Both parties send at the same time' },
  { id: 'meetup', name: 'In-Person Meetup', icon: ArrowLeftRight, description: 'Meet in person to exchange' },
  { id: 'escrow', name: 'Trusted Third Party', icon: ArrowLeftRight, description: 'Use a trusted intermediary' }
]

const CONDITIONS = [
  { id: 'mint', name: 'Mint' },
  { id: 'near_mint', name: 'Near Mint' },
  { id: 'lightly_played', name: 'Lightly Played' },
  { id: 'moderately_played', name: 'Moderately Played' },
  { id: 'heavily_played', name: 'Heavily Played' },
  { id: 'damaged', name: 'Damaged' }
]

export default function WantedBoardTradeModal({
  isOpen,
  onClose,
  post,
  selectedCards,
  onTradeCreated
}: WantedBoardTradeModalProps) {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const [loading, setLoading] = useState(false)
  const [recipientCards, setRecipientCards] = useState<UserCard[]>([])
  const [selectedTradeMethod, setSelectedTradeMethod] = useState(TRADE_METHODS[0])
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    avatar_url?: string
    display_name?: string
    username?: string
  } | null>(null)
  
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

  const [showRecipientCardSelector, setShowRecipientCardSelector] = useState(false)
  const [message, setMessage] = useState('')
  
  // Card selector filters
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'set'>('name')

  useEffect(() => {
    if (isOpen && user) {
      // Initialize with selected cards
      const initialCards = selectedCards.map(card => ({
        id: card.id,
        name: card.name,
        image_small: card.image_small,
        price: card.price || 0,
        set_name: card.set_name,
        quantity: 1,
        condition: 'near_mint'
      }))
      
      setMyOffer(prev => ({
        ...prev,
        cards: initialCards
      }))
      
      // Set default message
      setMessage(`I have the ${selectedCards.length > 1 ? 'cards' : 'card'} you want from the wanted board!`)
      
      // Load recipient's cards and current user profile
      loadRecipientCards()
      loadCurrentUserProfile()
    }
  }, [isOpen, user, selectedCards])

  const loadCurrentUserProfile = async () => {
    if (!user) return
    
    setCurrentUserProfile({
      avatar_url: user.user_metadata?.avatar_url,
      display_name: user.user_metadata?.display_name,
      username: user.user_metadata?.username
    })
  }

  const loadRecipientCards = async () => {
    if (!post.user_id) return
    
    setLoading(true)
    try {
      const result = await wantedBoardTradeService.getRecipientCards(post.user_id)
      if (result.success && result.data) {
        setRecipientCards(result.data)
      }
    } catch (error) {
      console.error('Error loading recipient cards:', error)
    } finally {
      setLoading(false)
    }
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
          set_name: userCard.card.set.name,
          quantity: 1,
          condition: userCard.condition
        }]
      }))
    }
    setShowRecipientCardSelector(false)
  }

  const removeCardFromMyOffer = (cardId: string) => {
    setMyOffer(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== cardId)
    }))
  }

  const removeCardFromTheirOffer = (cardId: string) => {
    setTheirOffer(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== cardId)
    }))
  }

  const updateMyCardQuantity = (cardId: string, change: number) => {
    setMyOffer(prev => ({
      ...prev,
      cards: prev.cards.map(c => {
        if (c.id === cardId) {
          const newQuantity = Math.max(1, c.quantity + change)
          return { ...c, quantity: newQuantity }
        }
        return c
      })
    }))
  }

  const updateTheirCardQuantity = (cardId: string, change: number) => {
    setTheirOffer(prev => ({
      ...prev,
      cards: prev.cards.map(c => {
        if (c.id === cardId) {
          const newQuantity = Math.max(1, c.quantity + change)
          // Find the card in recipient's collection to check max quantity
          const recipientCard = recipientCards.find(rc => rc.card.id === cardId)
          const maxQuantity = (recipientCard as any)?.totalQuantity || 1
          return { ...c, quantity: Math.min(newQuantity, maxQuantity) }
        }
        return c
      })
    }))
  }

  const calculateOfferValue = (offer: typeof myOffer) => {
    const cardValue = offer.cards.reduce((sum, card) => {
      return sum + (card.price || 0) * card.quantity
    }, 0)
    return cardValue + offer.money
  }

  const handleSubmitTrade = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const result = await wantedBoardTradeService.createWantedBoardTrade({
        initiatorId: user.id,
        recipientId: post.user_id,
        recipientName: post.user?.display_name || post.user?.username || 'User',
        initiatorCards: myOffer.cards.map(card => ({
          id: card.id,
          name: card.name,
          image_small: card.image_small,
          price: card.price || 0,
          set_name: card.set_name,
          quantity: card.quantity,
          condition: card.condition
        })),
        recipientCards: theirOffer.cards.map(card => ({
          id: card.id,
          name: card.name,
          image_small: card.image_small,
          price: card.price || 0,
          set_name: card.set_name,
          quantity: card.quantity,
          condition: card.condition
        })),
        initiatorMoney: myOffer.money,
        recipientMoney: theirOffer.money,
        message,
        tradeMethod: selectedTradeMethod.id,
        initiatorShippingIncluded: myOffer.shippingIncluded,
        recipientShippingIncluded: theirOffer.shippingIncluded
      })

      if (result.success) {
        onClose()
        showSuccess('Trade Offer Sent!', result.message || 'Your trade offer has been sent successfully!')
        
        if (onTradeCreated) {
          onTradeCreated()
        }
      } else {
        showError('Failed to Send Trade Offer', result.error || 'An error occurred while sending the trade offer.')
      }
    } catch (error: any) {
      console.error('Error creating trade:', error)
      showError('Failed to Send Trade Offer', error?.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const myOfferValue = calculateOfferValue(myOffer)
  const theirOfferValue = calculateOfferValue(theirOffer)

  // Filter and sort recipient cards
  const getFilteredAndSortedRecipientCards = () => {
    let filtered = [...recipientCards]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(card =>
        card.card.name.toLowerCase().includes(query) ||
        card.card.set.name.toLowerCase().includes(query)
      )
    }

    // Sort cards
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.card.name.localeCompare(b.card.name)
        case 'price':
          const priceA = a.card.cardmarket_avg_sell_price || 0
          const priceB = b.card.cardmarket_avg_sell_price || 0
          return priceB - priceA // Highest price first
        case 'set':
          return a.card.set.name.localeCompare(b.card.set.name)
        default:
          return 0
      }
    })

    return filtered
  }

  const filteredRecipientCards = getFilteredAndSortedRecipientCards()

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
                    Trading with {post.user?.display_name || post.user?.username}
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
                                    <div className="relative w-full h-full">
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
                                        <PriceDisplay
                                          amount={card.price * card.quantity}
                                          currency="EUR"
                                          showConversion={true}
                                          showOriginal={false}
                                          size="sm"
                                          className="text-xs font-bold text-white"
                                        />
                                      )}
                                    </div>
                                  </div>
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                    <div className="flex space-x-1">
                                      <button
                                        onClick={() => updateMyCardQuantity(card.id, -1)}
                                        className="p-2 bg-red-500 hover:bg-red-600 rounded text-white"
                                      >
                                        <Minus className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => updateMyCardQuantity(card.id, 1)}
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
                                <div className="w-full h-full flex items-center justify-center text-gray-600">
                                  <Plus className="w-8 h-8" />
                                </div>
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
                            name="myShipping"
                            checked={myOffer.shippingIncluded}
                            onChange={() => setMyOffer(prev => ({ ...prev, shippingIncluded: true }))}
                            className="w-4 h-4 text-pokemon-gold bg-pkmn-surface border-gray-600 focus:ring-pokemon-gold focus:ring-2"
                          />
                          <span className="text-white">Included</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="myShipping"
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
                        {myOfferValue > 0 ? (
                          <PriceDisplay
                            amount={myOfferValue}
                            currency="EUR"
                            showConversion={true}
                            showOriginal={false}
                            size="lg"
                            className="text-pokemon-gold font-bold"
                          />
                        ) : (
                          '0.00'
                        )}
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
                        {post.user?.display_name || post.user?.username}'s Offer
                      </h3>
                      <UserAvatar
                        avatarUrl={post.user?.avatar_url || undefined}
                        displayName={post.user?.display_name || undefined}
                        username={post.user?.username}
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
                              className="aspect-[3/4] bg-pkmn-surface border-2 border-gray-600 rounded-lg flex flex-col relative group"
                            >
                              {card ? (
                                <>
                                  <div className="flex-1 p-2">
                                    <div className="relative w-full h-full">
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
                                        <PriceDisplay
                                          amount={card.price * card.quantity}
                                          currency="EUR"
                                          showConversion={true}
                                          showOriginal={false}
                                          size="sm"
                                          className="text-xs font-bold text-white"
                                        />
                                      )}
                                    </div>
                                  </div>
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
                                </>
                              ) : (
                                <button
                                  onClick={() => setShowRecipientCardSelector(true)}
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

                    {/* Their Money Offer */}
                    <div className="flex items-center space-x-3">
                      <Coins className="w-5 h-5 text-pokemon-gold" />
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
                    </div>

                    {/* Their Offer Value */}
                    <div className="text-center">
                      <div className="text-sm text-gray-400">Total Value</div>
                      <div className="text-lg font-bold text-blue-400">
                        {theirOfferValue > 0 ? (
                          <PriceDisplay
                            amount={theirOfferValue}
                            currency="EUR"
                            showConversion={true}
                            showOriginal={false}
                            size="lg"
                            className="text-blue-400 font-bold"
                          />
                        ) : (
                          '0.00'
                        )}
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

                {/* Recipient Card Selector Modal */}
                {showRecipientCardSelector && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-pkmn-dark rounded-xl p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                      {/* Header */}
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Select Cards from {post.user?.display_name || post.user?.username}'s Collection</h3>
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
                              const cardPrice = userCard.card.cardmarket_avg_sell_price || 0
                              return (
                                <div
                                  key={userCard.id}
                                  onClick={() => addCardToTheirOffer(userCard as UserCard & { totalQuantity: number })}
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
                                    <div className="text-xs text-gray-400 truncate">{userCard.card.set.name}</div>
                                    {cardPrice > 0 && (
                                      <div className="text-center">
                                        <PriceDisplay
                                          amount={cardPrice}
                                          currency="EUR"
                                          showConversion={true}
                                          showOriginal={false}
                                          size="sm"
                                          className="text-xs font-bold text-white"
                                        />
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
    </Transition>
  )
}