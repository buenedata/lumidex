// Collection domain types - user collections, statistics, and collection management

import { BaseEntity, Currency, BaseFilter, SortConfig, PaginationParams } from '../core/common'
import { PokemonCard, CardVariant, CardCondition, SetCompletion } from './card'
import { User } from './user'

/**
 * User collection entry for a specific card variant
 */
export interface UserCollectionEntry extends BaseEntity {
  user_id: string
  card_id: string
  quantity: number
  condition: CardCondition
  variant: CardVariant
  is_foil?: boolean
  acquired_date?: string
  notes?: string
  
  // Relations (populated when needed)
  card?: PokemonCard
  user?: User
}

/**
 * Aggregated collection data for a card across all variants
 */
export interface CollectionCardData {
  cardId: string
  userId: string
  
  // Variant quantities
  variants: {
    normal: number
    holo: number
    reverseHolo: number
    pokeballPattern: number
    masterballPattern: number
    firstEdition: number
  }
  
  // Metadata
  totalQuantity: number
  totalValue: number
  firstAcquired?: string
  lastUpdated: string
  averageCondition: CardCondition
  hasNotes: boolean
}

/**
 * Collection statistics for a user
 */
export interface CollectionStats {
  userId: string
  
  // Basic counts
  totalCards: number
  uniqueCards: number
  setsWithCards: number
  
  // Values
  totalValueEur: number
  totalValueUsd?: number
  averageCardValue: number
  
  // Breakdowns
  rarityBreakdown: Record<string, CollectionRarityStats>
  setBreakdown: Record<string, CollectionSetStats>
  conditionBreakdown: Record<CardCondition, number>
  variantBreakdown: Record<CardVariant, number>
  
  // Time-based data
  collectionGrowth: CollectionGrowthPoint[]
  recentAdditions: CollectionRecentItem[]
  
  // Achievements
  completedSets: string[]
  nearCompleteSets: SetCompletion[]
  topValueCards: CollectionTopCard[]
  
  // Trends
  monthlyGrowth: number
  weeklyGrowth: number
  lastActivity?: string
  
  // Calculated at
  calculatedAt: string
}

/**
 * Rarity statistics in collection
 */
export interface CollectionRarityStats {
  count: number
  percentage: number
  value: number
  averageValue: number
}

/**
 * Set statistics in collection
 */
export interface CollectionSetStats {
  setId: string
  setName: string
  ownedCards: number
  totalCards: number
  completionPercentage: number
  setValue: number
  missingHighValue: CollectionMissingCard[]
}

/**
 * Missing high-value card in a set
 */
export interface CollectionMissingCard {
  cardId: string
  cardName: string
  number: string
  rarity: string
  estimatedValue: number
  imageSmall: string
}

/**
 * Collection growth tracking point
 */
export interface CollectionGrowthPoint {
  date: string
  totalCards: number
  totalValue: number
  uniqueCards: number
  setsCount: number
}

/**
 * Recent collection addition
 */
export interface CollectionRecentItem {
  id: string
  cardId: string
  cardName: string
  setName: string
  imageSmall: string
  quantity: number
  variant: CardVariant
  condition: CardCondition
  estimatedValue?: number
  addedAt: string
}

/**
 * Top value card in collection
 */
export interface CollectionTopCard {
  cardId: string
  cardName: string
  setName: string
  imageSmall: string
  variant: CardVariant
  condition: CardCondition
  quantity: number
  totalValue: number
  unitValue: number
}

/**
 * Collection filters for browsing user's collection
 */
export interface CollectionFilters extends BaseFilter {
  setId?: string
  rarity?: string[]
  condition?: CardCondition[]
  variant?: CardVariant[]
  minValue?: number
  maxValue?: number
  hasNotes?: boolean
  acquiredAfter?: string
  acquiredBefore?: string
}

/**
 * Collection sort options
 */
export type CollectionSortField = 
  | 'name' 
  | 'acquired_date' 
  | 'value' 
  | 'quantity'
  | 'set_name'
  | 'rarity'
  | 'condition'
  | 'updated_at'

/**
 * Collection query parameters
 */
