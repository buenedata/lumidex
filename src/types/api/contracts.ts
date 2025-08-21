// API contract types - standardized request/response interfaces

import { ApiResponse, PaginatedResponse, PaginationParams } from '../core/common'
import { User, UserPreferences, UserProfileForm, UserStats } from '../domains/user'
import { PokemonCard, CardFilters, CardListItem, CardDetails } from '../domains/card'
import { CollectionStats, CollectionQuery, UserCollectionEntry } from '../domains/collection'
import { WishlistItem, WishlistList, WishlistQuery, WishlistStats } from '../domains/wishlist'
import { Trade, TradeProposal, Friend, FriendRequest, SocialStats } from '../domains/social'

/**
 * Authentication API contracts
 */
export namespace AuthAPI {
  export interface SignUpRequest {
    email: string
    password: string
    username: string
    displayName?: string
  }
  
  export interface SignUpResponse extends ApiResponse<{
    user: User
    requiresEmailVerification: boolean
  }> {}
  
  export interface SignInRequest {
    email: string
    password: string
  }
  
  export interface SignInResponse extends ApiResponse<{
    user: User
    accessToken: string
    refreshToken: string
  }> {}
  
  export interface ResetPasswordRequest {
    email: string
  }
  
  export interface ResetPasswordResponse extends ApiResponse<{
    message: string
  }> {}
}

/**
 * User/Profile API contracts
 */
export namespace UserAPI {
  export interface GetProfileRequest {
    userId: string
    includeStats?: boolean
  }
  
  export interface GetProfileResponse extends ApiResponse<{
    user: User
    stats?: UserStats
  }> {}
  
  export interface UpdateProfileRequest {
    userId: string
    updates: UserProfileForm
  }
  
  export interface UpdateProfileResponse extends ApiResponse<User> {}
  
  export interface UpdatePreferencesRequest {
    userId: string
    preferences: UserPreferences
  }
  
  export interface UpdatePreferencesResponse extends ApiResponse<User> {}
  
  export interface UploadAvatarRequest {
    userId: string
    file: File
  }
  
  export interface UploadAvatarResponse extends ApiResponse<{
    avatarUrl: string
  }> {}
  
  export interface GetUserStatsRequest {
    userId: string
    period?: 'week' | 'month' | 'year' | 'all'
  }
  
  export interface GetUserStatsResponse extends ApiResponse<UserStats> {}
}

/**
 * Cards API contracts
 */
export namespace CardsAPI {
  export interface GetCardsRequest extends PaginationParams {
    filters?: CardFilters
    sortBy?: string
    sortDirection?: 'asc' | 'desc'
    includeUserData?: boolean
  }
  
  export interface GetCardsResponse extends ApiResponse<PaginatedResponse<CardListItem>> {}
  
  export interface GetCardDetailsRequest {
    cardId: string
    includeMarketData?: boolean
    includeTradingData?: boolean
    includeHistory?: boolean
  }
  
  export interface GetCardDetailsResponse extends ApiResponse<CardDetails> {}
  
  export interface SearchCardsRequest {
    query: string
    limit?: number
    filters?: Partial<CardFilters>
  }
  
  export interface SearchCardsResponse extends ApiResponse<CardListItem[]> {}
  
  export interface GetSetsRequest {
    includeStats?: boolean
  }
  
  export interface GetSetsResponse extends ApiResponse<Array<{
    id: string
    name: string
    series: string
    totalCards: number
    releaseDate: string
    symbolUrl?: string
    logoUrl?: string
    userStats?: {
      ownedCards: number
      completionPercentage: number
    }
  }>> {}
}

/**
 * Collection API contracts
 */
export namespace CollectionAPI {
  export interface GetCollectionRequest extends CollectionQuery {
    userId: string
  }
  
  export interface GetCollectionResponse extends ApiResponse<PaginatedResponse<UserCollectionEntry>> {}
  
  export interface AddToCollectionRequest {
    userId: string
    cardId: string
    quantity?: number
    condition?: string
    variant?: string
    notes?: string
  }
  
