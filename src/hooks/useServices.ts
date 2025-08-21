import { useMemo } from 'react'
import { ServiceFactory } from '@/lib/core/service-factory'
import { supabase } from '@/lib/supabase'
import type { CollectionRepository } from '@/lib/repositories/collection-repository'
import type { CardRepository } from '@/lib/repositories/card-repository'
import type { UserRepository } from '@/lib/repositories/user-repository'
import type { CollectionSortField } from '@/types/domains/collection'

/**
 * Custom hook to access all services through the service factory
 * Provides a clean interface for React components to use our new service layer
 */
export function useServices() {
  const factory = useMemo(() => {
    return ServiceFactory.getInstance(supabase)
  }, [])

  return useMemo(() => ({
    // Repositories
    collectionRepository: factory.collectionRepository,
    cardRepository: factory.cardRepository,
    userRepository: factory.userRepository,
    
    // Factory and Supabase client
    factory,
    supabase
  }), [factory])
}

/**
 * Hook specifically for collection operations
 * Provides collection repository with proper error handling and loading states
 */
export function useCollectionService() {
  const { collectionRepository } = useServices()
  return collectionRepository
}

/**
 * Hook for card repository operations
 */
export function useCardRepository() {
  const { cardRepository } = useServices()
  return cardRepository
}

/**
 * Hook for user repository operations
 */
export function useUserRepository() {
  const { userRepository } = useServices()
  return userRepository
}

/**
 * Hook for collection repository operations (for advanced use cases)
 */
export function useCollectionRepository() {
  const { collectionRepository } = useServices()
  return collectionRepository
}

/**
 * Hook that provides convenient collection operations with built-in state management
 * This replaces direct service calls with a more React-friendly interface
 */
export function useCollectionOperations() {
  const collectionRepository = useCollectionService()
  
  const addToCollection = async (
    userId: string,
    cardId: string,
    options: {
      quantity?: number
      condition?: string
      variant?: string
      notes?: string
    } = {}
  ) => {
    return collectionRepository.create({
      user_id: userId,
      card_id: cardId,
      quantity: options.quantity || 1,
      condition: options.condition || 'near_mint',
      variant: options.variant || 'normal',
      notes: options.notes
    })
  }

  const removeFromCollection = async (userId: string, entryId: string) => {
    return collectionRepository.delete(entryId)
  }

  const updateCollectionEntry = async (
    entryId: string,
    updates: {
      quantity?: number
      condition?: string
      variant?: string
      notes?: string
    }
  ) => {
    return collectionRepository.update(entryId, updates)
  }

  const getUserCollection = async (
    userId: string,
    options: {
      page?: number
      pageSize?: number
      filters?: any
      sortBy?: CollectionSortField
      sortDirection?: 'asc' | 'desc'
    } = {}
  ) => {
    return collectionRepository.getUserCollection(
      userId,
      options.page || 1,
      options.pageSize || 24,
      options.filters || {}
    )
  }

  const getCollectionStats = async (userId: string) => {
    return collectionRepository.getCollectionForStats(userId)
  }

  const clearCollection = async (userId: string) => {
    return collectionRepository.clearUserCollection(userId)
  }

  const checkCardOwnership = async (userId: string, cardId: string) => {
    return collectionRepository.checkOwnership(userId, cardId)
  }

  return {
    addToCollection,
    removeFromCollection,
    updateCollectionEntry,
    getUserCollection,
    getCollectionStats,
    clearCollection,
    checkCardOwnership,
    
    // Direct repository access for advanced operations
    repository: collectionRepository
  }
}