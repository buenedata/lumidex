import { supabase } from './supabase'
import { Card } from '@/types'

export interface WishlistItem {
  id: string
  user_id: string
  card_id: string
  priority: 1 | 2 | 3 | 4 | 5
  max_price_eur: number | null
  condition_preference: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
  notes: string | null
  created_at: string
  updated_at: string
  card?: Card
}

export interface WishlistItemWithCard extends WishlistItem {
  wishlist_list_id?: string // Optional for backward compatibility
  card: Card & {
    sets: {
      name: string
      symbol_url?: string
    }
  }
}

export interface WishlistStats {
  totalItems: number
  averagePriority: number
  totalMaxBudget: number
  priorityBreakdown: Record<number, number>
  conditionPreferences: Record<string, number>
  recentAdditions: WishlistItemWithCard[]
}

class WishlistService {
  /**
   * Add a card to user's wishlist
   */
  async addToWishlist(
    userId: string,
    cardId: string,
    options: {
      priority?: 1 | 2 | 3 | 4 | 5
      maxPriceEur?: number
      conditionPreference?: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
      notes?: string
    } = {}
  ): Promise<{ success: boolean; error?: string; data?: WishlistItem }> {
    try {
      const {
        priority = 3,
        maxPriceEur,
        conditionPreference = 'any',
        notes
      } = options

      // Check if card already exists in wishlist
      const { data: existingItem, error: fetchError } = await supabase
        .from('wishlists')
        .select('*')
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        return { success: false, error: fetchError.message }
      }

      if (existingItem) {
        return { success: false, error: 'Card is already in your wishlist' }
      }

      // Add new item to wishlist
      const { data, error } = await supabase
        .from('wishlists')
        .insert({
          user_id: userId,
          card_id: cardId,
          priority,
          max_price_eur: maxPriceEur,
          condition_preference: conditionPreference,
          notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as WishlistItem }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Add multiple cards to user's wishlist
   */
  async addCardsToWishlist(
    userId: string,
    cardIds: string[],
    options: {
      priority?: 1 | 2 | 3 | 4 | 5
      maxPriceEur?: number
      conditionPreference?: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
      notes?: string
    } = {}
  ): Promise<{ success: boolean; error?: string; addedCount?: number; skippedCount?: number }> {
    try {
      if (cardIds.length === 0) {
        return { success: true, addedCount: 0, skippedCount: 0 }
      }

      const {
        priority = 3,
        maxPriceEur,
        conditionPreference = 'any',
        notes
      } = options

      // Check which cards are already in wishlist
      const { data: existingItems, error: fetchError } = await supabase
        .from('wishlists')
        .select('card_id')
        .eq('user_id', userId)
        .in('card_id', cardIds)

      if (fetchError) {
        return { success: false, error: fetchError.message }
      }

      // Filter out cards that are already in the wishlist
      const existingCardIds = new Set(existingItems?.map(item => item.card_id) || [])
      const newCardIds = cardIds.filter(cardId => !existingCardIds.has(cardId))

      if (newCardIds.length === 0) {
        return {
          success: true,
          addedCount: 0,
          skippedCount: cardIds.length,
          error: 'All cards are already in your wishlist'
        }
      }

      // Prepare bulk insert data
      const insertData = newCardIds.map(cardId => ({
        user_id: userId,
        card_id: cardId,
        priority,
        max_price_eur: maxPriceEur,
        condition_preference: conditionPreference,
        notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      // Add the cards to the wishlist
      const { error: insertError } = await supabase
        .from('wishlists')
        .insert(insertData)

      if (insertError) {
        return { success: false, error: insertError.message }
      }

      return {
        success: true,
        addedCount: newCardIds.length,
        skippedCount: cardIds.length - newCardIds.length
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Remove a card from user's wishlist
   */
  async removeFromWishlist(
    userId: string,
    wishlistItemId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify the user owns this wishlist item
      const { data: item, error: fetchError } = await supabase
        .from('wishlists')
        .select('*')
        .eq('id', wishlistItemId)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        return { success: false, error: 'Wishlist item not found' }
      }

      // Delete the wishlist item
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('id', wishlistItemId)

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
   * Remove a card from user's wishlist by card ID
   */
  async removeFromWishlistByCardId(
    userId: string,
    cardId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the wishlist item for this card
      const { data: item, error: fetchError } = await supabase
        .from('wishlists')
        .select('*')
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No rows found - card not in wishlist, that's fine
          return { success: true }
        } else {
          // Real error - return failure
          return { success: false, error: `Database error: ${fetchError.message}` }
        }
      }

      if (!item) {
        // Card not in wishlist, that's fine
        return { success: true }
      }

      // Delete the wishlist item
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('id', item.id)

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
   * Update a wishlist item
   */
  async updateWishlistItem(
    userId: string,
    wishlistItemId: string,
    updates: {
      priority?: 1 | 2 | 3 | 4 | 5
      maxPriceEur?: number | null
      conditionPreference?: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
      notes?: string | null
    }
  ): Promise<{ success: boolean; error?: string; data?: WishlistItem }> {
    try {
      // Verify the user owns this wishlist item
      const { data: item, error: fetchError } = await supabase
        .from('wishlists')
        .select('*')
        .eq('id', wishlistItemId)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        return { success: false, error: 'Wishlist item not found' }
      }

      // Update the wishlist item
      const { data, error } = await supabase
        .from('wishlists')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', wishlistItemId)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as WishlistItem }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get user's wishlist with pagination and filtering
   */
  async getUserWishlist(
    userId: string,
    options: {
      page?: number
      limit?: number
      priority?: number
      conditionPreference?: string
      maxPrice?: number
      sortBy?: 'priority' | 'created_at' | 'price' | 'name'
      sortOrder?: 'asc' | 'desc'
      search?: string
    } = {}
  ): Promise<{ success: boolean; error?: string; data?: WishlistItemWithCard[]; total?: number }> {
    try {
      const {
        page = 1,
        limit = 24,
        priority,
        conditionPreference,
        maxPrice,
        sortBy = 'priority',
        sortOrder = 'asc',
        search
      } = options

      // First get wishlist items
      let query = supabase
        .from('wishlists')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)

      // Apply filters
      if (priority) {
        query = query.eq('priority', priority)
      }

      if (conditionPreference && conditionPreference !== 'any') {
        query = query.eq('condition_preference', conditionPreference as any)
      }

      if (maxPrice) {
        query = query.lte('max_price_eur', maxPrice)
      }

      // Apply sorting
      if (sortBy === 'priority') {
        query = query.order('priority', { ascending: sortOrder === 'asc' })
      } else if (sortBy === 'created_at') {
        query = query.order('created_at', { ascending: sortOrder === 'asc' })
      }

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data: wishlistItems, error, count } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      if (!wishlistItems || wishlistItems.length === 0) {
        return { success: true, data: [], total: 0 }
      }

      // Get card details
      const cardIds = wishlistItems.map(item => item.card_id)
      let cardQuery = supabase
        .from('cards')
        .select(`
          id,
          name,
          set_id,
          number,
          rarity,
          image_small,
          image_large,
          cardmarket_avg_sell_price,
          cardmarket_trend_price,
          cardmarket_low_price,
          sets!inner(name, symbol_url)
        `)
        .in('id', cardIds)

      // Apply search filter to cards
      if (search) {
        cardQuery = cardQuery.ilike('name', `%${search}%`)
      }

      const { data: cards, error: cardError } = await cardQuery

      if (cardError) {
        return { success: false, error: cardError.message }
      }

      // Combine wishlist items with card data
      const wishlistWithCards: WishlistItemWithCard[] = wishlistItems
        .map(item => {
          const card = cards?.find(c => c.id === item.card_id)
          if (!card) return null

          return {
            ...item,
            card: card as any
          }
        })
        .filter(Boolean) as WishlistItemWithCard[]

      // Apply additional sorting if needed
      if (sortBy === 'price') {
        wishlistWithCards.sort((a, b) => {
          const priceA = a.card.cardmarket_avg_sell_price || 0
          const priceB = b.card.cardmarket_avg_sell_price || 0
          return sortOrder === 'asc' ? priceA - priceB : priceB - priceA
        })
      } else if (sortBy === 'name') {
        wishlistWithCards.sort((a, b) => {
          const nameA = a.card.name.toLowerCase()
          const nameB = b.card.name.toLowerCase()
          if (sortOrder === 'asc') {
            return nameA.localeCompare(nameB)
          } else {
            return nameB.localeCompare(nameA)
          }
        })
      }

      return { success: true, data: wishlistWithCards, total: count || 0 }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Check if a card is in user's wishlist
   */
  async checkCardInWishlist(
    userId: string,
    cardId: string
  ): Promise<{ success: boolean; error?: string; inWishlist?: boolean; item?: WishlistItem }> {
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
        item: data ? (data as WishlistItem) : undefined
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get wishlist statistics
   */
  async getWishlistStats(userId: string): Promise<{ success: boolean; error?: string; data?: WishlistStats }> {
    try {
      // Get all wishlist items with card details
      const { data: wishlistItems, error } = await supabase
        .from('wishlists')
        .select(`
          *,
          cards!inner(
            id,
            name,
            set_id,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            sets!inner(name)
          )
        `)
        .eq('user_id', userId)

      if (error) {
        return { success: false, error: error.message }
      }

      if (!wishlistItems || wishlistItems.length === 0) {
        return {
          success: true,
          data: {
            totalItems: 0,
            averagePriority: 0,
            totalMaxBudget: 0,
            priorityBreakdown: {},
            conditionPreferences: {},
            recentAdditions: []
          }
        }
      }

      // Calculate statistics
      const totalItems = wishlistItems.length
      const averagePriority = wishlistItems.reduce((sum, item) => sum + item.priority, 0) / totalItems
      const totalMaxBudget = wishlistItems.reduce((sum, item) => sum + (item.max_price_eur || 0), 0)

      // Priority breakdown
      const priorityBreakdown: Record<number, number> = {}
      wishlistItems.forEach(item => {
        priorityBreakdown[item.priority] = (priorityBreakdown[item.priority] || 0) + 1
      })

      // Condition preferences breakdown
      const conditionPreferences: Record<string, number> = {}
      wishlistItems.forEach(item => {
        const condition = item.condition_preference
        conditionPreferences[condition] = (conditionPreferences[condition] || 0) + 1
      })

      // Recent additions (last 10)
      const recentAdditions = wishlistItems
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map((item: any) => ({
          ...item,
          card: item.cards
        })) as WishlistItemWithCard[]

      return {
        success: true,
        data: {
          totalItems,
          averagePriority,
          totalMaxBudget,
          priorityBreakdown,
          conditionPreferences,
          recentAdditions
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
   * Get affordable wishlist items (cards within budget)
   */
  async getAffordableWishlistItems(
    userId: string,
    budget: number
  ): Promise<{ success: boolean; error?: string; data?: WishlistItemWithCard[] }> {
    try {
      const result = await this.getUserWishlist(userId, {
        limit: 100, // Get more items to filter
        sortBy: 'priority',
        sortOrder: 'asc'
      })

      if (!result.success || !result.data) {
        return result
      }

      // Filter items that are within budget
      const affordableItems = result.data.filter(item => {
        const currentPrice = item.card.cardmarket_avg_sell_price || 0
        const maxPrice = item.max_price_eur || budget
        return currentPrice <= Math.min(maxPrice, budget) && currentPrice > 0
      })

      // Sort by priority and then by price
      affordableItems.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority // Higher priority first (lower number)
        }
        const priceA = a.card.cardmarket_avg_sell_price || 0
        const priceB = b.card.cardmarket_avg_sell_price || 0
        return priceA - priceB // Lower price first
      })

      return { success: true, data: affordableItems }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get price alerts (cards that dropped below max price)
   */
  async getPriceAlerts(
    userId: string
  ): Promise<{ success: boolean; error?: string; data?: WishlistItemWithCard[] }> {
    try {
      const result = await this.getUserWishlist(userId, {
        limit: 100,
        sortBy: 'priority',
        sortOrder: 'asc'
      })

      if (!result.success || !result.data) {
        return result
      }

      // Filter items where current price is below max price
      const priceAlerts = result.data.filter(item => {
        if (!item.max_price_eur) return false
        const currentPrice = item.card.cardmarket_avg_sell_price || 0
        return currentPrice > 0 && currentPrice <= item.max_price_eur
      })

      return { success: true, data: priceAlerts }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}

export const wishlistService = new WishlistService()
export default wishlistService