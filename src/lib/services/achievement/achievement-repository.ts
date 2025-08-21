/**
 * Achievement Repository - Data access layer for achievements
 * 
 * Handles all database operations for achievements while preserving
 * ALL functionality from the original service.
 */

import { createClient } from '@supabase/supabase-js'
import { calculateCardVariantValue } from '@/lib/variant-pricing'

export interface Achievement {
  id: string
  user_id: string
  achievement_type: string
  achievement_data: any
  unlocked_at: string
  created_at: string
}

export class AchievementRepository {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  /**
   * Get user's unlocked achievements
   * PRESERVES ALL ORIGINAL FUNCTIONALITY
   */
  async getUserAchievements(userId: string): Promise<{ success: boolean; error?: string; data?: Achievement[] }> {
    try {
      const { data: achievements, error } = await this.supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: (achievements || []) as unknown as Achievement[] }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Unlock achievement for user
   * PRESERVES ALL ORIGINAL FUNCTIONALITY
   */
  async unlockAchievement(
    userId: string, 
    achievementType: string, 
    achievementData: any
  ): Promise<{ success: boolean; error?: string; data?: Achievement }> {
    try {
      // Use RPC to bypass RLS (preserves original behavior)
      const { data: achievement, error: unlockError } = await (this.supabase as any)
        .rpc('unlock_user_achievement', {
          p_user_id: userId,
          p_achievement_type: achievementType,
          p_achievement_data: achievementData
        })

      if (unlockError) {
        console.error('Failed to unlock achievement via RPC:', unlockError)
        return { success: false, error: unlockError.message }
      }

      if (achievement && achievement.length > 0) {
        // The RPC returns an array, get the first (and only) result
        return { success: true, data: achievement[0] }
      }

      return { success: false, error: 'Failed to unlock achievement' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Revoke achievement from user (for achievements that are no longer valid)
   * PRESERVES ALL ORIGINAL FUNCTIONALITY
   */
  async revokeAchievement(
    userId: string, 
    achievementType: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Attempting to revoke achievement: ${achievementType} for user: ${userId}`)
      
      // First, let's see what records exist
      const { data: existingRecords, error: findError } = await this.supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .eq('achievement_type', achievementType)
      
      console.log(`Found ${existingRecords?.length || 0} existing records for ${achievementType}:`, existingRecords)
      
      if (findError) {
        console.error('Error finding achievement records:', findError)
        return { success: false, error: findError.message }
      }
      
      if (existingRecords && existingRecords.length > 0) {
        // Use service role to bypass RLS for deletion
        const { error: revokeError } = await (this.supabase as any)
          .rpc('delete_user_achievement', {
            p_user_id: userId,
            p_achievement_type: achievementType
          })

        if (revokeError) {
          console.error('Failed to revoke achievement:', revokeError)
          // Fallback to direct deletion if RPC fails
          const { error: directError } = await this.supabase
            .from('user_achievements')
            .delete()
            .eq('user_id', userId)
            .eq('achievement_type', achievementType)
          
          if (directError) {
            console.error('Direct deletion also failed:', directError)
            return { success: false, error: directError.message }
          }
        }

        console.log(`Successfully revoked achievement: ${achievementType}`)
        return { success: true }
      } else {
        console.log(`No records found to delete for achievement: ${achievementType}`)
        return { success: true }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get user statistics for achievement checking
   * PRESERVES ALL ORIGINAL FUNCTIONALITY AND CALCULATIONS
   */
  async getUserStats(userId: string): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      // Get collection stats with available card information
      const { data: userCollections, error: collectionError } = await this.supabase
        .from('user_collections')
        .select(`
          quantity,
          variant,
          cards!inner(
            id,
            name,
            rarity,
            cardmarket_avg_sell_price,
            cardmarket_low_price,
            cardmarket_trend_price,
            cardmarket_reverse_holo_sell,
            cardmarket_reverse_holo_low,
            cardmarket_reverse_holo_trend
          )
        `)
        .eq('user_id', userId)

      if (collectionError) {
        return { success: false, error: collectionError.message }
      }

      // Group collection items by card to calculate variant-specific pricing
      const cardGroups = userCollections?.reduce((acc, item) => {
        // Handle the case where cards might be an array (fix Supabase type issue)
        const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
        const cardId = card?.id
        if (!acc[cardId]) {
          acc[cardId] = {
            card: card,
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
      }, {} as Record<string, { card: any; variants: any }>) || {}

      const totalCards = userCollections?.reduce((sum, item) => sum + (item.quantity as number), 0) || 0
      const uniqueCards = Object.keys(cardGroups).length
      const totalValueEur = Object.values(cardGroups).reduce((sum, { card, variants }): number => {
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

      // Get friends count - fix the query structure
      const { data: friendships, error: friendsError } = await this.supabase
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

      if (friendsError) {
        console.error('Error fetching friendships:', friendsError)
        return { success: false, error: friendsError.message }
      }

      const friendsCount = friendships?.length || 0
      console.log(`Friends query result: ${friendsCount} friends found for user ${userId}`)

      // Get trading stats - fix the query structure
      const { data: trades, error: tradesError } = await this.supabase
        .from('trades')
        .select('*')
        .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)

      if (tradesError) {
        console.error('Error fetching trades:', tradesError)
        return { success: false, error: tradesError.message }
      }

      const allTrades = trades || []
      const completedTrades = allTrades.filter(t => t.status === 'completed')
      console.log(`Trades query result: ${allTrades.length} total trades, ${completedTrades.length} completed for user ${userId}`)
      
      // Debug: Log all trade statuses
      if (allTrades.length > 0) {
        const statusCounts = allTrades.reduce((acc, trade) => {
          const status = trade.status as string
          acc[status] = (acc[status] as number || 0) + 1
          return acc
        }, {} as Record<string, number>)
        console.log('Trade status breakdown:', statusCounts)
      }

      // Calculate themed achievement stats based on available card data
      const cardDetails = userCollections?.map(item => {
        const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
        return {
          name: card?.name || '',
          rarity: card?.rarity || '',
          variant: (item as any).variant || 'normal',
          quantity: item.quantity
        }
      }) || []

      // Get rare cards count
      const rareCardCount = userCollections?.filter((item: any) => {
        const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
        return ['rare', 'ultra rare', 'secret rare', 'rainbow rare'].includes(card?.rarity?.toLowerCase() || '')
      }).length || 0

      // Pokémon-specific counts (basic name matching)
      const pikachuCards = cardDetails.filter(card =>
        card.name.toLowerCase().includes('pikachu')
      ).length

      const charizardCards = cardDetails.filter(card =>
        card.name.toLowerCase().includes('charizard')
      ).length

      // Eeveelution check (simplified - just check for different eeveelution names)
      const eeveelutions = ['eevee', 'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon']
      const eeveelutionCards = eeveelutions.filter(evo =>
        cardDetails.some(card => card.name.toLowerCase().includes(evo))
      )
      const eeveelutionComplete = eeveelutionCards.length >= 9

      // Rarity and variant counts
      const holoCards = cardDetails.filter(card =>
        card.variant === 'holo' || card.rarity.toLowerCase().includes('holo')
      ).length

      const firstEditionCards = cardDetails.filter(card =>
        card.variant === '1st_edition'
      ).length

      const secretRareCards = cardDetails.filter(card =>
        card.rarity.toLowerCase().includes('secret')
      ).length

      const promoCards = cardDetails.filter(card =>
        card.name.toLowerCase().includes('promo')
      ).length

      // Exact number checks
      const exactCards = totalCards
      const exactUniqueCards = uniqueCards

      // Get streak data (with error handling)
      let streakData: any = null
      try {
        const result = await (this.supabase as any).rpc('get_user_streak_stats', { p_user_id: userId })
        if (!result.error) {
          streakData = result.data
        } else {
          console.error('Error fetching streak data:', result.error)
        }
      } catch (error) {
        console.error('Error calling get_user_streak_stats:', error)
      }

      // Get daily activity data (with error handling)
      let activityData: any = null
      try {
        const result = await (this.supabase as any).rpc('get_user_daily_activity_stats', {
          p_user_id: userId,
          p_days_back: 30
        })
        if (!result.error) {
          activityData = result.data
        } else {
          console.error('Error fetching activity data:', result.error)
        }
      } catch (error) {
        console.error('Error calling get_user_daily_activity_stats:', error)
      }

      // Extract streak values (with safe access)
      const streaks = streakData || {}
      const loginStreak = (streaks as any)?.login?.current || 0
      const collectionStreak = (streaks as any)?.collection_add?.current || 0
      const tradeStreak = (streaks as any)?.trade?.current || 0

      // Extract activity values (with safe access)
      const activity = activityData || {}
      const activeDays30 = (activity as any)?.total_active_days || 0
      const activityTotals = (activity as any)?.activity_totals || {}
      const dailyCardsAdded = (activityTotals as any)?.cards_added || 0
      const dailyTradesCompleted = (activityTotals as any)?.trades_completed || 0

      // Get user profile for early adopter check
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('created_at')
        .eq('id', userId)
        .single()

      if (profileError) {
        return { success: false, error: profileError.message }
      }

      const isEarlyAdopter = profile && new Date(profile.created_at as string) < new Date('2024-02-01')

      const stats = {
        // Basic counts
        unique_cards: uniqueCards,
        total_cards: totalCards,
        collection_value_eur: totalValueEur,
        friends: friendsCount,
        completed_trades: completedTrades.length,
        rare_cards: rareCardCount,
        early_adopter: isEarlyAdopter,

        // Pokémon-specific
        pikachu_cards: pikachuCards,
        charizard_cards: charizardCards,
        eeveelution_complete: eeveelutionComplete,

        // Rarity and variants
        holo_cards: holoCards,
        first_edition_cards: firstEditionCards,
        secret_rare_cards: secretRareCards,

        // Special cards
        promo_cards: promoCards,

        // Exact number achievements
        exact_cards: exactCards,
        exact_unique_cards: exactUniqueCards,

        // Streak and daily activity data
        login_streak: loginStreak,
        collection_streak: collectionStreak,
        trade_streak: tradeStreak,
        active_days_30: activeDays30,
        daily_cards_added: dailyCardsAdded,
        daily_trades_completed: dailyTradesCompleted,

        // Placeholder for achievements that need more complex logic or database schema updates
        fire_type_cards: 0, // Would need type information
        water_type_cards: 0, // Would need type information
        electric_type_cards: 0, // Would need type information
        all_types_collected: false, // Would need type information
        gen1_cards: 0, // Would need generation information
        gen2_cards: 0, // Would need generation information
        modern_sets: 0, // Would need set information
        vintage_sets: 0, // Would need set information
        classic_sets_complete: false, // Would need set information
        legendary_pokemon: 0, // Would need legendary Pokémon identification
        shiny_cards: 0, // Would need shiny card identification
        starter_generations: 0, // Would need starter Pokémon identification
        full_art_cards: 0, // Would need full art identification
        alt_art_cards: 0, // Would need alternate art identification
        shadowless_cards: 0, // Would need shadowless identification
        holiday_cards: 0, // Would need holiday card identification
        completed_sets: 0 // Would need set completion logic
      }

      return { success: true, data: stats }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}