export interface CollectionQuery extends PaginationParams {
  filters?: CollectionFilters
  sortBy?: CollectionSortField
  sortDirection?: 'asc' | 'desc'
  includeDetails?: boolean
}

/**
 * Bulk collection operation
 */
export interface BulkCollectionOperation {
  operation: 'add' | 'remove' | 'update'
  entries: BulkCollectionEntry[]
  options?: {
    skipDuplicates?: boolean
    updateExisting?: boolean
    preserveNotes?: boolean
  }
}

/**
 * Bulk collection entry for operations
 */
export interface BulkCollectionEntry {
  cardId: string
  quantity: number
  variant?: CardVariant
  condition?: CardCondition
  notes?: string
  acquiredDate?: string
}

/**
 * Collection import/export format
 */
export interface CollectionExportData {
  userId: string
  exportedAt: string
  version: string
  metadata: {
    totalCards: number
    uniqueCards: number
    totalValue: number
    format: 'lumidex' | 'csv' | 'tcgplayer' | 'pokellector'
  }
  entries: CollectionExportEntry[]
}

/**
 * Individual entry in collection export
 */
export interface CollectionExportEntry {
  cardId?: string
  cardName: string
  setName: string
  cardNumber: string
  rarity: string
  variant: CardVariant
  condition: CardCondition
  quantity: number
  estimatedValue?: number
  acquiredDate?: string
  notes?: string
}

/**
 * Collection import result
 */
export interface CollectionImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: CollectionImportError[]
  warnings: string[]
  summary: {
    newCards: number
    updatedCards: number
    totalValue: number
  }
}

/**
 * Collection import error
 */
export interface CollectionImportError {
  row?: number
  cardName?: string
  error: string
  suggestion?: string
}

/**
 * Collection comparison between users
 */
export interface CollectionComparison {
  user1: CollectionComparisonUser
  user2: CollectionComparisonUser
  comparison: {
    commonCards: CollectionComparisonCard[]
    user1Exclusive: CollectionComparisonCard[]
    user2Exclusive: CollectionComparisonCard[]
    tradingOpportunities: TradingOpportunity[]
    similarityScore: number
  }
}

/**
 * User data for collection comparison
 */
export interface CollectionComparisonUser {
  userId: string
  username: string
  displayName?: string
  avatarUrl?: string
  stats: {
    totalCards: number
    uniqueCards: number
    totalValue: number
    topSets: string[]
  }
}

/**
 * Card data for collection comparison
 */
export interface CollectionComparisonCard {
  cardId: string
  cardName: string
  setName: string
  imageSmall: string
  user1Quantity?: number
  user2Quantity?: number
  value: number
}

/**
 * Trading opportunity from collection comparison
 */
export interface TradingOpportunity {
  type: 'wants_has' | 'has_wants' | 'mutual_benefit'
  description: string
  cards: {
    cardId: string
    cardName: string
    direction: 'to_user1' | 'to_user2'
    value: number
  }[]
  totalValue: number
  fairness: 'fair' | 'favors_user1' | 'favors_user2'
}

/**
 * Collection analytics for insights
 */
export interface CollectionAnalytics {
  userId: string
  period: 'week' | 'month' | 'year' | 'all'
  
  // Activity metrics
  cardsAdded: number
  cardsRemoved: number
  netGrowth: number
  valueGrowth: number
  
  // Patterns
  mostActiveDay: string
  favoriteSet: string
  averageCardValue: number
  collectionVelocity: number
  
  // Recommendations
  recommendations: CollectionRecommendation[]
  insights: string[]
}

/**
 * Collection recommendation
 */
export interface CollectionRecommendation {
  type: 'complete_set' | 'upgrade_condition' | 'sell_duplicate' | 'trade_opportunity'
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  potentialValue?: number
  cards?: string[]
  action?: string
}

/**
 * Collection milestone tracking
 */
export interface CollectionMilestone {
  id: string
  type: 'card_count' | 'value_threshold' | 'set_completion' | 'rarity_collection'
  name: string
  description: string
  target: number
  current: number
  progress: number
  achieved: boolean
  achievedAt?: string
  reward?: string
}