  export interface AddToCollectionResponse extends ApiResponse<UserCollectionEntry> {}
  
  export interface RemoveFromCollectionRequest {
    userId: string
    cardId: string
    quantity?: number
    condition?: string
    variant?: string
    removeAll?: boolean
  }
  
  export interface RemoveFromCollectionResponse extends ApiResponse<UserCollectionEntry | null> {}
  
  export interface GetCollectionStatsRequest {
    userId: string
    includeGrowth?: boolean
    includeBreakdowns?: boolean
  }
  
  export interface GetCollectionStatsResponse extends ApiResponse<CollectionStats> {}
  
  export interface BulkCollectionUpdateRequest {
    userId: string
    operations: Array<{
      operation: 'add' | 'remove' | 'update'
      cardId: string
      quantity: number
      condition?: string
      variant?: string
      notes?: string
    }>
  }
  
  export interface BulkCollectionUpdateResponse extends ApiResponse<{
    successful: number
    failed: number
    errors: Array<{ cardId: string; error: string }>
  }> {}
  
  export interface ImportCollectionRequest {
    userId: string
    format: 'csv' | 'tcgplayer' | 'pokellector'
    data: string | File
    options?: {
      skipDuplicates?: boolean
      updateExisting?: boolean
    }
  }
  
  export interface ImportCollectionResponse extends ApiResponse<{
    imported: number
    skipped: number
    errors: Array<{ row: number; error: string }>
  }> {}
}

/**
 * Wishlist API contracts
 */
export namespace WishlistAPI {
  export interface GetWishlistsRequest {
    userId: string
    includePublic?: boolean
  }
  
  export interface GetWishlistsResponse extends ApiResponse<WishlistList[]> {}
  
  export interface CreateWishlistRequest {
    userId: string
    name: string
    description?: string
    isPublic?: boolean
  }
  
  export interface CreateWishlistResponse extends ApiResponse<WishlistList> {}
  
  export interface GetWishlistItemsRequest extends WishlistQuery {
    listId: string
  }
  
  export interface GetWishlistItemsResponse extends ApiResponse<PaginatedResponse<WishlistItem>> {}
  
  export interface AddToWishlistRequest {
    userId: string
    cardId: string
    listId: string
    priority?: number
    maxPrice?: number
    conditionPreference?: string
    notes?: string
  }
  
  export interface AddToWishlistResponse extends ApiResponse<WishlistItem> {}
  
  export interface RemoveFromWishlistRequest {
    userId: string
    itemId: string
  }
  
  export interface RemoveFromWishlistResponse extends ApiResponse<{ success: boolean }> {}
  
  export interface GetWishlistStatsRequest {
    userId: string
    listId?: string
  }
  
  export interface GetWishlistStatsResponse extends ApiResponse<WishlistStats> {}
}

/**
 * Social/Trading API contracts
 */
export namespace SocialAPI {
  export interface GetFriendsRequest {
    userId: string
    limit?: number
    includeStats?: boolean
  }
  
  export interface GetFriendsResponse extends ApiResponse<Friend[]> {}
  
  export interface SendFriendRequestRequest {
    fromUserId: string
    toUserId: string
    message?: string
  }
  
  export interface SendFriendRequestResponse extends ApiResponse<FriendRequest> {}
  
  export interface GetFriendRequestsRequest {
    userId: string
    type: 'incoming' | 'outgoing' | 'all'
  }
  
  export interface GetFriendRequestsResponse extends ApiResponse<FriendRequest[]> {}
  
  export interface RespondToFriendRequestRequest {
    requestId: string
    response: 'accept' | 'decline'
  }
  
  export interface RespondToFriendRequestResponse extends ApiResponse<{ success: boolean }> {}
  
  export interface GetTradesRequest {
    userId: string
    status?: string[]
    limit?: number
  }
  
  export interface GetTradesResponse extends ApiResponse<Trade[]> {}
  
