/**
 * React hooks for simplified data fetching
 * 
 * These hooks use the simple data service and provide:
 * - Proper loading states
 * - Error handling with meaningful fallbacks
 * - Progressive loading patterns
 * - Cache integration
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { simpleDataService } from '@/lib/simple-data-service'

interface UseDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  fromCache: boolean
}

/**
 * Base hook for data fetching with the simple service
 */
function useSimpleData<T>(
  fetchFn: () => Promise<{ success: boolean; data?: T; error?: string; fromCache?: boolean }>,
  deps: any[] = [],
  options: {
    autoFetch?: boolean
    fallback?: T
  } = {}
): UseDataResult<T> {
  const { autoFetch = true, fallback } = options
  const [data, setData] = useState<T | null>(fallback || null)
  const [loading, setLoading] = useState(autoFetch)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return

    setLoading(true)
    setError(null)

    try {
      const result = await fetchFn()
      
      if (!mountedRef.current) return

      if (result.success) {
        setData(result.data || null)
        setFromCache(result.fromCache || false)
        setError(null)
      } else {
        setError(result.error || 'Unknown error')
        if (fallback && !data) {
          setData(fallback)
        }
      }
    } catch (err) {
      if (!mountedRef.current) return
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      
      if (fallback && !data) {
        setData(fallback)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    
    if (autoFetch) {
      fetchData()
    }

    return () => {
      mountedRef.current = false
    }
  }, deps)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    fromCache
  }
}

/**
 * ============================
 * USER DATA HOOKS
 * ============================
 */

export function useUserProfile(userId: string | null) {
  return useSimpleData(
    () => userId ? simpleDataService.getUserProfile(userId) : Promise.resolve({ success: false, error: 'No user ID' }),
    [userId],
    {
      autoFetch: !!userId,
      fallback: userId ? { id: userId, username: 'User', display_name: null, avatar_url: null } : null
    }
  )
}

export function useUserCollectionCount(userId: string | null) {
  return useSimpleData(
    () => userId ? simpleDataService.getUserCollectionCount(userId) : Promise.resolve({ success: true, data: 0 }),
    [userId],
    {
      autoFetch: !!userId,
      fallback: 0
    }
  )
}

/**
 * ============================
 * DASHBOARD DATA HOOKS
 * ============================
 */

