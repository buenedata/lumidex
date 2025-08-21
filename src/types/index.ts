// Main type exports - organized and re-exported for clean imports

// Core types
export * from './core/common'

// Domain types
export * from './domains/user'
export * from './domains/card'
export * from './domains/social'
export * from './domains/wishlist'

// Collection domain
export * from './domains/collection'

// API contracts
export * from './api/contracts'

// Additional legacy type exports for compatibility
export type PokemonTCGApiResponse<T = any> = {
  data: T[]
  page: number
  pageSize: number
  count: number
  totalCount: number
}

export type PriceDisplay = CardPriceDisplay

// UI state types
export * from './ui/state'

// Legacy compatibility - maintain backwards compatibility during migration
// These re-export existing types under their old names for gradual migration

import type {
  User,
  UserPreferences,
  UserStats,
  UserActivityItem
} from './domains/user'
import type {
  PokemonCard,
  PokemonSet,
  CardVariant,
  CardCondition,
  CardFilters,
  CardListItem,
  CardDetails,
  CardPriceDisplay
} from './domains/card'
import type {
  UserCollectionEntry,
  CollectionStats,
  CollectionQuery
} from './domains/collection'
import type {
  Friend,
  FriendRequest,
  Trade,
  TradeItem,
  TradeOffer,
  SocialStats
} from './domains/social'
import type {
  WishlistItem,
  WishlistList,
  WishlistStats,
  WishlistQuery
} from './domains/wishlist'
import type {
  ApiResponse,
  PaginatedResponse,
  LoadingState,
  Currency,
  Language,
  PaginationParams
} from './core/common'
import type {
  FormState,
  ModalState,
  ListViewState,
  ToastState
} from './ui/state'

// Legacy type aliases for backwards compatibility
/** @deprecated Use User from domains/user instead */
export type Profile = User

/** @deprecated Use PokemonCard from domains/card instead */
export type Card = PokemonCard

/** @deprecated Use PokemonSet from domains/card instead */
export type Set = PokemonSet

/** @deprecated Use UserCollectionEntry from domains/collection instead */
export type UserCollection = UserCollectionEntry

/** @deprecated Use Friend from domains/social instead */
export type Friendship = Friend

// Utility types for type safety
export type ExtractArrayType<T> = T extends (infer U)[] ? U : never
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

// Type guards for runtime type checking
export const isUser = (obj: any): obj is User => {
  return obj && typeof obj.id === 'string' && typeof obj.username === 'string'
}

export const isPokemonCard = (obj: any): obj is PokemonCard => {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string' && obj.set_id
}

export const isApiResponse = <T>(obj: any): obj is ApiResponse<T> => {
  return obj && typeof obj.success === 'boolean'
}

export const isLoadingState = (value: any): value is LoadingState => {
  return ['idle', 'loading', 'success', 'error'].includes(value)
}

// Error type helpers
export const createApiError = (message: string, code?: string, details?: Record<string, any>): ApiResponse<never> => ({
  success: false,
  error: message,
  ...(code && { code }),
  ...(details && { details })
})

export const createSuccessResponse = <T>(data: T, message?: string): ApiResponse<T> => ({
  success: true,
  data,
  ...(message && { message })
})

// Constants for commonly used values
export const CARD_CONDITIONS: readonly CardCondition[] = [
  'mint',
  'near_mint', 
  'lightly_played',
  'moderately_played',
  'heavily_played',
  'damaged'
] as const

export const CARD_VARIANTS: readonly CardVariant[] = [
  'normal',
  'holo',
  'reverse_holo',
  'pokeball_pattern',
  'masterball_pattern',
  '1st_edition'
] as const

export const CURRENCIES: readonly Currency[] = [
  'EUR',
  'USD',
  'GBP',
  'JPY'
] as const

export const LANGUAGES: readonly Language[] = [
  'en',
  'de', 
  'fr',
  'es',
  'it',
  'nl'
] as const

export const LOADING_STATES: readonly LoadingState[] = [
  'idle',
  'loading',
  'success',
  'error'
] as const

// Default values for common types
export const DEFAULT_PAGINATION: PaginationParams = {
  page: 1,
  pageSize: 24
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  preferred_currency: 'EUR',
  preferred_language: 'en',
  privacy_level: 'public',
  show_collection_value: true
}

export const DEFAULT_COLLECTION_QUERY: CollectionQuery = {
  ...DEFAULT_PAGINATION,
  sortBy: 'acquired_date',
  sortDirection: 'desc',
  includeDetails: false
}

export const DEFAULT_WISHLIST_QUERY: WishlistQuery = {
  ...DEFAULT_PAGINATION,
  sortBy: 'priority',
  sortDirection: 'asc',
  includeAvailability: true,
  includePricing: true
}