/**
 * Database Helper Functions
 * Clean interface for querying Supabase data
 * Replaces external Pokemon TCG API calls
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Use client-side keys for read operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types matching new schema
// Note: sets table uses 'set_id', 'setTotal', and 'setComplete' columns.
// Queries alias set_id→id and setTotal→total for backward compatibility.
// setTotal = cards excluding secret rares; setComplete = full set incl. secret rares.
export interface DbSet {
  id: string            // aliased from set_id
  name: string
  series: string | null
  total: number | null  // aliased from setTotal (excl. secret rares)
  setComplete: number | null // total incl. secret rares
  release_date: string | null
  logo_url: string | null
  symbol_url: string | null
  created_at: string
  /** ISO 639-1 language code: 'en' = English, 'ja' = Japanese */
  language: string | null
}

export interface DbCard {
  id: string
  set_id: string
  name: string | null
  number: string | null
  rarity: string | null
  type: string | null
  image: string | null
  /** FK → variants.id — the default variant for double-click quick-add */
  default_variant_id: string | null
  /** pokemontcg.io / RapidAPI card ID e.g. "sv1-1". Used for price matching. */
  api_id: string | null
  created_at: string
}

export interface DbVariant {
  id: string
  name: string
  key: string
  created_at: string
}

export interface DbUserCardVariant {
  id: string
  user_id: string
  card_id: string
  variant_key: string
  quantity: number
  created_at: string
}

/**
 * Returns true when any card in the array has a rarity that indicates it is a
 * promotional card (e.g. "Promo", "Black Star Promo", "Promo Holo"). The check
 * is case-insensitive and matches any rarity string containing the word "promo".
 *
 * Used on the set page to decide whether to show the "Grandmaster Set" option.
 */
export function hasPromoCards(cards: DbCard[]): boolean {
  return cards.some(card => card.rarity?.toLowerCase().includes('promo'))
}

/**
 * Get all sets ordered by release date (newest first)
 */
export async function getSets(): Promise<DbSet[]> {
  const { data, error } = await supabase
    .from('sets')
    .select('id:set_id, name, series, total:setTotal, setComplete, release_date, logo_url, symbol_url, created_at, language')
    .order('release_date', { ascending: false })
  
  if (error) {
    console.error('Error fetching sets:', error)
    throw new Error(`Failed to fetch sets: ${error.message}`)
  }
  
  return data || []
}

/**
 * Get specific set by ID
 */
export async function getSetById(setId: string): Promise<DbSet | null> {
  const { data, error } = await supabase
    .from('sets')
    .select('id:set_id, name, series, total:setTotal, setComplete, release_date, logo_url, symbol_url, created_at, language')
    .eq('set_id', setId)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null
    }
    console.error('Error fetching set:', error)
    throw new Error(`Failed to fetch set: ${error.message}`)
  }
  
  return data
}

/**
 * Get all cards for a specific set, ordered by card number
 */
export async function getCardsBySet(setId: string): Promise<DbCard[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('set_id', setId)
    .order('number', { ascending: true })
  
  if (error) {
    console.error('Error fetching cards:', error)
    throw new Error(`Failed to fetch cards: ${error.message}`)
  }
  
  return data || []
}

/**
 * Search cards by name across all sets
 */
export async function searchCards(query: string, limit: number = 50): Promise<DbCard[]> {
  if (!query.trim()) return []
  
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(limit)
  
  if (error) {
    console.error('Error searching cards:', error)
    throw new Error(`Failed to search cards: ${error.message}`)
  }
  
  return data || []
}

/**
 * Get all available variants
 */
export async function getVariants(): Promise<DbVariant[]> {
  const { data, error } = await supabase
    .from('variants')
    .select('*')
    .order('name')
  
  if (error) {
    console.error('Error fetching variants:', error)
    throw new Error(`Failed to fetch variants: ${error.message}`)
  }
  
  return data || []
}

/**
 * Get user's card variants
 */
