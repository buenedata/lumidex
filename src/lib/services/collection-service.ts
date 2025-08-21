import { CollectionRepository, CreateCollectionEntryInput, UpdateCollectionEntryInput, UserCollectionWithCard } from '@/lib/repositories/collection-repository'
import type { 
  UserCollectionEntry,
  CollectionStats,
  CollectionFilters,
  CollectionQuery,
  CollectionAnalytics,
  BulkCollectionOperation
} from '@/types/domains/collection'
import type { ApiResponse, PaginatedResponse } from '@/types'
import { createClient } from '@supabase/supabase-js'

/**
 * Collection Service - business logic for user collection management
 * 
 * Handles collection operations, statistics calculation, validation,
 * and business rules while delegating data access to repository.
 */
export class CollectionService {
  private repository: CollectionRepository

  constructor(supabase: ReturnType<typeof createClient>) {
    this.repository = new CollectionRepository(supabase)
  }

  /**
   * Get user's collection with filtering, sorting, and pagination
   */
  async getUserCollection(
    userId: string,
    query: Partial<CollectionQuery> = {}
  ): Promise<ApiResponse<{ data: UserCollectionWithCard[]; total: number }>> {
    const { 
      page = 1, 
      pageSize = 24, 
      filters = {},
      sortBy = 'acquired_date',
      sortDirection = 'desc' 
    } = query

    return this.repository.getUserCollection(userId, page, pageSize, filters)
  }

  /**
   * Add a new card to user's collection
   */
  async addToCollection(input: CreateCollectionEntryInput): Promise<ApiResponse<UserCollectionEntry>> {
    // Business validation
    if (input.quantity <= 0) {
      return {
        success: false,
        error: 'Quantity must be greater than 0'
      }
    }

    // Check if entry already exists for this card/variant/condition combination
    const existingResult = await this.repository.findByCardAndVariant(
      input.user_id,
      input.card_id,
      input.condition,
      input.variant
    )

    if (!existingResult.success) {
      return existingResult as ApiResponse<UserCollectionEntry>
    }

    // If exists, update quantity instead of creating new entry
    if (existingResult.data) {
      const newQuantity = existingResult.data.quantity + input.quantity
      return this.repository.update(existingResult.data.id, { quantity: newQuantity })
    }

    // Create new entry
    return this.repository.create(input)
  }

  /**
   * Update collection entry
   */
  async updateCollectionEntry(
    id: string, 
    updates: UpdateCollectionEntryInput
  ): Promise<ApiResponse<UserCollectionEntry>> {
    // Business validation
    if (updates.quantity !== undefined && updates.quantity < 0) {
      return {
        success: false,
        error: 'Quantity cannot be negative'
      }
    }

    // If quantity is 0, remove the entry completely
    if (updates.quantity === 0) {
      const deleteResult = await this.repository.delete(id)
      if (deleteResult.success) {
        return {
          success: true,
          data: undefined as any, // Entry was deleted
          message: 'Collection entry removed'
        }
      }
      return {
        success: false,
        error: deleteResult.error || 'Failed to delete entry'
      }
    }

    return this.repository.update(id, updates)
  }

  /**
   * Remove card from collection
   */
  async removeFromCollection(id: string): Promise<ApiResponse<boolean>> {
    return this.repository.delete(id)
  }

  /**
   * Check if user owns a specific card
   */
  async checkCardOwnership(
    userId: string, 
    cardId: string
  ): Promise<ApiResponse<{ owned: boolean; quantity: number }>> {
    return this.repository.checkOwnership(userId, cardId)
  }

