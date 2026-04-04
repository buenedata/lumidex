'use server'

import { requireAdmin, getAdminSupabaseClient } from '@/lib/admin'
import { revalidatePath } from 'next/cache'

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

    // Check for duplicate name globally (variants are global catalog)
    const { data: existing, error: checkError } = await supabase
      .from('variants')
      .select('id')
      .ilike('name', rawData.name.trim())
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

    revalidatePath('/admin/variants')
    
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

    revalidatePath('/admin/variants')

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

    revalidatePath('/admin/variants')
    
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

    revalidatePath('/admin/variants')
    
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

    const cardId   = formData.get('cardId') as string
    const name     = (formData.get('name')  as string)?.trim()
    const color    = (formData.get('color') as string) || 'gray'
    const shortLabel = (formData.get('shortLabel') as string)?.trim() || null
    const description = (formData.get('description') as string)?.trim() || null
    const sortOrder = parseInt(formData.get('sortOrder') as string || '0')

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

    revalidatePath('/admin/variants')

    return { success: true, data: newVariant }

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

    revalidatePath('/admin/variants')
    
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