export function useDashboardEssentials(userId: string | null) {
  return useSimpleData(
    () => userId ? simpleDataService.getDashboardEssentials(userId) : Promise.resolve({ success: false, error: 'No user ID' }),
    [userId],
    {
      autoFetch: !!userId,
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
 * COLLECTION DATA HOOKS
 * ============================
 */

export function useCollectionChunk(
  userId: string | null,
  options: { offset?: number; limit?: number; setId?: string } = {}
) {
  const { offset = 0, limit = 24, setId } = options
  
  return useSimpleData(
    () => userId ? simpleDataService.getCollectionChunk(userId, { offset, limit, setId }) : Promise.resolve({ success: true, data: [] }),
    [userId, offset, limit, setId],
    {
      autoFetch: !!userId,
      fallback: []
    }
  )
}

export function useUserSets(userId: string | null) {
  return useSimpleData(
    () => userId ? simpleDataService.getUserSets(userId) : Promise.resolve({ success: true, data: [] }),
    [userId],
    {
      autoFetch: !!userId,
      fallback: []
    }
  )
}

/**
 * ============================
 * TRADING DATA HOOKS
 * ============================
 */

export function useTradeCounts(userId: string | null) {
  return useSimpleData(
    () => userId ? simpleDataService.getTradeCounts(userId) : Promise.resolve({ success: true, data: { total: 0, pending: 0, active: 0, completed: 0 } }),
    [userId],
    {
      autoFetch: !!userId,
      fallback: { total: 0, pending: 0, active: 0, completed: 0 }
    }
  )
}

export function useTradesChunk(
  userId: string | null,
  options: { status?: string; offset?: number; limit?: number } = {}
) {
  const { status, offset = 0, limit = 10 } = options
  
  return useSimpleData(
    () => userId ? simpleDataService.getTradesChunk(userId, { status, offset, limit }) : Promise.resolve({ success: true, data: [] }),
    [userId, status, offset, limit],
    {
      autoFetch: !!userId,
      fallback: []
    }
  )
}

/**
 * ============================
 * MENU DATA HOOKS
 * ============================
 */

export function useMenuSets() {
  return useSimpleData(
    () => simpleDataService.getMenuSets(),
    [],
    {
      fallback: []
    }
  )
}

/**
 * ============================
 * PROGRESSIVE LOADING HOOK
 * ============================
 */

interface UseProgressiveDataOptions<T, E> {
  essential: () => Promise<{ success: boolean; data?: E; error?: string; fromCache?: boolean }>
  detailed: () => Promise<{ success: boolean; data?: T; error?: string; fromCache?: boolean }>
  essentialFallback?: E
  detailedFallback?: T
  autoFetchDetailed?: boolean
}

export function useProgressiveData<T, E>(
  deps: any[],
  options: UseProgressiveDataOptions<T, E>
) {
  const { essential, detailed, essentialFallback, detailedFallback, autoFetchDetailed = true } = options
  
  const [essentialData, setEssentialData] = useState<E | null>(essentialFallback || null)
  const [detailedData, setDetailedData] = useState<T | null>(detailedFallback || null)
  const [essentialLoading, setEssentialLoading] = useState(true)
  const [detailedLoading, setDetailedLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchEssential = useCallback(async () => {
    if (!mountedRef.current) return

    setEssentialLoading(true)
    setError(null)

    try {
      const result = await essential()
      
      if (!mountedRef.current) return

      if (result.success) {
        setEssentialData(result.data || null)
        setError(null)
        
        // Start fetching detailed data
        if (autoFetchDetailed) {
          fetchDetailed()
        }
      } else {
        setError(result.error || 'Failed to load essential data')
        if (essentialFallback) {
          setEssentialData(essentialFallback)
        }
      }
    } catch (err) {
      if (!mountedRef.current) return
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      
      if (essentialFallback) {
        setEssentialData(essentialFallback)
      }
    } finally {
      if (mountedRef.current) {
        setEssentialLoading(false)
      }
    }
  }, deps)

  const fetchDetailed = useCallback(async () => {
    if (!mountedRef.current) return

    setDetailedLoading(true)

    try {
      const result = await detailed()
      
      if (!mountedRef.current) return

      if (result.success) {
        setDetailedData(result.data || null)
      } else {
        console.warn('Failed to load detailed data:', result.error)
        if (detailedFallback) {
          setDetailedData(detailedFallback)
        }
      }
    } catch (err) {
      if (!mountedRef.current) return
      console.warn('Error loading detailed data:', err)
      
      if (detailedFallback) {
        setDetailedData(detailedFallback)
      }
    } finally {
      if (mountedRef.current) {
        setDetailedLoading(false)
      }
    }
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    fetchEssential()

    return () => {
      mountedRef.current = false
    }
  }, deps)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  return {
    essentialData,
    detailedData,
    essentialLoading,
    detailedLoading,
    error,
    refetchEssential: fetchEssential,
    refetchDetailed: fetchDetailed,
    hasEssential: !!essentialData,
    hasDetailed: !!detailedData
  }
}

/**
 * ============================
 * CACHE MANAGEMENT HOOKS
 * ============================
 */

export function useCacheInvalidation() {
  const invalidateUserCache = useCallback((userId: string) => {
    simpleDataService.invalidateUserCache(userId)
  }, [])

  const clearAllCache = useCallback(() => {
    simpleDataService.clearCache()
  }, [])

  const getCacheStats = useCallback(() => {
    return simpleDataService.getCacheStats()
  }, [])

  return {
    invalidateUserCache,
    clearAllCache,
    getCacheStats
  }
}

/**
 * ============================
 * HEALTH CHECK HOOK
 * ============================
 */

export function useHealthCheck() {
  return useSimpleData(
    () => simpleDataService.healthCheck(),
    [],
    {
      fallback: { status: 'unknown', timestamp: Date.now() }
    }
  )
}