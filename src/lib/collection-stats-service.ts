import { supabase } from './supabase'
import { calculateCardVariantValue } from './variant-pricing'

export interface CollectionStats {
  totalCards: number
  uniqueCards: number
  totalValueEur: number
  averageCardValue: number
  setsWithCards: number
  totalSets: number
  completionPercentage: number
  rarityBreakdown: {
    [rarity: string]: {
      count: number
      percentage: number
      totalValue: number
    }
  }
  setProgress: SetProgress[]
  recentAdditions: RecentCard[]
  topValueCards: ValueCard[]
  collectionGrowth: GrowthData[]
}

export interface SetProgress {
  setId: string
  setName: string
  totalCards: number
  ownedCards: number
  completionPercentage: number
  totalValue: number
  missingCards: number
  setSymbolUrl?: string
  releaseDate: string
}

export interface RecentCard {
  cardId: string
  cardName: string
  setId: string
  setName: string
  imageSmall: string
  addedAt: string
  quantity: number
  estimatedValue: number
  rarity: string
}

export interface ValueCard {
  cardId: string
  cardName: string
  setId: string
  setName: string
  imageSmall: string
  quantity: number
  unitValue: number
  totalValue: number
  rarity: string
}

export interface GrowthData {
  date: string
  totalCards: number
  uniqueCards: number
  totalValue: number
}

export interface CollectionComparison {
  user: {
    id: string
    username: string
    displayName?: string | null
  }
  stats: CollectionStats
  commonSets: string[]
  sharedCards: number
  uniqueToUser: number
  uniqueToOther: number
}

