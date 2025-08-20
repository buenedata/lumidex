import { supabase } from './supabase'
import { Card, UserCollection } from '@/types'
import { achievementService } from './achievement-service'
import { toastService } from './toast-service'
import { calculateCardVariantValue } from './variant-pricing'
import { wishlistService } from './wishlist-service'

// Extended UserCollection for service responses with nested card data
export interface UserCollectionWithCard extends UserCollection {
  cards?: {
    id: string
    name: string
    set_id: string
    number: string
    rarity: string
    image_small: string
    image_large: string
    cardmarket_avg_sell_price: number | null
    cardmarket_trend_price: number | null
    sets: {
      name: string
      symbol_url?: string
    }
  }
}

export type CardCondition = 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged'

export interface CollectionStats {
  totalCards: number
  totalValue: number
  uniqueCards: number
  setCompletion: Record<string, { owned: number; total: number; percentage: number }>
  rarityBreakdown: Record<string, number>
  recentAdditions: UserCollectionWithCard[]
}

class CollectionService {
  /**
   * Add a card to user's collection
   */
  async addToCollection(
    userId: string,
    cardId: string,
    options: {
      quantity?: number
      condition?: CardCondition
      variant?: string
      notes?: string
    } = {}
  ): Promise<{ success: boolean; error?: string; data?: UserCollection }> {
    try {
      const {
        quantity = 1,
        condition = 'near_mint',
        variant = 'normal',
        notes
      } = options

      // Check if card already exists in collection with same variant and condition
      const { data: existingCard, error: fetchError } = await supabase
        .from('user_collections')
        .select('*')
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .eq('condition', condition)
        .eq('variant', variant as any)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        return { success: false, error: fetchError.message }
      }

      if (existingCard) {
        // Update existing card quantity
        const { data, error } = await supabase
          .from('user_collections')
          .update({
            quantity: existingCard.quantity + quantity,
            updated_at: new Date().toISOString(),
            ...(notes && { notes })
          })
          .eq('id', existingCard.id)
          .select()
          .single()

        if (error) {
          return { success: false, error: error.message }
        }

        // Check for new achievements after adding to collection
        try {
          const achievementResult = await achievementService.checkAchievements(userId)
          if (achievementResult.success && achievementResult.newAchievements && achievementResult.newAchievements.length > 0) {
            // Show toast notifications for new achievements
            achievementResult.newAchievements.forEach(achievement => {
              const definition = achievementService.getAchievementDefinition(achievement.achievement_type)
              if (definition) {
                toastService.achievement(
                  `Achievement Unlocked: ${definition.name}`,
                  definition.description,
                  definition.icon
                )
              }
            })
          }
        } catch (achievementError) {
          console.warn('Failed to check achievements:', achievementError)
          // Don't fail the collection operation if achievement checking fails
        }

        // Remove card from wishlist if it exists there
        try {
          const wishlistRemovalResult = await wishlistService.removeFromWishlistByCardId(userId, cardId)
          if (wishlistRemovalResult.success) {
            console.log(`Card ${cardId} automatically removed from wishlist after being added to collection`)
          }
        } catch (wishlistError) {
          console.warn('Failed to remove card from wishlist:', wishlistError)
          // Don't fail the collection operation if wishlist removal fails
        }

        return { success: true, data }
      } else {
        // Add new card to collection
        const { data, error } = await supabase
          .from('user_collections')
          .insert({
            user_id: userId,
            card_id: cardId,
            quantity,
            condition,
            variant: variant as any,
            acquired_date: new Date().toISOString().split('T')[0],
            is_foil: variant === 'holo' || variant === 'reverse_holo',
            notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          return { success: false, error: error.message }
        }

        // Check for new achievements after adding to collection
        try {
          const achievementResult = await achievementService.checkAchievements(userId)
          if (achievementResult.success && achievementResult.newAchievements && achievementResult.newAchievements.length > 0) {
            // Show toast notifications for new achievements
            achievementResult.newAchievements.forEach(achievement => {
              const definition = achievementService.getAchievementDefinition(achievement.achievement_type)
              if (definition) {
                toastService.achievement(
                  `Achievement Unlocked: ${definition.name}`,
                  definition.description,
                  definition.icon
                )
              }
            })
          }
        } catch (achievementError) {
          console.warn('Failed to check achievements:', achievementError)
          // Don't fail the collection operation if achievement checking fails
        }

        // Remove card from wishlist if it exists there
        try {
          const wishlistRemovalResult = await wishlistService.removeFromWishlistByCardId(userId, cardId)
          if (wishlistRemovalResult.success) {
            console.log(`Card ${cardId} automatically removed from wishlist after being added to collection`)
          }
        } catch (wishlistError) {
          console.warn('Failed to remove card from wishlist:', wishlistError)
          // Don't fail the collection operation if wishlist removal fails
        }

        return { success: true, data }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Remove a card from user's collection
   */
  async removeFromCollection(
    userId: string,
    cardId: string,
    options: {
      quantity?: number
      condition?: CardCondition
      variant?: string
      removeAll?: boolean
    } = {}
  ): Promise<{ success: boolean; error?: string; data?: UserCollection | null }> {
    try {
      const {
        quantity = 1,
        condition = 'near_mint',
        variant = 'normal',
        removeAll = false
      } = options

      // Find the card in collection with specific variant and condition
      const { data: existingCard, error: fetchError } = await supabase
        .from('user_collections')
        .select('*')
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .eq('condition', condition)
        .eq('variant', variant as any)
        .single()

      if (fetchError) {
        return { success: false, error: 'Card not found in collection' }
      }

      if (removeAll || existingCard.quantity <= quantity) {
        // Remove card completely
        const { error } = await supabase
          .from('user_collections')
          .delete()
          .eq('id', existingCard.id)

        if (error) {
          return { success: false, error: error.message }
        }

        // Check for achievements that need to be revoked after removing from collection
        try {
          const achievementResult = await achievementService.checkAchievements(userId)
          // Note: checkAchievements will handle both unlocking new achievements and revoking invalid ones
        } catch (achievementError) {
          console.warn('Failed to check achievements after removal:', achievementError)
          // Don't fail the collection operation if achievement checking fails
        }

        return { success: true, data: null }
      } else {
        // Reduce quantity
        const { data, error } = await supabase
          .from('user_collections')
          .update({
            quantity: existingCard.quantity - quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCard.id)
          .select()
          .single()

        if (error) {
          return { success: false, error: error.message }
        }

        // Check for achievements that need to be revoked after reducing quantity
        try {
          const achievementResult = await achievementService.checkAchievements(userId)
          // Note: checkAchievements will handle both unlocking new achievements and revoking invalid ones
        } catch (achievementError) {
          console.warn('Failed to check achievements after quantity reduction:', achievementError)
          // Don't fail the collection operation if achievement checking fails
        }

        return { success: true, data }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get user's collection with pagination and filtering
   */
  async getUserCollection(
    userId: string,
    options: {
      page?: number
      limit?: number
      setId?: string
      rarity?: string
      condition?: string
      sortBy?: 'name' | 'acquired_date' | 'value' | 'quantity'
      sortOrder?: 'asc' | 'desc'
    } = {}
  ): Promise<{ success: boolean; error?: string; data?: UserCollectionWithCard[]; total?: number }> {
    try {
      const {
        page = 1,
        limit = 24,
        setId,
        rarity,
        condition,
        sortBy = 'acquired_date',
        sortOrder = 'desc'
      } = options

      let query = supabase
        .from('user_collections')
        .select(`
          *,
          cards!inner(
            id,
            name,
            set_id,
            number,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            cardmarket_trend_price,
            sets!inner(name, symbol_url)
          )
        `, { count: 'exact' })
        .eq('user_id', userId)

      // Apply filters
      if (setId) {
        query = query.eq('cards.set_id', setId)
      }

      if (rarity) {
        query = query.eq('cards.rarity', rarity)
      }

      if (condition) {
        query = query.eq('condition', condition as CardCondition)
      }

      // Apply sorting
      // Apply sorting
      if (sortBy === 'name') {
        query = query.order('cards.name', { ascending: sortOrder === 'asc' })
      } else if (sortBy === 'value') {
        query = query.order('cards.cardmarket_avg_sell_price', { ascending: sortOrder === 'asc' })
      } else {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' })
      }

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (data as UserCollectionWithCard[]) || [], total: count || 0 }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Check if user owns a specific card
   */
  async checkCardOwnership(
    userId: string,
    cardId: string
  ): Promise<{ success: boolean; error?: string; owned?: boolean; quantity?: number }> {
    try {
      const { data, error } = await supabase
        .from('user_collections')
        .select('quantity')
        .eq('user_id', userId)
        .eq('card_id', cardId)

      if (error) {
        return { success: false, error: error.message }
      }

      const totalQuantity = data?.reduce((sum, item) => sum + item.quantity, 0) || 0

      return { 
        success: true, 
        owned: totalQuantity > 0, 
        quantity: totalQuantity 
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Clear entire collection for a user (DANGER ZONE)
   */
  async clearCollection(userId: string): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
    try {
      // First, get count of items to be deleted
      const { data: countData, error: countError } = await supabase
        .from('user_collections')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)

      if (countError) {
        return { success: false, error: countError.message }
      }

      const deletedCount = countData?.length || 0

      // Delete all collection entries for this user
      const { error: deleteError } = await supabase
        .from('user_collections')
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        return { success: false, error: deleteError.message }
      }

      // Also clear related data
      // Clear wishlists
      await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', userId)

      // Clear collection stats
      await supabase
        .from('collection_stats')
        .delete()
        .eq('user_id', userId)

      // Clear achievements that are no longer valid
      // Only keep special achievements like early_adopter that don't depend on collection
      await supabase
        .from('user_achievements')
        .delete()
        .eq('user_id', userId)
        .not('achievement_type', 'eq', 'early_adopter') // Keep early adopter

      return { success: true, deletedCount }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(userId: string): Promise<{ success: boolean; error?: string; data?: CollectionStats }> {
    try {
      // Get all collection items with card details
      const { data: collection, error } = await supabase
        .from('user_collections')
        .select(`
          *,
          cards!inner(
            id,
            name,
            set_id,
            number,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            cardmarket_low_price,
            cardmarket_trend_price,
            cardmarket_reverse_holo_sell,
            cardmarket_reverse_holo_low,
            cardmarket_reverse_holo_trend,
            sets!inner(name, symbol_url)
          )
        `)
        .eq('user_id', userId)

      if (error) {
        return { success: false, error: error.message }
      }

      if (!collection || collection.length === 0) {
        return {
          success: true,
          data: {
            totalCards: 0,
            totalValue: 0,
            uniqueCards: 0,
            setCompletion: {},
            rarityBreakdown: {},
            recentAdditions: []
          }
        }
      }

      // Calculate statistics
      const totalCards = collection.reduce((sum, item) => sum + item.quantity, 0)
      const uniqueCards = collection.length
      // Group collection items by card to calculate variant-specific pricing
      const cardGroups = collection.reduce((acc, item) => {
        const cardId = item.card_id
        if (!acc[cardId]) {
          acc[cardId] = {
            card: item.cards,
            variants: {
              normal: 0,
              holo: 0,
              reverseHolo: 0,
              pokeballPattern: 0,
              masterballPattern: 0,
              firstEdition: 0,
            }
          }
        }
        
        // Add quantity to the appropriate variant
        const variant = (item as any).variant || 'normal'
        switch (variant) {
          case 'normal':
            acc[cardId].variants.normal += item.quantity
            break
          case 'holo':
            acc[cardId].variants.holo += item.quantity
            break
          case 'reverse_holo':
            acc[cardId].variants.reverseHolo += item.quantity
            break
          case 'pokeball_pattern':
            acc[cardId].variants.pokeballPattern += item.quantity
            break
          case 'masterball_pattern':
            acc[cardId].variants.masterballPattern += item.quantity
            break
          case '1st_edition':
            acc[cardId].variants.firstEdition += item.quantity
            break
        }
        
        return acc
      }, {} as Record<string, { card: any; variants: any }>)

      // Calculate total value using variant-specific pricing
      const totalValue = Object.values(cardGroups).reduce((sum, { card, variants }) => {
        if (!card) return sum
        
        const cardValue = calculateCardVariantValue(
          {
            cardmarket_avg_sell_price: card.cardmarket_avg_sell_price,
            cardmarket_low_price: card.cardmarket_low_price,
            cardmarket_trend_price: card.cardmarket_trend_price,
            cardmarket_reverse_holo_sell: card.cardmarket_reverse_holo_sell,
            cardmarket_reverse_holo_low: card.cardmarket_reverse_holo_low,
            cardmarket_reverse_holo_trend: card.cardmarket_reverse_holo_trend,
          },
          variants
        )
        
        return sum + cardValue
      }, 0)

      // Rarity breakdown
      const rarityBreakdown: Record<string, number> = {}
      collection.forEach(item => {
        const rarity = item.cards?.rarity || 'Unknown'
        rarityBreakdown[rarity] = (rarityBreakdown[rarity] || 0) + item.quantity
      })

      // Recent additions (last 10)
      const recentAdditions = collection
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)

      // Set completion (simplified - would need more complex logic for full implementation)
      const setCompletion: Record<string, { owned: number; total: number; percentage: number }> = {}
      const setGroups = collection.reduce((acc, item) => {
        const setId = item.cards?.set_id
        if (setId) {
          acc[setId] = (acc[setId] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      // For now, just show owned cards per set (would need total cards per set from database)
      Object.entries(setGroups).forEach(([setId, owned]) => {
        setCompletion[setId] = {
          owned,
          total: owned, // Placeholder - would need actual set totals
          percentage: 100 // Placeholder
        }
      })

      return {
        success: true,
        data: {
          totalCards,
          totalValue,
          uniqueCards,
          setCompletion,
          rarityBreakdown,
          recentAdditions: recentAdditions as UserCollectionWithCard[]
        }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}

export const collectionService = new CollectionService()
export default collectionService