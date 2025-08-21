// Core repository pattern - base classes for data access layer

import { ApiResponse, PaginationParams, PaginatedResponse } from '@/types'

/**
 * Base repository interface for all data access
 */
export interface BaseRepository<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  // Basic CRUD operations
  findById(id: string): Promise<ApiResponse<T>>
  findMany(params?: FindManyParams): Promise<ApiResponse<PaginatedResponse<T>>>
  create(data: TCreate): Promise<ApiResponse<T>>
  update(id: string, data: TUpdate): Promise<ApiResponse<T>>
  delete(id: string): Promise<ApiResponse<boolean>>
  
  // Bulk operations
  findByIds(ids: string[]): Promise<ApiResponse<T[]>>
  createMany(data: TCreate[]): Promise<ApiResponse<T[]>>
  updateMany(updates: Array<{ id: string; data: TUpdate }>): Promise<ApiResponse<T[]>>
  deleteMany(ids: string[]): Promise<ApiResponse<number>>
}

/**
 * Parameters for findMany operations
 */
export interface FindManyParams extends PaginationParams {
  filters?: Record<string, any>
  sorting?: {
    field: string
    direction: 'asc' | 'desc'
  }
  includes?: string[]
}

/**
 * Repository error handling
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'RepositoryError'
  }

  static notFound(resource: string, id?: string): RepositoryError {
    return new RepositoryError(
      `${resource}${id ? ` with id ${id}` : ''} not found`,
      'NOT_FOUND',
      { resource, id }
    )
  }

  static validationError(field: string, message: string): RepositoryError {
    return new RepositoryError(
      `Validation error: ${field} ${message}`,
      'VALIDATION_ERROR',
      { field, message }
    )
  }

  static databaseError(originalError: Error): RepositoryError {
    return new RepositoryError(
      `Database operation failed: ${originalError.message}`,
      'DATABASE_ERROR',
      { originalError: originalError.message }
    )
  }

  static unauthorized(action?: string): RepositoryError {
    return new RepositoryError(
      `Unauthorized${action ? ` to ${action}` : ''}`,
      'UNAUTHORIZED',
      { action }
    )
  }
}

/**
 * Abstract base repository implementation
 */
export abstract class AbstractRepository<T, TCreate = Partial<T>, TUpdate = Partial<T>> 
  implements BaseRepository<T, TCreate, TUpdate> {
  
  constructor(
    protected tableName: string,
    protected supabase: any // Will be typed properly in implementation
  ) {}

  /**
   * Handle repository errors consistently
   */
  protected handleError<TResult = any>(error: any): ApiResponse<TResult> {
    console.error(`Repository error in ${this.tableName}:`, error)
    
    if (error instanceof RepositoryError) {
      return {
        success: false,
        error: error.message
      }
    }

    // Supabase specific error handling
    if (error.code === 'PGRST116') {
      return {
        success: false,
        error: 'Resource not found'
      }
    }

    if (error.code?.startsWith('23')) { // PostgreSQL constraint violations
      return {
        success: false,
        error: 'Data constraint violation'
      }
    }

    return {
      success: false,
      error: error.message || 'Unknown repository error'
    }
  }

  /**
   * Create successful response
   */
  protected createSuccessResponse<TResult>(data: TResult): ApiResponse<TResult> {
    return { success: true, data }
  }

  /**
   * Validate required fields
   */
  protected validateRequired(data: any, requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        throw RepositoryError.validationError(field, 'is required')
      }
    }
  }

  /**
   * Build query with filters, sorting, and pagination
   */
  protected buildQuery(
    baseQuery: any,
    params?: FindManyParams
  ): any {
    let query = baseQuery

    // Apply filters
    if (params?.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            query = query.in(key, value)
          } else if (typeof value === 'string' && value.includes('%')) {
            query = query.like(key, value)
          } else {
            query = query.eq(key, value)
          }
        }
      })
    }

    // Apply sorting
    if (params?.sorting) {
      query = query.order(params.sorting.field, { 
        ascending: params.sorting.direction === 'asc' 
      })
    }

    // Apply pagination
    if (params?.page && params?.pageSize) {
      const from = (params.page - 1) * params.pageSize
      const to = from + params.pageSize - 1
      query = query.range(from, to)
    }

    return query
  }

  // Abstract methods to be implemented by concrete repositories
  abstract findById(id: string): Promise<ApiResponse<T>>
  abstract findMany(params?: FindManyParams): Promise<ApiResponse<PaginatedResponse<T>>>
  abstract create(data: TCreate): Promise<ApiResponse<T>>
  abstract update(id: string, data: TUpdate): Promise<ApiResponse<T>>
  abstract delete(id: string): Promise<ApiResponse<boolean>>
  abstract findByIds(ids: string[]): Promise<ApiResponse<T[]>>
  abstract createMany(data: TCreate[]): Promise<ApiResponse<T[]>>
  abstract updateMany(updates: Array<{ id: string; data: TUpdate }>): Promise<ApiResponse<T[]>>
  abstract deleteMany(ids: string[]): Promise<ApiResponse<number>>
}

