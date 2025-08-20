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
import TradeModal from '@/components/trading/TradeModal'
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
  ShoppingCart
} from 'lucide-react'

interface WishlistMatch {
  card_id: string
  card_name: string
  card_image_small: string
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

interface FilterOption {
  id: string
  name: string
}

function MatchesContent() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data states
  const [summary, setSummary] = useState<MatchesSummary | null>(null)
  const [iWantMatches, setIWantMatches] = useState<WishlistMatch[]>([])
  const [theyWantMatches, setTheyWantMatches] = useState<WishlistMatch[]>([])

  // Filter states
  const [selectedFriend, setSelectedFriend] = useState<FilterOption>({ id: 'all', name: 'All Friends' })
  const [selectedSort, setSelectedSort] = useState<FilterOption>({ id: 'name', name: 'Card Name' })

  // Trade modal states
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [tradeRecipient, setTradeRecipient] = useState<{
    id: string
    name: string
    avatar?: string
  } | null>(null)
  const [initialTradeCard, setInitialTradeCard] = useState<{
    id: string
    name: string
    image_small: string
    price?: number
    set_name: string
  } | null>(null)

  const sortOptions: FilterOption[] = [
    { id: 'name', name: 'Card Name' },
    { id: 'rarity', name: 'Rarity' },
    { id: 'price', name: 'Price (High to Low)' }
  ]

  useEffect(() => {
    if (user) {
      loadWishlistMatches()
    }
  }, [user])

  const loadWishlistMatches = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      console.log('Loading wishlist matches for user:', user.id)

      // Get cards I want that my friends have
      console.log('Calling get_cards_i_want_friends_have...')
      const { data: iWantData, error: iWantError } = await (supabase as any)
        .rpc('get_cards_i_want_friends_have', { user_id_param: user.id })

      if (iWantError) {
        console.error('Error in get_cards_i_want_friends_have:', iWantError)
        throw new Error(`I Want function error: ${iWantError.message}`)
      }
      console.log('I Want data:', iWantData)

      // Get cards my friends want that I have
      console.log('Calling get_cards_friends_want_i_have...')
      const { data: theyWantData, error: theyWantError } = await (supabase as any)
        .rpc('get_cards_friends_want_i_have', { user_id_param: user.id })

      if (theyWantError) {
        console.error('Error in get_cards_friends_want_i_have:', theyWantError)
        throw new Error(`They Want function error: ${theyWantError.message}`)
      }
      console.log('They Want data:', theyWantData)

      // Get summary data
      console.log('Calling get_wishlist_matching_summary...')
      const { data: summaryData, error: summaryError } = await (supabase as any)
        .rpc('get_wishlist_matching_summary', { user_id_param: user.id })

      if (summaryError) {
        console.error('Error in get_wishlist_matching_summary:', summaryError)
        throw new Error(`Summary function error: ${summaryError.message}`)
      }
      console.log('Summary data:', summaryData)

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

