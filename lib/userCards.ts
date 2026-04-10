import { supabase } from './supabase'
import type { GradingCompany, UserGradedCard } from '@/types'

export async function getUserCardVariants(userId: string, cardId: string) {
  const { data, error } = await supabase
    .from('user_card_variants')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', cardId)

  if (error) throw error
  return data
}

export async function upsertUserCardVariant({
  userId,
  cardId,
  variantId,
  quantity,
  setId
}: {
  userId: string
  cardId: string
  variantId: string
  quantity: number
  setId: string
}) {
  if (quantity === 0) {
    // Delete the record instead of leaving an orphan row with quantity 0
    const { error } = await supabase
      .from('user_card_variants')
      .delete()
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .eq('variant_id', variantId)

    if (error) throw error
    return null
  }

  // ── Read current quantity so we can compute the signed delta ─────────────
  // This allows the Last Activity section to show ↑ (increase) vs ↓ (decrease).
  const { data: existing } = await supabase
    .from('user_card_variants')
    .select('quantity')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .eq('variant_id', variantId)
    .maybeSingle()

  const oldQty = existing?.quantity ?? 0
  const quantityDelta = quantity - oldQty

  // Look up the variant key to populate the legacy variant_type column
  const { data: variantDef } = await supabase
    .from('variants')
    .select('key')
    .eq('id', variantId)
    .single()

  const { data, error } = await supabase
    .from('user_card_variants')
    .upsert(
      {
        user_id: userId,
        card_id: cardId,
        variant_id: variantId,
        variant_type: variantDef?.key ?? null,
        quantity,
        quantity_delta: quantityDelta,
        // Explicitly refresh updated_at so the Last Activity section always
        // surfaces the most recently touched variant at the top of the list.
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,card_id,variant_id' }
    )

  if (error) throw error

  // Auto-add set when first card is added
  await supabase.from('user_sets').upsert({
    user_id: userId,
    set_id: setId
  }, { onConflict: 'user_id,set_id' })

  return data
}

export async function getVariantDefinitions() {
  const { data, error } = await supabase
    .from('variants')
    .select('*')
    .eq('is_official', true)
    .order('sort_order')

  if (error) throw error
  return data
}

export async function getAllVariantDefinitions() {
  const { data, error } = await supabase
    .from('variants')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data
}

export async function getUserCardVariantsBatch(userId: string, cardIds: string[]) {
  const { data, error } = await supabase
    .from('user_card_variants')
    .select('*')
    .eq('user_id', userId)
    .in('card_id', cardIds)

  if (error) throw error
  return data
}

/**
 * Returns all user_card_variants with quantity > 0 for a given set,
 * resolved via a join on `cards.set_id` so that no Pokemon TCG API
 * string IDs (e.g. "sv4-1") are ever passed into the uuid card_id column.
 */
export async function getUserCardVariantsBySet(userId: string, setId: string) {
  const { data, error } = await supabase
    .from('user_card_variants')
    .select('card_id, quantity, cards!inner(set_id)')
    .eq('user_id', userId)
    .eq('cards.set_id', setId)
    .gt('quantity', 0)

  if (error) throw error
  return data ?? []
}

export async function getUserSets(userId: string) {
  const { data, error } = await supabase
    .from('user_sets')
    .select('*')
    .eq('user_id', userId)

  if (error) throw error
  return data
}

export async function getUserOwnedCardsCount(userId: string, setId?: string) {
  let query = supabase
    .from('user_card_variants')
    .select('card_id')
    .eq('user_id', userId)
    .gt('quantity', 0)

  if (setId) {
    // We'll filter by set in the frontend since we don't have set_id in user_card_variants
    // This query gets all cards for the user
  }

  const { data, error } = await query

  if (error) throw error
  
  // Return unique card IDs
  const uniqueCardIds = [...new Set(data.map(item => item.card_id))]
  return uniqueCardIds.length
}

// ── Graded Cards ──────────────────────────────────────────────────────────────

/**
 * Fetch all graded card entries for the given user + card combination.
 * Returns an empty array if no graded copies are tracked yet.
 */
export async function getUserGradedCards(
  userId: string,
  cardId: string,
): Promise<UserGradedCard[]> {
  const { data, error } = await supabase
    .from('user_graded_cards')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .order('grading_company')
    .order('grade')

  if (error) throw error
  return (data ?? []) as UserGradedCard[]
}

/**
 * Upsert a graded card entry for the authenticated user.
 *
 * - If a row already exists for (user, card, variant, company, grade) its
 *   quantity is replaced with the new value (not incremented — the caller
 *   is responsible for computing the correct final quantity).
 * - Rows are never inserted with quantity < 1 (the DB constraint enforces
 *   this); callers should delete rows explicitly when the quantity should
 *   reach 0 (use deleteUserGradedCard instead).
 * - Auto-adds the set to user_sets on the first graded card added (same
 *   behaviour as upsertUserCardVariant).
 */
export async function upsertUserGradedCard({
  userId,
  cardId,
  variantId,
  gradingCompany,
  grade,
  quantity,
  setId,
}: {
  userId: string
  cardId: string
  variantId: string | null
  gradingCompany: GradingCompany
  grade: string
  quantity: number
  setId: string
}): Promise<UserGradedCard | null> {
  if (quantity < 1) return null

  const { data, error } = await supabase
    .from('user_graded_cards')
    .upsert(
      {
        user_id: userId,
        card_id: cardId,
        variant_id: variantId ?? null,
        grading_company: gradingCompany,
        grade,
        quantity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,card_id,variant_id,grading_company,grade' },
    )
    .select()
    .single()

  if (error) throw error

  // Auto-add set when first graded card is added (mirrors upsertUserCardVariant)
  await supabase
    .from('user_sets')
    .upsert({ user_id: userId, set_id: setId }, { onConflict: 'user_id,set_id' })

  return data as UserGradedCard
}

/**
 * Delete a single graded card entry by its primary key.
 * Used when the user reduces quantity to 0.
 */
export async function deleteUserGradedCard(id: string): Promise<void> {
  const { error } = await supabase
    .from('user_graded_cards')
    .delete()
    .eq('id', id)

  if (error) throw error
}