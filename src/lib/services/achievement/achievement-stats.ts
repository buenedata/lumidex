/**
 * Achievement Statistics - Statistical analysis and reporting
 * 
 * Handles calculation of achievement statistics, category breakdowns,
 * and statistical analysis. Preserves ALL original functionality.
 */

import type { Achievement } from './achievement-repository'
import type { AchievementDefinition } from './achievement-definitions'
import type { AchievementProgress } from './achievement-progress'

export interface AchievementStats {
  totalAchievements: number
  unlockedAchievements: number
  totalPoints: number
  completionPercentage: number
  recentAchievements: Achievement[]
  categoryStats: {
    collection: { unlocked: number; total: number }
    social: { unlocked: number; total: number }
    trading: { unlocked: number; total: number }
    special: { unlocked: number; total: number }
  }
}

/**
 * Calculate comprehensive achievement statistics
 * PRESERVES ALL ORIGINAL LOGIC - NO CHANGES TO FUNCTIONALITY
 */
export function calculateAchievementStats(
  achievements: Achievement[],
  definitions: AchievementDefinition[]
): AchievementStats {
  const totalAchievements = definitions.filter(def => !def.hidden).length
  const unlockedAchievements = achievements.length
  const totalPoints = achievements.reduce((sum, ach) => sum + (ach.achievement_data?.points || 0), 0)
  const completionPercentage = totalAchievements > 0 ? (unlockedAchievements / totalAchievements) * 100 : 0

  // Category stats
  const unlockedTypes = new Set(achievements.map(a => a.achievement_type))
  const categoryStats = {
    collection: { unlocked: 0, total: 0 },
    social: { unlocked: 0, total: 0 },
    trading: { unlocked: 0, total: 0 },
    special: { unlocked: 0, total: 0 }
  }

  for (const def of definitions) {
    if (def.hidden) continue
    
    categoryStats[def.category].total++
    if (unlockedTypes.has(def.type)) {
      categoryStats[def.category].unlocked++
    }
  }

  return {
    totalAchievements,
    unlockedAchievements,
    totalPoints,
    completionPercentage,
    recentAchievements: achievements.slice(0, 5),
    categoryStats
  }
}

/**
 * Get achievements by rarity breakdown
 */
export function getRarityBreakdown(
  achievements: Achievement[],
  definitions: AchievementDefinition[]
): Record<string, { unlocked: number; total: number; percentage: number }> {
  const unlockedTypes = new Set(achievements.map(a => a.achievement_type))
  const rarityStats: Record<string, { unlocked: number; total: number; percentage: number }> = {}

  for (const def of definitions) {
    if (def.hidden) continue

    if (!rarityStats[def.rarity]) {
      rarityStats[def.rarity] = { unlocked: 0, total: 0, percentage: 0 }
    }

    rarityStats[def.rarity].total++
    if (unlockedTypes.has(def.type)) {
      rarityStats[def.rarity].unlocked++
    }
  }

  // Calculate percentages
  for (const rarity of Object.keys(rarityStats)) {
    const stats = rarityStats[rarity]
    stats.percentage = stats.total > 0 ? (stats.unlocked / stats.total) * 100 : 0
  }

  return rarityStats
}

/**
 * Get achievement leaderboard data
 */