      console.log('Wishlist matches loaded successfully')

    } catch (err) {
      console.error('Error loading wishlist matches:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load wishlist matches'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
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

  const handleTradeClick = (friendId: string, friendName: string, friendAvatar?: string, card?: WishlistMatch) => {
    setTradeRecipient({
      id: friendId,
      name: friendName,
      avatar: friendAvatar
    })
    
    if (card) {
      setInitialTradeCard({
        id: card.card_id,
        name: card.card_name,
        image_small: card.card_image_small,
        price: card.card_price,
        set_name: card.set_name
      })
    } else {
      setInitialTradeCard(null)
    }
    
    setTradeModalOpen(true)
  }

  const closeTradeModal = () => {
    setTradeModalOpen(false)
    setTradeRecipient(null)
    setInitialTradeCard(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-pokemon-gold border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading wishlist matches...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
          <Heart className="w-8 h-8 mr-3 text-pokemon-gold" />
          Wishlist Matches
        </h1>
        <p className="text-gray-400 text-lg">
          Find cards you want that your friends have, and cards they want that you have
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-900/50 border border-red-700 rounded-xl p-4">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-300">Error</h3>
              <div className="mt-1 text-sm text-red-400">{error}</div>
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
                  ? 'bg-pokemon-gold text-black shadow'
                  : 'text-gray-400 hover:bg-pkmn-card hover:text-white'
              }`
            }
          >
            <div className="flex items-center justify-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Overview</span>
              {summary?.total_matches && summary.total_matches > 0 && (
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
                  ? 'bg-pokemon-gold text-black shadow'
                  : 'text-gray-400 hover:bg-pkmn-card hover:text-white'
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
              `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200 ${
                selected
                  ? 'bg-pokemon-gold text-black shadow'
                  : 'text-gray-400 hover:bg-pkmn-card hover:text-white'
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
                        {summary.friends.slice(0, 5).map((friendData) => (
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
                                  <div className="text-sm text-pokemon-gold font-medium">
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
                                    onClick={() => handleTradeClick(
                                      friendData.friend_id,
                                      friendData.friend_display_name || friendData.friend_username,
                                      friendData.friend_avatar_url
                                    )}
                                    className="px-3 py-1.5 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 rounded-lg transition-colors flex items-center space-x-1.5"
                                    title="Propose Trade"
                                  >
                                    <ShoppingCart className="w-4 h-4 text-pokemon-gold" />
                                    <span className="text-xs font-medium text-pokemon-gold">Trade</span>
                                  </button>
                                  <button
                                    className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors flex items-center space-x-1.5"
                                    title="Message"
                                  >
                                    <MessageCircle className="w-4 h-4 text-blue-400" />
                                    <span className="text-xs font-medium text-blue-400">Message</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
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
                      Sort By
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

              {/* Cards Grid - More Compact */}
              {filteredIWantMatches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {filteredIWantMatches.map((match, index) => (
                    <div key={`${match.card_id}-${match.friend_id}-${index}`} className="group bg-pkmn-card rounded-lg overflow-hidden border border-gray-700/50 hover:border-green-500/50 transition-all duration-200 hover:scale-105">
                      <div className="aspect-w-3 aspect-h-4">
                        <Image
                          src={match.card_image_small}
                          alt={match.card_name}
                          width={180}
                          height={250}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <Link href={`/cards/${match.card_id}`} className="block">
                          <h3 className="text-xs font-medium text-white truncate group-hover:text-pokemon-gold transition-colors">
                            {match.card_name}
                          </h3>
                        </Link>
                        <p className="text-xs text-gray-400 truncate">{match.set_name}</p>
                        
                        <div className="mt-2 flex items-center justify-between">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                            Want
                          </span>
                          {match.card_price && (
                            <PriceDisplay
                              amount={match.card_price}
                              currency="EUR"
                              className="text-xs font-medium text-green-400"
                              showOriginal={false}
                            />
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center min-w-0 flex-1">
                            <div className="flex-shrink-0">
                              {match.friend_avatar_url ? (
                                <Image
                                  src={match.friend_avatar_url}
                                  alt={match.friend_display_name || match.friend_username}
                                  width={20}
                                  height={20}
                                  className="w-5 h-5 rounded-full border border-gray-600"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-pokemon-gold/20 flex items-center justify-center border border-gray-600">
                                  <span className="text-xs font-medium text-pokemon-gold">
                                    {(match.friend_display_name || match.friend_username).charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="ml-1 min-w-0 flex-1">
                              <p className="text-xs text-gray-400 truncate">
                                {match.friend_display_name || match.friend_username}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-1 ml-2">
                            <button
                              onClick={() => handleTradeClick(
                                match.friend_id,
                                match.friend_display_name || match.friend_username,
                                match.friend_avatar_url,
                                match
                              )}
                              className="p-1 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 rounded transition-colors"
                              title="Propose Trade"
                            >
                              <ShoppingCart className="w-3 h-3 text-pokemon-gold" />
                            </button>
                            <button
                              className="p-1 bg-blue-500/20 hover:bg-blue-500/30 rounded transition-colors"
                              title="Message"
                            >
                              <MessageCircle className="w-3 h-3 text-blue-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 opacity-50">🎁</div>
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No matches found</h3>
                  <p className="text-gray-500 mb-4">
                    None of your friends have cards from your wishlist yet.
                  </p>
                  <Link href="/wishlist" className="btn-gaming">
                    Add More Cards to Wishlist
                  </Link>
                </div>
              )}
            </div>
          </Tab.Panel>

          {/* They Want Panel */}
          <Tab.Panel>
            <div className="space-y-6">
              {/* Filters */}
              <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                <div className="flex items-center space-x-4 mb-4">
                  <Filter className="w-5 h-5 text-pokemon-gold" />
                  <h3 className="text-lg font-semibold text-white">Cards Friends Want That I Have</h3>
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
                      Sort By
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

              {/* Cards Grid - More Compact */}
              {filteredTheyWantMatches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {filteredTheyWantMatches.map((match, index) => (
                    <div key={`${match.card_id}-${match.friend_id}-${index}`} className="group bg-pkmn-card rounded-lg overflow-hidden border border-gray-700/50 hover:border-blue-500/50 transition-all duration-200 hover:scale-105">
                      <div className="aspect-w-3 aspect-h-4">
                        <Image
                          src={match.card_image_small}
                          alt={match.card_name}
                          width={180}
                          height={250}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <Link href={`/cards/${match.card_id}`} className="block">
                          <h3 className="text-xs font-medium text-white truncate group-hover:text-pokemon-gold transition-colors">
                            {match.card_name}
                          </h3>
                        </Link>
                        <p className="text-xs text-gray-400 truncate">{match.set_name}</p>
                        
                        <div className="mt-2 flex items-center justify-between">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                            They Want
                          </span>
                          {match.card_price && (
                            <PriceDisplay
                              amount={match.card_price}
                              currency="EUR"
                              className="text-xs font-medium text-blue-400"
                              showOriginal={false}
                            />
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center min-w-0 flex-1">
                            <div className="flex-shrink-0">
                              {match.friend_avatar_url ? (
                                <Image
                                  src={match.friend_avatar_url}
                                  alt={match.friend_display_name || match.friend_username}
                                  width={20}
                                  height={20}
                                  className="w-5 h-5 rounded-full border border-gray-600"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-pokemon-gold/20 flex items-center justify-center border border-gray-600">
                                  <span className="text-xs font-medium text-pokemon-gold">
                                    {(match.friend_display_name || match.friend_username).charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="ml-1 min-w-0 flex-1">
                              <p className="text-xs text-gray-400 truncate">
                                {match.friend_display_name || match.friend_username}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-1 ml-2">
                            <button
                              onClick={() => handleTradeClick(
                                match.friend_id,
                                match.friend_display_name || match.friend_username,
                                match.friend_avatar_url,
                                match
                              )}
                              className="p-1 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 rounded transition-colors"
                              title="Propose Trade"
                            >
                              <ShoppingCart className="w-3 h-3 text-pokemon-gold" />
                            </button>
                            <button
                              className="p-1 bg-blue-500/20 hover:bg-blue-500/30 rounded transition-colors"
                              title="Message"
                            >
                              <MessageCircle className="w-3 h-3 text-blue-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 opacity-50">🎯</div>
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No matches found</h3>
                  <p className="text-gray-500 mb-4">
                    Your friends don't have any cards from your collection on their wishlists yet.
                  </p>
                  <Link href="/collection" className="btn-gaming">
                    View My Collection
                  </Link>
                </div>
              )}
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Trade Modal */}
      {tradeRecipient && (
        <TradeModal
          isOpen={tradeModalOpen}
          onClose={closeTradeModal}
          recipientId={tradeRecipient.id}
          recipientName={tradeRecipient.name}
          recipientAvatar={tradeRecipient.avatar}
          initialCard={initialTradeCard}
        />
      )}
    </div>
  )
}

export default function MatchesPage() {
  return (
    <ProtectedRoute>
      <Navigation>
        <MatchesContent />
      </Navigation>
    </ProtectedRoute>
  )
}