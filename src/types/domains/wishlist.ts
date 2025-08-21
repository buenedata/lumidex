// Wishlist domain types - wishlists, lists, and wanted cards

import { BaseEntity, Currency, BaseFilter, PaginationParams } from '../core/common'
import { PokemonCard, CardCondition } from './card'
import { User } from './user'

/**
 * Wishlist list entity - users can have multiple wishlist lists
 */
export interface WishlistList extends BaseEntity {
  user_id: string
  name: string
  description?: string
  is_default: boolean
  is_public: boolean
  
  // Relations
  user?: User
  items?: WishlistItem[]
}

/**
 * Individual wishlist item
 */
export interface WishlistItem extends BaseEntity {
  user_id: string
  card_id: string
  wishlist_list_id: string
  priority: 1 | 2 | 3 | 4 | 5 // 1 = highest priority
  max_price_eur?: number
  condition_preference: CardCondition | 'any'
  notes?: string
  
  // Relations
  card?: PokemonCard
  user?: User
  wishlist_list?: WishlistList
}

/**
 * Wishlist item with populated card data for UI
 */
export interface WishlistItemWithCard extends WishlistItem {
  card: PokemonCard & {
    set?: {
      id: string
      name: string
      symbol_url?: string
    }
  }
  isAvailable?: boolean
  availableFromFriends?: WishlistAvailability[]
  marketPrice?: number
  priceAlert?: boolean
}

/**
 * Availability information for wishlist items
 */
export interface WishlistAvailability {
  friendId: string
  friendUsername: string
  friendDisplayName?: string
  friendAvatarUrl?: string
  quantity: number
  condition: CardCondition
  variant: string
  estimatedValue?: number
  lastActive?: string
  willingToTrade?: boolean
}

/**
 * Wishlist statistics for a user
 */
export interface WishlistStats {
  userId: string
  
  // Basic counts
  totalItems: number
  totalLists: number
  highPriorityItems: number
  
  // Values
  totalEstimatedValue: number
  averageItemValue: number
  budgetSet: number
  budgetUsed: number
  
  // Availability
  availableItems: number
  availableFromFriends: number
  recentlyAvailable: number
  
  // Progress
  itemsAddedThisMonth: number
  itemsObtainedThisMonth: number
  completionRate: number
  
  // Alerts
  priceAlerts: number
  friendAlerts: number
  newAvailability: number
  
  // Breakdown
  priorityBreakdown: Record<number, number>
  setBreakdown: Record<string, WishlistSetStats>
  priceRangeBreakdown: Record<string, number>
  
  calculatedAt: string
}

/**
 * Wishlist set statistics
 */
export interface WishlistSetStats {
  setId: string
  setName: string
  wantedCards: number
  totalCards: number
  wantedPercentage: number
  averagePriority: number
  totalValue: number
  availableCount: number
}

/**
 * Wishlist filters for browsing
 */
export interface WishlistFilters extends BaseFilter {
  listId?: string
  priority?: number[]
  maxPrice?: number
  minPrice?: number
  conditionPreference?: CardCondition[]
  setId?: string
  availability?: 'any' | 'available' | 'from_friends' | 'unavailable'
  hasNotes?: boolean
  priceAlert?: boolean
}

/**
 * Wishlist sort options
 */
export type WishlistSortField = 
  | 'priority'
  | 'name'
  | 'set_name'
  | 'max_price'
  | 'market_price'
  | 'availability'
  | 'created_at'
  | 'updated_at'

/**
 * Wishlist query parameters
 */
export interface WishlistQuery extends PaginationParams {
  filters?: WishlistFilters
  sortBy?: WishlistSortField
  sortDirection?: 'asc' | 'desc'
  includeAvailability?: boolean
  includePricing?: boolean
}

/**
 * Bulk wishlist operation
 */
export interface BulkWishlistOperation {
  operation: 'add' | 'remove' | 'move' | 'update_priority'
  items: BulkWishlistItem[]
  targetListId?: string
  options?: {
    skipDuplicates?: boolean
    preservePriority?: boolean
    preserveNotes?: boolean
  }
}

/**
 * Bulk wishlist item for operations
 */
export interface BulkWishlistItem {
  cardId: string
  listId?: string
  priority?: number
  maxPrice?: number
  conditionPreference?: CardCondition | 'any'
  notes?: string
}

/**
 * Wishlist sharing configuration
 */
export interface WishlistSharing {
  listId: string
  isPublic: boolean
  shareToken?: string
  allowedUsers?: string[]
  shareSettings: {
    showPrices: boolean
    showNotes: boolean
    showPriorities: boolean
    allowCopying: boolean
  }
}

