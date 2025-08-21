import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CollectionRepository } from '@/lib/repositories/collection-repository'
import { CardRepository } from '@/lib/repositories/card-repository'
import { UserRepository } from '@/lib/repositories/user-repository'

/**
 * Service Factory - centralized dependency injection and service management
 * 
 * Provides singleton instances of repositories and services with proper
 * dependency injection. Ensures consistent Supabase client usage across
 * the application.
 */
export class ServiceFactory {
  private static instance: ServiceFactory
  private supabaseClient: any
  
  // Repository instances
  private _collectionRepository?: CollectionRepository
  private _cardRepository?: CardRepository
  private _userRepository?: UserRepository

  private constructor(supabaseClient: any) {
    this.supabaseClient = supabaseClient
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(supabaseClient?: SupabaseClient): ServiceFactory {
    if (!ServiceFactory.instance) {
      if (!supabaseClient) {
        throw new Error('ServiceFactory requires Supabase client for initialization')
      }
      ServiceFactory.instance = new ServiceFactory(supabaseClient)
    }
    return ServiceFactory.instance
  }

  /**
   * Initialize with environment variables (for server-side usage)
   */
  static initializeWithEnv(): ServiceFactory {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const client = createClient(supabaseUrl, supabaseKey)
    return ServiceFactory.getInstance(client)
  }

  /**
   * Reset singleton (useful for testing)
   */
  static reset(): void {
    ServiceFactory.instance = undefined as any
  }

  // Repository getters with lazy initialization
  
  get collectionRepository(): CollectionRepository {
    if (!this._collectionRepository) {
      this._collectionRepository = new CollectionRepository(this.supabaseClient)
    }
    return this._collectionRepository
  }

  get cardRepository(): CardRepository {
    if (!this._cardRepository) {
      this._cardRepository = new CardRepository(this.supabaseClient)
    }
    return this._cardRepository
  }

  get userRepository(): UserRepository {
    if (!this._userRepository) {
      this._userRepository = new UserRepository(this.supabaseClient)
    }
    return this._userRepository
  }


  /**
   * Get the underlying Supabase client
   */
  get supabase(): any {
    return this.supabaseClient
  }

  /**
   * Health check - verify all repositories can connect
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy'
    repositories: Record<string, boolean>
    timestamp: string
  }> {
    const results = {
      status: 'healthy' as 'healthy' | 'unhealthy',
      repositories: {} as Record<string, boolean>,
      timestamp: new Date().toISOString()
    }

    try {
      // Test basic connection with a simple query
      const { error } = await this.supabaseClient
        .from('users')
        .select('id')
        .limit(1)

      results.repositories.connection = !error
      
      if (error) {
        results.status = 'unhealthy'
      }
    } catch (error) {
      results.repositories.connection = false
      results.status = 'unhealthy'
    }

    return results
  }

  /**
   * Cleanup resources (for graceful shutdown)
   */
  cleanup(): void {
    // Reset repository instances
    this._collectionRepository = undefined
    this._cardRepository = undefined
    this._userRepository = undefined

    // Note: Supabase client doesn't require explicit cleanup
  }
}

/**
 * Hook-style factory access for React components
 */
export const useServiceFactory = (supabaseClient: any): ServiceFactory => {
  return ServiceFactory.getInstance(supabaseClient)
}

/**
 * Direct repository access helpers (for convenience)
 */
export const getCardRepository = (supabaseClient: any): CardRepository => {
  return ServiceFactory.getInstance(supabaseClient).cardRepository
}

export const getUserRepository = (supabaseClient: any): UserRepository => {
  return ServiceFactory.getInstance(supabaseClient).userRepository
}

export const getCollectionRepository = (supabaseClient: any): CollectionRepository => {
  return ServiceFactory.getInstance(supabaseClient).collectionRepository
}

/**
 * Server-side service access (for API routes and server components)
 */
export const getServerServices = (): ServiceFactory => {
  return ServiceFactory.initializeWithEnv()
}

/**
 * Type-safe service factory interface
 */
export interface IServiceFactory {
  collectionRepository: CollectionRepository
  cardRepository: CardRepository
  userRepository: UserRepository
  supabase: any
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; repositories: Record<string, boolean>; timestamp: string }>
  cleanup(): void
}

// Ensure ServiceFactory implements the interface
const _typeCheck: IServiceFactory = {} as ServiceFactory