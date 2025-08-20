import { supabase } from './supabase'
import { friendsService } from './friends-service'

export interface FriendCardOwnership {
  friend_id: string
  friend_username: string
  friend_display_name: string
  friend_avatar_url: string | null
  owns_card: boolean
  total_quantity: number
  variants: {
    normal: number
    holo: number
    reverse_holo: number
    pokeball_pattern: number
    masterball_pattern: number
  }
}

export interface WishlistItem {
  id: string
  user_id: string
  card_id: string
  priority: number // 1-5 scale
  max_price_eur: number | null
  condition_preference: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
  notes: string | null
  created_at: string
  updated_at: string
}

// Note: price_alerts table doesn't exist in current schema
// This is a placeholder for future implementation
export interface PriceAlert {
  id: string
  user_id: string
  card_id: string
  target_price: number
  condition?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TradeOffer {
  id: string
  requester_id: string
  addressee_id: string
  offered_cards: string[] // card IDs
  requested_cards: string[] // card IDs
  status: 'pending' | 'accepted' | 'declined' | 'completed'
  message?: string
  created_at: string
  updated_at: string
}

class CardSocialService {
  /**
   * Check which friends own a specific card
   */
  async getFriendsWithCard(
    userId: string,
    cardId: string
  ): Promise<{ success: boolean; error?: string; data?: FriendCardOwnership[] }> {
    try {
      console.log('🔍 DEBUG SERVICE: Using API route to bypass RLS', { userId, cardId })
      
      // Use the API route that can access server-side functionality
      const response = await fetch('/api/friends/with-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, cardId }),
      })

      const result = await response.json()
      
      console.log('🔍 DEBUG SERVICE: API response', result)
      
      return result
    } catch (error) {
      console.error('🔍 DEBUG SERVICE: API error', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Add card to wishlist
   */
  async addToWishlist(
    userId: string,
    cardId: string,
    priority: number = 3, // 1-5 scale, 3 = medium
    notes?: string
  ): Promise<{ success: boolean; error?: string; data?: WishlistItem }> {
    try {
      // Check if already in wishlist
      const { data: existing, error: checkError } = await supabase
        .from('wishlists')
        .select('*')
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        return { success: false, error: checkError.message }
      }

      if (existing) {
        return { success: false, error: 'Card already in wishlist' }
      }

      // Add to wishlist
      const { data, error } = await supabase
        .from('wishlists')
        .insert({
          user_id: userId,
          card_id: cardId,
          priority,
          notes
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Remove card from wishlist
   */
  async removeFromWishlist(
    userId: string,
    cardId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', cardId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Check if card is in user's wishlist
   */
  async isInWishlist(
    userId: string,
    cardId: string
  ): Promise<{ success: boolean; error?: string; inWishlist?: boolean; data?: WishlistItem }> {
    try {
      const { data, error } = await supabase
        .from('wishlists')
        .select('*')
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .single()

      if (error && error.code !== 'PGRST116') {
        return { success: false, error: error.message }
      }

      return { 
        success: true, 
        inWishlist: !!data,
        data: data || undefined
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Set price alert for a card (placeholder - table doesn't exist yet)
   */
  async setPriceAlert(
    userId: string,
    cardId: string,
    targetPrice: number,
    condition?: string
  ): Promise<{ success: boolean; error?: string; data?: PriceAlert }> {
    // TODO: Implement when price_alerts table is added to schema
    return {
      success: false,
      error: 'Price alerts feature not yet implemented - database table missing'
    }
  }

  /**
   * Share card (generate shareable link or data)
   */
  async shareCard(
    cardId: string,
    shareType: 'link' | 'social' | 'export' = 'link'
  ): Promise<{ success: boolean; error?: string; shareData?: any }> {
    try {
      // Get card details
      const { data: card, error } = await supabase
        .from('cards')
        .select(`
          *,
          sets!inner(name, symbol_url, release_date)
        `)
        .eq('id', cardId)
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.lumidex.app'
      
      switch (shareType) {
        case 'link':
          return {
            success: true,
            shareData: {
              url: `${baseUrl}/cards/${cardId}`,
              title: `${card.name} - Pokemon TCG`,
              description: `Check out this ${card.rarity} ${card.name} from ${card.sets.name}!`
            }
          }
        
        case 'social':
          return {
            success: true,
            shareData: {
              text: `Check out this ${card.name} from ${card.sets.name}! 🎴`,
              url: `${baseUrl}/cards/${cardId}`,
              hashtags: ['PokemonTCG', 'Trading', 'Collection']
            }
          }
        
        case 'export':
          return {
            success: true,
            shareData: {
              name: card.name,
              number: card.number,
              set: card.sets.name,
              rarity: card.rarity,
              types: card.types,
              prices: {
                average: card.cardmarket_avg_sell_price,
                low: card.cardmarket_low_price,
                trend: card.cardmarket_trend_price
              },
              image: card.image_large,
              url: `${baseUrl}/cards/${cardId}`
            }
          }
        
        default:
          return { success: false, error: 'Invalid share type' }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get friends who want this card (have it on wishlist)
   */
  async getFriendsWhoWantCard(
    userId: string,
    cardId: string
  ): Promise<{ success: boolean; error?: string; data?: any[] }> {
    try {
      // Get user's friends
      const friendsResult = await friendsService.getFriends(userId, { limit: 100 })
      
      if (!friendsResult.success || !friendsResult.data) {
        return { success: false, error: friendsResult.error || 'Failed to get friends' }
      }

      const friends = friendsResult.data
      if (friends.length === 0) {
        return { success: true, data: [] }
      }

      // Get friend IDs
      const friendIds = friends.map(f => f.friend_id)

      // Check which friends have this card on their wishlist
      const { data: wishlists, error } = await supabase
        .from('wishlists')
        .select('user_id, priority, notes, created_at')
        .eq('card_id', cardId)
        .in('user_id', friendIds)

      if (error) {
        return { success: false, error: error.message }
      }

      // Combine friend data with wishlist data
      const friendsWhoWant = friends
        .map(friend => {
          const wishlistEntry = wishlists?.find(w => w.user_id === friend.friend_id)
          if (!wishlistEntry) return null

          return {
            friend_id: friend.friend_id,
            friend_username: friend.friend.username,
            friend_display_name: friend.friend.display_name || friend.friend.username,
            friend_avatar_url: friend.friend.avatar_url,
            priority: wishlistEntry.priority,
            notes: wishlistEntry.notes,
            added_to_wishlist: wishlistEntry.created_at
          }
        })
        .filter(Boolean)

      return { success: true, data: friendsWhoWant }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const cardSocialService = new CardSocialService()
export default cardSocialService