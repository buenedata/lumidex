/**
 * Simplified Data Service - Fast, reliable data fetching
 * 
 * Design Principles:
 * 1. Simple queries with minimal joins
 * 2. Progressive loading (essential first, details later)
 * 3. Proper caching with smart invalidation
 * 4. Meaningful fallbacks when queries fail
 * 5. Optimized timeouts based on query complexity
 */

import { supabase } from './supabase'

// Cache configuration
interface CacheConfig {
  key: string
  ttl: number // Time to live in milliseconds
  data: any
  timestamp: number
}

class SimpleDataService {
  private cache = new Map<string, CacheConfig>()
  private readonly DEFAULT_TIMEOUT = 5000 // 5 seconds
  private readonly SIMPLE_TIMEOUT = 2000 // 2 seconds for simple queries
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Execute query with timeout and caching
   */
  private async executeQuery<T>(
    key: string, 
    queryFn: () => Promise<T>, 
    options: {
      timeout?: number
      useCache?: boolean
      fallback?: T
    } = {}
  ): Promise<{ success: boolean; data?: T; error?: string; fromCache?: boolean }> {
    const { timeout = this.DEFAULT_TIMEOUT, useCache = true, fallback } = options

    // Check cache first
    if (useCache) {
      const cached = this.getFromCache<T>(key)
      if (cached) {
        return { success: true, data: cached, fromCache: true }
      }
    }

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Query timeout after ${timeout}ms`)), timeout)
      })

      // Race query against timeout
      const result = await Promise.race([queryFn(), timeoutPromise])

      // Cache successful result
      if (useCache && result) {
        this.setCache(key, result)
      }

      return { success: true, data: result }
    } catch (error) {
      console.warn(`Query failed for key "${key}":`, error)
      
      // Return fallback if available
      if (fallback !== undefined) {
        return { success: true, data: fallback }
      }

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Cache management
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    // Check if expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  private setCache(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, {
      key,
      data,
      ttl,
      timestamp: Date.now()
    })
  }

  /**
   * Clear cache by pattern
   */
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      return
    }

    const keysToDelete: string[] = []
    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key)
      }
    })
    
    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * ============================
   * USER DATA - Simple & Fast
   * ============================
   */

  /**
   * Get basic user profile (essential data only)
   */
  async getUserProfile(userId: string) {
    return this.executeQuery(
      `user_profile_${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .eq('id', userId)
          .single()

        if (error) throw error
        return data
      },
      {
        timeout: this.SIMPLE_TIMEOUT,
        fallback: {
          id: userId,
          username: 'User',
          display_name: null,
          avatar_url: null
        }
      }
    )
  }

  /**
   * Get basic collection count (fast query)
   */
  async getUserCollectionCount(userId: string) {
    return this.executeQuery(
      `collection_count_${userId}`,
      async () => {
        const { count, error } = await supabase
          .from('user_collections')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)

        if (error) throw error
        return count || 0
      },
      {
        timeout: this.SIMPLE_TIMEOUT,
        fallback: 0
      }
    )
  }

  /**
   * ============================
   * COLLECTION DATA - Chunked Loading
   * ============================
   */

  /**
   * Get collection with smart pagination
   */
  async getCollectionChunk(userId: string, options: {
    offset?: number
    limit?: number
    setId?: string
  } = {}) {
    const { offset = 0, limit = 24, setId } = options
    const cacheKey = `collection_chunk_${userId}_${offset}_${limit}_${setId || 'all'}`

    return this.executeQuery(
      cacheKey,
      async () => {
        let query = supabase
          .from('user_collections')
          .select(`
            id,
            card_id,
            quantity,
            condition,
            variant,
            created_at,
            cards!inner(
              id,
              name,
              number,
              rarity,
              image_small,
              cardmarket_avg_sell_price,
              sets!inner(id, name)
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (setId) {
          query = query.eq('cards.set_id', setId)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
      },
      {
        useCache: offset === 0, // Only cache first chunk
        fallback: []
      }
    )
  }

  /**
   * Get available sets for user (simple count query)
   */
  async getUserSets(userId: string) {
    return this.executeQuery(
      `user_sets_${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('user_collections')
          .select(`
            cards!inner(
              set_id,
              sets!inner(id, name)
            )
          `)
          .eq('user_id', userId)

        if (error) throw error

        // Process into unique sets
        const setsMap = new Map()
        data?.forEach((item: any) => {
          const set = item.cards?.sets
          if (set && !setsMap.has(set.id)) {
            setsMap.set(set.id, set)
          }
        })

        return Array.from(setsMap.values()).sort((a: any, b: any) => 
          a.name.localeCompare(b.name)
        )
      },
      {
        fallback: []
      }
    )
  }

  /**
   * ============================
   * DASHBOARD DATA - Essential First
   * ============================
   */

  /**
   * Get essential dashboard data (fast queries only)
   */
  async getDashboardEssentials(userId: string) {
    return this.executeQuery(
      `dashboard_essentials_${userId}`,
      async () => {
        // Run simple queries in parallel
        const [userProfile, collectionData, totalUsers] = await Promise.allSettled([
          // User profile
          supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', userId)
            .single(),
          
          // Collection with actual pricing data
          supabase
            .from('user_collections')
            .select(`
              quantity,
              variant,
              cards!inner(
                cardmarket_avg_sell_price,
                cardmarket_low_price,
                cardmarket_trend_price,
                cardmarket_reverse_holo_sell,
                cardmarket_reverse_holo_low,
                cardmarket_reverse_holo_trend
              )
            `)
            .eq('user_id', userId),
          
          // Total community users
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
        ])

        // Process results safely
        const profile = userProfile.status === 'fulfilled' ? userProfile.value.data : null
        const collectionResult = collectionData.status === 'fulfilled' ? collectionData.value : null
        const communityResult = totalUsers.status === 'fulfilled' ? totalUsers.value : null

        // Calculate actual collection value using variant pricing
        let actualValue = 0
        let totalCards = 0
        
        if (collectionResult?.data && Array.isArray(collectionResult.data)) {
          collectionResult.data.forEach((item: any) => {
            const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
            const variant = item.variant || 'normal'
            const quantity = item.quantity || 1
            
            // Use appropriate price based on variant
            let cardPrice = 0
            if (variant === 'reverse_holo' && card?.cardmarket_reverse_holo_sell) {
              cardPrice = card.cardmarket_reverse_holo_sell
            } else if (card?.cardmarket_avg_sell_price) {
              cardPrice = card.cardmarket_avg_sell_price
            } else if (card?.cardmarket_low_price) {
              cardPrice = card.cardmarket_low_price
            }
            
            actualValue += cardPrice * quantity
            totalCards += quantity
          })
        }

        return {
          profile: profile || { username: 'User', display_name: null, avatar_url: null },
          totalCards,
          totalUsers: communityResult?.count || 1,
          estimatedValue: actualValue // Now using actual calculated value
        }
      },
      {
        timeout: this.DEFAULT_TIMEOUT, // Use longer timeout for pricing query
        fallback: {
          profile: { username: 'User', display_name: null, avatar_url: null },
          totalCards: 0,
          totalUsers: 1,
          estimatedValue: 0
        }
      }
    )
  }

  /**
   * ============================
   * TRADING DATA - Simplified
   * ============================
   */

  /**
   * Get basic trade counts (fast query)
   */
  async getTradeCounts(userId: string) {
    return this.executeQuery(
      `trade_counts_${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('trades')
          .select('status')
          .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)

        if (error) throw error

        const trades = data || []
        return {
          total: trades.length,
          pending: trades.filter(t => t.status === 'pending').length,
          active: trades.filter(t => ['pending', 'accepted'].includes(t.status)).length,
          completed: trades.filter(t => t.status === 'completed').length
        }
      },
      {
        timeout: this.SIMPLE_TIMEOUT,
        fallback: { total: 0, pending: 0, active: 0, completed: 0 }
      }
    )
  }

  /**
   * Get trades in chunks (pagination)
   */
  async getTradesChunk(userId: string, options: {
    status?: string
    offset?: number
    limit?: number
  } = {}) {
    const { status, offset = 0, limit = 10 } = options
    const cacheKey = `trades_chunk_${userId}_${status || 'all'}_${offset}_${limit}`

    return this.executeQuery(
      cacheKey,
      async () => {
        let query = supabase
          .from('trades')
          .select(`
            id,
            initiator_id,
            recipient_id,
            status,
            created_at,
            updated_at,
            initiator:profiles!trades_initiator_id_fkey(username, display_name, avatar_url),
            recipient:profiles!trades_recipient_id_fkey(username, display_name, avatar_url)
          `)
          .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (status) {
          query = query.eq('status', status)
        }

        const { data, error } = await query
        if (error) throw error
        return data || []
      },
      {
        useCache: offset === 0,
        fallback: []
      }
    )
  }

  /**
   * ============================
   * MENU DATA - Simplified
   * ============================
   */

  /**
   * Get menu sets (simplified for mega menu)
   */
  async getMenuSets() {
    const result = await this.executeQuery(
      'menu_sets',
      async () => {
        const { data, error } = await supabase
          .from('sets')
          .select('id, name, series, release_date, total_cards, symbol_url')
          .order('release_date', { ascending: false })
          .limit(50) // Reasonable limit

        if (error) throw error
        return data || []
      },
      {
        fallback: []
      }
    )
    
    // Set longer cache for menu sets
    if (result.success && result.data && !result.fromCache) {
      this.setCache('menu_sets', result.data, 10 * 60 * 1000) // 10 minutes
    }
    
    return result
  }

  /**
   * ============================
   * UTILITY METHODS
   * ============================
   */

  /**
   * Invalidate user-specific cache
   */
  invalidateUserCache(userId: string): void {
    this.clearCache(userId)
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Health check - test database connectivity
   */
  async healthCheck() {
    return this.executeQuery(
      'health_check',
      async () => {
        const { data, error } = await supabase
          .from('sets')
          .select('count')
          .limit(1)

        if (error) throw error
        return { status: 'healthy', timestamp: Date.now() }
      },
      {
        timeout: 1000, // 1 second for health check
        useCache: false,
        fallback: { status: 'unhealthy', timestamp: Date.now() }
      }
    )
  }
}

// Export singleton instance
export const simpleDataService = new SimpleDataService()
export default simpleDataService