export function getLeaderboardStats(achievements: Achievement[]): {
  totalPoints: number
  achievementCount: number
  averagePointsPerAchievement: number
  recentActivity: Achievement[]
} {
  const totalPoints = achievements.reduce((sum, ach) => sum + (ach.achievement_data?.points || 0), 0)
  const achievementCount = achievements.length
  const averagePointsPerAchievement = achievementCount > 0 ? totalPoints / achievementCount : 0
  const recentActivity = achievements
    .sort((a, b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime())
    .slice(0, 10)

  return {
    totalPoints,
    achievementCount,
    averagePointsPerAchievement,
    recentActivity
  }
}

/**
 * Get achievement streaks and patterns
 */
export function getAchievementPatterns(achievements: Achievement[]): {
  longestStreak: number
  currentStreak: number
  mostActiveDay: string
  achievementVelocity: number
  monthlyBreakdown: Record<string, number>
} {
  if (achievements.length === 0) {
    return {
      longestStreak: 0,
      currentStreak: 0,
      mostActiveDay: 'Monday',
      achievementVelocity: 0,
      monthlyBreakdown: {}
    }
  }

  // Sort achievements by unlock date
  const sortedAchievements = [...achievements].sort((a, b) => 
    new Date(a.unlocked_at).getTime() - new Date(b.unlocked_at).getTime()
  )

  // Calculate streaks (simplified - consecutive days with achievements)
  let longestStreak = 1
  let currentStreak = 1
  
  for (let i = 1; i < sortedAchievements.length; i++) {
    const current = new Date(sortedAchievements[i].unlocked_at)
    const previous = new Date(sortedAchievements[i - 1].unlocked_at)
    const daysDiff = Math.floor((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff <= 1) {
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 1
    }
  }

  // Get most active day of week
  const dayOfWeekCount: Record<string, number> = {}
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  achievements.forEach(ach => {
    const dayOfWeek = days[new Date(ach.unlocked_at).getDay()]
    dayOfWeekCount[dayOfWeek] = (dayOfWeekCount[dayOfWeek] || 0) + 1
  })

  const mostActiveDay = Object.entries(dayOfWeekCount)
    .reduce((max, [day, count]) => count > (dayOfWeekCount[max] || 0) ? day : max, 'Monday')

  // Calculate achievement velocity (achievements per week)
  const firstAchievement = new Date(sortedAchievements[0].unlocked_at)
  const lastAchievement = new Date(sortedAchievements[sortedAchievements.length - 1].unlocked_at)
  const weeksSpan = Math.max(1, (lastAchievement.getTime() - firstAchievement.getTime()) / (1000 * 60 * 60 * 24 * 7))
  const achievementVelocity = achievements.length / weeksSpan

  // Monthly breakdown
  const monthlyBreakdown: Record<string, number> = {}
  achievements.forEach(ach => {
    const month = new Date(ach.unlocked_at).toISOString().slice(0, 7) // YYYY-MM
    monthlyBreakdown[month] = (monthlyBreakdown[month] || 0) + 1
  })

  return {
    longestStreak,
    currentStreak,
    mostActiveDay,
    achievementVelocity,
    monthlyBreakdown
  }
}

/**
 * Get achievement difficulty analysis
 */
export function getDifficultyAnalysis(
  progress: AchievementProgress[]
): {
  easiest: AchievementProgress[]
  hardest: AchievementProgress[]
  averageCompletion: number
  completionDistribution: Record<string, number>
} {
  const unlocked = progress.filter(p => p.unlocked)
  const locked = progress.filter(p => !p.unlocked)

  // Easiest: high completion rate among locked achievements
  const easiest = locked
    .filter(p => p.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5)

  // Hardest: low completion rate and high point value
  const hardest = locked
    .sort((a, b) => {
      const scoreA = a.percentage + (a.definition.points / 100)
      const scoreB = b.percentage + (b.definition.points / 100)
      return scoreA - scoreB
    })
    .slice(0, 5)

  // Average completion percentage
  const totalCompletion = progress.reduce((sum, p) => sum + p.percentage, 0)
  const averageCompletion = progress.length > 0 ? totalCompletion / progress.length : 0

  // Completion distribution
  const completionDistribution: Record<string, number> = {
    '0-20%': 0,
    '21-40%': 0,
    '41-60%': 0,
    '61-80%': 0,
    '81-99%': 0,
    '100%': 0
  }

  progress.forEach(p => {
    if (p.percentage === 100) completionDistribution['100%']++
    else if (p.percentage >= 81) completionDistribution['81-99%']++
    else if (p.percentage >= 61) completionDistribution['61-80%']++
    else if (p.percentage >= 41) completionDistribution['41-60%']++
    else if (p.percentage >= 21) completionDistribution['21-40%']++
    else completionDistribution['0-20%']++
  })

  return {
    easiest,
    hardest,
    averageCompletion,
    completionDistribution
  }
}

/**
 * Get time-based achievement insights
 */
export function getTimeBasedInsights(achievements: Achievement[]): {
  firstAchievement?: Achievement
  latestAchievement?: Achievement
  achievementsThisWeek: number
  achievementsThisMonth: number
  averageTimeBetweenAchievements: number
  peakActivityPeriod: string
} {
  if (achievements.length === 0) {
    return {
      achievementsThisWeek: 0,
      achievementsThisMonth: 0,
      averageTimeBetweenAchievements: 0,
      peakActivityPeriod: 'No data'
    }
  }

  const sorted = [...achievements].sort((a, b) => 
    new Date(a.unlocked_at).getTime() - new Date(b.unlocked_at).getTime()
  )

  const firstAchievement = sorted[0]
  const latestAchievement = sorted[sorted.length - 1]

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const achievementsThisWeek = achievements.filter(ach => 
    new Date(ach.unlocked_at) >= weekAgo
  ).length

  const achievementsThisMonth = achievements.filter(ach => 
    new Date(ach.unlocked_at) >= monthAgo
  ).length

  // Calculate average time between achievements
  let totalTimeBetween = 0
  for (let i = 1; i < sorted.length; i++) {
    const timeDiff = new Date(sorted[i].unlocked_at).getTime() - new Date(sorted[i-1].unlocked_at).getTime()
    totalTimeBetween += timeDiff
  }
  const averageTimeBetweenAchievements = sorted.length > 1 ? 
    totalTimeBetween / (sorted.length - 1) / (1000 * 60 * 60 * 24) : 0 // in days

  // Find peak activity period (month with most achievements)
  const monthlyCount: Record<string, number> = {}
  achievements.forEach(ach => {
    const month = new Date(ach.unlocked_at).toISOString().slice(0, 7)
    monthlyCount[month] = (monthlyCount[month] || 0) + 1
  })

  const peakActivityPeriod = Object.entries(monthlyCount)
    .reduce((max, [month, count]) => 
      count > (monthlyCount[max[0]] || 0) ? [month, count] : max, ['No data', 0]
    )[0]

  return {
    firstAchievement,
    latestAchievement,
    achievementsThisWeek,
    achievementsThisMonth,
    averageTimeBetweenAchievements,
    peakActivityPeriod
  }
}

/**
 * Get comparison stats for multiple users (for leaderboards)
 */
export function getComparisonStats(
  userAchievements: Record<string, Achievement[]>,
  definitions: AchievementDefinition[]
): Record<string, {
  userId: string
  totalPoints: number
  achievementCount: number
  completionPercentage: number
  rank: number
}> {
  const stats: Record<string, any> = {}
  const totalPossibleAchievements = definitions.filter(def => !def.hidden).length

  // Calculate stats for each user
  for (const [userId, achievements] of Object.entries(userAchievements)) {
    const totalPoints = achievements.reduce((sum, ach) => sum + (ach.achievement_data?.points || 0), 0)
    const achievementCount = achievements.length
    const completionPercentage = totalPossibleAchievements > 0 ? 
      (achievementCount / totalPossibleAchievements) * 100 : 0

    stats[userId] = {
      userId,
      totalPoints,
      achievementCount,
      completionPercentage,
      rank: 0 // Will be calculated below
    }
  }

  // Calculate ranks based on total points
  const sortedUsers = Object.values(stats).sort((a: any, b: any) => b.totalPoints - a.totalPoints)
  sortedUsers.forEach((user: any, index) => {
    stats[user.userId].rank = index + 1
  })

  return stats
}