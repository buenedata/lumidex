import { supabase } from './supabase'
import type { Achievement } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AchievementCheck {
  /** Must match the `name` column in the `achievements` DB table */
  name: string
  condition: (stats: UserStats) => boolean
}

export interface UserStats {
  /** Sum of all variant quantities owned */
  totalCards: number
  /** Count of distinct card_ids owned (regardless of variant quantity) */
  uniqueCardCount: number
  /** Number of sets the user is actively tracking */
  totalSets: number
  /** Sets where owned cards ≥ setComplete / setTotal */
  completedSets: number
  /** Accepted friendships (either direction) */
  friendCount: number
  /** Total duplicate stock: sum of (quantity-1) for each variant where qty > 1 */
  duplicateCount: number
  /** Cards currently on the wanted list */
  wantedCount: number
  /** Sealed products with quantity > 0 */
  sealedProductCount: number
  /** Whether the user has uploaded a profile avatar */
  hasAvatar: boolean
  /** Whether the user completed the first-time setup wizard */
  hasCompletedSetup: boolean
}

/**
 * Accepts either the browser Supabase client (supabase) or the admin client
 * (supabaseAdmin). Both expose identical .from() / .rpc() / .select() APIs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any

// ── Achievement definitions ───────────────────────────────────────────────────
// Each entry's `name` must exactly match a row in public.achievements.

const achievementChecks: AchievementCheck[] = [
  // ── Collection Size (total quantity) ─────────────────────────────────────
  { name: 'First Steps',       condition: s => s.totalCards >= 1 },
  { name: 'Century Club',      condition: s => s.totalCards >= 100 },
  { name: 'Enthusiast',        condition: s => s.totalCards >= 500 },
  { name: 'Diamond Collector', condition: s => s.totalCards >= 1_000 },
  { name: 'Elite Collector',   condition: s => s.totalCards >= 2_500 },
  { name: 'Master Vault',      condition: s => s.totalCards >= 5_000 },
  { name: 'Legendary Hoard',   condition: s => s.totalCards >= 10_000 },
  { name: 'Card Emperor',      condition: s => s.totalCards >= 25_000 },

  // ── Unique Cards (distinct card_ids) ──────────────────────────────────────
  { name: 'Card Hunter',          condition: s => s.uniqueCardCount >= 10 },
  { name: 'Dedicated Collector',  condition: s => s.uniqueCardCount >= 250 },
  { name: 'Thousand Faces',       condition: s => s.uniqueCardCount >= 1_000 },
  { name: 'Card Archivist',       condition: s => s.uniqueCardCount >= 5_000 },

  // ── Sets Tracked ──────────────────────────────────────────────────────────
  { name: 'Collector',      condition: s => s.totalSets >= 1 },
  { name: 'Set Explorer',   condition: s => s.totalSets >= 5 },
  { name: 'Set Hoarder',    condition: s => s.totalSets >= 15 },
  { name: 'Set Chronicler', condition: s => s.totalSets >= 30 },
  { name: 'Set Archivist',  condition: s => s.totalSets >= 50 },

  // ── Set Completion ────────────────────────────────────────────────────────
  { name: 'Completionist',     condition: s => s.completedSets >= 1 },
  { name: 'Master Collector',  condition: s => s.completedSets >= 5 },
  { name: 'Legend',            condition: s => s.completedSets >= 10 },
  { name: 'Set Perfectionist', condition: s => s.completedSets >= 25 },
  { name: 'Living Pokédex',    condition: s => s.completedSets >= 50 },

  // ── Duplicates ────────────────────────────────────────────────────────────
  { name: 'Double Trouble', condition: s => s.duplicateCount >= 50 },
  { name: 'Trade Ready',    condition: s => s.duplicateCount >= 200 },

  // ── Wanted List ───────────────────────────────────────────────────────────
  { name: 'Wishful Thinking',    condition: s => s.wantedCount >= 1 },
  { name: 'On the Hunt',         condition: s => s.wantedCount >= 25 },
  { name: 'Obsessive Collector', condition: s => s.wantedCount >= 100 },

  // ── Sealed Products ───────────────────────────────────────────────────────
  { name: 'Sealed Ambitions', condition: s => s.sealedProductCount >= 1 },
  { name: 'Box Hoarder',      condition: s => s.sealedProductCount >= 10 },
  { name: 'Sealed Vault',     condition: s => s.sealedProductCount >= 50 },

  // ── Social ────────────────────────────────────────────────────────────────
  { name: 'Friend Finder',    condition: s => s.friendCount >= 1 },
  { name: 'Social Butterfly', condition: s => s.friendCount >= 5 },
  { name: 'Network Builder',  condition: s => s.friendCount >= 10 },
  { name: 'Community Pillar', condition: s => s.friendCount >= 25 },

  // ── Profile ───────────────────────────────────────────────────────────────
  { name: 'Picture Perfect', condition: s => s.hasAvatar },
  { name: 'Identity',        condition: s => s.hasCompletedSetup },
]

// ── Stats computation ─────────────────────────────────────────────────────────

export async function getUserStats(
  userId: string,
  client: AnySupabaseClient = supabase,
): Promise<UserStats> {

  // ── Variant rows: quantity + card_id ──────────────────────────────────────
  const { data: variantsData } = await client
    .from('user_card_variants')
    .select('card_id, quantity')
    .eq('user_id', userId)

  const rows: Array<{ card_id: string; quantity: number }> = variantsData ?? []

  const totalCards = rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0)

  const uniqueCardIds = new Set<string>(rows.map(r => r.card_id).filter(Boolean))
  const uniqueCardCount = uniqueCardIds.size

  // Sum of (qty - 1) for every variant where the user owns more than one copy
  const duplicateCount = rows.reduce((sum, r) => {
    const qty = r.quantity ?? 0
    return sum + (qty > 1 ? qty - 1 : 0)
  }, 0)

  // ── Sets ──────────────────────────────────────────────────────────────────
  const { data: setsData } = await client
    .from('user_sets')
    .select('set_id')
    .eq('user_id', userId)

  const userSetIds: string[] = setsData?.map((s: { set_id: string }) => s.set_id) ?? []
  const totalSets = userSetIds.length

  // ── Completed sets ────────────────────────────────────────────────────────
  let completedSets = 0

  if (userSetIds.length > 0) {
    type CardCountRow = { set_id: string; card_count: number }

    const [setsResult, rpcResult] = await Promise.all([
      client
        .from('sets')
        .select('set_id, "setComplete", "setTotal"')
        .in('set_id', userSetIds),
      client.rpc('get_user_card_counts_by_set', { p_user_id: userId }),
    ])

    const setsInfo   = (setsResult.data ?? []) as Array<{ set_id: string; setComplete: number | null; setTotal: number | null }>
    const cardCounts = (rpcResult.data ?? []) as CardCountRow[]

    completedSets = setsInfo.filter(set => {
      const owned = cardCounts.find(r => r.set_id === set.set_id)?.card_count ?? 0
      const total = set.setComplete ?? set.setTotal ?? 0
      return total > 0 && owned >= total
    }).length
  }

  // ── Friends ───────────────────────────────────────────────────────────────
  const { data: friendData } = await client
    .from('friendships')
    .select('id')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted')

  const friendCount = friendData?.length ?? 0

  // ── Wanted cards, sealed products, profile — run in parallel ─────────────
  const [wantedResult, sealedResult, profileResult] = await Promise.all([
    client
      .from('wanted_cards')
      .select('card_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    client
      .from('user_sealed_products')
      .select('product_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    client
      .from('users')
      .select('avatar_url, setup_completed')
      .eq('id', userId)
      .single(),
  ])

  const wantedCount        = wantedResult.count  ?? 0
  const sealedProductCount = sealedResult.count  ?? 0
  const hasAvatar          = Boolean(profileResult.data?.avatar_url)
  const hasCompletedSetup  = Boolean(profileResult.data?.setup_completed)

  return {
    totalCards,
    uniqueCardCount,
    totalSets,
    completedSets,
    friendCount,
    duplicateCount,
    wantedCount,
    sealedProductCount,
    hasAvatar,
    hasCompletedSetup,
  }
}

// ── Check & unlock achievements ───────────────────────────────────────────────

export async function checkAndUnlockAchievements(
  userId: string,
  client: AnySupabaseClient = supabase,
): Promise<Achievement[]> {
  const stats = await getUserStats(userId, client)

  // Get currently unlocked achievement names
  const { data: unlockedData } = await client
    .from('user_achievements')
    .select('achievements!inner ( name )')
    .eq('user_id', userId)

  const unlockedNames = new Set<string>(
    (unlockedData ?? [])
      .map((ua: { achievements: { name: string } | null }) => ua.achievements?.name ?? null)
      .filter((n: string | null): n is string => typeof n === 'string'),
  )

  // Fetch all achievement rows from DB so we have their IDs
  const { data: allAchievements } = await client
    .from('achievements')
    .select('id, name, description, icon')

  const achievementByName = new Map<string, Achievement>(
    allAchievements?.map((a: Achievement) => [a.name, a]) ?? [],
  )

  const newAchievements: Achievement[] = []

  for (const check of achievementChecks) {
    if (unlockedNames.has(check.name)) continue
    if (!check.condition(stats)) continue

    const achievementRow = achievementByName.get(check.name)
    if (!achievementRow) continue

    const { error } = await client
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

export async function unlockAchievement(
  userId: string,
  achievementName: string,
  client: AnySupabaseClient = supabase,
): Promise<boolean> {
  try {
    const { data: achievementData } = await client
      .from('achievements')
      .select('id')
      .eq('name', achievementName)
      .single()

    if (!achievementData) return false

    const { error } = await client
      .from('user_achievements')
      .insert({ user_id: userId, achievement_id: achievementData.id })

    return !error
  } catch (err) {
    console.error('unlockAchievement error:', err)
    return false
  }
}

// ── Read helpers ──────────────────────────────────────────────────────────────

export async function getUserAchievements(
  userId: string,
  client: AnySupabaseClient = supabase,
): Promise<Achievement[]> {
  const { data, error } = await client
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
    .map((ua: { achievements: Achievement | Achievement[] | null }) => ua.achievements)
    .filter(Boolean)
    .flat() as Achievement[]
}