  /**
   * Get collection statistics for a user
   */
  async getCollectionStats(userId: string): Promise<ApiResponse<CollectionStats>> {
    const collectionResult = await this.repository.getCollectionForStats(userId)
    
    if (!collectionResult.success || !collectionResult.data) {
      return {
        success: false,
        error: collectionResult.error || 'Failed to fetch collection data'
      }
    }

    const collection = collectionResult.data

    // Calculate basic statistics
    const totalCards = collection.reduce((sum, entry) => sum + entry.quantity, 0)
    const uniqueCards = collection.length
    const setsWithCards = new Set(collection.map(entry => entry.card?.set_id).filter(Boolean)).size

    // Calculate total value
    const totalValueEur = collection.reduce((sum, entry) => {
      const cardValue = this.getCardValue(entry)
      return sum + (cardValue * entry.quantity)
    }, 0)

    // Group by rarity
    const rarityBreakdown: Record<string, any> = {}
    collection.forEach(entry => {
      const rarity = entry.card?.rarity || 'Unknown'
      if (!rarityBreakdown[rarity]) {
        rarityBreakdown[rarity] = { count: 0, percentage: 0, value: 0, averageValue: 0 }
      }
      rarityBreakdown[rarity].count += entry.quantity
      rarityBreakdown[rarity].value += this.getCardValue(entry) * entry.quantity
    })

    // Calculate percentages and averages
    Object.values(rarityBreakdown).forEach((rarity: any) => {
      rarity.percentage = (rarity.count / totalCards) * 100
      rarity.averageValue = rarity.value / rarity.count
    })

    // Group by set
    const setBreakdown: Record<string, any> = {}
    collection.forEach(entry => {
      const setId = entry.card?.set_id
      const setName = entry.card?.sets?.name || 'Unknown Set'
      if (setId && !setBreakdown[setId]) {
        setBreakdown[setId] = {
          setId,
          setName,
          ownedCards: 0,
          totalCards: 0, // Would need to query set total
          completionPercentage: 0,
          setValue: 0,
          missingHighValue: []
        }
      }
      if (setId) {
        setBreakdown[setId].ownedCards += entry.quantity
        setBreakdown[setId].setValue += this.getCardValue(entry) * entry.quantity
      }
    })

    // Group by condition
    const conditionBreakdown: Record<string, number> = {}
    collection.forEach(entry => {
      conditionBreakdown[entry.condition] = (conditionBreakdown[entry.condition] || 0) + entry.quantity
    })

    // Group by variant
    const variantBreakdown: Record<string, number> = {}
    collection.forEach(entry => {
      variantBreakdown[entry.variant] = (variantBreakdown[entry.variant] || 0) + entry.quantity
    })

    // Get recent additions
    const recentResult = await this.repository.getRecentAdditions(userId, 10)
    const recentAdditions = recentResult.success && recentResult.data ? 
      recentResult.data.map(entry => ({
        id: entry.id,
        cardId: entry.card_id,
        cardName: entry.card?.name || 'Unknown',
        setName: entry.card?.sets?.name || 'Unknown Set',
        imageSmall: entry.card?.image_small || '',
        quantity: entry.quantity,
        variant: entry.variant as any,
        condition: entry.condition as any,
        estimatedValue: this.getCardValue(entry),
        addedAt: entry.created_at
      })) : []

    const stats: CollectionStats = {
      userId,
      totalCards,
      uniqueCards,
      setsWithCards,
      totalValueEur,
      averageCardValue: totalValueEur / totalCards || 0,
      rarityBreakdown,
      setBreakdown,
      conditionBreakdown: conditionBreakdown as any,
      variantBreakdown: variantBreakdown as any,
      collectionGrowth: [], // Would need historical data
      recentAdditions,
      completedSets: [],
      nearCompleteSets: [],
      topValueCards: this.getTopValueCards(collection),
      monthlyGrowth: 0, // Would need historical calculation
      weeklyGrowth: 0, // Would need historical calculation
      calculatedAt: new Date().toISOString()
    }

    return {
      success: true,
      data: stats
    }
  }

  /**
   * Get collection by set
   */
  async getCollectionBySet(
    userId: string, 
    setId: string
  ): Promise<ApiResponse<UserCollectionWithCard[]>> {
    return this.repository.getCollectionBySet(userId, setId)
  }

  /**
   * Clear user's entire collection
   */
  async clearCollection(userId: string): Promise<ApiResponse<number>> {
    return this.repository.clearUserCollection(userId)
  }

  /**
   * Get unique card IDs in user's collection
   */
  async getUserCardIds(userId: string): Promise<ApiResponse<string[]>> {
    return this.repository.getUserCardIds(userId)
  }

  /**
   * Legacy-compatible method for adding cards to collection
   * Used by trading system - DO NOT REMOVE
   */
  async addToCollectionLegacy(
    userId: string,
    cardId: string,
    options: {
      quantity?: number
      condition?: 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged'
      variant?: string
      notes?: string
    } = {}
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    const {
      quantity = 1,
      condition = 'near_mint',
      variant = 'normal',
      notes
    } = options

    const result = await this.addToCollection({
      user_id: userId,
      card_id: cardId,
      quantity,
      condition,
      variant,
      notes,
      acquired_date: new Date().toISOString().split('T')[0]
    })

    return {
      success: result.success,
      error: result.error,
      data: result.data
    }
  }

  /**
   * Legacy-compatible method for removing cards from collection
   * Used by trading system - DO NOT REMOVE
   */
  async removeFromCollectionLegacy(
    userId: string,
    cardId: string,
    options: {
      quantity?: number
      condition?: 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged'
      variant?: string
      removeAll?: boolean
    } = {}
  ): Promise<{ success: boolean; error?: string; data?: any | null }> {
    const {
      quantity = 1,
      condition = 'near_mint',
      variant = 'normal',
      removeAll = false
    } = options

    // Find the existing entry
    const existingResult = await this.repository.findByCardAndVariant(
      userId,
      cardId,
      condition,
      variant
    )

    if (!existingResult.success) {
      return {
        success: false,
        error: 'Card not found in collection'
      }
    }

    if (!existingResult.data) {
      return {
        success: false,
        error: 'Card not found in collection'
      }
    }

    const existingEntry = existingResult.data

    if (removeAll || existingEntry.quantity <= quantity) {
      // Remove entry completely
      const deleteResult = await this.repository.delete(existingEntry.id)
      return {
        success: deleteResult.success,
        error: deleteResult.error,
        data: null
      }
    } else {
      // Reduce quantity
      const newQuantity = existingEntry.quantity - quantity
      const updateResult = await this.repository.update(existingEntry.id, { quantity: newQuantity })
      return {
        success: updateResult.success,
        error: updateResult.error,
        data: updateResult.data
      }
    }
  }