  export interface CreateTradeRequest {
    proposal: TradeProposal
  }
  
  export interface CreateTradeResponse extends ApiResponse<Trade> {}
  
  export interface RespondToTradeRequest {
    tradeId: string
    response: 'accept' | 'decline' | 'counter'
    message?: string
    counterOffer?: TradeProposal
  }
  
  export interface RespondToTradeResponse extends ApiResponse<Trade> {}
  
  export interface GetSocialStatsRequest {
    userId: string
  }
  
  export interface GetSocialStatsResponse extends ApiResponse<SocialStats> {}
}

/**
 * Sync/Admin API contracts
 */
export namespace SyncAPI {
  export interface SyncCardsRequest {
    setIds?: string[]
    forceRefresh?: boolean
  }
  
  export interface SyncCardsResponse extends ApiResponse<{
    processed: number
    updated: number
    errors: number
  }> {}
  
  export interface SyncPricingRequest {
    cardIds?: string[]
    source?: 'cardmarket' | 'tcgplayer' | 'all'
    priority?: 'high' | 'normal' | 'low'
  }
  
  export interface SyncPricingResponse extends ApiResponse<{
    processed: number
    updated: number
    failed: number
  }> {}
  
  export interface GetSyncProgressRequest {
    operation: 'cards' | 'pricing' | 'images'
  }
  
  export interface GetSyncProgressResponse extends ApiResponse<{
    status: 'idle' | 'running' | 'completed' | 'error'
    progress: number
    total: number
    errors: string[]
    startedAt?: string
    completedAt?: string
  }> {}
}

/**
 * Achievement API contracts
 */
export namespace AchievementAPI {
  export interface CheckAchievementsRequest {
    userId: string
  }
  
  export interface CheckAchievementsResponse extends ApiResponse<{
    newAchievements: Array<{
      type: string
      name: string
      description: string
      unlockedAt: string
    }>
    progress: Array<{
      type: string
      current: number
      required: number
      percentage: number
    }>
  }> {}
  
  export interface GetAchievementsRequest {
    userId: string
    includeProgress?: boolean
  }
  
  export interface GetAchievementsResponse extends ApiResponse<Array<{
    type: string
    name: string
    description: string
    icon: string
    unlocked: boolean
    unlockedAt?: string
    progress?: number
    required?: number
  }>> {}
}

/**
 * Analytics API contracts
 */
export namespace AnalyticsAPI {
  export interface GetPriceHistoryRequest {
    cardId: string
    period?: 'week' | 'month' | 'quarter' | 'year'
    source?: 'cardmarket' | 'tcgplayer'
  }
  
  export interface GetPriceHistoryResponse extends ApiResponse<Array<{
    date: string
    price: number
    source: string
    priceType: string
  }>> {}
  
  export interface GetMarketTrendsRequest {
    period?: 'week' | 'month' | 'quarter'
    setIds?: string[]
    rarities?: string[]
  }
  
  export interface GetMarketTrendsResponse extends ApiResponse<{
    trends: Array<{
      cardId: string
      cardName: string
      currentPrice: number
      priceChange: number
      changePercentage: number
      trend: 'up' | 'down' | 'stable'
    }>
    summary: {
      totalCards: number
      averageChange: number
      topGainers: Array<{ cardId: string; change: number }>
      topLosers: Array<{ cardId: string; change: number }>
    }
  }> {}
}

/**
 * Error response structure for all APIs
 */
export interface APIError {
  success: false
  error: string
  code?: string
  details?: Record<string, any>
  timestamp: string
}

/**
 * Generic API request wrapper with metadata
 */
export interface APIRequest<T = any> {
  data: T
  metadata?: {
    requestId?: string
    userAgent?: string
    clientVersion?: string
  }
}

/**
 * Generic API response wrapper with metadata
 */
export interface APIResponseMeta<T = any> extends ApiResponse<T> {
  metadata?: {
    requestId?: string
    processingTime?: number
    rateLimit?: {
      remaining: number
      resetAt: string
    }
  }
}