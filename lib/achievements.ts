import { supabase } from './supabase'
import type { Achievement } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AchievementCheck {
  /** Must match the `name` column in the `achievements` DB table */
  name: string
  condition: (stats: UserStats) => boolean
}

interface UserStats {
  totalCards: number
  totalSets: number
  completedSets: number
  friendCount: number
}

// ── Achievement definitions ───────────────────────────────────────────────────
// Each entry's `name` must exactly match a row in public.achievements.

const achievementChecks: AchievementCheck[] = [
  {
    name:      'First Steps',
    condition: (s) => s.totalCards >= 1,
  },
  {
    name:      'Collector',
    condition: (s) => s.totalSets >= 1,
  },
  {
    name:      'Century Club',
    condition: (s) => s.totalCards >= 100,
  },
  {
    name:      'Enthusiast',
    condition: (s) => s.totalCards >= 500,
  },
  {
    name:      'Diamond Collector',
    condition: (s) => s.totalCards >= 1000,
  },
  {
    name:      'Completionist',
    condition: (s) => s.completedSets >= 1,
  },
  {
    name:      'Master Collector',
    condition: (s) => s.completedSets >= 5,
  },
  {
    name:      'Legend',
    condition: (s) => s.completedSets >= 10,
  },
  {
    name:      'Friend Finder',
    condition: (s) => s.friendCount >= 1,
  },
  {
    name:      'Social Butterfly',
    condition: (s) => s.friendCount >= 5,
  },
]

// ── Stats computation ─────────────────────────────────────────────────────────

export async function getUserStats(userId: string): Promise<UserStats> {
  // ── Total cards: sum quantities from user_card_variants (source of truth) ──
  const { data: variantsData } = await supabase
    .from('user_card_variants')
    .select('quantity')
    .eq('user_id', userId)

  const totalCards = variantsData?.reduce((sum, row) => sum + (row.quantity ?? 0), 0) ?? 0

  // ── Total sets ──────────────────────────────────────────────────────────────
  const { data: setsData } = await supabase
    .from('user_sets')
    .select('set_id')
    .eq('user_id', userId)

  const userSetIds = setsData?.map(s => s.set_id) ?? []
  const totalSets  = userSetIds.length

  // ── Completed sets: owned ≥ setComplete (or setTotal) ──────────────────────
  let completedSets = 0

  if (userSetIds.length > 0) {
    type CardCountRow = { set_id: string; card_count: number }

    const [setsResult, rpcResult] = await Promise.all([
      supabase
        .from('sets')
        .select('set_id, "setComplete", "setTotal"')
        .in('set_id', userSetIds),
      supabase.rpc('get_user_card_counts_by_set', { p_user_id: userId }),
    ])

    const setsInfo    = (setsResult.data ?? []) as Array<{ set_id: string; setComplete: number | null; setTotal: number | null }>
    const cardCounts  = (rpcResult.data ?? []) as CardCountRow[]

    completedSets = setsInfo.filter(set => {
      const owned = cardCounts.find(r => r.set_id === set.set_id)?.card_count ?? 0
      const total = (set.setComplete ?? set.setTotal ?? 0)
      return total > 0 && owned >= total
    }).length
  }

  // ── Friend count: accepted friendships (either direction) ──────────────────
  const { data: friendData } = await supabase
    .from('friendships')
    .select('id')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted')

  const friendCount = friendData?.length ?? 0

  return { totalCards, totalSets, completedSets, friendCount }
}

// ── Check & unlock achievements ───────────────────────────────────────────────

export async function checkAndUnlockAchievements(userId: string): Promise<Achievement[]> {
  const stats = await getUserStats(userId)

  // Get currently unlocked achievement names
  const { data: unlockedData } = await supabase
    .from('user_achievements')
    .select(`
      achievements!inner ( name )
    `)
    .eq('user_id', userId)

  const unlockedNames = new Set<string>(
    (unlockedData ?? [])
      .map(ua => ((ua.achievements as unknown as { name: string } | null)?.name ?? null))
      .filter((n): n is string => typeof n === 'string')
  )

  // Fetch all achievement rows from DB so we have their IDs
  const { data: allAchievements } = await supabase
    .from('achievements')
    .select('id, name, description, icon')

  const achievementByName = new Map(
    allAchievements?.map(a => [a.name, a]) ?? []
  )

  const newAchievements: Achievement[] = []

  for (const check of achievementChecks) {
    if (unlockedNames.has(check.name)) continue
    if (!check.condition(stats)) continue

    const achievementRow = achievementByName.get(check.name)
    if (!achievementRow) continue

    const { error } = await supabase
      .from('user_achievements')
      .insert({ user_id: userId, achievement_id: achievementRow.id })

    if (!error) {
      newAchievements.push({
        id:          achievementRow.id,
        name:        achievementRow.name,
        description: achievementRow.description,
        icon:        achievementRow.icon,
      })
    }
  }

  return newAchievements
}

// ── One-off unlock helper ─────────────────────────────────────────────────────

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
      .insert({ user_id: userId, achievement_id: achievementData.id })

    return !error
  } catch (err) {
    console.error('unlockAchievement error:', err)
    return false
  }
}

// ── Read helpers ──────────────────────────────────────────────────────────────

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
