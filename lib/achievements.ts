import { supabase } from './supabase'
import type { Achievement } from '@/types'

// Achievement checking functions
interface AchievementCheck {
  id: string
  name: string
  description: string
  icon: string
  condition: (stats: UserStats) => boolean
}

interface UserStats {
  totalCards: number
  totalSets: number
  completedSets: number
  cardsBySet: Map<string, number>
}

const achievementChecks: AchievementCheck[] = [
  {
    id: 'first-card',
    name: 'First Steps',
    description: 'Add your first card to your collection',
    icon: '🎯',
    condition: (stats) => stats.totalCards >= 1
  },
  {
    id: 'first-set',
    name: 'Collector',
    description: 'Add your first set',
    icon: '📦',
    condition: (stats) => stats.totalSets >= 1
  },
  {
    id: 'century-club',
    name: 'Century Club',
    description: 'Collect 100 cards',
    icon: '💯',
    condition: (stats) => stats.totalCards >= 100
  },
  {
    id: 'enthusiast',
    name: 'Enthusiast',
    description: 'Collect 500 cards',
    icon: '⭐',
    condition: (stats) => stats.totalCards >= 500
  },
  {
    id: 'completionist',
    name: 'Completionist',
    description: 'Complete your first set',
    icon: '🏆',
    condition: (stats) => stats.completedSets >= 1
  },
  {
    id: 'master-collector',
    name: 'Master Collector',
    description: 'Complete 5 sets',
    icon: '👑',
    condition: (stats) => stats.completedSets >= 5
  }
]

export async function getUserStats(userId: string): Promise<UserStats> {
  // Get user's total cards
  const { data: cardsData } = await supabase
    .from('user_cards')
    .select('card_id, quantity')
    .eq('user_id', userId)

  // Get user's sets
  const { data: setsData } = await supabase
    .from('user_sets')
    .select('set_id')
    .eq('user_id', userId)

  const totalCards = cardsData?.reduce((sum, card) => sum + card.quantity, 0) || 0
  const totalSets = setsData?.length || 0
  
  // Calculate cards by set (for completion checking)
  const cardsBySet = new Map<string, number>()
  if (cardsData) {
    // This would require joining with card data to get set IDs
    // For now, return empty map
  }

  const completedSets = 0 // TODO: Calculate actual completed sets

  return {
    totalCards,
    totalSets,
    completedSets,
    cardsBySet
  }
}

export async function checkAndUnlockAchievements(userId: string): Promise<Achievement[]> {
  const stats = await getUserStats(userId)
  
  // Get currently unlocked achievements
  const { data: unlockedData } = await supabase
    .from('user_achievements')
    .select(`
      achievements!inner (
        name
      )
    `)
    .eq('user_id', userId)

  const unlockedNames = new Set(
    unlockedData?.map(ua => (ua.achievements as any)?.name).filter(Boolean) || []
  )

  const newAchievements: Achievement[] = []

  // Check each achievement
  for (const check of achievementChecks) {
    if (!unlockedNames.has(check.name) && check.condition(stats)) {
      // Get or create achievement record
      const { data: achievementData } = await supabase
        .from('achievements')
        .select('id')
        .eq('name', check.name)
        .single()

      if (achievementData) {
        // Unlock achievement
        const { error } = await supabase
          .from('user_achievements')
          .insert([{
            user_id: userId,
            achievement_id: achievementData.id
          }])

        if (!error) {
          newAchievements.push({
            id: achievementData.id,
            name: check.name,
            description: check.description,
            icon: check.icon
          })
        }
      }
    }
  }

  return newAchievements
}

export async function unlockAchievement(userId: string, achievementName: string): Promise<boolean> {
  try {
    const { data: achievementData } = await supabase
      .from('achievements')
      .select('id')
      .eq('name', achievementName)
      .single()

    if (!achievementData) return false

    const { error } = await supabase
      .from('user_achievements')
      .insert([{
        user_id: userId,
        achievement_id: achievementData.id
      }])

    return !error
  } catch (error) {
    console.error('Error unlocking achievement:', error)
    return false
  }
}

export async function getUserAchievements(userId: string): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      unlocked_at,
      achievements (
        id,
        name,
        description,
        icon
      )
    `)
    .eq('user_id', userId)

  if (error || !data) return []

  return data
    .map(ua => ua.achievements)
    .filter(Boolean)
    .flat() as Achievement[]
}