// Service registry - dependency injection and service management

import { UserRepository } from '../repositories/user-repository'
import { userService } from '../services/user-service'
import { collectionDomainService } from '../services/domain/collection-domain-service'
import { supabase } from '../supabase'

/**
 * Service registry for dependency injection and service management
 */
export class ServiceRegistry {
  private services = new Map<string, any>()
  private repositories = new Map<string, any>()
  private initialized = false

  /**
   * Initialize all services and their dependencies
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Register repositories first (data access layer)
      this.repositories.set('userRepository', new UserRepository(supabase as any))
      // Additional repositories would be registered here:
      // this.repositories.set('cardRepository', cardRepository)
      // this.repositories.set('collectionRepository', collectionRepository)
      // this.repositories.set('wishlistRepository', wishlistRepository)
      // this.repositories.set('tradeRepository', tradeRepository)

      // Register services (business logic layer)
      this.services.set('userService', userService)
      // Additional services would be registered here:
      // this.services.set('cardService', cardService)
      // this.services.set('collectionService', collectionService)
      // this.services.set('wishlistService', wishlistService)
      // this.services.set('tradeService', tradeService)

      // Register domain services (orchestration layer)
      this.services.set('collectionDomainService', collectionDomainService)
      // Additional domain services:
      // this.services.set('tradingDomainService', tradingDomainService)
      // this.services.set('socialDomainService', socialDomainService)

      this.initialized = true
      console.log('Service registry initialized successfully')
    } catch (error) {
      console.error('Failed to initialize service registry:', error)
      throw error
    }
  }

  /**
   * Get a service by name
   */
  getService<T>(name: string): T {
    if (!this.initialized) {
      throw new Error('Service registry not initialized. Call initialize() first.')
    }

    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service '${name}' not found in registry`)
    }

    return service
  }

  /**
   * Get a repository by name
   */
  getRepository<T>(name: string): T {
    if (!this.initialized) {
      throw new Error('Service registry not initialized. Call initialize() first.')
    }

    const repository = this.repositories.get(name)
    if (!repository) {
      throw new Error(`Repository '${name}' not found in registry`)
    }

    return repository
  }

  /**
   * Check if service exists
   */
  hasService(name: string): boolean {
    return this.services.has(name)
  }

  /**
   * Check if repository exists
   */
  hasRepository(name: string): boolean {
    return this.repositories.has(name)
  }

  /**
   * Register a new service
   */
  registerService<T>(name: string, service: T): void {
    this.services.set(name, service)
  }

  /**
   * Register a new repository
   */
  registerRepository<T>(name: string, repository: T): void {
    this.repositories.set(name, repository)
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys())
  }

  /**
   * Get all registered repository names
   */
  getRepositoryNames(): string[] {
    return Array.from(this.repositories.keys())
  }

  /**
   * Clear all services and repositories (for testing)
   */
  clear(): void {
    this.services.clear()
    this.repositories.clear()
    this.initialized = false
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    services: Record<string, 'healthy' | 'unhealthy'>
    repositories: Record<string, 'healthy' | 'unhealthy'>
    overall: 'healthy' | 'degraded' | 'unhealthy'
  }> {
    const serviceStatus: Record<string, 'healthy' | 'unhealthy'> = {}
    const repositoryStatus: Record<string, 'healthy' | 'unhealthy'> = {}

    // Check service health (basic connectivity)
    for (const [name, service] of Array.from(this.services.entries())) {
      try {
        // Services should implement a health check method
        if (typeof service.healthCheck === 'function') {
          await service.healthCheck()
          serviceStatus[name] = 'healthy'
        } else {
          serviceStatus[name] = 'healthy' // Assume healthy if no health check
        }
      } catch {
        serviceStatus[name] = 'unhealthy'
      }
    }

    // Check repository health (database connectivity)
    for (const [name, repository] of Array.from(this.repositories.entries())) {
      try {
        // Repositories should implement a health check method
        if (typeof repository.healthCheck === 'function') {
          await repository.healthCheck()
          repositoryStatus[name] = 'healthy'
        } else {
          repositoryStatus[name] = 'healthy' // Assume healthy if no health check
        }
      } catch {
        repositoryStatus[name] = 'unhealthy'
      }
    }

    // Determine overall health
    const allStatuses = [
      ...Object.values(serviceStatus),
      ...Object.values(repositoryStatus)
    ]

    let overall: 'healthy' | 'degraded' | 'unhealthy'
    if (allStatuses.every(status => status === 'healthy')) {
      overall = 'healthy'
    } else if (allStatuses.some(status => status === 'healthy')) {
      overall = 'degraded'
    } else {
      overall = 'unhealthy'
    }

    return {
      services: serviceStatus,
      repositories: repositoryStatus,
      overall
    }
  }
}

/**
 * Global service registry instance
 */
export const serviceRegistry = new ServiceRegistry()

/**
 * Convenience functions for getting common services
 */
export const getService = <T>(name: string): T => serviceRegistry.getService<T>(name)
export const getRepository = <T>(name: string): T => serviceRegistry.getRepository<T>(name)

/**
 * Type-safe service getters
 */
export const getUserService = () => serviceRegistry.getService<typeof userService>('userService')
export const getCollectionDomainService = () => serviceRegistry.getService<typeof collectionDomainService>('collectionDomainService')
export const getUserRepository = () => serviceRegistry.getRepository<UserRepository>('userRepository')

/**
 * Service registry initialization hook for Next.js
 */
export async function initializeServices(): Promise<void> {
  if (typeof window === 'undefined') {
    // Server-side initialization
    await serviceRegistry.initialize()
  } else {
    // Client-side initialization
    await serviceRegistry.initialize()
  }
}

/**
 * Service health check endpoint helper
 */
export async function getSystemHealth() {
  try {
    const health = await serviceRegistry.getHealthStatus()
    return {
      status: health.overall,
      timestamp: new Date().toISOString(),
      services: health.services,
      repositories: health.repositories,
      uptime: process.uptime?.() || 0
    }
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      uptime: process.uptime?.() || 0
    }
  }
}

/**
 * Decorator for automatic service injection
 */
export function injectService(serviceName: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args)
        // Inject the service as a property
        ;(this as any)[serviceName] = serviceRegistry.getService(serviceName)
      }
    }
  }
}

/**
 * Service dependency validator
 */
export function validateServiceDependencies(requiredServices: string[]): void {
  const missingServices: string[] = []
  
  for (const serviceName of requiredServices) {
    if (!serviceRegistry.hasService(serviceName) && !serviceRegistry.hasRepository(serviceName)) {
      missingServices.push(serviceName)
    }
  }

  if (missingServices.length > 0) {
    throw new Error(`Missing required services: ${missingServices.join(', ')}`)
  }
}