export async function getUserCardVariants(userId: string, cardId?: string): Promise<DbUserCardVariant[]> {
  let query = supabase
    .from('user_card_variants')
    .select('*')
    .eq('user_id', userId)
  
  if (cardId) {
    query = query.eq('card_id', cardId)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching user card variants:', error)
    throw new Error(`Failed to fetch user card variants: ${error.message}`)
  }
  
  return data || []
}

/**
 * Upsert user card variant quantity
 */
export async function upsertUserCardVariant(
  userId: string,
  cardId: string,
  variantKey: string,
  quantity: number
): Promise<DbUserCardVariant> {
  const { data, error } = await supabase
    .from('user_card_variants')
    .upsert(
      {
        user_id: userId,
        card_id: cardId,
        variant_key: variantKey,
        quantity: quantity,
      },
      { 
        onConflict: 'user_id,card_id,variant_key',
        ignoreDuplicates: false 
      }
    )
    .select()
    .single()
  
  if (error) {
    console.error('Error updating user card variant:', error)
    throw new Error(`Failed to update user card variant: ${error.message}`)
  }
  
  return data
}

/**
 * Get distinct card counts per set for a user.
 *
 * Uses a Postgres RPC (get_user_card_counts_by_set) that issues a single
 * GROUP BY query in the database and returns ~1 row per set.  This replaces
 * the previous approach of fetching ALL user_card_variants rows into Node.js
 * and aggregating them in JS, which caused heap-OOM on large collections.
 *
 * Migration: database/migration_rpc_card_counts.sql
 */
export async function getUserCardCountsBySet(userId: string): Promise<{ set_id: string; count: number }[]> {
  const { data, error } = await supabase.rpc('get_user_card_counts_by_set', {
    p_user_id: userId,
  })

  if (error) {
    console.error('Error fetching user card counts via RPC:', error)
    throw new Error(`Failed to fetch user card counts: ${error.message}`)
  }

  return (data ?? []).map((row: { set_id: string; card_count: number }) => ({
    set_id: row.set_id,
    count: Number(row.card_count),
  }))
}

/**
 * Get sets with card progress for user
 */
export async function getSetsWithProgress(userId: string): Promise<(DbSet & { user_card_count: number })[]> {
  // Get all sets
  const sets = await getSets()
  
  // Get user's card counts by set
  const cardCounts = await getUserCardCountsBySet(userId)
  const countsBySetId = Object.fromEntries(
    cardCounts.map(item => [item.set_id, item.count])
  )
  
  // Combine sets with user progress
  return sets.map(set => ({
    ...set,
    user_card_count: countsBySetId[set.id] || 0
  }))
}

/**
 * Get image coverage stats for every set in one DB round-trip.
 * Uses the `get_set_image_stats` Postgres function (GROUP BY on cards table).
 * Migration: database/migration_set_image_stats.sql
 */
export async function getSetImageStats(): Promise<
  { set_id: string; total_cards: number; cards_with_images: number }[]
> {
  const { data, error } = await supabase.rpc('get_set_image_stats')

  if (error) {
    console.error('Error fetching set image stats via RPC:', error)
    throw new Error(`Failed to fetch set image stats: ${error.message}`)
  }

  return (data ?? []).map(
    (row: { set_id: string; total_cards: number; cards_with_images: number }) => ({
      set_id: row.set_id,
      total_cards: Number(row.total_cards),
      cards_with_images: Number(row.cards_with_images),
    }),
  )
}

/**
 * Database statistics for admin/debugging
 */
export async function getDatabaseStats(): Promise<{
  sets: number
  cards: number
  variants: number
  userVariants: number
}> {
  const [setsResult, cardsResult, variantsResult, userVariantsResult] = await Promise.all([
    supabase.from('sets').select('id', { count: 'exact', head: true }),
    supabase.from('cards').select('id', { count: 'exact', head: true }),
    supabase.from('variants').select('id', { count: 'exact', head: true }),
    supabase.from('user_card_variants').select('id', { count: 'exact', head: true }),
  ])
  
  return {
    sets: setsResult.count || 0,
    cards: cardsResult.count || 0,
    variants: variantsResult.count || 0,
    userVariants: userVariantsResult.count || 0,
  }
}