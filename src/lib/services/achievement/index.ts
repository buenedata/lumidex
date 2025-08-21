/**
 * Achievement System - Modular architecture index
 * 
 * This index file exports the complete achievement system
 * while maintaining backward compatibility with existing code.
 */

// Core service
export { AchievementService, createAchievementService } from './achievement-service'

// Repository for data access
export { AchievementRepository } from './achievement-repository'

// Achievement definitions
export { 
  ACHIEVEMENT_DEFINITIONS,
  getAchievementDefinition,
  getAllAchievementDefinitions,
  getAchievementsByCategory,
  getAchievementsByRarity
} from './achievement-definitions'

// Requirements checking
export {
  checkAchievementRequirements,
  getCurrentProgress,
  getRequiredProgress
} from './achievement-checker'

// Progress calculation
export {
  calculateAchievementProgress,
  getAchievementProgress,
  getProgressByCategory,
  getProgressByRarity,
  getUnlockedAchievements,
  getNearlyCompleteAchievements,
  getAchievementsByCompletion,
  sortByProgress,
  sortByPoints,
  getTotalPossiblePoints,
  getTotalEarnedPoints,
  getOverallCompletion,
  getCompletionByCategory,
  getRecommendedAchievements
} from './achievement-progress'

// Statistics and analysis
export {
  calculateAchievementStats,
  getRarityBreakdown,
  getLeaderboardStats,
  getAchievementPatterns,
  getDifficultyAnalysis,
  getTimeBasedInsights,
  getComparisonStats
} from './achievement-stats'

// Types
export type { 
  Achievement,
  AchievementDefinition,
  AchievementProgress,
  AchievementStats
} from './achievement-service'