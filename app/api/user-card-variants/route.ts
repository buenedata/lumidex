import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkAndUnlockAchievements } from '@/lib/achievements'

// ── Shared helper ─────────────────────────────────────────────────────────────

/** Appends one row to user_card_activity_log. Fire-and-forget — never throws. */
function logActivity(
  userId:      string,
  cardId:      string,
  variantId:   string,
  oldQuantity: number,
  newQuantity: number,
) {
  if (oldQuantity === newQuantity) return  // no change — skip
  supabaseAdmin
    .from('user_card_activity_log')
    .insert({
      user_id:      userId,
      card_id:      cardId,
      variant_id:   variantId,
      old_quantity: oldQuantity,
      new_quantity: newQuantity,
    })
    .then(({ error }) => {
      if (error) console.error('[activity-log] insert failed:', error.message)
    })
}

// ── POST — set a variant quantity directly (modal numeric input) ──────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, cardId, variantId, quantity } = body

    if (!userId || !cardId || !variantId || quantity === undefined) {
      return NextResponse.json(
        { error: 'userId, cardId, variantId, and quantity are required' },
        { status: 400 }
      )
    }

    if (quantity < 0) {
      return NextResponse.json(
        { error: 'Quantity cannot be negative' },
        { status: 400 }
      )
    }

    // Read current quantity — needed for both delta tracking and the activity log.
    const { data: existingPost } = await supabaseAdmin
      .from('user_card_variants')
      .select('quantity')
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .eq('variant_id', variantId)
      .maybeSingle()

    const oldQty           = existingPost?.quantity ?? 0
    const quantityDeltaPost = quantity - oldQty

    if (quantity === 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('user_card_variants')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .eq('variant_id', variantId)

      if (deleteError) {
        console.error('Error deleting user card variant:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete card variant' },
          { status: 500 }
        )
      }

      logActivity(userId, cardId, variantId, oldQty, 0)
      checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
        console.error('[user-card-variants POST] achievement sync failed:', err)
      )
      return NextResponse.json({ message: 'Card variant removed successfully', quantity: 0 })
    }

    const { error } = await supabaseAdmin
      .from('user_card_variants')
      .upsert({
        user_id:        userId,
        card_id:        cardId,
        variant_id:     variantId,
        variant_type:   null,
        quantity,
        quantity_delta: quantityDeltaPost,
        updated_at:     new Date().toISOString(),
      }, {
        onConflict: 'user_id,card_id,variant_id',
      })

    if (error) {
      console.error('Error upserting user card variant:', error)
      return NextResponse.json(
        { error: 'Failed to update card variant' },
        { status: 500 }
      )
    }

    logActivity(userId, cardId, variantId, oldQty, quantity)
    checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
      console.error('[user-card-variants POST] achievement sync failed:', err)
    )
    return NextResponse.json({ message: 'Card variant updated successfully', quantity })

  } catch (error) {
    console.error('Unexpected error in user-card-variants POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH — increment or decrement a variant quantity by ±1 ──────────────────
//
// Performance: the client passes `currentQuantity` (its locally-known value) so
// the server can compute the new quantity without a prior SELECT round-trip.
// This collapses what was previously 3 sequential DB calls into 1 upsert.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, cardId, variantId, increment, currentQuantity } = body

    if (!userId || !cardId || !variantId || increment === undefined) {
      return NextResponse.json(
        { error: 'userId, cardId, variantId, and increment are required' },
        { status: 400 }
      )
    }

    const base        = typeof currentQuantity === 'number' ? currentQuantity : 0
    const newQuantity = Math.max(0, base + increment)

    if (newQuantity === 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('user_card_variants')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .eq('variant_id', variantId)

      if (deleteError) {
        console.error('Error deleting user card variant:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete card variant' },
          { status: 500 }
        )
      }

      logActivity(userId, cardId, variantId, base, 0)
      checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
        console.error('[user-card-variants PATCH] achievement sync failed:', err)
      )
      return NextResponse.json({ quantity: 0 })
    }

    // updated_at is set explicitly because the BEFORE UPDATE trigger is not
    // guaranteed to fire when supabaseAdmin (service role) issues the upsert.
    const { error } = await supabaseAdmin
      .from('user_card_variants')
      .upsert({
        user_id:        userId,
        card_id:        cardId,
        variant_id:     variantId,
        variant_type:   null,
        quantity:       newQuantity,
        quantity_delta: increment,        // ±1 — the exact change
        updated_at:     new Date().toISOString(),
      }, {
        onConflict: 'user_id,card_id,variant_id',
      })

    if (error) {
      console.error('Error upserting user card variant:', error)
      return NextResponse.json(
        { error: 'Failed to update card variant' },
        { status: 500 }
      )
    }

    logActivity(userId, cardId, variantId, base, newQuantity)
    checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
      console.error('[user-card-variants PATCH] achievement sync failed:', err)
    )
    return NextResponse.json({ quantity: newQuantity })

  } catch (error) {
    console.error('Unexpected error in user-card-variants PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
