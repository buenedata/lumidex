import { supabase } from './supabase'
import { tradeCompletionService } from './trade-completion-service'
import { tradeService } from './trade-service'

export interface WantedBoardTradeCard {
  id: string
  name: string
  image_small: string
  price?: number
  set_name: string
  quantity: number
  condition: string
}

export interface WantedBoardTradeData {
  initiatorId: string
  recipientId: string
  recipientName: string
  initiatorCards: WantedBoardTradeCard[]
  recipientCards: WantedBoardTradeCard[]
  initiatorMoney: number
  recipientMoney: number
  message: string
  tradeMethod: string
  initiatorShippingIncluded: boolean
  recipientShippingIncluded: boolean
}

class WantedBoardTradeService {
  async createWantedBoardTrade(tradeData: WantedBoardTradeData) {
    try {
      console.log('Creating wanted board trade with data:', tradeData)

      // Create the main trade record using the same structure as the normal trade modal
      // This ensures compatibility with the existing trade completion service
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .insert({
          initiator_id: tradeData.initiatorId,
          recipient_id: tradeData.recipientId,
          status: 'pending',
          initiator_message: tradeData.message,
          initiator_money_offer: tradeData.initiatorMoney,
          recipient_money_offer: tradeData.recipientMoney,
          trade_method: tradeData.tradeMethod,
          initiator_shipping_included: tradeData.initiatorShippingIncluded,
          recipient_shipping_included: tradeData.recipientShippingIncluded,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        })
        .select()
        .single()

      if (tradeError) {
        console.error('Trade creation error:', tradeError)
        throw tradeError
      }

      console.log('Trade created successfully:', trade)

      // Add trade items for initiator's cards
      const initiatorTradeItems = tradeData.initiatorCards.map(card => ({
        trade_id: trade.id,
        user_id: tradeData.initiatorId,
        card_id: card.id,
        quantity: card.quantity,
        condition: card.condition,
        is_foil: false // TODO: Add foil support to wanted board trades
      }))

      // Add trade items for recipient's cards
      const recipientTradeItems = tradeData.recipientCards.map(card => ({
        trade_id: trade.id,
        user_id: tradeData.recipientId,
        card_id: card.id,
        quantity: card.quantity,
        condition: card.condition,
        is_foil: false // TODO: Add foil support to wanted board trades
      }))

      // Insert all trade items
      const allTradeItems = [...initiatorTradeItems, ...recipientTradeItems]
      
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

      // Send notification to recipient about the new trade offer
      await tradeService.sendTradeNotification(
        trade.id,
        tradeData.initiatorId,
        tradeData.recipientId,
        'trade_request',
        `You have received a new trade offer from wanted board!`
      )

      return {
        success: true,
        data: trade,
        message: `Your trade offer has been sent to ${tradeData.recipientName}!`
      }

    } catch (error: any) {
      console.error('Error creating wanted board trade:', error)
      return {
        success: false,
        error: error?.message || 'An unexpected error occurred while creating the trade.'
      }
    }
  }

  /**
   * Complete a wanted board trade - handles all the complex logic for:
   * - Card variant management
   * - Collection updates (add/remove cards)
   * - Wishlist removal
   * - Achievement tracking
   * - Notification sending
   */
  async completeWantedBoardTrade(tradeId: string, userId: string) {
    try {
      // Use the existing trade completion service which handles all the complex logic
      const result = await tradeCompletionService.completeTrade(tradeId, userId)
      
      if (result.success) {
        console.log('Wanted board trade completed successfully:', tradeId)
        return {
          success: true,
          message: 'Trade completed successfully! Cards have been exchanged and achievements updated.'
        }
      } else {
        return {
          success: false,
          error: result.error || 'Failed to complete trade'
        }
      }
    } catch (error: any) {
      console.error('Error completing wanted board trade:', error)
      return {
        success: false,
        error: error?.message || 'An unexpected error occurred while completing the trade.'
      }
    }
  }

  async getUserCardsForWantedBoard(userId: string, wantedCardIds: string[]) {
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
        .eq('user_id', userId)
        .in('card_id', wantedCardIds)
        .gt('quantity', 0)

      if (error) throw error

      // Group cards by card_id and aggregate quantities
      const cardMap = new Map()
      data?.forEach(item => {
        const cardId = item.card_id
        if (!cardMap.has(cardId)) {
          cardMap.set(cardId, {
            ...item,
            totalQuantity: item.quantity,
            variants: [item]
          })
        } else {
          const existing = cardMap.get(cardId)
          existing.totalQuantity += item.quantity
          existing.variants.push(item)
        }
      })

      return {
        success: true,
        data: Array.from(cardMap.values())
      }
    } catch (error: any) {
      console.error('Error loading user cards for wanted board:', error)
      return {
        success: false,
        error: error?.message || 'Failed to load your cards'
      }
    }
  }

  async getRecipientCards(recipientId: string) {
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

      // Group cards by card_id and aggregate quantities
      const cardMap = new Map()
      data?.forEach(item => {
        const cardId = item.card_id
        if (!cardMap.has(cardId)) {
          cardMap.set(cardId, {
            ...item,
            totalQuantity: item.quantity,
            variants: [item]
          })
        } else {
          const existing = cardMap.get(cardId)
          existing.totalQuantity += item.quantity
          existing.variants.push(item)
        }
      })

      return {
        success: true,
        data: Array.from(cardMap.values())
      }
    } catch (error: any) {
      console.error('Error loading recipient cards:', error)
      return {
        success: false,
        error: error?.message || 'Failed to load recipient cards'
      }
    }
  }
}

export const wantedBoardTradeService = new WantedBoardTradeService()