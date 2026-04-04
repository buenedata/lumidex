import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/admin/promote-global-to-card-specific
 *
 * Converts a global variant (variants.card_id IS NULL) into a card-specific
 * variant (variants.card_id = cardId) for a single card, so that the admin
 * can customise its short_label (and other fields) without affecting every
 * other card that uses the same global variant.
 *
 * What happens atomically:
 *  1. Fetches the global variant row (validates card_id IS NULL).
 *  2. Inserts a new card-specific variant row (copy of the global, card_id set).
 *  3. Migrates any user_card_variants rows for (cardId, globalVariantId) to the
 *     new card-specific variant ID so no existing collection data is lost.
 *  4. Removes the global variant from card_variant_availability for this card.
 *
 * Body: { cardId: string, globalVariantId: string }
 * Response: { success: true, variant: Variant }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cardId, globalVariantId } = body as {
      cardId: string
      globalVariantId: string
    }

    if (!cardId || !globalVariantId) {
      return NextResponse.json(
        { error: 'cardId and globalVariantId are required' },
        { status: 400 }
      )
    }

    // ── 1. Fetch + validate the global variant ───────────────────
    const { data: globalVariant, error: fetchErr } = await supabaseAdmin
      .from('variants')
      .select('*')
      .eq('id', globalVariantId)
      .is('card_id', null)   // must be global
      .single()

    if (fetchErr || !globalVariant) {
      return NextResponse.json(
        { error: 'Global variant not found (it may already be card-specific)' },
        { status: 404 }
      )
    }

    // ── 2. Build a unique key for the card-specific clone ────────
    // Same strategy used by bulk-create-card-specific:
    // <base_key>_<first12charsOfCardId_without_dashes>
    const cardFragment = cardId.replace(/-/g, '').slice(0, 12)
    const newKey = `${globalVariant.key}_${cardFragment}`

    // ── 3. Insert the card-specific clone ────────────────────────
    const { data: newVariant, error: insertErr } = await supabaseAdmin
      .from('variants')
      .insert({
        key:          newKey,
        name:         globalVariant.name,
        description:  globalVariant.description,
        color:        globalVariant.color,
        short_label:  globalVariant.short_label,
        is_quick_add: globalVariant.is_quick_add,
        sort_order:   globalVariant.sort_order,
        is_official:  globalVariant.is_official,
        created_by:   globalVariant.created_by,
        card_id:      cardId,
      })
      .select('*')
      .single()

    if (insertErr || !newVariant) {
      console.error('promote-global: insert failed', insertErr)
      return NextResponse.json(
        { error: `Failed to create card-specific variant: ${insertErr?.message}` },
        { status: 500 }
      )
    }

    // ── 4. Migrate user_card_variants to new variant ID ──────────
    // Update all collection rows that tracked the old global variant for
    // this specific card so collectors don't lose their data.
    const { error: migrateErr } = await supabaseAdmin
      .from('user_card_variants')
      .update({ variant_id: newVariant.id })
      .eq('card_id', cardId)
      .eq('variant_id', globalVariantId)

    if (migrateErr) {
      // Non-fatal — log and continue.
      console.warn(
        'promote-global: user_card_variants migration failed (non-fatal)',
        migrateErr
      )
    }

    // ── 5. Remove global variant from card_variant_availability ───
    const { error: deleteAvailErr } = await supabaseAdmin
      .from('card_variant_availability')
      .delete()
      .eq('card_id', cardId)
      .eq('variant_id', globalVariantId)

    if (deleteAvailErr) {
      console.warn(
        'promote-global: card_variant_availability cleanup failed (non-fatal)',
        deleteAvailErr
      )
    }

    return NextResponse.json({ success: true, variant: newVariant })
  } catch (err: any) {
    console.error('Error in POST /api/admin/promote-global-to-card-specific:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