class CollectionStatsService {
  /**
   * Get comprehensive collection statistics for a user
   */
  async getCollectionStats(userId: string): Promise<{ success: boolean; error?: string; data?: CollectionStats }> {
    try {
      // Get user's collection with card details including variant information
      const { data: userCollection, error: collectionError } = await supabase
        .from('user_collections')
        .select(`
          quantity,
          variant,
          created_at,
          cards!inner(
            id,
            name,
            set_id,
            rarity,
            image_small,
            cardmarket_avg_sell_price,
            cardmarket_low_price,
            cardmarket_trend_price,
            cardmarket_reverse_holo_sell,
            cardmarket_reverse_holo_low,
            cardmarket_reverse_holo_trend,
            sets!inner(
              id,
              name,
              total_cards,
              symbol_url,
              release_date
            )
          )
        `)
        .eq('user_id', userId)

      if (collectionError) {
        return { success: false, error: collectionError.message }
      }

      const collection = userCollection || []

      // Group collection items by card to calculate variant-specific pricing
      const cardGroups = collection.reduce((acc, item) => {
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
      }, {} as Record<string, { card: any; variants: any }>)

      // Calculate basic stats using variant-specific pricing
      const totalCards = collection.reduce((sum, item) => sum + item.quantity, 0)
      const uniqueCards = Object.keys(cardGroups).length
      const totalValueEur = Object.values(cardGroups).reduce((sum, { card, variants }) => {
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
      const averageCardValue = uniqueCards > 0 ? totalValueEur / totalCards : 0

      // Get all sets to calculate completion
      const { data: allSets, error: setsError } = await supabase
        .from('sets')
        .select('id, name, total_cards, symbol_url, release_date')

      if (setsError) {
        return { success: false, error: setsError.message }
      }

      const totalSets = allSets?.length || 0
      const userSets = new Set(collection.map(item => {
        const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
        const sets = Array.isArray(card?.sets) ? card?.sets[0] : card?.sets
        return sets?.id
      }).filter(Boolean))
      const setsWithCards = userSets.size
      const completionPercentage = totalSets > 0 ? (setsWithCards / totalSets) * 100 : 0

      // Calculate rarity breakdown using variant-specific pricing
      const rarityBreakdown: { [rarity: string]: { count: number; percentage: number; totalValue: number } } = {}
      
      Object.values(cardGroups).forEach(({ card, variants }) => {
        const rarity = card.rarity || 'Unknown'
        if (!rarityBreakdown[rarity]) {
          rarityBreakdown[rarity] = { count: 0, percentage: 0, totalValue: 0 }
        }
        
        const totalQuantity = Object.values(variants).reduce((sum: number, qty) => sum + (qty as number), 0)
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
        
        rarityBreakdown[rarity].count += totalQuantity
        rarityBreakdown[rarity].totalValue += cardValue
      })

      // Calculate percentages for rarity breakdown
      Object.keys(rarityBreakdown).forEach(rarity => {
        rarityBreakdown[rarity].percentage = totalCards > 0 ? (rarityBreakdown[rarity].count / totalCards) * 100 : 0
      })

      // Calculate set progress
      const setProgress = await this.calculateSetProgress(userId, allSets || [])

      // Get recent additions (last 10) - using individual collection items with variant pricing
      const recentAdditions = collection
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map(item => {
          const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
          const sets = Array.isArray(card?.sets) ? card?.sets[0] : card?.sets
          const variant = (item as any).variant || 'normal'
          const variantQuantities = {
            normal: variant === 'normal' ? item.quantity : 0,
            holo: variant === 'holo' ? item.quantity : 0,
            reverseHolo: variant === 'reverse_holo' ? item.quantity : 0,
            pokeballPattern: variant === 'pokeball_pattern' ? item.quantity : 0,
            masterballPattern: variant === 'masterball_pattern' ? item.quantity : 0,
            firstEdition: variant === '1st_edition' ? item.quantity : 0,
          }
          const estimatedValue = calculateCardVariantValue(
            {
              cardmarket_avg_sell_price: card?.cardmarket_avg_sell_price,
              cardmarket_low_price: card?.cardmarket_low_price,
              cardmarket_trend_price: card?.cardmarket_trend_price,
              cardmarket_reverse_holo_sell: card?.cardmarket_reverse_holo_sell,
              cardmarket_reverse_holo_low: card?.cardmarket_reverse_holo_low,
              cardmarket_reverse_holo_trend: card?.cardmarket_reverse_holo_trend,
            },
            variantQuantities
          ) / item.quantity // Get per-card value
          
          return {
            cardId: card?.id || '',
            cardName: card?.name || '',
            setId: card?.set_id || '',
            setName: sets?.name || '',
            imageSmall: card?.image_small || '',
            addedAt: item.created_at,
            quantity: item.quantity,
            estimatedValue,
            rarity: card?.rarity || ''
          }
        })

      // Get top value cards using variant-specific pricing
      const topValueCards = Object.values(cardGroups)
        .map(({ card, variants }) => {
          const totalQuantity = Object.values(variants).reduce((sum: number, qty) => sum + (qty as number), 0)
          const totalValue = calculateCardVariantValue(
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
          
          return {
            cardId: card.id,
            cardName: card.name,
            setId: card.set_id,
            setName: card.sets.name,
            imageSmall: card.image_small,
            quantity: totalQuantity as number,
            unitValue: (totalQuantity as number) > 0 ? totalValue / (totalQuantity as number) : 0,
            totalValue,
            rarity: card.rarity
          }
        })
        .sort((a, b) => b.unitValue - a.unitValue)
        .slice(0, 10)

      // Calculate collection growth (simplified - would need historical data for real implementation)
      const collectionGrowth = await this.calculateCollectionGrowth(userId)

      const stats: CollectionStats = {
        totalCards,
        uniqueCards,
        totalValueEur,
        averageCardValue,
        setsWithCards,
        totalSets,
        completionPercentage,
        rarityBreakdown,
        setProgress,
        recentAdditions,
        topValueCards,
        collectionGrowth
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
   * Calculate progress for each set - optimized to avoid N+1 queries
   */
  private async calculateSetProgress(userId: string, allSets: any[]): Promise<SetProgress[]> {
    // Get all user's cards in one query with DISTINCT to ensure unique cards only
    const { data: userCards, error } = await supabase
      .from('user_collections')
      .select(`
        quantity,
        cards!inner(
          id,
          set_id,
          cardmarket_avg_sell_price
        )
      `)
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching user cards:', error)
      return []
    }

    // Group cards by set, ensuring we only count unique cards (by card ID)
    const cardsBySet = new Map<string, Map<string, { quantity: number; price: number }>>()
    
    userCards?.forEach(item => {
      const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
      const setId = card?.set_id
      const cardId = card?.id
      
      if (setId && cardId && !cardsBySet.has(setId)) {
        cardsBySet.set(setId, new Map())
      }
      
      // Only store one entry per unique card ID (prevents duplicates)
      if (setId && cardId) {
        cardsBySet.get(setId)!.set(cardId, {
          quantity: item.quantity,
          price: card?.cardmarket_avg_sell_price || 0
        })
      }
    })

    // Calculate progress for each set
    const setProgress: SetProgress[] = allSets.map(set => {
      const userCardsInSet = cardsBySet.get(set.id) || new Map()
      const ownedCards = userCardsInSet.size // Count unique cards only
      const totalValue = Array.from(userCardsInSet.values()).reduce((sum, card) => {
        return sum + (card.quantity * card.price)
      }, 0)

      return {
        setId: set.id,
        setName: set.name,
        totalCards: set.total_cards,
        ownedCards,
        completionPercentage: set.total_cards > 0 ? (ownedCards / set.total_cards) * 100 : 0,
        totalValue,
        missingCards: set.total_cards - ownedCards,
        setSymbolUrl: set.symbol_url,
        releaseDate: set.release_date
      }
    })

    return setProgress.sort((a, b) => b.completionPercentage - a.completionPercentage)
  }

  /**
   * Calculate collection growth over time (simplified version)
   */
  private async calculateCollectionGrowth(userId: string): Promise<GrowthData[]> {
    try {
      // Get collection data grouped by month (simplified)
      const { data: collectionHistory, error } = await supabase
        .from('user_collections')
        .select(`
          created_at,
          quantity,
          cards!inner(
            cardmarket_avg_sell_price
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error || !collectionHistory) {
        return []
      }

      // Group by month and calculate cumulative stats
      const monthlyData = new Map<string, { totalCards: number; uniqueCards: number; totalValue: number }>()
      let cumulativeCards = 0
      let cumulativeUnique = 0
      let cumulativeValue = 0

      collectionHistory.forEach(item => {
        const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
        const month = new Date(item.created_at).toISOString().substring(0, 7) // YYYY-MM
        
        cumulativeCards += item.quantity
        cumulativeUnique += 1
        cumulativeValue += item.quantity * (card?.cardmarket_avg_sell_price || 0)

        monthlyData.set(month, {
          totalCards: cumulativeCards,
          uniqueCards: cumulativeUnique,
          totalValue: cumulativeValue
        })
      })

      // Convert to array format
      return Array.from(monthlyData.entries()).map(([date, stats]) => ({
        date,
        ...stats
      }))
    } catch (error) {
      console.error('Error calculating collection growth:', error)
      return []
    }
  }

  /**
   * Get set completion statistics
   */
  async getSetCompletionStats(userId: string, setId?: string): Promise<{ success: boolean; error?: string; data?: SetProgress[] }> {
    try {
      let setsQuery = supabase
        .from('sets')
        .select('id, name, total_cards, symbol_url, release_date')

      if (setId) {
        setsQuery = setsQuery.eq('id', setId)
      }

      const { data: sets, error: setsError } = await setsQuery

      if (setsError) {
        return { success: false, error: setsError.message }
      }

      const setProgress = await this.calculateSetProgress(userId, sets || [])
      return { success: true, data: setProgress }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Compare collections between two users
   */
  async compareCollections(
    userId1: string, 
    userId2: string
  ): Promise<{ success: boolean; error?: string; data?: { user1: CollectionComparison; user2: CollectionComparison } }> {
    try {
      // Get both users' stats
      const [stats1Result, stats2Result] = await Promise.all([
        this.getCollectionStats(userId1),
        this.getCollectionStats(userId2)
      ])

      if (!stats1Result.success || !stats2Result.success) {
        return { success: false, error: 'Failed to get collection stats' }
      }

      // Get user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', [userId1, userId2])

      if (profilesError) {
        return { success: false, error: profilesError.message }
      }

      const user1Profile = profiles?.find(p => p.id === userId1)
      const user2Profile = profiles?.find(p => p.id === userId2)

      if (!user1Profile || !user2Profile) {
        return { success: false, error: 'User profiles not found' }
      }

      // Get collections for comparison
      const [collection1, collection2] = await Promise.all([
        this.getUserCardIds(userId1),
        this.getUserCardIds(userId2)
      ])

      // Calculate shared and unique cards
      const cards1 = new Set(collection1)
      const cards2 = new Set(collection2)
      const cards1Array = Array.from(cards1)
      const cards2Array = Array.from(cards2)
      const sharedCards = new Set(cards1Array.filter(x => cards2.has(x)))
      const uniqueToUser1 = new Set(cards1Array.filter(x => !cards2.has(x)))
      const uniqueToUser2 = new Set(cards2Array.filter(x => !cards1.has(x)))

      // Calculate common sets
      const sets1 = new Set(stats1Result.data!.setProgress.filter(s => s.ownedCards > 0).map(s => s.setId))
      const sets2 = new Set(stats2Result.data!.setProgress.filter(s => s.ownedCards > 0).map(s => s.setId))
      const sets1Array = Array.from(sets1)
      const commonSets = sets1Array.filter(x => sets2.has(x))

      const comparison = {
        user1: {
          user: {
            id: user1Profile.id,
            username: user1Profile.username,
            displayName: user1Profile.display_name
          },
          stats: stats1Result.data!,
          commonSets,
          sharedCards: sharedCards.size,
          uniqueToUser: uniqueToUser1.size,
          uniqueToOther: uniqueToUser2.size
        },
        user2: {
          user: {
            id: user2Profile.id,
            username: user2Profile.username,
            displayName: user2Profile.display_name
          },
          stats: stats2Result.data!,
          commonSets,
          sharedCards: sharedCards.size,
          uniqueToUser: uniqueToUser2.size,
          uniqueToOther: uniqueToUser1.size
        }
      }

      return { success: true, data: comparison }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get user's card IDs for comparison
   */
  private async getUserCardIds(userId: string): Promise<string[]> {
    const { data: collection, error } = await supabase
      .from('user_collections')
      .select('cards!inner(id)')
      .eq('user_id', userId)

    if (error || !collection) {
      return []
    }

    return collection.map(item => {
      const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
      return card?.id
    }).filter(Boolean) as string[]
  }

  /**
   * Get collection value history
   */
  async getCollectionValueHistory(
    userId: string,
    days: number = 30
  ): Promise<{ success: boolean; error?: string; data?: Array<{ date: string; value: number }> }> {
    try {
      // This would require historical pricing data
      // For now, return current value as a single point
      const statsResult = await this.getCollectionStats(userId)
      if (!statsResult.success || !statsResult.data) {
        return { success: false, error: 'Failed to get collection stats' }
      }

      const currentValue = statsResult.data.totalValueEur
      const today = new Date().toISOString().split('T')[0]

      return {
        success: true,
        data: [{ date: today, value: currentValue }]
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get collection insights and recommendations
   */
  async getCollectionInsights(userId: string): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      const statsResult = await this.getCollectionStats(userId)
      if (!statsResult.success || !statsResult.data) {
        return { success: false, error: 'Failed to get collection stats' }
      }

      const stats = statsResult.data
      const insights = []

      // Value insights
      if (stats.totalValueEur > 500) {
        insights.push({
          type: 'value',
          title: 'Valuable Collection',
          description: `Your collection is worth €${stats.totalValueEur.toFixed(2)}! Consider getting insurance for high-value cards.`,
          icon: '💎'
        })
      }

      // Completion insights
      const nearCompleteSet = stats.setProgress.find(set => set.completionPercentage > 80 && set.completionPercentage < 100)
      if (nearCompleteSet) {
        insights.push({
          type: 'completion',
          title: 'Almost Complete!',
          description: `You're ${nearCompleteSet.completionPercentage.toFixed(1)}% done with ${nearCompleteSet.setName}. Only ${nearCompleteSet.missingCards} cards to go!`,
          icon: '🎯'
        })
      }

      // Rarity insights
      const rareCards = Object.entries(stats.rarityBreakdown)
        .filter(([rarity]) => ['rare', 'ultra rare', 'secret rare'].includes(rarity.toLowerCase()))
        .reduce((sum, [, data]) => sum + data.count, 0)

      if (rareCards > 10) {
        insights.push({
          type: 'rarity',
          title: 'Rare Card Collector',
          description: `You have ${rareCards} rare or higher cards! You're building an impressive collection.`,
          icon: '⭐'
        })
      }

      return { success: true, data: insights }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}

export const collectionStatsService = new CollectionStatsService()
export default collectionStatsService