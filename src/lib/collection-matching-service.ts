import { supabase } from './supabase'
import { Card } from '@/types'

export interface CollectionMatch {
  id: string
  user_id: string
  friend_id: string
  card_id: string
  match_type: 'friend_has_wanted' | 'user_has_friend_wants'
  created_at: string
  card: Card & {
    sets: {
      name: string
      symbol_url?: string
    }
  }
  friend: {
    id: string
    username: string
    display_name?: string | null
    avatar_url?: string | null
  }
}

export interface MatchingSummary {
  totalMatches: number
  friendHasWanted: number
  userHasFriendWants: number
  topFriends: Array<{
    friend: {
      id: string
      username: string
      display_name?: string | null
      avatar_url?: string | null
    }
    matchCount: number
  }>
  recentMatches: CollectionMatch[]
}

export interface FriendCollectionComparison {
  friend: {
    id: string
    username: string
    display_name?: string | null
    avatar_url?: string | null
  }
  cardsTheyHaveIWant: CollectionMatch[]
  cardsIHaveTheyWant: CollectionMatch[]
  totalMatches: number
}

class CollectionMatchingService {
  /**
   * Find all collection matches for a user
   */
  async findCollectionMatches(
    userId: string,
    options: {
      friendId?: string
      matchType?: 'friend_has_wanted' | 'user_has_friend_wants'
      limit?: number
      page?: number
    } = {}
  ): Promise<{ success: boolean; error?: string; data?: CollectionMatch[]; total?: number }> {
    try {
      const { friendId, matchType, limit = 50, page = 1 } = options

      // Get user's friends first
      const { data: friendships, error: friendshipError } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

      if (friendshipError) {
        return { success: false, error: friendshipError.message }
      }

      if (!friendships || friendships.length === 0) {
        return { success: true, data: [], total: 0 }
      }

      // Get friend IDs
      const friendIds = friendships.map(f => 
        f.requester_id === userId ? f.addressee_id : f.requester_id
      )

      // Filter by specific friend if provided
      const targetFriendIds = friendId ? [friendId] : friendIds

      const matches: CollectionMatch[] = []

      // Find matches for each friend
      for (const targetFriendId of targetFriendIds) {
        if (!matchType || matchType === 'friend_has_wanted') {
          // Cards friend has that user wants (user's wishlist vs friend's collection)
          const friendHasWanted = await this.findFriendHasWantedMatches(userId, targetFriendId)
          if (friendHasWanted.success && friendHasWanted.data) {
            matches.push(...friendHasWanted.data)
          }
        }

        if (!matchType || matchType === 'user_has_friend_wants') {
          // Cards user has that friend wants (friend's wishlist vs user's collection)
          const userHasFriendWants = await this.findUserHasFriendWantsMatches(userId, targetFriendId)
          if (userHasFriendWants.success && userHasFriendWants.data) {
            matches.push(...userHasFriendWants.data)
          }
        }
      }

      // Sort by created_at (most recent first)
      matches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit
      const paginatedMatches = matches.slice(from, to)

      return { success: true, data: paginatedMatches, total: matches.length }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Find cards that a friend has that the user wants
   */
  private async findFriendHasWantedMatches(
    userId: string,
    friendId: string
  ): Promise<{ success: boolean; error?: string; data?: CollectionMatch[] }> {
    try {
      // Get user's wishlist
      const { data: userWishlist, error: wishlistError } = await supabase
        .from('wishlists')
        .select('card_id')
        .eq('user_id', userId)

      if (wishlistError) {
        return { success: false, error: wishlistError.message }
      }

      if (!userWishlist || userWishlist.length === 0) {
        return { success: true, data: [] }
      }

      const wantedCardIds = userWishlist.map(w => w.card_id)

      // Get friend's collection that matches user's wishlist
      const { data: friendCollection, error: collectionError } = await supabase
        .from('user_collections')
        .select(`
          card_id,
          cards!inner(
            id,
            name,
            set_id,
            number,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            sets!inner(name, symbol_url)
          )
        `)
        .eq('user_id', friendId)
        .in('card_id', wantedCardIds)

      if (collectionError) {
        return { success: false, error: collectionError.message }
      }

      if (!friendCollection || friendCollection.length === 0) {
        return { success: true, data: [] }
      }

      // Get friend profile
      const { data: friendProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', friendId)
        .single()

      if (profileError) {
        return { success: false, error: profileError.message }
      }

      // Create matches
      const matches: CollectionMatch[] = friendCollection.map((item: any) => ({
        id: `${userId}-${friendId}-${item.card_id}-friend_has_wanted`,
        user_id: userId,
        friend_id: friendId,
        card_id: item.card_id,
        match_type: 'friend_has_wanted' as const,
        created_at: new Date().toISOString(),
        card: item.cards,
        friend: friendProfile
      }))

      return { success: true, data: matches }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Find cards that the user has that a friend wants
   */
  private async findUserHasFriendWantsMatches(
    userId: string,
    friendId: string
  ): Promise<{ success: boolean; error?: string; data?: CollectionMatch[] }> {
    try {
      // Get friend's wishlist
      const { data: friendWishlist, error: wishlistError } = await supabase
        .from('wishlists')
        .select('card_id')
        .eq('user_id', friendId)

      if (wishlistError) {
        return { success: false, error: wishlistError.message }
      }

      if (!friendWishlist || friendWishlist.length === 0) {
        return { success: true, data: [] }
      }

      const friendWantedCardIds = friendWishlist.map(w => w.card_id)

      // Get user's collection that matches friend's wishlist
      const { data: userCollection, error: collectionError } = await supabase
        .from('user_collections')
        .select(`
          card_id,
          cards!inner(
            id,
            name,
            set_id,
            number,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            sets!inner(name, symbol_url)
          )
        `)
        .eq('user_id', userId)
        .in('card_id', friendWantedCardIds)

      if (collectionError) {
        return { success: false, error: collectionError.message }
      }

      if (!userCollection || userCollection.length === 0) {
        return { success: true, data: [] }
      }

      // Get friend profile
      const { data: friendProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', friendId)
        .single()

      if (profileError) {
        return { success: false, error: profileError.message }
      }

      // Create matches
      const matches: CollectionMatch[] = userCollection.map((item: any) => ({
        id: `${userId}-${friendId}-${item.card_id}-user_has_friend_wants`,
        user_id: userId,
        friend_id: friendId,
        card_id: item.card_id,
        match_type: 'user_has_friend_wants' as const,
        created_at: new Date().toISOString(),
        card: item.cards,
        friend: friendProfile
      }))

      return { success: true, data: matches }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get collection matching summary for a user
   */
  async getMatchingSummary(userId: string): Promise<{ success: boolean; error?: string; data?: MatchingSummary }> {
    try {
      const result = await this.findCollectionMatches(userId, { limit: 1000 })
      
      if (!result.success) {
        return { success: false, error: result.error }
      }

      if (!result.data) {
        return { success: true, data: {
          totalMatches: 0,
          friendHasWanted: 0,
          userHasFriendWants: 0,
          topFriends: [],
          recentMatches: []
        }}
      }

      const matches = result.data
      const totalMatches = matches.length
      const friendHasWanted = matches.filter(m => m.match_type === 'friend_has_wanted').length
      const userHasFriendWants = matches.filter(m => m.match_type === 'user_has_friend_wants').length

      // Calculate top friends by match count
      const friendMatchCounts = new Map<string, { friend: any; count: number }>()
      
      matches.forEach(match => {
        const friendId = match.friend_id
        if (friendMatchCounts.has(friendId)) {
          friendMatchCounts.get(friendId)!.count++
        } else {
          friendMatchCounts.set(friendId, {
            friend: match.friend,
            count: 1
          })
        }
      })

      const topFriends = Array.from(friendMatchCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(item => ({
          friend: item.friend,
          matchCount: item.count
        }))

      // Get recent matches (last 10)
      const recentMatches = matches.slice(0, 10)

      return {
        success: true,
        data: {
          totalMatches,
          friendHasWanted,
          userHasFriendWants,
          topFriends,
          recentMatches
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Compare collections with a specific friend
   */
  async compareFriendCollections(
    userId: string,
    friendId: string
  ): Promise<{ success: boolean; error?: string; data?: FriendCollectionComparison }> {
    try {
      // Get friend profile
      const { data: friendProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', friendId)
        .single()

      if (profileError) {
        return { success: false, error: profileError.message }
      }

      // Get matches for this specific friend
      const result = await this.findCollectionMatches(userId, { 
        friendId, 
        limit: 1000 
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      if (!result.data) {
        return { success: true, data: {
          friend: friendProfile,
          cardsTheyHaveIWant: [],
          cardsIHaveTheyWant: [],
          totalMatches: 0
        }}
      }

      const matches = result.data
      const cardsTheyHaveIWant = matches.filter(m => m.match_type === 'friend_has_wanted')
      const cardsIHaveTheyWant = matches.filter(m => m.match_type === 'user_has_friend_wants')

      return {
        success: true,
        data: {
          friend: friendProfile,
          cardsTheyHaveIWant,
          cardsIHaveTheyWant,
          totalMatches: matches.length
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get potential trading partners (friends with the most matches)
   */
  async getPotentialTradingPartners(
    userId: string,
    limit: number = 10
  ): Promise<{ success: boolean; error?: string; data?: Array<{
    friend: {
      id: string
      username: string
      display_name?: string | null
      avatar_url?: string | null
    }
    matchCount: number
    cardsTheyHave: number
    cardsIHave: number
  }> }> {
    try {
      const summaryResult = await this.getMatchingSummary(userId)
      
      if (!summaryResult.success) {
        return { success: false, error: summaryResult.error }
      }

      if (!summaryResult.data) {
        return { success: true, data: [] }
      }

      const topFriends = summaryResult.data.topFriends.slice(0, limit)
      
      // Get detailed breakdown for each friend
      const tradingPartners = []
      
      for (const friendData of topFriends) {
        const comparisonResult = await this.compareFriendCollections(userId, friendData.friend.id)
        
        if (comparisonResult.success && comparisonResult.data) {
          tradingPartners.push({
            friend: friendData.friend,
            matchCount: friendData.matchCount,
            cardsTheyHave: comparisonResult.data.cardsTheyHaveIWant.length,
            cardsIHave: comparisonResult.data.cardsIHaveTheyWant.length
          })
        }
      }

      return { success: true, data: tradingPartners }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get collection completion suggestions based on friends' collections
   */
  async getCollectionSuggestions(
    userId: string,
    setId?: string,
    limit: number = 20
  ): Promise<{ success: boolean; error?: string; data?: Array<{
    card: Card & {
      sets: {
        name: string
        symbol_url?: string
      }
    }
    friendsWhoHave: Array<{
      id: string
      username: string
      display_name?: string | null
      avatar_url?: string | null
    }>
    inWishlist: boolean
  }> }> {
    try {
      // Get user's collection to exclude owned cards
      let userCollectionQuery = supabase
        .from('user_collections')
        .select('card_id')
        .eq('user_id', userId)

      const { data: userCollection, error: collectionError } = await userCollectionQuery

      if (collectionError) {
        return { success: false, error: collectionError.message }
      }

      const ownedCardIds = userCollection?.map(c => c.card_id) || []

      // Get user's wishlist
      const { data: userWishlist, error: wishlistError } = await supabase
        .from('wishlists')
        .select('card_id')
        .eq('user_id', userId)

      if (wishlistError) {
        return { success: false, error: wishlistError.message }
      }

      const wishlistCardIds = new Set(userWishlist?.map(w => w.card_id) || [])

      // Get friends' collections
      const matchResult = await this.findCollectionMatches(userId, { 
        matchType: 'friend_has_wanted',
        limit: 1000 
      })

      if (!matchResult.success) {
        return { success: false, error: matchResult.error }
      }

      if (!matchResult.data) {
        return { success: true, data: [] }
      }

      // Group by card and count friends who have each card
      const cardFriendMap = new Map<string, {
        card: any
        friends: Set<string>
        friendProfiles: any[]
      }>()

      matchResult.data.forEach(match => {
        const cardId = match.card_id
        if (!cardFriendMap.has(cardId)) {
          cardFriendMap.set(cardId, {
            card: match.card,
            friends: new Set(),
            friendProfiles: []
          })
        }
        
        const cardData = cardFriendMap.get(cardId)!
        if (!cardData.friends.has(match.friend_id)) {
          cardData.friends.add(match.friend_id)
          cardData.friendProfiles.push(match.friend)
        }
      })

      // Convert to suggestions array and sort by number of friends who have the card
      const suggestions = Array.from(cardFriendMap.values())
        .map(item => ({
          card: item.card,
          friendsWhoHave: item.friendProfiles,
          inWishlist: wishlistCardIds.has(item.card.id)
        }))
        .sort((a, b) => b.friendsWhoHave.length - a.friendsWhoHave.length)
        .slice(0, limit)

      return { success: true, data: suggestions }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}

export const collectionMatchingService = new CollectionMatchingService()
export default collectionMatchingService