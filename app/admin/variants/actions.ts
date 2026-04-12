'use server'

import { requireAdmin, getAdminSupabaseClient } from '@/lib/admin'

// Validation helpers
function validateCreateVariant(data: any) {
  const errors: string[] = []
  
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required')
  }
  
  if (data.name && data.name.length > 100) {
    errors.push('Name is too long (max 100 characters)')
  }
  
  const validColors = ['green', 'blue', 'purple', 'red', 'pink', 'yellow', 'gray', 'orange', 'teal']
  if (!data.color || !validColors.includes(data.color)) {
    errors.push('Invalid color selection')
  }
  
  return errors
}

function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/**
 * Create a new variant
 */
export async function createVariant(formData: FormData) {
  try {
    // Verify admin permissions
    const user = await requireAdmin()
    const supabase = getAdminSupabaseClient()

    // Parse and validate form data — variants are global, no cardId needed
    const rawData = {
      name: formData.get('name') as string,
      key: (formData.get('key') as string) || (formData.get('name') as string)?.toLowerCase().replace(/\s+/g, '_'),
      description: formData.get('description') as string || null,
      color: formData.get('color') as string,
      shortLabel: formData.get('shortLabel') as string || null,
      isQuickAdd: formData.get('isQuickAdd') === 'true',
      sortOrder: parseInt(formData.get('sortOrder') as string || '0')
    }

    // Validate the data
    const validationErrors = validateCreateVariant(rawData)
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: validationErrors.join(', ')
      }
    }

    // Check for duplicate name in the global catalog only (card_id IS NULL).
    // Card-specific variants with the same display name are scoped to their card
    // and must not block creation of a global catalog entry.
    const { data: existing, error: checkError } = await supabase
      .from('variants')
      .select('id')
      .ilike('name', rawData.name.trim())
      .is('card_id', null)
      .limit(1)
      .maybeSingle()

    if (checkError) {
      throw new Error(`Database error: ${checkError.message}`)
    }

    if (existing) {
      return {
        success: false,
        error: 'A variant with this name already exists'
      }
    }

    // Create the global variant
    const { data, error } = await supabase
      .from('variants')
      .insert([{
        key: rawData.key,
        name: rawData.name.trim(),
        description: rawData.description?.trim() || null,
        color: rawData.color,
        short_label: rawData.shortLabel?.trim() || null,
        is_quick_add: rawData.isQuickAdd || false,
        sort_order: rawData.sortOrder || 0,
        is_official: true, // Admin-created variants are official
        created_by: user.id
      }])
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create variant: ${error.message}`)
    }

    return {
      success: true,
      data
    }

  } catch (error: any) {
    console.error('Create variant error:', error)
    return {
      success: false,
      error: error.message || 'Failed to create variant'
    }
  }
}

/**
 * Rename a variant
 */
export async function renameVariant(variantId: string, newName: string) {
  try {
    // Verify admin permissions
    await requireAdmin()
    const supabase = getAdminSupabaseClient()

    // Validate inputs
    if (!variantId || typeof variantId !== 'string') {
      return { success: false, error: 'Invalid variant ID' }
    }

    const trimmedName = newName?.trim()
    if (!trimmedName) {
      return { success: false, error: 'Variant name is required' }
    }

    if (trimmedName.length > 100) {
      return { success: false, error: 'Name is too long (max 100 characters)' }
    }

    // Check for duplicate name (excluding the current variant)
    const { data: existing, error: checkError } = await supabase
      .from('variants')
      .select('id')
      .ilike('name', trimmedName)
      .neq('id', variantId)
      .limit(1)
      .maybeSingle()

    if (checkError) {
      throw new Error(`Database error: ${checkError.message}`)
    }

    if (existing) {
      return { success: false, error: 'A variant with this name already exists' }
    }

    // Update the variant name
    const { data, error } = await supabase
      .from('variants')
      .update({ name: trimmedName })
      .eq('id', variantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to rename variant: ${error.message}`)
    }

    return {
      success: true,
      data,
      message: `Variant renamed to "${trimmedName}"`
    }

  } catch (error: any) {
    console.error('Rename variant error:', error)
    return {
      success: false,
      error: error.message || 'Failed to rename variant'
    }
  }
}

/**
 * Update a variant's name, description, color, and sort_order.
 *
 * Duplicate-name logic:
 *  - Global variants (card_id IS NULL) → must be unique across the global catalog.
 *  - Card-specific variants (card_id IS NOT NULL) → must be unique within that card; other
 *    cards (and the global catalog) may share the same display name.
 */
