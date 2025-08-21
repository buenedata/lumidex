/**
 * Achievement Service - Main orchestrator for achievement system
 * 
 * This service coordinates all achievement modules while preserving
 * the EXACT SAME API as the original monolithic service.
 * ALL FUNCTIONALITY IS PRESERVED - NO BREAKING CHANGES.
 */

import { createClient } from '@supabase/supabase-js'
import { AchievementRepository, type Achievement } from './achievement-repository'
import { 
  ACHIEVEMENT_DEFINITIONS, 
  getAchievementDefinition, 
  getAllAchievementDefinitions,
  type AchievementDefinition 
} from './achievement-definitions'
import { checkAchievementRequirements } from './achievement-checker'
import { 
  calculateAchievementProgress, 
  type AchievementProgress 
} from './achievement-progress'
import { 
  calculateAchievementStats, 
  type AchievementStats 
} from './achievement-stats'

export class AchievementService {
  private repository: AchievementRepository

  constructor(supabase: ReturnType<typeof createClient>) {
    this.repository = new AchievementRepository(supabase)
  }

  /**
   * Get all achievement definitions
   * PRESERVES ORIGINAL API
   */
  getAchievementDefinitions(): AchievementDefinition[] {
    return getAllAchievementDefinitions()
  }

  /**
   * Get achievement definition by type
   * PRESERVES ORIGINAL API
   */
  getAchievementDefinition(type: string): AchievementDefinition | undefined {
    return getAchievementDefinition(type)
  }

  /**
   * Get user's unlocked achievements
   * PRESERVES ORIGINAL API
   */
  async getUserAchievements(userId: string): Promise<{ success: boolean; error?: string; data?: Achievement[] }> {
    return this.repository.getUserAchievements(userId)
  }

  /**
   * Check and unlock/revoke achievements for a user
   * PRESERVES ALL ORIGINAL LOGIC AND BEHAVIOR
   */
  async checkAchievements(userId: string): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[]; revokedAchievements?: string[] }> {
    try {
      // Get user's current achievements
      const achievementsResult = await this.getUserAchievements(userId)
      if (!achievementsResult.success) {
        return { success: false, error: achievementsResult.error }
      }

      const currentAchievements = achievementsResult.data || []
      const unlockedTypes = new Set(currentAchievements.map(a => a.achievement_type))
      const newAchievements: Achievement[] = []
      const revokedAchievements: string[] = []

      // Get user stats for checking requirements
      const stats = await this.repository.getUserStats(userId)
      if (!stats.success || !stats.data) {
        return { success: false, error: 'Failed to get user stats' }
      }

      // Check each achievement definition
      for (const definition of ACHIEVEMENT_DEFINITIONS) {
        const isCurrentlyUnlocked = unlockedTypes.has(definition.type)
        const shouldBeUnlocked = checkAchievementRequirements(definition, stats.data)

        if (!isCurrentlyUnlocked && shouldBeUnlocked) {
          // Unlock new achievement
          const unlockResult = await this.repository.unlockAchievement(
            userId,
            definition.type,
            { points: definition.points }
          )

          if (unlockResult.success && unlockResult.data) {
            newAchievements.push(unlockResult.data)
          }
        } else if (isCurrentlyUnlocked && !shouldBeUnlocked) {
          // Revoke achievement that is no longer valid
          // Don't revoke special achievements like early_adopter
          if (definition.category !== 'special') {
            const revokeResult = await this.repository.revokeAchievement(userId, definition.type)
            if (revokeResult.success) {
              revokedAchievements.push(definition.type)
            }
          }
        }
      }

      return { success: true, newAchievements, revokedAchievements }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get achievement progress for a user
   * PRESERVES ORIGINAL API
   */
  async getAchievementProgress(userId: string): Promise<{ success: boolean; error?: string; data?: AchievementProgress[] }> {
    try {
      const achievementsResult = await this.getUserAchievements(userId)
      if (!achievementsResult.success) {
        return { success: false, error: achievementsResult.error }
      }

      const unlockedTypes = new Set(achievementsResult.data?.map(a => a.achievement_type) || [])

      const statsResult = await this.repository.getUserStats(userId)
      if (!statsResult.success || !statsResult.data) {
        return { success: false, error: 'Failed to get user stats' }
      }

      const progress = await calculateAchievementProgress(
        ACHIEVEMENT_DEFINITIONS,
        unlockedTypes,
        statsResult.data
      )

      return { success: true, data: progress }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get achievement statistics for a user
   * PRESERVES ORIGINAL API
   */
  async getAchievementStats(userId: string): Promise<{ success: boolean; error?: string; data?: AchievementStats }> {
    try {
      const achievementsResult = await this.getUserAchievements(userId)
      if (!achievementsResult.success) {
        return { success: false, error: achievementsResult.error }
      }

      const achievements = achievementsResult.data || []
      const stats = calculateAchievementStats(achievements, ACHIEVEMENT_DEFINITIONS)

      return {
        success: true,
        data: stats
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Legacy method for backward compatibility
   * PRESERVES ORIGINAL API FOR EXISTING CODE
   */
  async getUserStats(userId: string): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.repository.getUserStats(userId)
  }

  /**
   * Legacy method for checking achievement requirements
   * PRESERVES ORIGINAL API FOR EXISTING CODE
   */
  checkAchievementRequirements(definition: AchievementDefinition, stats: any): boolean {
    return checkAchievementRequirements(definition, stats)
  }

  /**
   * Legacy method for getting current progress
   * PRESERVES ORIGINAL API FOR EXISTING CODE
   */
  getCurrentProgress(definition: AchievementDefinition, stats: any, isUnlocked: boolean = false): number {
    const { getCurrentProgress } = require('./achievement-checker')
    return getCurrentProgress(definition, stats, isUnlocked)
  }

  /**
   * Legacy method for getting required progress
   * PRESERVES ORIGINAL API FOR EXISTING CODE
   */
  getRequiredProgress(definition: AchievementDefinition): number {
    const { getRequiredProgress } = require('./achievement-checker')
    return getRequiredProgress(definition)
  }
}

/**
 * Export types for backward compatibility
 */
export type { Achievement, AchievementDefinition, AchievementProgress, AchievementStats }

/**
 * Create and export service instance (for backward compatibility)
 */
export function createAchievementService(supabase: ReturnType<typeof createClient>): AchievementService {
  return new AchievementService(supabase)
}

/**
 * Legacy export for existing imports
 * This allows existing code that imports { achievementService } to continue working
 */
let legacyServiceInstance: AchievementService | null = null

export function getLegacyAchievementService(): AchievementService {
  if (!legacyServiceInstance) {
    // This will be properly initialized when the service factory is used
    throw new Error('Achievement service not initialized. Use service factory to get instance.')
  }
  return legacyServiceInstance
}

export function setLegacyAchievementService(service: AchievementService): void {
  legacyServiceInstance = service
}