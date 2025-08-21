/**
 * Achievement Progress Calculator - Progress tracking and calculation
 * 
 * Handles calculation of achievement progress and generates progress reports.
 * This preserves ALL original progress calculation logic.
 */

import type { AchievementDefinition } from './achievement-definitions'
import { getCurrentProgress, getRequiredProgress } from './achievement-checker'

export interface AchievementProgress {
  achievement_type: string
  current: number
  required: number
  percentage: number
  unlocked: boolean
  definition: AchievementDefinition
}

/**
 * Calculate achievement progress for a user
 * PRESERVES ALL ORIGINAL LOGIC - NO CHANGES TO FUNCTIONALITY
 */
export async function calculateAchievementProgress(
  definitions: AchievementDefinition[],
  unlockedTypes: Set<string>,
  stats: any
): Promise<AchievementProgress[]> {
  const progress: AchievementProgress[] = []

  for (const definition of definitions) {
    if (definition.hidden && !unlockedTypes.has(definition.type)) {
      continue // Skip hidden achievements that aren't unlocked
    }

    // Determine unlocked status - if it's in database, it should be unlocked
    // Only check requirements for display purposes (progress calculation)
    const unlocked = unlockedTypes.has(definition.type)

    const current = getCurrentProgress(definition, stats, unlocked)
    const required = getRequiredProgress(definition)
    const percentage = required > 0 ? Math.min((current / required) * 100, 100) : 100

    progress.push({
      achievement_type: definition.type,
      current,
      required,
      percentage,
      unlocked,
      definition
    })
  }

  return progress
}

/**
 * Get progress for a specific achievement
 */
export function getAchievementProgress(
  definition: AchievementDefinition,
  isUnlocked: boolean,
  stats: any
): AchievementProgress {
  const current = getCurrentProgress(definition, stats, isUnlocked)
  const required = getRequiredProgress(definition)
  const percentage = required > 0 ? Math.min((current / required) * 100, 100) : 100

  return {
    achievement_type: definition.type,
    current,
    required,
    percentage,
    unlocked: isUnlocked,
    definition
  }
}

/**
 * Get progress by category
 */
export function getProgressByCategory(
  progress: AchievementProgress[]
): Record<string, AchievementProgress[]> {
  return progress.reduce((acc, item) => {
    const category = item.definition.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, AchievementProgress[]>)
}

/**
 * Get progress by rarity
 */
export function getProgressByRarity(
  progress: AchievementProgress[]
): Record<string, AchievementProgress[]> {
  return progress.reduce((acc, item) => {
    const rarity = item.definition.rarity
    if (!acc[rarity]) {
      acc[rarity] = []
    }
    acc[rarity].push(item)
    return acc
  }, {} as Record<string, AchievementProgress[]>)
}

/**
 * Get unlocked achievements only
 */
export function getUnlockedAchievements(progress: AchievementProgress[]): AchievementProgress[] {
  return progress.filter(item => item.unlocked)
}

/**
 * Get achievements close to completion (>= 80% progress)
 */
export function getNearlyCompleteAchievements(progress: AchievementProgress[]): AchievementProgress[] {
  return progress.filter(item => !item.unlocked && item.percentage >= 80)
}

/**
 * Get achievements by completion range
 */
export function getAchievementsByCompletion(
  progress: AchievementProgress[],
  minPercentage: number,
  maxPercentage: number = 100
): AchievementProgress[] {
  return progress.filter(item => 
    item.percentage >= minPercentage && 
    item.percentage <= maxPercentage &&
    !item.unlocked
  )
}

/**
 * Sort achievements by progress percentage
 */
export function sortByProgress(
  progress: AchievementProgress[],
  ascending: boolean = false
): AchievementProgress[] {
  return [...progress].sort((a, b) => 
    ascending ? a.percentage - b.percentage : b.percentage - a.percentage
  )
}

/**
 * Sort achievements by points
 */
export function sortByPoints(
  progress: AchievementProgress[],
  ascending: boolean = false
): AchievementProgress[] {
  return [...progress].sort((a, b) => 
    ascending ? a.definition.points - b.definition.points : b.definition.points - a.definition.points
  )
}

/**
 * Get total possible points from all achievements
 */
export function getTotalPossiblePoints(definitions: AchievementDefinition[]): number {
  return definitions
    .filter(def => !def.hidden)
    .reduce((sum, def) => sum + def.points, 0)
}

/**
 * Get total earned points from unlocked achievements
 */
export function getTotalEarnedPoints(progress: AchievementProgress[]): number {
  return progress
    .filter(item => item.unlocked)
    .reduce((sum, item) => sum + item.definition.points, 0)
}

/**
 * Calculate overall completion percentage
 */
export function getOverallCompletion(progress: AchievementProgress[]): number {
  const total = progress.filter(item => !item.definition.hidden).length
  const unlocked = progress.filter(item => item.unlocked && !item.definition.hidden).length
  return total > 0 ? (unlocked / total) * 100 : 0
}

/**
 * Get completion by category
 */
export function getCompletionByCategory(
  progress: AchievementProgress[]
): Record<string, { unlocked: number; total: number; percentage: number }> {
  const categories = getProgressByCategory(progress)
  const result: Record<string, { unlocked: number; total: number; percentage: number }> = {}

  for (const [category, items] of Object.entries(categories)) {
    const total = items.filter(item => !item.definition.hidden).length
    const unlocked = items.filter(item => item.unlocked && !item.definition.hidden).length
    const percentage = total > 0 ? (unlocked / total) * 100 : 0

    result[category] = { unlocked, total, percentage }
  }

  return result
}

/**
 * Get recommended achievements (high value, low difficulty)
 */
export function getRecommendedAchievements(
  progress: AchievementProgress[],
  limit: number = 5
): AchievementProgress[] {
  return progress
    .filter(item => !item.unlocked && item.percentage > 0)
    .sort((a, b) => {
      // Score based on points and current progress
      const scoreA = (a.definition.points * 0.7) + (a.percentage * 0.3)
      const scoreB = (b.definition.points * 0.7) + (b.percentage * 0.3)
      return scoreB - scoreA
    })
    .slice(0, limit)
}