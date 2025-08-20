/**
 * Simple in-memory cache service for performance optimization
 * This will be replaced with Redis or similar in production
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      // Entry has expired, remove it
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    }
    
    this.cache.set(key, entry)
  }

  /**
   * Delete cached data
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++
      } else {
        validEntries++
      }
    })

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      hitRate: this.getHitRate()
    }
  }

  private hits = 0
  private misses = 0

  private getHitRate(): number {
    const total = this.hits + this.misses
    return total > 0 ? (this.hits / total) * 100 : 0
  }

  /**
   * Get cached data or execute function and cache result
   */
  async getOrSet<T>(
    key: string, 
    fetchFunction: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key)
    if (cached !== null) {
      this.hits++
      return cached
    }

    this.misses++

    // Not in cache, fetch and store
    try {
      const data = await fetchFunction()
      this.set(key, data, ttl)
      return data
    } catch (error) {
      // Don't cache errors
      throw error
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => this.cache.delete(key))
  }
}

// Create singleton instance
export const cacheService = new CacheService()

// Set up periodic cleanup (every 10 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    cacheService.cleanup()
  }, 10 * 60 * 1000)
}

export default cacheService