/**
 * Cache-enabled repository for frequently accessed data
 */
export abstract class CachedRepository<T, TCreate = Partial<T>, TUpdate = Partial<T>> 
  extends AbstractRepository<T, TCreate, TUpdate> {
  
  private cache = new Map<string, { data: T; timestamp: number }>()
  private readonly cacheTimeout = 5 * 60 * 1000 // 5 minutes

  constructor(
    tableName: string,
    supabase: any,
    private cacheKey: (id: string) => string = (id) => `${tableName}:${id}`
  ) {
    super(tableName, supabase)
  }

  /**
   * Get from cache if valid, otherwise fetch
   */
  protected async getFromCacheOrFetch(
    id: string,
    fetchFn: () => Promise<ApiResponse<T>>
  ): Promise<ApiResponse<T>> {
    const key = this.cacheKey(id)
    const cached = this.cache.get(key)
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return this.createSuccessResponse(cached.data)
    }

    const result = await fetchFn()
    if (result.success && result.data) {
      this.cache.set(key, { data: result.data, timestamp: Date.now() })
    }

    return result
  }

  /**
   * Invalidate cache for specific item
   */
  protected invalidateCache(id: string): void {
    const key = this.cacheKey(id)
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  protected clearCache(): void {
    this.cache.clear()
  }

  /**
   * Override update to invalidate cache - to be implemented by concrete class
   */
  protected async updateWithCacheInvalidation(
    id: string,
    data: TUpdate,
    updateFn: () => Promise<ApiResponse<T>>
  ): Promise<ApiResponse<T>> {
    const result = await updateFn()
    if (result.success) {
      this.invalidateCache(id)
    }
    return result
  }

  /**
   * Override delete to invalidate cache - to be implemented by concrete class
   */
  protected async deleteWithCacheInvalidation(
    id: string,
    deleteFn: () => Promise<ApiResponse<boolean>>
  ): Promise<ApiResponse<boolean>> {
    const result = await deleteFn()
    if (result.success) {
      this.invalidateCache(id)
    }
    return result
  }
}

/**
 * Repository factory for dependency injection
 */
export class RepositoryFactory {
  private repositories = new Map<string, any>()

  register<T>(name: string, repository: T): void {
    this.repositories.set(name, repository)
  }

  get<T>(name: string): T {
    const repository = this.repositories.get(name)
    if (!repository) {
      throw new Error(`Repository ${name} not found`)
    }
    return repository
  }

  has(name: string): boolean {
    return this.repositories.has(name)
  }
}

/**
 * Singleton repository factory instance
 */
export const repositoryFactory = new RepositoryFactory()

/**
 * Repository decorator for automatic error handling and logging
 */
export function withErrorHandling<T extends AbstractRepository<any, any, any>>(
  target: T
): T {
  const originalMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(target))
    .filter(name => name !== 'constructor' && typeof target[name as keyof T] === 'function')

  originalMethods.forEach(methodName => {
    const originalMethod = target[methodName as keyof T] as any
    
    target[methodName as keyof T] = async function(this: T, ...args: any[]) {
      const startTime = Date.now()
      
      try {
        const result = await originalMethod.apply(this, args)
        const duration = Date.now() - startTime
        
        console.debug(`Repository ${methodName} completed in ${duration}ms`)
        return result
      } catch (error) {
        const duration = Date.now() - startTime
        
        console.error(`Repository ${methodName} failed after ${duration}ms:`, error)
        return this.handleError(error)
      }
    } as any
  })

  return target
}