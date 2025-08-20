import { supabase } from './supabase'
import { Card } from '@/types'
import { achievementService } from './achievement-service'

export interface TradeItem {
  id: string
  trade_id: string
  user_id: string
  card_id: string
  quantity: number
  condition: string
  is_foil: boolean
  notes?: string | null
  created_at: string
  card?: Card & {
    sets: {
      name: string
      symbol_url?: string
    }
  }
}

export interface Trade {
  id: string
  initiator_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'
  initiator_message?: string | null
  recipient_message?: string | null
  created_at: string
  updated_at: string
  expires_at: string
  
  // Related data
  initiator?: {
    id: string
    username: string
    display_name?: string | null
    avatar_url?: string | null
  }
  recipient?: {
    id: string
    username: string
    display_name?: string | null
    avatar_url?: string | null
  }
  trade_items?: TradeItem[]
}

export interface TradeProposal {
  recipient_id: string
  message?: string
  offering_cards: Array<{
    card_id: string
    quantity: number
    condition: string
    is_foil?: boolean
    notes?: string
  }>
  requesting_cards: Array<{
    card_id: string
    quantity: number
    condition: string
    is_foil?: boolean
    notes?: string
  }>
}

export interface TradeStats {
  totalTrades: number
  pendingTrades: number
  completedTrades: number
  successRate: number
  recentTrades: Trade[]
}

