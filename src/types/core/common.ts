// Core shared types across all domains

/**
 * Common utility types for the application
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export type SortDirection = 'asc' | 'desc'

export type Currency = 'EUR' | 'USD' | 'GBP' | 'JPY'

export type Language = 'en' | 'de' | 'fr' | 'es' | 'it' | 'nl'

export type PrivacyLevel = 'public' | 'friends' | 'private'

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  page: number
  pageSize: number
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
}

/**
 * Sort configuration for data queries
 */
export interface SortConfig<T = string> {
  field: T
  direction: SortDirection
  label: string
}

/**
 * Filter base interface
 */
export interface BaseFilter {
  search?: string
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  startDate?: string
  endDate?: string
}

/**
 * Price range filter
 */
export interface PriceRangeFilter {
  minPrice?: number
  maxPrice?: number
  currency?: Currency
}

/**
 * Generic error with optional code and details
 */
export interface AppError {
  message: string
  code?: string
  details?: Record<string, any>
}

/**
 * Async operation state
 */
export interface AsyncState<T = any> {
  data: T | null
  loading: boolean
  error: AppError | null
}

/**
 * Timestamp fields for entities
 */
export interface Timestamps {
  created_at: string
  updated_at: string
}

/**
 * Entity with ID and timestamps
 */
export interface BaseEntity extends Timestamps {
  id: string
}