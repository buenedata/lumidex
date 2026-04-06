import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkAndUnlockAchievements } from '@/lib/achievements'

// POST — set a variant quantity directly (used by the modal's numeric input)
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

      // Fire-and-forget achievement check
      checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
        console.error('[user-card-variants POST] achievement sync failed:', err)
      )

      return NextResponse.json({ message: 'Card variant removed successfully', quantity: 0 })
    }

    // Single upsert — variant_type is a legacy column, skip the extra variants.key lookup
    const { error } = await supabaseAdmin
      .from('user_card_variants')
      .upsert({
        user_id:      userId,
        card_id:      cardId,
        variant_id:   variantId,
        variant_type: null,
        quantity,
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

    // Fire-and-forget achievement check
    checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
      console.error('[user-card-variants POST] achievement sync failed:', err)
    )

    return NextResponse.json({ message: 'Card variant updated successfully', quantity })

  } catch (error) {
    console.error('Unexpected error in user-card-variants POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH — increment or decrement a variant quantity by ±1.
//
// Performance: the client passes `currentQuantity` (its locally-known value) so
// the server can compute the new quantity without a prior SELECT round-trip.
// This collapses what was previously 3 sequential DB calls into 1 upsert.
//
// Race-condition note: if two sessions update the same variant simultaneously,
// the second write wins (last-write-wins). For a personal collection tracker
// this is acceptable; for full atomicity run the migration_increment_user_card_variant_rpc.sql
// and switch the upsert below to supabaseAdmin.rpc('increment_user_card_variant', ...).
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

    // Derive new quantity from the client-supplied current value.
    // Falls back to 0 when currentQuantity is omitted (older clients / first click).
    const base       = typeof currentQuantity === 'number' ? currentQuantity : 0
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

      // Fire-and-forget achievement check
      checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
        console.error('[user-card-variants PATCH] achievement sync failed:', err)
      )

      return NextResponse.json({ quantity: 0 })
    }

    // Single upsert — no prior SELECT, no variants.key lookup
    const { error } = await supabaseAdmin
      .from('user_card_variants')
      .upsert({
        user_id:      userId,
        card_id:      cardId,
        variant_id:   variantId,
        variant_type: null,   // legacy column; populated by DB trigger if needed
        quantity:     newQuantity,
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

    // Fire-and-forget achievement check
    checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
      console.error('[user-card-variants PATCH] achievement sync failed:', err)
    )

    return NextResponse.json({ quantity: newQuantity })

  } catch (error) {
    console.error('Unexpected error in user-card-variants PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
