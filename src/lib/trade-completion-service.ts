import { supabase } from './supabase'
import { wishlistService } from './wishlist-service'
import { collectionService } from './collection-service'
import { achievementService } from './achievement-service'

// Helper function to determine the correct variant for a card
function determineCardVariant(card: any, isHolo: boolean = false): string {
  if (!card) return 'normal'
  
  const cardName = card.name?.toLowerCase() || ''
  const rarity = card.rarity?.toLowerCase() || ''
  
  // Special cases for specific cards
  if (cardName.includes('alakazam ex') || cardName.includes('alakazam-ex')) {
    return 'holo' // Alakazam ex should always be holo
  }
  
  // Check if it's an ex card
  if (cardName.includes(' ex') || cardName.includes('-ex') || rarity.includes('ex')) {
    return 'holo' // Most ex cards are holo
  }
  
  // Check if it's a special illustration or ultra rare
  if (rarity.includes('special illustration') ||
      rarity.includes('ultra rare') ||
      rarity.includes('secret rare') ||
      rarity.includes('ace spec')) {
    return 'holo'
  }
  
  // Check if it's explicitly marked as foil
  if (isHolo) {
    return 'holo'
  }
  
  // Check rarity-based variants
  if (rarity.includes('rare holo') || rarity.includes('holo rare')) {
    return 'holo'
  }
  
  if (rarity.includes('rare') && !rarity.includes('ultra') && !rarity.includes('secret')) {
    return 'holo' // Regular rare cards are typically holo
  }
  
  // Default to normal for common/uncommon cards
  return 'normal'
}

export interface TradeCompletionResult {
  success: boolean
  error?: string
  removedFromWishlist?: string[]
  removedFromCollection?: string[]
  addedToCollection?: string[]
}