class TradingService {
  /**
   * Propose a new trade
   */
  async proposeTrade(
    proposerId: string,
    proposal: TradeProposal
  ): Promise<{ success: boolean; error?: string; data?: Trade }> {
    try {
      // Validate that proposer and recipient are friends
      const { data: friendship, error: friendshipError } = await supabase
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`and(requester_id.eq.${proposerId},addressee_id.eq.${proposal.recipient_id}),and(requester_id.eq.${proposal.recipient_id},addressee_id.eq.${proposerId})`)
        .single()

      if (friendshipError || !friendship) {
        return { success: false, error: 'You can only trade with friends' }
      }

      // Validate that proposer owns the cards they're offering
      if (proposal.offering_cards.length > 0) {
        const offeringCardIds = proposal.offering_cards.map(c => c.card_id)
        const { data: ownedCards, error: ownedError } = await supabase
          .from('user_collections')
          .select('card_id, quantity')
          .eq('user_id', proposerId)
          .in('card_id', offeringCardIds)

        if (ownedError) {
          return { success: false, error: ownedError.message }
        }

        // Check if proposer has enough quantity of each card
        const ownedCardMap = new Map(ownedCards?.map(c => [c.card_id, c.quantity]) || [])
        
        for (const offeringCard of proposal.offering_cards) {
          const ownedQuantity = ownedCardMap.get(offeringCard.card_id) || 0
          if (ownedQuantity < offeringCard.quantity) {
            return { success: false, error: `You don't have enough copies of the requested card` }
          }
        }
      }

      // Create the trade
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .insert({
          initiator_id: proposerId,
          recipient_id: proposal.recipient_id,
          status: 'pending',
          initiator_message: proposal.message,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        })
        .select()
        .single()

      if (tradeError) {
        return { success: false, error: tradeError.message }
      }

      // Add trade items
      const tradeItems = [
        ...proposal.offering_cards.map(card => ({
          trade_id: trade.id,
          user_id: proposerId,
          card_id: card.card_id,
          quantity: card.quantity,
          condition: card.condition,
          is_foil: card.is_foil || false,
          notes: card.notes
        })),
        ...proposal.requesting_cards.map(card => ({
          trade_id: trade.id,
          user_id: proposal.recipient_id,
          card_id: card.card_id,
          quantity: card.quantity,
          condition: card.condition,
          is_foil: card.is_foil || false,
          notes: card.notes
        }))
      ]

      if (tradeItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('trade_items')
          .insert(tradeItems)

        if (itemsError) {
          // Rollback trade creation
          await supabase.from('trades').delete().eq('id', trade.id)
          return { success: false, error: itemsError.message }
        }
      }

      // Fetch the complete trade data
      const completeTradeResult = await this.getTradeById(trade.id)
      if (completeTradeResult.success && completeTradeResult.data) {
        return { success: true, data: completeTradeResult.data }
      }

      return { success: true, data: trade }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get trade by ID with all related data
   */
  async getTradeById(tradeId: string): Promise<{ success: boolean; error?: string; data?: Trade }> {
    try {
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select(`
          *,
          initiator:profiles!trades_initiator_id_fkey(id, username, display_name, avatar_url),
          recipient:profiles!trades_recipient_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('id', tradeId)
        .single()

      if (tradeError) {
        return { success: false, error: tradeError.message }
      }

      // Get trade items
      const { data: tradeItems, error: itemsError } = await supabase
        .from('trade_items')
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
            sets!inner(name, symbol_url)
          )
        `)
        .eq('trade_id', tradeId)

      if (itemsError) {
        return { success: false, error: itemsError.message }
      }

      const completeTradeData: Trade = {
        ...trade,
        trade_items: tradeItems || []
      }

      return { success: true, data: completeTradeData }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get trades for a user (both sent and received)
   */
  async getUserTrades(
    userId: string,
    options: {
      status?: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'
      type?: 'sent' | 'received' | 'all'
      limit?: number
      page?: number
    } = {}
  ): Promise<{ success: boolean; error?: string; data?: Trade[]; total?: number }> {
    try {
      const { status, type = 'all', limit = 50, page = 1 } = options

      let query = supabase
        .from('trades')
        .select(`
          *,
          initiator:profiles!trades_initiator_id_fkey(id, username, display_name, avatar_url),
          recipient:profiles!trades_recipient_id_fkey(id, username, display_name, avatar_url)
        `)

      // Filter by user involvement
      if (type === 'sent') {
        query = query.eq('initiator_id', userId)
      } else if (type === 'received') {
        query = query.eq('recipient_id', userId)
      } else {
        query = query.or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
      }

      // Filter by status
      if (status) {
        query = query.eq('status', status)
      }

      // Apply pagination and ordering
      const from = (page - 1) * limit
      query = query
        .order('created_at', { ascending: false })
        .range(from, from + limit - 1)

      const { data: trades, error: tradesError } = await query

      if (tradesError) {
        return { success: false, error: tradesError.message }
      }

      // Get trade items for each trade
      const tradesWithItems: Trade[] = []
      
      for (const trade of trades || []) {
        const { data: tradeItems, error: itemsError } = await supabase
          .from('trade_items')
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
              sets!inner(name, symbol_url)
            )
          `)
          .eq('trade_id', trade.id)

        if (itemsError) {
          console.error('Error fetching trade items:', itemsError)
          continue
        }

        tradesWithItems.push({
          ...trade,
          trade_items: tradeItems || []
        })
      }

      return { success: true, data: tradesWithItems, total: tradesWithItems.length }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Respond to a trade (accept or decline)
   */
  async respondToTrade(
    tradeId: string,
    userId: string,
    response: 'accepted' | 'declined'
  ): Promise<{ success: boolean; error?: string; data?: Trade }> {
    try {
      // Verify user is the recipient
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('recipient_id', userId)
        .eq('status', 'pending')
        .single()

      if (tradeError || !trade) {
        return { success: false, error: 'Trade not found or you are not authorized to respond' }
      }

      // Update trade status
      const { data: updatedTrade, error: updateError } = await supabase
        .from('trades')
        .update({
          status: response,
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId)
        .select()
        .single()

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // If accepted, we need to execute the trade (transfer cards)
      if (response === 'accepted') {
        const executeResult = await this.executeTrade(tradeId)
        if (!executeResult.success) {
          // Rollback the acceptance
          await supabase
            .from('trades')
            .update({ status: 'pending' })
            .eq('id', tradeId)
          
          return { success: false, error: executeResult.error }
        }
      }

      // Get complete trade data
      const completeTradeResult = await this.getTradeById(tradeId)
      if (completeTradeResult.success && completeTradeResult.data) {
        return { success: true, data: completeTradeResult.data }
      }

      return { success: true, data: updatedTrade }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Execute a trade (transfer cards between users)
   */
  private async executeTrade(tradeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get trade details
      const tradeResult = await this.getTradeById(tradeId)
      if (!tradeResult.success || !tradeResult.data) {
        return { success: false, error: 'Trade not found' }
      }

      const trade = tradeResult.data

      // Group items by user (initiator vs recipient items)
      const initiatorItems = trade.trade_items?.filter(ti => ti.user_id === trade.initiator_id) || []
      const recipientItems = trade.trade_items?.filter(ti => ti.user_id === trade.recipient_id) || []

      // Transfer items from initiator to recipient
      for (const item of initiatorItems) {
        // Remove from initiator's collection
        const { data: currentCollection, error: fetchError } = await supabase
          .from('user_collections')
          .select('quantity')
          .eq('user_id', trade.initiator_id)
          .eq('card_id', item.card_id)
          .single()

        if (fetchError || !currentCollection) {
          return { success: false, error: `Card not found in initiator's collection` }
        }

        if (currentCollection.quantity < item.quantity) {
          return { success: false, error: `Insufficient quantity in initiator's collection` }
        }

        // Update or delete from initiator's collection
        if (currentCollection.quantity === item.quantity) {
          const { error: deleteError } = await supabase
            .from('user_collections')
            .delete()
            .eq('user_id', trade.initiator_id)
            .eq('card_id', item.card_id)

          if (deleteError) {
            return { success: false, error: `Failed to remove card from initiator: ${deleteError.message}` }
          }
        } else {
          const { error: updateError } = await supabase
            .from('user_collections')
            .update({ quantity: currentCollection.quantity - item.quantity })
            .eq('user_id', trade.initiator_id)
            .eq('card_id', item.card_id)

          if (updateError) {
            return { success: false, error: `Failed to update initiator's collection: ${updateError.message}` }
          }
        }

        // Add to recipient's collection
        const { error: upsertError } = await supabase
          .from('user_collections')
          .upsert({
            user_id: trade.recipient_id,
            card_id: item.card_id,
            quantity: item.quantity,
            condition: item.condition as any,
            is_foil: item.is_foil
          }, {
            onConflict: 'user_id,card_id,condition,is_foil'
          })

        if (upsertError) {
          return { success: false, error: `Failed to add card to recipient: ${upsertError.message}` }
        }
      }

      // Transfer items from recipient to initiator
      for (const item of recipientItems) {
        // Remove from recipient's collection
        const { data: currentCollection, error: fetchError } = await supabase
          .from('user_collections')
          .select('quantity')
          .eq('user_id', trade.recipient_id)
          .eq('card_id', item.card_id)
          .single()

        if (fetchError || !currentCollection) {
          return { success: false, error: `Card not found in recipient's collection` }
        }

        if (currentCollection.quantity < item.quantity) {
          return { success: false, error: `Insufficient quantity in recipient's collection` }
        }

        // Update or delete from recipient's collection
        if (currentCollection.quantity === item.quantity) {
          const { error: deleteError } = await supabase
            .from('user_collections')
            .delete()
            .eq('user_id', trade.recipient_id)
            .eq('card_id', item.card_id)

          if (deleteError) {
            return { success: false, error: `Failed to remove card from recipient: ${deleteError.message}` }
          }
        } else {
          const { error: updateError } = await supabase
            .from('user_collections')
            .update({ quantity: currentCollection.quantity - item.quantity })
            .eq('user_id', trade.recipient_id)
            .eq('card_id', item.card_id)

          if (updateError) {
            return { success: false, error: `Failed to update recipient's collection: ${updateError.message}` }
          }
        }

        // Add to initiator's collection
        const { error: upsertError } = await supabase
          .from('user_collections')
          .upsert({
            user_id: trade.initiator_id,
            card_id: item.card_id,
            quantity: item.quantity,
            condition: item.condition as any,
            is_foil: item.is_foil
          }, {
            onConflict: 'user_id,card_id,condition,is_foil'
          })

        if (upsertError) {
          return { success: false, error: `Failed to add card to initiator: ${upsertError.message}` }
        }
      }

      // Mark trade as completed
      const { error: completeError } = await supabase
        .from('trades')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId)

      if (completeError) {
        return { success: false, error: completeError.message }
      }

      // Check achievements for both users after trade completion
      try {
        await Promise.all([
          achievementService.checkAchievements(trade.initiator_id),
          achievementService.checkAchievements(trade.recipient_id)
        ])
      } catch (achievementError) {
        console.warn('Failed to check achievements after trade execution:', achievementError)
        // Don't fail the trade completion if achievement checking fails
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
   * Cancel a trade (only by initiator, only if pending)
   */
  async cancelTrade(
    tradeId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; data?: Trade }> {
    try {
      // Verify user is the initiator and trade is pending
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('initiator_id', userId)
        .eq('status', 'pending')
        .single()

      if (tradeError || !trade) {
        return { success: false, error: 'Trade not found or you are not authorized to cancel' }
      }

      // Update trade status
      const { data: updatedTrade, error: updateError } = await supabase
        .from('trades')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', tradeId)
        .select()
        .single()

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Get complete trade data
      const completeTradeResult = await this.getTradeById(tradeId)
      if (completeTradeResult.success && completeTradeResult.data) {
        return { success: true, data: completeTradeResult.data }
      }

      return { success: true, data: updatedTrade }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get trading statistics for a user
   */
  async getTradingStats(userId: string): Promise<{ success: boolean; error?: string; data?: TradeStats }> {
    try {
      // Get all trades for user
      const { data: allTrades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)

      if (tradesError) {
        return { success: false, error: tradesError.message }
      }

      const trades = allTrades || []
      const totalTrades = trades.length
      const pendingTrades = trades.filter(t => t.status === 'pending').length
      const completedTrades = trades.filter(t => t.status === 'completed').length
      const successRate = totalTrades > 0 ? (completedTrades / totalTrades) * 100 : 0

      // Get recent trades with full data
      const recentTradesResult = await this.getUserTrades(userId, { limit: 5 })
      const recentTrades = recentTradesResult.success ? recentTradesResult.data || [] : []

      return {
        success: true,
        data: {
          totalTrades,
          pendingTrades,
          completedTrades,
          successRate,
          recentTrades
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

export const tradingService = new TradingService()
export default tradingService