  /**
   * Legacy-compatible method for clearing entire collection
   * Used by account settings - DO NOT REMOVE
   */
  async clearCollectionLegacy(userId: string): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
    const result = await this.clearCollection(userId)
    return {
      success: result.success,
      error: result.error,
      deletedCount: result.data || 0
    }
  }

  /**
   * Legacy-compatible method for getting collection stats
   * Used by various components - DO NOT REMOVE
   */
  async getCollectionStatsLegacy(userId: string): Promise<{ success: boolean; error?: string; data?: any }> {
    const result = await this.getCollectionStats(userId)
    
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to get collection stats'
      }
    }

    // Transform to legacy format
    const legacyStats = {
      totalCards: result.data.totalCards,
      totalValue: result.data.totalValueEur,
      uniqueCards: result.data.uniqueCards,
      setCompletion: result.data.setBreakdown,
      rarityBreakdown: result.data.rarityBreakdown,
      recentAdditions: result.data.recentAdditions.map(item => ({
        id: item.id,
        card_id: item.cardId,
        cards: {
          id: item.cardId,
          name: item.cardName,
          sets: {
            name: item.setName
          },
          image_small: item.imageSmall
        },
        quantity: item.quantity,
        variant: item.variant,
        condition: item.condition,
        created_at: item.addedAt
      }))
    }

    return {
      success: true,
      data: legacyStats
    }
  }

  /**
   * Perform bulk collection operations
   */
  async performBulkOperation(
    userId: string,
    operation: BulkCollectionOperation
  ): Promise<ApiResponse<{ processed: number; errors: string[] }>> {
    const errors: string[] = []
    let processed = 0

    for (const entry of operation.entries) {
      try {
        if (operation.operation === 'add') {
          const result = await this.addToCollection({
            user_id: userId,
            card_id: entry.cardId,
            quantity: entry.quantity,
            condition: entry.condition || 'near_mint',
            variant: entry.variant || 'normal',
            notes: entry.notes,
            acquired_date: entry.acquiredDate
          })
          
          if (result.success) {
            processed++
          } else {
            errors.push(`Failed to add ${entry.cardId}: ${result.error}`)
          }
        }
        // Add other operations as needed
      } catch (error: any) {
        errors.push(`Error processing ${entry.cardId}: ${error.message}`)
      }
    }

    return {
      success: true,
      data: { processed, errors }
    }
  }

  /**
   * Calculate collection analytics
   */
  async getCollectionAnalytics(
    userId: string,
    period: 'week' | 'month' | 'year' | 'all' = 'month'
  ): Promise<ApiResponse<CollectionAnalytics>> {
    // This would require historical data tracking
    // For now, return basic analytics
    const analytics: CollectionAnalytics = {
      userId,
      period,
      cardsAdded: 0,
      cardsRemoved: 0,
      netGrowth: 0,
      valueGrowth: 0,
      mostActiveDay: 'Monday',
      favoriteSet: 'Unknown',
      averageCardValue: 0,
      collectionVelocity: 0,
      recommendations: [],
      insights: []
    }

    return {
      success: true,
      data: analytics
    }
  }

  /**
   * Private helper to get card value based on variant and condition
   */
  private getCardValue(entry: UserCollectionWithCard): number {
    if (!entry.card) return 0

    // Determine which price to use based on variant
    let basePrice = 0
    const card = entry.card as any // Type assertion for pricing fields
    if (entry.variant === 'reverse_holo' && card.cardmarket_reverse_holo_sell) {
      basePrice = card.cardmarket_reverse_holo_sell
    } else if (card.cardmarket_avg_sell_price) {
      basePrice = card.cardmarket_avg_sell_price
    }

    // Apply condition modifier
    const conditionMultiplier = this.getConditionMultiplier(entry.condition)
    return basePrice * conditionMultiplier
  }

  /**
   * Private helper to get condition price multiplier
   */
  private getConditionMultiplier(condition: string): number {
    const multipliers: Record<string, number> = {
      'mint': 1.0,
      'near_mint': 0.95,
      'lightly_played': 0.85,
      'moderately_played': 0.7,
      'heavily_played': 0.5,
      'damaged': 0.3
    }
    return multipliers[condition] || 0.95
  }

  /**
   * Private helper to get top value cards
   */
  private getTopValueCards(collection: UserCollectionWithCard[], limit: number = 10): any[] {
    return collection
      .map(entry => ({
        cardId: entry.card_id,
        cardName: entry.card?.name || 'Unknown',
        setName: entry.card?.sets?.name || 'Unknown Set',
        imageSmall: entry.card?.image_small || '',
        variant: entry.variant,
        condition: entry.condition,
        quantity: entry.quantity,
        unitValue: this.getCardValue(entry),
        totalValue: this.getCardValue(entry) * entry.quantity
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, limit)
  }
}