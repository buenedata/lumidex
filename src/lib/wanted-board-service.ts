import { supabase } from './supabase'

// Type assertion for wanted_board table since it's not in the main schema
const wantedBoardTable = 'wanted_board' as any
const userCardsTable = 'user_cards' as any

export interface WantedBoardPost {
  id: string
  user_id: string
  card_id: string
  max_price_eur: number | null
  condition_preference: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
  notes: string | null
  created_at: string
  updated_at: string
  user?: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  card?: {
    id: string
    name: string
    set_id: string
    number: string
    rarity: string
    image_small: string
    image_large: string | null
    cardmarket_avg_sell_price: number | null
    sets: {
      name: string
      symbol_url: string | null
    }
  }
}

export interface WantedBoardStats {
  totalPosts: number
  totalUsers: number
  recentPosts: WantedBoardPost[]
}

class WantedBoardService {
  /**
   * Post cards from wishlist to wanted board
   */
  async postWishlistToWantedBoard(
    userId: string,
    wishlistItems: any[],
    replaceAll: boolean = true
  ): Promise<{ success: boolean; error?: string; data?: WantedBoardPost[] }> {
    try {
      // Only remove existing posts if replaceAll is true
      if (replaceAll) {
        await supabase
          .from(wantedBoardTable)
          .delete()
          .eq('user_id', userId)
      }

      // Insert new posts
      const posts = wishlistItems.map(item => ({
        user_id: userId,
        card_id: item.card_id,
        max_price_eur: item.max_price_eur,
        condition_preference: item.condition_preference,
        notes: item.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      const { data, error } = await supabase
        .from(wantedBoardTable)
        .insert(posts)
        .select()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as unknown as WantedBoardPost[] }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Add individual cards to wanted board without removing existing posts
   * Use this when posting cards one by one or adding to existing posts
   */
  async addCardsToWantedBoard(
    userId: string,
    wishlistItems: any[]
  ): Promise<{ success: boolean; error?: string; data?: WantedBoardPost[] }> {
    return this.postWishlistToWantedBoard(userId, wishlistItems, false)
  }

  /**
   * Replace all user's wanted board posts with new wishlist
   * Use this when posting entire wishlist at once (replaces all existing posts)
   */
  async replaceAllWantedBoardPosts(
    userId: string,
    wishlistItems: any[]
  ): Promise<{ success: boolean; error?: string; data?: WantedBoardPost[] }> {
    return this.postWishlistToWantedBoard(userId, wishlistItems, true)
  }

  /**
   * Get all wanted board posts with user and card details
   */
  async getWantedBoardPosts(
    currentUserId?: string,
    limit: number = 50
  ): Promise<{ success: boolean; error?: string; data?: WantedBoardPost[] }> {
    try {
      const { data, error } = await supabase
        .from(wantedBoardTable)
        .select(`
          *,
          profiles(id, username, display_name, avatar_url),
          cards(
            id,
            name,
            set_id,
            number,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            sets(name, symbol_url)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        return { success: false, error: error.message }
      }

      // Transform the data to match our interface
      const transformedData = (data as any)?.map((post: any) => ({
        id: post.id,
        user_id: post.user_id,
        card_id: post.card_id,
        max_price_eur: post.max_price_eur,
        condition_preference: post.condition_preference,
        notes: post.notes,
        created_at: post.created_at,
        updated_at: post.updated_at,
        user: post.profiles,
        card: {
          id: post.cards.id,
          name: post.cards.name,
          set_id: post.cards.set_id,
          number: post.cards.number,
          rarity: post.cards.rarity,
          image_small: post.cards.image_small,
          image_large: post.cards.image_large,
          cardmarket_avg_sell_price: post.cards.cardmarket_avg_sell_price,
          sets: post.cards.sets
        }
      })) as WantedBoardPost[]

      return { success: true, data: transformedData || [] }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Check if current user has any of the wanted cards in their collection
   */
  async checkUserHasWantedCards(
    userId: string,
    wantedPosts: WantedBoardPost[]
  ): Promise<{ success: boolean; error?: string; data?: string[] }> {
    try {
      if (wantedPosts.length === 0) {
        return { success: true, data: [] }
      }

      const cardIds = wantedPosts.map(post => post.card_id)

      const { data, error } = await supabase
        .from('user_collections')
        .select('card_id')
        .eq('user_id', userId)
        .in('card_id', cardIds)
        .gt('quantity', 0) // Only cards they actually have

      if (error) {
        return { success: false, error: error.message }
      }

      const ownedCardIds = data?.map((item: any) => item.card_id) || []
      return { success: true, data: ownedCardIds }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get wanted board statistics
   */
  async getWantedBoardStats(): Promise<{ success: boolean; error?: string; data?: WantedBoardStats }> {
    try {
      const [postsResult, usersResult, recentResult] = await Promise.all([
        supabase.from(wantedBoardTable).select('id', { count: 'exact', head: true }),
        supabase.from(wantedBoardTable).select('user_id').then((result: any) => {
          if (result.data) {
            const uniqueUsers = new Set(result.data.map((item: any) => item.user_id))
            return { count: uniqueUsers.size }
          }
          return { count: 0 }
        }),
        this.getWantedBoardPosts(undefined, 5)
      ])

      const stats: WantedBoardStats = {
        totalPosts: postsResult.count || 0,
        totalUsers: usersResult.count || 0,
        recentPosts: recentResult.success ? recentResult.data || [] : []
      }

      return { success: true, data: stats }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Remove specific card from wanted board
   */
  async removeCardFromWantedBoard(
    userId: string,
    cardId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from(wantedBoardTable)
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
   * Remove specific wanted board post by ID
   */
  async removeWantedBoardPost(
    userId: string,
    postId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from(wantedBoardTable)
        .delete()
        .eq('user_id', userId)
        .eq('id', postId)

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
   * Remove all user's posts from wanted board
   */
  async removeUserPosts(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from(wantedBoardTable)
        .delete()
        .eq('user_id', userId)

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
}

export const wantedBoardService = new WantedBoardService()
export default wantedBoardService