export async function updateVariant(
  variantId: string,
  fields: { name: string; description: string | null; color: string; sortOrder: number; isQuickAdd: boolean; shortLabel: string | null }
) {
  try {
    await requireAdmin()
    const supabase = getAdminSupabaseClient()

    if (!variantId || !validateUUID(variantId)) {
      return { success: false, error: 'Invalid variant ID' }
    }

    const trimmedName = fields.name?.trim()
    if (!trimmedName) {
      return { success: false, error: 'Variant name is required' }
    }
    if (trimmedName.length > 100) {
      return { success: false, error: 'Variant name is too long (max 100 characters)' }
    }

    const validColors = ['green', 'blue', 'purple', 'red', 'pink', 'yellow', 'gray', 'orange', 'teal']
    if (!validColors.includes(fields.color)) {
      return { success: false, error: 'Invalid color selection' }
    }

    // Fetch the current variant so we know if it is global or card-specific
    const { data: current, error: fetchError } = await supabase
      .from('variants')
      .select('id, card_id')
      .eq('id', variantId)
      .single()

    if (fetchError || !current) {
      return { success: false, error: 'Variant not found' }
    }

    // Duplicate-name check scoped to the variant's domain
    if (current.card_id) {
      // Card-specific: unique within the same card
      const { data: dup } = await supabase
        .from('variants')
        .select('id')
        .eq('card_id', current.card_id)
        .ilike('name', trimmedName)
        .neq('id', variantId)
        .limit(1)
        .maybeSingle()

      if (dup) {
        return { success: false, error: 'A variant with this name already exists for this card' }
      }
    } else {
      // Global: unique across the entire catalog
      const { data: dup } = await supabase
        .from('variants')
        .select('id')
        .ilike('name', trimmedName)
        .neq('id', variantId)
        .limit(1)
        .maybeSingle()

      if (dup) {
        return { success: false, error: 'A variant with this name already exists' }
      }
    }

    const { data, error } = await supabase
      .from('variants')
      .update({
        name:         trimmedName,
        description:  fields.description?.trim() || null,
        color:        fields.color,
        sort_order:   fields.sortOrder,
        is_quick_add: fields.isQuickAdd,
        short_label:  fields.shortLabel?.trim() || null,
      })
      .eq('id', variantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update variant: ${error.message}`)
    }

    return { success: true, data }

  } catch (error: any) {
    console.error('updateVariant error:', error)
    return { success: false, error: error.message || 'Failed to update variant' }
  }
}

/**
 * Delete a variant
 */
export async function deleteVariant(variantId: string) {
  try {
    // Verify admin permissions
    await requireAdmin()
    const supabase = getAdminSupabaseClient()

    // Validate input
    if (!variantId || typeof variantId !== 'string') {
      throw new Error('Invalid variant ID')
    }

    // Check if variant exists first
    const { data: variant, error: checkError } = await supabase
      .from('variants')
      .select('id, name')
      .eq('id', variantId)
      .single()

    if (checkError) {
      throw new Error('Variant not found')
    }

    // Delete the variant (cascade will handle user_card_variants)
    const { error } = await supabase
      .from('variants')
      .delete()
      .eq('id', variantId)

    if (error) {
      throw new Error(`Failed to delete variant: ${error.message}`)
    }

    return {
      success: true,
      message: `Variant "${variant.name}" deleted successfully`
    }

  } catch (error: any) {
    console.error('Delete variant error:', error)
    return {
      success: false,
      error: error.message || 'Failed to delete variant'
    }
  }
}

/**
 * Remove a GLOBAL variant from a single card's availability list,
 * WITHOUT deleting the variant itself from the catalog.
 *
 * This is the safe alternative to deleteVariant() when operating from the
 * card modal — it only removes the card_variant_availability link so the
 * global variant is no longer offered for that card.  All other cards that
 * use the same global variant are unaffected.
 *
 * For CARD-SPECIFIC variants (variants.card_id IS NOT NULL), call
 * deleteVariant() instead — there's no shared catalog entry to protect.
 */
export async function removeVariantFromCard(variantId: string, cardId: string) {
  try {
    await requireAdmin()

    if (!variantId || !cardId) {
      return { success: false, error: 'variantId and cardId are required' }
    }

    const supabase = getAdminSupabaseClient()

    const { error } = await supabase
      .from('card_variant_availability')
      .delete()
      .eq('variant_id', variantId)
      .eq('card_id', cardId)

    if (error) {
      throw new Error(`Failed to remove variant from card: ${error.message}`)
    }

    return { success: true, message: 'Variant removed from this card' }
  } catch (error: any) {
    console.error('removeVariantFromCard error:', error)
    return { success: false, error: error.message || 'Failed to remove variant from card' }
  }
}

/**
 * Approve a variant suggestion.
 *
 * Suggestions are always card-specific (they carry a card_id). Approving one
 * creates a card-scoped variant row — NOT a global catalog entry — so the
 * global-name uniqueness check must not be applied here.  Instead we guard
 * only against a duplicate variant name on the same card.
 */
export async function approveVariantSuggestion(suggestionId: string) {
  try {
    // Verify admin permissions
    const user = await requireAdmin()
    const supabase = getAdminSupabaseClient()

    // Validate input
    if (!suggestionId || typeof suggestionId !== 'string' || !validateUUID(suggestionId)) {
      return {
        success: false,
        error: 'Invalid suggestion ID'
      }
    }

    // Get suggestion details
    const { data: suggestion, error: fetchError } = await supabase
      .from('variant_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .eq('status', 'pending') // Only approve pending suggestions
      .single()

    if (fetchError || !suggestion) {
      throw new Error('Suggestion not found or already processed')
    }

    if (!suggestion.card_id) {
      return {
        success: false,
        error: 'Suggestion is missing a card ID and cannot be approved as a card-specific variant'
      }
    }

    // Check for a duplicate variant name scoped to this specific card only.
    // We do NOT check the global catalog — a card-specific "Holo Rare" variant
    // is independent of the global "Holo Rare" entry.
    const { data: existingCardVariant, error: checkError } = await supabase
      .from('variants')
      .select('id')
      .eq('card_id', suggestion.card_id)
      .ilike('name', suggestion.name.trim())
      .limit(1)
      .maybeSingle()

    if (checkError) {
      throw new Error(`Database error: ${checkError.message}`)
    }

    if (existingCardVariant) {
      return {
        success: false,
        error: 'A variant with this name already exists for this card'
      }
    }

    // Build a key that is unique across the global `variants_key_unique` constraint.
    // The constraint covers `key` alone (not a composite), so two card-specific
    // variants with the same display name (even for different cards) would collide
    // if we derived the key from the name alone.  Prefixing with a sanitized
    // card_id guarantees per-card uniqueness regardless of the name.
    const _nameSlug = suggestion.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const _cardSlug = (suggestion.card_id || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    const variantKey = _cardSlug ? `${_cardSlug}_${_nameSlug}` : _nameSlug

    // Create a card-specific variant from the suggestion.
    // card_id scopes it to the suggested card; is_official: true because an
    // admin has explicitly reviewed and approved this entry.
    const { data: newVariant, error: createError } = await supabase
      .from('variants')
      .insert([{
        key: variantKey,
        name: suggestion.name.trim(),
        description: suggestion.description?.trim() || null,
        color: 'gray', // Gray signals a user-suggested custom variant; admin can adjust later
        short_label: null,
        is_quick_add: true,  // Card-specific variants show as quick-add buttons on the card tile
        sort_order: 999,     // Put at end by default
        is_official: true,   // Admin has approved this variant
        created_by: suggestion.created_by,
        card_id: suggestion.card_id, // Scope to the specific card that was suggested
      }])
      .select()
      .single()

    if (createError) {
      throw new Error(`Failed to create variant: ${createError.message}`)
    }

    // Mark the suggestion as accepted
    const { error: updateError } = await supabase
      .from('variant_suggestions')
      .update({ status: 'accepted' })
      .eq('id', suggestionId)

    if (updateError) {
      throw new Error(`Failed to update suggestion: ${updateError.message}`)
    }

    return {
      success: true,
      data: newVariant,
      message: `Variant "${suggestion.name}" approved and created for card`
    }

  } catch (error: any) {
    console.error('Approve suggestion error:', error)
    return {
      success: false,
      error: error.message || 'Failed to approve suggestion'
    }
  }
}

/**
 * Create a card-specific variant (scoped to one card only)
 *
 * The variant is inserted into `variants` with card_id set, then immediately
 * wired into `card_variant_availability` so the card's override set is kept
 * consistent and the variant shows up for collectors right away.
 */
export async function createCardSpecificVariant(formData: FormData) {
  try {
    const user = await requireAdmin()
    const supabase = getAdminSupabaseClient()

    const cardId      = formData.get('cardId') as string
    const name        = (formData.get('name')  as string)?.trim()
    const color       = (formData.get('color') as string) || 'gray'
    const shortLabel  = (formData.get('shortLabel') as string)?.trim() || null
    const description = (formData.get('description') as string)?.trim() || null
    const sortOrder   = parseInt(formData.get('sortOrder') as string || '0')
    const makeDefault = formData.get('makeDefault') === 'true'

    // ── Validate ────────────────────────────────────────────────
    if (!cardId || !validateUUID(cardId)) {
      return { success: false, error: 'A valid card ID is required' }
    }
    if (!name || name.length === 0) {
      return { success: false, error: 'Variant name is required' }
    }
    if (name.length > 100) {
      return { success: false, error: 'Variant name is too long (max 100 characters)' }
    }

    const validColors = ['green', 'blue', 'purple', 'red', 'pink', 'yellow', 'gray', 'orange', 'teal']
    if (!validColors.includes(color)) {
      return { success: false, error: 'Invalid color selection' }
    }

    // ── Check card exists ────────────────────────────────────────
    const { data: card, error: cardCheckError } = await supabase
      .from('cards')
      .select('id')
      .eq('id', cardId)
      .maybeSingle()

    if (cardCheckError || !card) {
      return { success: false, error: 'Card not found' }
    }

    // ── Check for duplicate name on this card ───────────────────
    const { data: existingCardSpecific } = await supabase
      .from('variants')
      .select('id')
      .eq('card_id', cardId)
      .ilike('name', name)
      .limit(1)
      .maybeSingle()

    if (existingCardSpecific) {
      return { success: false, error: 'A card-specific variant with this name already exists for this card' }
    }

    // ── Insert the card-specific variant ────────────────────────
    // The `variants_key_unique` constraint is global, so two cards with the
    // same variant display name (e.g. "Pokémon Center") would collide if we
    // derived the key from the name alone.  Appending a 12-char card-ID
    // fragment matches the strategy used by bulk-create-card-specific and
    // promote-global-to-card-specific.
    const nameSlug     = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const cardFragment = cardId.replace(/-/g, '').slice(0, 12)
    const key          = `${nameSlug}_${cardFragment}`

    const { data: newVariant, error: insertError } = await supabase
      .from('variants')
      .insert([{
        key,
        name,
        description,
        color,
        short_label: shortLabel,
        // Card-specific variants show as regular quick-add buttons on the card tile
        is_quick_add: true,
        sort_order: sortOrder,
        is_official: true,
        created_by: user.id,
        card_id: cardId,          // ← scopes variant to this card only
      }])
      .select()
      .single()

    if (insertError || !newVariant) {
      throw new Error(`Failed to create card-specific variant: ${insertError?.message}`)
    }

    // Card-specific variants are fetched via `variants WHERE card_id = cardId` and
    // merged on top of the existing rarity/override result — they do NOT touch
    // `card_variant_availability`, which would replace the global rarity rules.

    // Optionally set this new variant as the card's quick-add default.
    if (makeDefault) {
      const { error: defaultError } = await supabase
        .from('cards')
        .update({ default_variant_id: newVariant.id })
        .eq('id', cardId)

      if (defaultError) {
        // Non-fatal: variant was created; just warn rather than roll back.
        console.warn('createCardSpecificVariant: failed to set default_variant_id:', defaultError.message)
      }
    }

    return { success: true, data: newVariant, madeDefault: makeDefault }

  } catch (error: any) {
    console.error('createCardSpecificVariant error:', error)
    return { success: false, error: error.message || 'Failed to create card-specific variant' }
  }
}

/**
 * Reject a variant suggestion
 */
export async function rejectVariantSuggestion(suggestionId: string) {
  try {
    // Verify admin permissions
    await requireAdmin()
    const supabase = getAdminSupabaseClient()

    // Validate input
    if (!suggestionId || typeof suggestionId !== 'string' || !validateUUID(suggestionId)) {
      return {
        success: false,
        error: 'Invalid suggestion ID'
      }
    }

    // Update suggestion status
    const { data, error } = await supabase
      .from('variant_suggestions')
      .update({ status: 'rejected' })
      .eq('id', suggestionId)
      .eq('status', 'pending') // Only reject pending suggestions
      .select('name')
      .single()

    if (error) {
      throw new Error('Suggestion not found or already processed')
    }

    return {
      success: true,
      message: `Suggestion "${data.name}" rejected`
    }

  } catch (error: any) {
    console.error('Reject suggestion error:', error)
    return {
      success: false,
      error: error.message || 'Failed to reject suggestion'
    }
  }
}