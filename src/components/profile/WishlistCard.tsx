'use client'

import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition, Listbox, Menu } from '@headlessui/react'
import { WishlistItemWithCard, WishlistStats } from '@/lib/wishlist-service'
import { wishlistListsService, WishlistList } from '@/lib/wishlist-lists-service'
import { wishlistService } from '@/lib/wishlist-service'
import { cardSocialService, FriendCardOwnership } from '@/lib/card-social-service'
import { wantedBoardService } from '@/lib/wanted-board-service'
import { FriendsWithCardModal } from '@/components/pokemon/FriendsWithCardModal'
import { PokemonCard } from '@/components/pokemon/PokemonCard'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { currencyService } from '@/lib/currency-service'
import { useI18n } from '@/contexts/I18nContext'
import { useToast } from '@/components/ui/ToastContainer'
import Image from 'next/image'
import Link from 'next/link'
import {
  Star,
  Heart,
  TrendingUp,
  Eye,
  ArrowRight,
  Filter,
  Search,
  Users,
  ExternalLink,
  Share2,
  List,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  ChevronsUpDown,
  ChevronDown
} from 'lucide-react'

interface WishlistCardProps {
  wishlistItems: WishlistItemWithCard[]
  stats: WishlistStats | null
  loading: boolean
  onRemoveItem?: (itemId: string) => void
  onEditItem?: (item: WishlistItemWithCard) => void
  onViewDetails?: (cardId: string) => void
  userId?: string
}

