import { supabase } from './supabase'

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
        quantity
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