/**
 * Shared wishlist view for external access
 */
export interface SharedWishlistView {
  list: Omit<WishlistList, 'user_id'> & {
    owner: {
      username: string
      displayName?: string
      avatarUrl?: string
    }
  }
  items: SharedWishlistItem[]
  stats: {
    totalItems: number
    totalValue?: number
    lastUpdated: string
  }
  shareSettings: WishlistSharing['shareSettings']
}

/**
 * Shared wishlist item (privacy-filtered)
 */
export interface SharedWishlistItem {
  cardId: string
  cardName: string
  setName: string
  imageSmall: string
  priority?: number
  maxPrice?: number
  conditionPreference?: CardCondition | 'any'
  notes?: string
  marketPrice?: number
  addedAt: string
}

/**
 * Wishlist recommendation
 */
export interface WishlistRecommendation {
  type: 'similar_cards' | 'set_completion' | 'price_opportunity' | 'friend_available'
  title: string
  description: string
  cards: WishlistRecommendationCard[]
  priority: 'low' | 'medium' | 'high'
  action: string
  metadata?: Record<string, any>
}

/**
 * Recommended card for wishlist
 */
export interface WishlistRecommendationCard {
  cardId: string
  cardName: string
  setName: string
  imageSmall: string
  reason: string
  estimatedValue?: number
  availability?: 'market' | 'friends' | 'rare'
  suggestedPriority?: number
}

/**
 * Wishlist alert configuration
 */
export interface WishlistAlert {
  id: string
  userId: string
  cardId: string
  type: 'price_drop' | 'friend_available' | 'market_available'
  isActive: boolean
  
  // Price alert settings
  targetPrice?: number
  priceThreshold?: number
  
  // Notification settings
  emailNotification: boolean
  pushNotification: boolean
  
  // Metadata
  createdAt: string
  lastTriggered?: string
  triggerCount: number
}

/**
 * Wishlist alert trigger event
 */
export interface WishlistAlertTrigger {
  alertId: string
  cardId: string
  type: WishlistAlert['type']
  message: string
  currentPrice?: number
  previousPrice?: number
  source?: string
  metadata?: Record<string, any>
  triggeredAt: string
}

/**
 * Wishlist import/export format
 */
export interface WishlistExportData {
  userId: string
  exportedAt: string
  version: string
  lists: WishlistExportList[]
}

/**
 * Exported wishlist list
 */
export interface WishlistExportList {
  name: string
  description?: string
  isDefault: boolean
  items: WishlistExportItem[]
}

/**
 * Exported wishlist item
 */
export interface WishlistExportItem {
  cardId?: string
  cardName: string
  setName: string
  cardNumber: string
  priority: number
  maxPrice?: number
  conditionPreference: CardCondition | 'any'
  notes?: string
}

/**
 * Wishlist import result
 */
export interface WishlistImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: WishlistImportError[]
  warnings: string[]
  summary: {
    newItems: number
    updatedItems: number
    newLists: number
  }
}

/**
 * Wishlist import error
 */
export interface WishlistImportError {
  row?: number
  cardName?: string
  listName?: string
  error: string
  suggestion?: string
}

/**
 * Wishlist analytics
 */
export interface WishlistAnalytics {
  userId: string
  period: 'week' | 'month' | 'year' | 'all'
  
  // Activity
  itemsAdded: number
  itemsRemoved: number
  itemsObtained: number
  listsCreated: number
  
  // Efficiency
  obtainmentRate: number
  averageTimeToObtain: number
  priceAccuracy: number
  
  // Insights
  topPriorityPatterns: string[]
  seasonalTrends: Record<string, number>
  recommendedActions: string[]
  
  // Predictions
  nextLikelyObtainment?: {
    cardId: string
    cardName: string
    probability: number
    estimatedDate?: string
  }
}

/**
 * Wishlist comparison between users
 */
export interface WishlistComparison {
  user1: {
    userId: string
    username: string
    totalItems: number
  }
  user2: {
    userId: string
    username: string
    totalItems: number
  }
  
  comparison: {
    sharedWants: WishlistComparisonCard[]
    user1Exclusive: WishlistComparisonCard[]
    user2Exclusive: WishlistComparisonCard[]
    similarityScore: number
    recommendations: string[]
  }
}

/**
 * Wishlist comparison card
 */
export interface WishlistComparisonCard {
  cardId: string
  cardName: string
  setName: string
  imageSmall: string
  user1Priority?: number
  user2Priority?: number
  marketValue?: number
}