export function WishlistCard({
  wishlistItems,
  stats,
  loading,
  onRemoveItem,
  onEditItem,
  onViewDetails,
  userId
}: WishlistCardProps) {
  const preferredCurrency = usePreferredCurrency()
  const { locale } = useI18n()
  const { showSuccess, showError } = useToast()
  const [showAll, setShowAll] = useState(false)
  const [friendsModalOpen, setFriendsModalOpen] = useState(false)
  const [selectedCardForFriends, setSelectedCardForFriends] = useState<WishlistItemWithCard | null>(null)
  const [friendsWithCard, setFriendsWithCard] = useState<FriendCardOwnership[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [postingToWantedBoard, setPostingToWantedBoard] = useState(false)
  const [showWantedBoardModal, setShowWantedBoardModal] = useState(false)
  const [wishlistLists, setWishlistLists] = useState<WishlistList[]>([])
  const [selectedListId, setSelectedListId] = useState<string>('all')
  const [showListsModal, setShowListsModal] = useState(false)
  const [showCreateListForm, setShowCreateListForm] = useState(false)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [updatingList, setUpdatingList] = useState(false)
  const [deletingListId, setDeletingListId] = useState<string | null>(null)
  const [wantedBoardItems, setWantedBoardItems] = useState<Array<{
    id: string
    card_id: string
    card: any
    max_price_eur: number | null
    condition_preference: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
    notes: string | null
    selected: boolean
  }>>([])
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const [confirmRemoval, setConfirmRemoval] = useState<{
    isOpen: boolean
    itemId: string | null
    cardName: string
  }>({
    isOpen: false,
    itemId: null,
    cardName: ''
  })

  // Load wishlist lists when component mounts
  useEffect(() => {
    if (userId) {
      loadWishlistLists()
    }
  }, [userId])

  const loadWishlistLists = async () => {
    if (!userId) return

    try {
      const result = await wishlistListsService.getUserWishlistLists(userId, true)
      if (result.success && result.data) {
        setWishlistLists(result.data)
      }
    } catch (error) {
      console.error('Error loading wishlist lists:', error)
    }
  }

  const handleCreateNewList = async () => {
    if (!userId || !newListName.trim()) {
      showError('Name required', 'Please enter a name for your new wishlist')
      return
    }

    setCreatingList(true)
    try {
      const result = await wishlistListsService.createWishlistList(userId, {
        name: newListName.trim(),
        description: newListDescription.trim() || undefined
      })

      if (result.success) {
        showSuccess('List created!', `"${newListName}" has been created successfully`)
        setNewListName('')
        setNewListDescription('')
        setShowCreateListForm(false)
        await loadWishlistLists() // Refresh the lists
      } else {
        showError('Failed to create list', result.error || 'Please try again later')
      }
    } catch (error) {
      console.error('Error creating wishlist list:', error)
      showError('An error occurred', 'Please try again later')
    } finally {
      setCreatingList(false)
    }
  }

  const handleEditList = (list: WishlistList) => {
    setEditingListId(list.id)
    setNewListName(list.name)
    setNewListDescription(list.description || '')
  }

  const handleUpdateList = async () => {
    if (!userId || !editingListId || !newListName.trim()) {
      showError('Name required', 'Please enter a name for your wishlist')
      return
    }

    setUpdatingList(true)
    try {
      const result = await wishlistListsService.updateWishlistList(userId, editingListId, {
        name: newListName.trim(),
        description: newListDescription.trim() || undefined
      })

      if (result.success) {
        showSuccess('List updated!', `Wishlist has been updated successfully`)
        setNewListName('')
        setNewListDescription('')
        setEditingListId(null)
        await loadWishlistLists() // Refresh the lists
      } else {
        showError('Failed to update list', result.error || 'Please try again later')
      }
    } catch (error) {
      console.error('Error updating wishlist list:', error)
      showError('An error occurred', 'Please try again later')
    } finally {
      setUpdatingList(false)
    }
  }

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!userId) return

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${listName}"? This will remove all cards in this list.`)) {
      return
    }

    setDeletingListId(listId)
    try {
      const result = await wishlistListsService.deleteWishlistList(userId, listId)

      if (result.success) {
        showSuccess('List deleted!', `"${listName}" has been deleted successfully`)
        await loadWishlistLists() // Refresh the lists
        // Reset selected list if it was deleted
        if (selectedListId === listId) {
          setSelectedListId('all')
        }
      } else {
        showError('Failed to delete list', result.error || 'Please try again later')
      }
    } catch (error) {
      console.error('Error deleting wishlist list:', error)
      showError('An error occurred', 'Please try again later')
    } finally {
      setDeletingListId(null)
    }
  }

  const cancelEdit = () => {
    setEditingListId(null)
    setNewListName('')
    setNewListDescription('')
  }

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return 'N/A'
    return currencyService.formatCurrency(price, preferredCurrency, locale)
  }

  const handleCheckFriends = async (item: WishlistItemWithCard, userId: string) => {
    setFriendsLoading(true)
    setSelectedCardForFriends(item)
    
    try {
      const result = await cardSocialService.getFriendsWithCard(userId, item.card_id)
      if (result.success && result.data) {
        setFriendsWithCard(result.data)
        setFriendsModalOpen(true)
      } else {
        showError('Failed to check friends', result.error || 'Please try again later')
      }
    } catch (error) {
      console.error('Error checking friends:', error)
      showError('An error occurred', 'Failed to check friends. Please try again.')
    } finally {
      setFriendsLoading(false)
    }
  }

  const handleCheckAllFriends = async () => {
    if (!userId || wishlistItems.length === 0) return

    setFriendsLoading(true)
    
    try {
      // Check all cards in wishlist and collect friends who have any of them
      const allFriendsWithCards: (FriendCardOwnership & { cardData?: any })[] = []
      const cardNames: string[] = []

      for (const item of wishlistItems) {
        const result = await cardSocialService.getFriendsWithCard(userId, item.card_id)
        if (result.success && result.data && result.data.length > 0) {
          // Add friends who have this card, including the card data
          const friendsWithCardData = result.data.map(friend => ({
            ...friend,
            cardData: {
              id: item.card_id,
              name: item.card.name,
              image_small: item.card.image_small,
              price: item.card.cardmarket_avg_sell_price || 0,
              set_name: item.card.sets?.name || ''
            }
          }))
          allFriendsWithCards.push(...friendsWithCardData)
          cardNames.push(item.card.name)
        }
      }

      if (allFriendsWithCards.length > 0) {
        // Remove duplicates by friend_id and combine their cards
        const uniqueFriends = allFriendsWithCards.reduce((acc, friend) => {
          const existing = acc.find(f => f.friend_id === friend.friend_id)
          if (existing) {
            existing.total_quantity += friend.total_quantity
            // Combine variants
            existing.variants.normal += friend.variants.normal
            existing.variants.holo += friend.variants.holo
            existing.variants.reverse_holo += friend.variants.reverse_holo
            existing.variants.pokeball_pattern += friend.variants.pokeball_pattern
            existing.variants.masterball_pattern += friend.variants.masterball_pattern
            // Keep the first card data found (we could enhance this to show multiple cards)
            if (!existing.cardData && friend.cardData) {
              existing.cardData = friend.cardData
            }
          } else {
            acc.push({ ...friend })
          }
          return acc
        }, [] as (FriendCardOwnership & { cardData?: any })[])

        // Filter out friends with 0 total cards
        const friendsWithCards = uniqueFriends.filter(friend => friend.total_quantity > 0)

        setFriendsWithCard(friendsWithCards)
        setSelectedCardForFriends({
          id: 'multiple',
          card_id: 'multiple',
          card: {
            id: 'multiple',
            name: `Multiple Wishlist Cards`,
            image_small: wishlistItems[0]?.card.image_small || '',
            sets: { name: 'Various Sets' }
          }
        } as any)
        setFriendsModalOpen(true)
      } else {
        showError('No matches found', 'None of your friends have any cards from your wishlist.')
      }
    } catch (error) {
      console.error('Error checking friends for wishlist:', error)
      showError('An error occurred', 'Failed to check friends. Please try again.')
    } finally {
      setFriendsLoading(false)
    }
  }

  const handleBuyFromCardmarket = (item: WishlistItemWithCard) => {
    const searchQuery = encodeURIComponent(`${item.card.name} ${item.card.sets.name}`)
    const cardmarketUrl = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${searchQuery}`
    window.open(cardmarketUrl, '_blank')
  }


  const handleShareCard = async (item: WishlistItemWithCard) => {
    try {
      const result = await cardSocialService.shareCard(item.card_id, 'link')
      if (result.success && result.shareData) {
        if (navigator.share) {
          await navigator.share({
            title: result.shareData.title,
            text: result.shareData.description,
            url: result.shareData.url
          })
        } else {
          await navigator.clipboard.writeText(result.shareData.url)
          showSuccess('Link copied!', 'Card link copied to clipboard')
        }
      } else {
        showError('Failed to share card', result.error || 'Please try again later')
      }
    } catch (error) {
      console.error('Error sharing card:', error)
      showError('An error occurred', 'Failed to share card. Please try again.')
    }
  }

  const handlePostToWantedBoard = () => {
    if (!userId || wishlistItems.length === 0) return

    // Prepare items for the modal
    const items = wishlistItems.map(item => ({
      id: item.id,
      card_id: item.card_id,
      card: item.card,
      max_price_eur: item.max_price_eur,
      condition_preference: item.condition_preference,
      notes: item.notes,
      selected: true // All items selected by default
    }))

    setWantedBoardItems(items)
    setShowWantedBoardModal(true)
  }

  const handleConfirmPostToWantedBoard = async () => {
    if (!userId) return

    const selectedItems = wantedBoardItems.filter(item => item.selected)
    if (selectedItems.length === 0) {
      showError('No items selected', 'Please select at least one item to post.')
      return
    }

    setPostingToWantedBoard(true)
    try {
      // Convert selected items to wanted board format
      const itemsToPost = selectedItems.map(item => ({
        card_id: item.card_id,
        max_price_eur: item.max_price_eur,
        condition_preference: item.condition_preference,
        notes: item.notes
      }))

      const result = await wantedBoardService.addCardsToWantedBoard(userId, itemsToPost)
      
      if (result.success) {
        const itemText = selectedItems.length === 1 ? 'item' : 'items'
        showSuccess(
          'Posted to Wanted Board!',
          `Successfully posted ${selectedItems.length} ${itemText} to the wanted board`
        )
        setShowWantedBoardModal(false)
      } else {
        showError('Failed to post to wanted board', result.error || 'Please try again later')
      }
    } catch (error) {
      console.error('Error posting to wanted board:', error)
      showError('An error occurred', 'Failed to post to wanted board. Please try again.')
    } finally {
      setPostingToWantedBoard(false)
    }
  }

  const updateWantedBoardItem = (id: string, updates: Partial<typeof wantedBoardItems[0]>) => {
    setWantedBoardItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))
  }

  const toggleSelectAll = () => {
    const allSelected = wantedBoardItems.every(item => item.selected)
    setWantedBoardItems(prev => prev.map(item => ({ ...item, selected: !allSelected })))
  }

  const handleRemoveItem = (itemId: string, cardName: string) => {
    if (!userId) return

    // Show confirmation modal
    setConfirmRemoval({
      isOpen: true,
      itemId,
      cardName
    })
  }

  const confirmRemoveItem = async () => {
    if (!userId || !confirmRemoval.itemId) return

    setRemovingItemId(confirmRemoval.itemId)
    try {
      const result = await wishlistService.removeFromWishlist(userId, confirmRemoval.itemId)
      
      if (result.success) {
        showSuccess('Removed from wishlist!', `${confirmRemoval.cardName} has been removed from your wishlist`)
        // Call the onRemoveItem callback if provided
        if (onRemoveItem) {
          onRemoveItem(confirmRemoval.itemId)
        }
      } else {
        showError('Failed to remove item', result.error || 'Please try again later')
      }
    } catch (error) {
      console.error('Error removing wishlist item:', error)
      showError('An error occurred', 'Failed to remove item. Please try again.')
    } finally {
      setRemovingItemId(null)
      setConfirmRemoval({ isOpen: false, itemId: null, cardName: '' })
    }
  }

  const cancelRemoveItem = () => {
    setConfirmRemoval({ isOpen: false, itemId: null, cardName: '' })
  }

  // Filter items by selected list
  const filteredItems = selectedListId === 'all'
    ? wishlistItems
    : wishlistItems.filter(item => {
        // Filter by wishlist_list_id if it exists
        return item.wishlist_list_id === selectedListId
      })
  
  const displayItems = showAll ? filteredItems : filteredItems.slice(0, 6)

  if (loading) {
    return (
      <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-pkmn-card rounded-xl border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-pink-500/20 rounded-lg">
              <Heart className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">My Wishlists</h3>
              <p className="text-gray-400 text-sm">Cards you want to acquire across {wishlistLists.length} list{wishlistLists.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* List Filter */}
        {wishlistLists.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Filter by list:</label>
            <Listbox value={selectedListId} onChange={setSelectedListId}>
              <div className="relative w-full md:w-auto">
                <Listbox.Button className="relative w-full cursor-default rounded-lg bg-pkmn-surface border border-gray-600 py-2 pl-3 pr-10 text-left text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-pokemon-gold">
                  <span className="block truncate">
                    {selectedListId === 'all'
                      ? `All Lists (${stats?.totalItems || 0} items)`
                      : `${wishlistLists.find(l => l.id === selectedListId)?.name || 'Unknown'} (${wishlistLists.find(l => l.id === selectedListId)?.item_count || 0} items)`
                    }
                  </span>
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
                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-pkmn-surface border border-gray-600 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    <Listbox.Option
                      value="all"
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-pokemon-gold/20 text-pokemon-gold' : 'text-white'
                        }`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                            All Lists ({stats?.totalItems || 0} items)
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-pokemon-gold">
                              <Check className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                    {wishlistLists.map((list) => (
                      <Listbox.Option
                        key={list.id}
                        value={list.id}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${
                            active ? 'bg-pokemon-gold/20 text-pokemon-gold' : 'text-white'
                          }`
                        }
                      >
                        {({ selected }) => (
                          <>
                            <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                              {list.name} ({list.item_count || 0} items)
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
        )}

        {/* Stats and Action Buttons */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-pkmn-surface rounded-lg p-3">
              <div className="text-2xl font-bold text-white">{stats.totalItems}</div>
              <div className="text-xs text-gray-400">Total Items</div>
            </div>
            {/* Manage Lists - Enhanced Button */}
            <Transition
              as="div"
              appear={true}
              show={true}
              enter="transition-all duration-300 ease-out"
              enterFrom="opacity-0 scale-95 translate-y-2"
              enterTo="opacity-100 scale-100 translate-y-0"
              className="bg-gradient-to-br from-blue-500/10 to-blue-600/20 rounded-xl p-1 border border-blue-500/30 shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
            >
              <button
                onClick={() => setShowListsModal(true)}
                className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg p-4 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl group"
              >
                <div className="relative">
                  <List className="w-8 h-8 mb-2 group-hover:rotate-12 transition-transform duration-300" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                <div className="text-sm font-semibold tracking-wide">Manage Lists</div>
                <div className="text-xs opacity-80 mt-1">Organize wishlists</div>
              </button>
            </Transition>
            {/* Check for Trading Matches - Enhanced Button */}
            <Transition
              as="div"
              appear={true}
              show={true}
              enter="transition-all duration-300 ease-out delay-100"
              enterFrom="opacity-0 scale-95 translate-y-2"
              enterTo="opacity-100 scale-100 translate-y-0"
              className="bg-gradient-to-br from-purple-500/10 to-purple-600/20 rounded-xl p-1 border border-purple-500/30 shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
            >
              <button
                onClick={handleCheckAllFriends}
                disabled={friendsLoading || !userId || wishlistItems.length === 0}
                className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-purple-400 disabled:to-purple-500 disabled:cursor-not-allowed text-white rounded-lg p-4 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl group disabled:opacity-60"
              >
                <div className="relative">
                  <Users className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform duration-300" />
                  {friendsLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <div className="text-sm font-semibold tracking-wide">
                  {friendsLoading ? 'Checking...' : 'Trading Matches'}
                </div>
                <div className="text-xs opacity-80 mt-1">Find friends with cards</div>
              </button>
            </Transition>

            {/* Post on Wanted Board - Enhanced Button */}
            <Transition
              as="div"
              appear={true}
              show={true}
              enter="transition-all duration-300 ease-out delay-200"
              enterFrom="opacity-0 scale-95 translate-y-2"
              enterTo="opacity-100 scale-100 translate-y-0"
              className="bg-gradient-to-br from-orange-500/10 to-orange-600/20 rounded-xl p-1 border border-orange-500/30 shadow-lg hover:shadow-orange-500/25 transition-all duration-300"
            >
              <button
                onClick={handlePostToWantedBoard}
                disabled={!userId || wishlistItems.length === 0}
                className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-orange-400 disabled:to-orange-500 disabled:cursor-not-allowed text-white rounded-lg p-4 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl group disabled:opacity-60"
              >
                <div className="relative">
                  <Star className="w-8 h-8 mb-2 group-hover:rotate-12 transition-transform duration-300" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                <div className="text-sm font-semibold tracking-wide">Wanted Board</div>
                <div className="text-xs opacity-80 mt-1">Post your wants</div>
              </button>
            </Transition>
          </div>
        )}

      </div>

      {/* Content */}
      <div className="p-6">
        {wishlistItems.length === 0 ? (
          <div className="text-center py-8">
            <Heart className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No Wishlist Items</h3>
            <p className="text-gray-500 mb-4">Start adding cards you want to acquire</p>
            <Link href="/cards" className="btn-gaming">
              Browse Cards
            </Link>
          </div>
        ) : (
          <>
            {/* Wishlist Items Grid */}
            <div className="cards-grid mb-6">
              {displayItems.map((item, index) => {
                // Transform wishlist item to match PokemonCard expected format
                const transformedCard = {
                  id: item.card.id,
                  name: item.card.name,
                  number: item.card.number || '',
                  rarity: item.card.rarity || 'Common',
                  types: [],
                  images: {
                    small: item.card.image_small,
                    large: item.card.image_large || item.card.image_small
                  },
                  cardmarket: {
                    prices: {
                      averageSellPrice: item.card.cardmarket_avg_sell_price || 0,
                      lowPrice: item.card.cardmarket_low_price || 0,
                      trendPrice: item.card.cardmarket_trend_price || 0
                    }
                  },
                  set: {
                    id: item.card.set_id,
                    name: item.card.sets.name,
                    releaseDate: ''
                  }
                }

                return (
                  <div key={item.id} className="relative">
                    <PokemonCard
                      card={transformedCard}
                      collectionData={undefined}
                      onToggleCollection={() => {}}
                      onAddVariant={() => {}}
                      onRemoveVariant={() => {}}
                      onViewDetails={onViewDetails}
                      showVariants={false}
                      index={index}
                    />
                    
                    {/* Remove Button - Top Right Corner */}
                    <button
                      onClick={() => handleRemoveItem(item.id, item.card.name)}
                      disabled={removingItemId === item.id}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white rounded-full shadow-lg transition-colors z-10 group"
                      title="Remove from wishlist"
                    >
                      {removingItemId === item.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                    
                    {/* Individual Card Action Buttons */}
                    <div className="mt-2 space-y-2">
                      <button
                        onClick={() => handleBuyFromCardmarket(item)}
                        className="w-full flex items-center justify-center space-x-2 bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Buy on Cardmarket</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Show More/Less Button */}
            {filteredItems.length > 6 && (
              <div className="text-center">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="btn-outline flex items-center mx-auto"
                >
                  {showAll ? 'Show Less' : `Show All ${filteredItems.length} Items`}
                  <ArrowRight className={`w-4 h-4 ml-2 transition-transform ${showAll ? 'rotate-90' : ''}`} />
                </button>
              </div>
            )}

            {/* Recent Additions */}
            {stats?.recentAdditions && stats.recentAdditions.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-700/50">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-pokemon-gold" />
                  Recent Additions
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {stats.recentAdditions.slice(0, 5).map((item) => {
                    // Handle different data structures for recent additions
                    const cardData = item.card || (item as any).cards
                    const imageSrc = cardData?.image_small || '/placeholder-card.png'
                    const cardName = cardData?.name || 'Unknown Card'
                    
                    return (
                      <div key={item.id} className="bg-pkmn-surface rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-10 h-14 relative flex-shrink-0">
                            <Image
                              src={imageSrc}
                              alt={cardName}
                              fill
                              className="rounded object-cover"
                              sizes="40px"
                              onError={(e) => {
                                console.log('Recent additions image failed to load:', imageSrc, 'for card:', cardName)
                                console.log('Full item data:', item)
                                console.log('Card data:', cardData)
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {cardName}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(item.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Friends With Card Modal */}
      {selectedCardForFriends && (
        <FriendsWithCardModal
          isOpen={friendsModalOpen}
          onClose={() => {
            setFriendsModalOpen(false)
            setSelectedCardForFriends(null)
            setFriendsWithCard([])
          }}
          friends={friendsWithCard}
          cardName={selectedCardForFriends.card.name}
          cardImage={selectedCardForFriends.card.image_small}
          cardId={selectedCardForFriends.card_id !== 'multiple' ? selectedCardForFriends.card_id : undefined}
          cardPrice={selectedCardForFriends.card.cardmarket_avg_sell_price}
          cardSetName={selectedCardForFriends.card.sets?.name}
        />
      )}

      {/* Wanted Board Modal */}
      {showWantedBoardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-pkmn-card rounded-xl border border-gray-700/50 w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <Star className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Post to Wanted Board</h3>
                    <p className="text-gray-400 text-sm">Customize budget and preferences for each card</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWantedBoardModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {/* Select All Toggle */}
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={toggleSelectAll}
                  className="btn-outline btn-sm"
                >
                  {wantedBoardItems.every(item => item.selected) ? 'Deselect All' : 'Select All'}
                </button>
                <div className="text-sm text-gray-400">
                  {wantedBoardItems.filter(item => item.selected).length} of {wantedBoardItems.length} selected
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {wantedBoardItems.map((item) => (
                  <div key={item.id} className={`border rounded-lg p-4 transition-colors ${
                    item.selected ? 'border-orange-500/50 bg-orange-500/5' : 'border-gray-700/50 bg-pkmn-surface'
                  }`}>
                    <div className="flex items-start space-x-4">
                      {/* Selection Checkbox */}
                      <div className="flex items-center pt-2">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => updateWantedBoardItem(item.id, { selected: e.target.checked })}
                          className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-500 focus:ring-2"
                        />
                      </div>

                      {/* Card Image */}
                      <div className="w-16 h-24 relative flex-shrink-0">
                        <Image
                          src={item.card.image_small || '/placeholder-card.png'}
                          alt={item.card.name}
                          fill
                          className="rounded object-cover"
                          sizes="64px"
                        />
                      </div>

                      {/* Card Details and Controls */}
                      <div className="flex-1 space-y-3">
                        <div>
                          <h4 className="font-semibold text-white">{item.card.name}</h4>
                          <p className="text-sm text-gray-400">{item.card.sets?.name}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Max Budget */}
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Max Budget ({currencyService.getCurrencySymbol(preferredCurrency)})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.max_price_eur || ''}
                              onChange={(e) => updateWantedBoardItem(item.id, {
                                max_price_eur: e.target.value ? parseFloat(e.target.value) : null
                              })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="No limit"
                              disabled={!item.selected}
                            />
                          </div>

                          {/* Condition Preference */}
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Condition
                            </label>
                            <select
                              value={item.condition_preference}
                              onChange={(e) => updateWantedBoardItem(item.id, {
                                condition_preference: e.target.value as any
                              })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              disabled={!item.selected}
                            >
                              <option value="any">Any Condition</option>
                              <option value="mint">Mint</option>
                              <option value="near_mint">Near Mint</option>
                              <option value="lightly_played">Lightly Played</option>
                              <option value="moderately_played">Moderately Played</option>
                            </select>
                          </div>

                          {/* Notes */}
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Notes
                            </label>
                            <input
                              type="text"
                              value={item.notes || ''}
                              onChange={(e) => updateWantedBoardItem(item.id, { notes: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="Optional notes..."
                              disabled={!item.selected}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-700/50 flex items-center justify-between">
              <button
                onClick={() => setShowWantedBoardModal(false)}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPostToWantedBoard}
                disabled={postingToWantedBoard || wantedBoardItems.filter(item => item.selected).length === 0}
                className="btn-gaming flex items-center space-x-2"
              >
                {postingToWantedBoard ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Posting...</span>
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4" />
                    <span>Post to Wanted Board ({wantedBoardItems.filter(item => item.selected).length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lists Management Modal */}
      {showListsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-pkmn-card rounded-xl border border-gray-700/50 w-full max-w-md">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <List className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Manage Wishlist Lists</h3>
                    <p className="text-gray-400 text-sm">View and organize your wishlist collections</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowListsModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* Create New List Form */}
              {showCreateListForm ? (
                <div className="mb-6 p-4 bg-pkmn-surface rounded-lg border border-blue-500/30">
                  <h4 className="text-lg font-semibold text-white mb-3">Create New Wishlist</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter list name..."
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={newListDescription}
                        onChange={(e) => setNewListDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Optional description..."
                        maxLength={200}
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <button
                        onClick={handleCreateNewList}
                        disabled={creatingList || !newListName.trim()}
                        className="btn-gaming flex items-center space-x-2"
                      >
                        {creatingList ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Creating...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Create List</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateListForm(false)
                          setNewListName('')
                          setNewListDescription('')
                        }}
                        className="btn-outline"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <button
                    onClick={() => setShowCreateListForm(true)}
                    className="w-full flex items-center justify-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Create New Wishlist</span>
                  </button>
                </div>
              )}

              {/* Existing Lists */}
              <div className="space-y-3">
                {wishlistLists.map((list) => (
                  <div key={list.id} className="p-3 bg-pkmn-surface rounded-lg">
                    {editingListId === list.id ? (
                      // Edit Form
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter list name..."
                            maxLength={50}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={newListDescription}
                            onChange={(e) => setNewListDescription(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Optional description..."
                            maxLength={200}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={handleUpdateList}
                            disabled={updatingList || !newListName.trim()}
                            className="btn-gaming btn-sm flex items-center space-x-1"
                          >
                            {updatingList ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Save</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="btn-outline btn-sm"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Display Mode
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${list.is_default ? 'bg-pokemon-gold' : 'bg-blue-500'}`}></div>
                          <div>
                            <div className="font-medium text-white">{list.name}</div>
                            {list.description && (
                              <div className="text-xs text-gray-400">{list.description}</div>
                            )}
                            <div className="text-xs text-gray-500">
                              {list.item_count || 0} items
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center space-x-1">
                          {/* Edit button - available for all lists */}
                          <button
                            onClick={() => handleEditList(list)}
                            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                            title="Edit list"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          {/* Delete button - only for non-default lists */}
                          {!list.is_default && (
                            <button
                              onClick={() => handleDeleteList(list.id, list.name)}
                              disabled={deletingListId === list.id}
                              className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-gray-500/10 rounded transition-colors disabled:opacity-50"
                              title="Delete list"
                            >
                              {deletingListId === list.id ? (
                                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          
                          {/* Default badge */}
                          {list.is_default && (
                            <div className="text-xs text-gray-300 font-medium px-2 py-1 bg-gray-500/20 rounded">
                              Default
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {wishlistLists.length === 0 && !showCreateListForm && (
                <div className="text-center py-8">
                  <List className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                  <h3 className="text-lg font-semibold text-gray-400 mb-2">No Wishlist Lists</h3>
                  <p className="text-gray-500">Create your first wishlist to get started.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-700/50">
              <button
                onClick={() => {
                  setShowListsModal(false)
                  setShowCreateListForm(false)
                  setEditingListId(null)
                  setNewListName('')
                  setNewListDescription('')
                }}
                className="w-full btn-outline text-white hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Item Removal */}
      <ConfirmationModal
        isOpen={confirmRemoval.isOpen}
        onClose={cancelRemoveItem}
        onConfirm={confirmRemoveItem}
        title="Remove from Wishlist"
        message={`Are you sure you want to remove "${confirmRemoval.cardName}" from your wishlist?`}
        confirmText="Remove"
        cancelText="Cancel"
        type="danger"
        isLoading={removingItemId === confirmRemoval.itemId}
      />
    </div>
  )
}