class TradeCompletionService {
  /**
   * Complete a trade and handle card transfers
   */
  async completeTrade(
    tradeId: string,
    userId: string
  ): Promise<TradeCompletionResult> {
    try {
      // First, get the trade details with all items including variant information
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select(`
          id,
          initiator_id,
          recipient_id,
          status,
          trade_items (
            id,
            user_id,
            card_id,
            quantity,
            condition,
            is_foil,
            card:cards (
              id,
              name,
              image_small,
              rarity
            )
          )
        `)
        .eq('id', tradeId)
        .single()

      if (tradeError || !trade) {
        return { success: false, error: 'Trade not found' }
      }

      // Verify the user is part of this trade
      if (trade.initiator_id !== userId && trade.recipient_id !== userId) {
        return { success: false, error: 'You are not authorized to complete this trade' }
      }

      // Verify the trade is in accepted status
      if (trade.status !== 'accepted') {
        return { success: false, error: 'Trade must be accepted before it can be completed' }
      }

      const removedFromWishlist: string[] = []
      const removedFromCollection: string[] = []
      const addedToCollection: string[] = []

      // Process card transfers for both users
      const initiatorItems = trade.trade_items.filter(item => item.user_id === trade.initiator_id)
      const recipientItems = trade.trade_items.filter(item => item.user_id === trade.recipient_id)

      // Handle initiator's cards (going to recipient)
      // Scenario: Initiator gives cards to recipient
      for (const item of initiatorItems) {
        const card = Array.isArray(item.card) ? item.card[0] : item.card
        const cardName = card?.name || 'Unknown Card'
        console.log(`Processing initiator's card: ${cardName} -> going to recipient`)
        
        // Determine the correct variant for this card
        const variant = determineCardVariant(card, item.is_foil)
        
        // Remove from initiator's collection (they're giving this card away)
        const removeResult = await collectionService.removeFromCollection(
          trade.initiator_id,
          item.card_id,
          {
            quantity: item.quantity,
            condition: item.condition as any,
            variant: variant
          }
        )

        if (removeResult.success) {
          removedFromCollection.push(`${cardName} (${item.quantity}x ${variant})`)
        } else {
          console.error(`Failed to remove ${cardName} from initiator's collection:`, removeResult.error)
        }

        // Add to recipient's collection (they're receiving this card)
        const addResult = await collectionService.addToCollection(
          trade.recipient_id,
          item.card_id,
          {
            quantity: item.quantity,
            condition: item.condition as any,
            variant: variant
          }
        )

        if (addResult.success) {
          addedToCollection.push(`${cardName} (${item.quantity}x ${variant})`)
        } else {
          console.error(`Failed to add ${cardName} to recipient's collection:`, addResult.error)
        }

        // IMPORTANT: Remove from recipient's wishlist if it exists
        // (They wanted this card, now they have it, so remove from wishlist)
        await this.removeFromWishlistIfExists(trade.recipient_id, item.card_id, removedFromWishlist, cardName)
      }

      // Handle recipient's cards (going to initiator)
      // Scenario: Recipient gives cards to initiator
      for (const item of recipientItems) {
        const card = Array.isArray(item.card) ? item.card[0] : item.card
        const cardName = card?.name || 'Unknown Card'
        console.log(`Processing recipient's card: ${cardName} -> going to initiator`)
        
        // Determine the correct variant for this card
        const variant = determineCardVariant(card, item.is_foil)
        
        // Remove from recipient's collection (they're giving this card away)
        const removeResult = await collectionService.removeFromCollection(
          trade.recipient_id,
          item.card_id,
          {
            quantity: item.quantity,
            condition: item.condition as any,
            variant: variant
          }
        )

        if (removeResult.success) {
          removedFromCollection.push(`${cardName} (${item.quantity}x ${variant})`)
        } else {
          console.error(`Failed to remove ${cardName} from recipient's collection:`, removeResult.error)
        }

        // Add to initiator's collection (they're receiving this card)
        const addResult = await collectionService.addToCollection(
          trade.initiator_id,
          item.card_id,
          {
            quantity: item.quantity,
            condition: item.condition as any,
            variant: variant
          }
        )

        if (addResult.success) {
          addedToCollection.push(`${cardName} (${item.quantity}x ${variant})`)
        } else {
          console.error(`Failed to add ${cardName} to initiator's collection:`, addResult.error)
        }

        // IMPORTANT: Remove from initiator's wishlist if it exists
        // (They wanted this card, now they have it, so remove from wishlist)
        await this.removeFromWishlistIfExists(trade.initiator_id, item.card_id, removedFromWishlist, cardName)
      }

      // Mark trade as completed
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId)

      if (updateError) {
        return { success: false, error: 'Failed to update trade status' }
      }

      // Check achievements for both users after trade completion
      try {
        await Promise.all([
          achievementService.checkAchievements(trade.initiator_id),
          achievementService.checkAchievements(trade.recipient_id)
        ])
      } catch (achievementError) {
        console.warn('Failed to check achievements after trade completion:', achievementError)
        // Don't fail the trade completion if achievement checking fails
      }

      return {
        success: true,
        removedFromWishlist,
        removedFromCollection,
        addedToCollection
      }
    } catch (error) {
      console.error('Error completing trade:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Helper method to remove card from wishlist if it exists
   */
  private async removeFromWishlistIfExists(
    userId: string,
    cardId: string,
    removedList: string[],
    cardName: string
  ): Promise<void> {
    try {
      // Check if card is in wishlist
      const checkResult = await wishlistService.checkCardInWishlist(userId, cardId)
      
      if (checkResult.success && checkResult.inWishlist && checkResult.item) {
        // Remove from wishlist
        const removeResult = await wishlistService.removeFromWishlist(userId, checkResult.item.id)
        
        if (removeResult.success) {
          removedList.push(cardName)
        }
      }
    } catch (error) {
      console.warn('Error removing card from wishlist:', error)
      // Don't fail the entire trade completion if wishlist removal fails
    }
  }

  /**
   * Check if user can complete a trade
   */
  async canCompleteTrade(tradeId: string, userId: string): Promise<{ canComplete: boolean; reason?: string }> {
    try {
      const { data: trade, error } = await supabase
        .from('trades')
        .select('id, initiator_id, recipient_id, status')
        .eq('id', tradeId)
        .single()

      if (error || !trade) {
        return { canComplete: false, reason: 'Trade not found' }
      }

      if (trade.initiator_id !== userId && trade.recipient_id !== userId) {
        return { canComplete: false, reason: 'You are not part of this trade' }
      }

      if (trade.status !== 'accepted') {
        return { canComplete: false, reason: 'Trade must be accepted before completion' }
      }

      return { canComplete: true }
    } catch (error) {
      return { canComplete: false, reason: 'Error checking trade status' }
    }
  }
}

export const tradeCompletionService = new TradeCompletionService()
export default tradeCompletionService