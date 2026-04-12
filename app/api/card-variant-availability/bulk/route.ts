import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/card-variant-availability/bulk
 *
 * Applies the same variant configuration to multiple cards at once.
 *
 * Body:
 * {
 *   cardIds:          string[]           — cards to update
 *   variantIds?:      string[] | null    — global variants to enable.
 *                                          [] = revert to rarity rules (clears overrides).
 *                                          omit / null = leave card_variant_availability untouched.
 *   defaultVariantId: string | null      — optional; applied to every card.default_variant_id
 * }
 *
 * Response: { success: true, updatedCount: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cardIds, variantIds, defaultVariantId } = body as {
      cardIds: string[]
      variantIds?: string[] | null
      defaultVariantId?: string | null
    }

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json(
        { error: 'cardIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // variantIds is optional.  When provided (even as []), the override set is
    // replaced.  When absent / null the card_variant_availability rows are left
    // completely untouched — only default_variant_id is updated.
    if (variantIds !== undefined && variantIds !== null && !Array.isArray(variantIds)) {
      return NextResponse.json(
        { error: 'variantIds must be an array when provided' },
        { status: 400 }
      )
    }

    if (Array.isArray(variantIds)) {
      // 1. Delete all existing overrides for every card in the batch
      const { error: deleteError } = await supabaseAdmin
        .from('card_variant_availability')
        .delete()
        .in('card_id', cardIds)

      if (deleteError) {
        throw new Error(`Failed to clear existing overrides: ${deleteError.message}`)
      }

      // 2. Re-insert new overrides for each cardId × variantId combination
      if (variantIds.length > 0) {
        const rows = cardIds.flatMap((cardId) =>
          variantIds.map((variantId) => ({ card_id: cardId, variant_id: variantId }))
        )

        const { error: insertError } = await supabaseAdmin
          .from('card_variant_availability')
          .insert(rows)

        if (insertError) {
          throw new Error(`Failed to save overrides: ${insertError.message}`)
        }
      }
    }
    // If variantIds is undefined/null → steps 1 & 2 are skipped entirely.

    // 3. Optionally update cards.default_variant_id for every card
    //    undefined = no change; null or a variant ID = explicit set
    if (defaultVariantId !== undefined) {
      const { error: cardUpdateError } = await supabaseAdmin
        .from('cards')
        .update({ default_variant_id: defaultVariantId ?? null })
        .in('id', cardIds)

      if (cardUpdateError) {
        throw new Error(`Failed to update default variant: ${cardUpdateError.message}`)
      }
    }

    return NextResponse.json({ success: true, updatedCount: cardIds.length })
  } catch (error: any) {
    console.error('Error in bulk card-variant-availability update:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to bulk-update card variant availability' },
      { status: 500 }
    )
  }
}
