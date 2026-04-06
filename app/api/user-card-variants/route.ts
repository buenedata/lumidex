import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkAndUnlockAchievements } from '@/lib/achievements'

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
      // Delete the record if quantity is 0
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

      // Fire-and-forget: check & revoke/unlock achievements after card removal
      checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
        console.error('[user-card-variants POST] achievement sync failed:', err)
      )

      return NextResponse.json({
        message: 'Card variant removed successfully',
        quantity: 0
      })
    }

    // Look up the variant key to populate the legacy variant_type column
    const { data: variantDef } = await supabaseAdmin
      .from('variants')
      .select('key')
      .eq('id', variantId)
      .single()

    // Upsert the record
    const { data, error } = await supabaseAdmin
      .from('user_card_variants')
      .upsert({
        user_id: userId,
        card_id: cardId,
        variant_id: variantId,
        variant_type: variantDef?.key ?? null,
        quantity
      })
      .select('*')

    if (error) {
      console.error('Error upserting user card variant:', error)
      return NextResponse.json(
        { error: 'Failed to update card variant' },
        { status: 500 }
      )
    }

    // Fire-and-forget: check & unlock any newly earned achievements
    checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
      console.error('[user-card-variants POST] achievement sync failed:', err)
    )

    return NextResponse.json({
      message: 'Card variant updated successfully',
      data: data?.[0],
      quantity
    })

  } catch (error) {
    console.error('Unexpected error in user-card-variants API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, cardId, variantId, increment } = body

    console.log('🔍 PATCH request data:', { userId, cardId, variantId, increment })

    if (!userId || !cardId || !variantId || increment === undefined) {
      return NextResponse.json(
        { error: 'userId, cardId, variantId, and increment are required' },
        { status: 400 }
      )
    }

    // Get current quantity
    const { data: currentVariant, error: fetchError } = await supabaseAdmin
      .from('user_card_variants')
      .select('quantity')
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .eq('variant_id', variantId)
      .single()

    console.log('🔍 Current variant fetch result:', { currentVariant, fetchError })

    let currentQuantity = 0
    if (!fetchError && currentVariant) {
      currentQuantity = currentVariant.quantity
    }

    const newQuantity = Math.max(0, currentQuantity + increment)
    console.log('🔍 Quantity calculation:', { currentQuantity, increment, newQuantity })

    if (newQuantity === 0) {
      // Delete the record if quantity becomes 0
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

      // Fire-and-forget: check & revoke/unlock achievements after card removal
      checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
        console.error('[user-card-variants PATCH] achievement sync failed:', err)
      )

      return NextResponse.json({
        message: 'Card variant removed successfully',
        quantity: 0
      })
    }

    // Look up the variant key to populate the legacy variant_type column
    const { data: variantDef } = await supabaseAdmin
      .from('variants')
      .select('key')
      .eq('id', variantId)
      .single()

    // Upsert the record
    const { data, error } = await supabaseAdmin
      .from('user_card_variants')
      .upsert({
        user_id: userId,
        card_id: cardId,
        variant_id: variantId,
        variant_type: variantDef?.key ?? null,
        quantity: newQuantity
      }, {
        onConflict: 'user_id,card_id,variant_id'
      })
      .select('*')

    if (error) {
      console.error('Error upserting user card variant:', error)
      return NextResponse.json(
        { error: 'Failed to update card variant' },
        { status: 500 }
      )
    }

    // Fire-and-forget: check & unlock any newly earned achievements
    checkAndUnlockAchievements(userId, supabaseAdmin).catch(err =>
      console.error('[user-card-variants PATCH] achievement sync failed:', err)
    )

    return NextResponse.json({
      message: 'Card variant updated successfully',
      data: data?.[0],
      quantity: newQuantity
    })

  } catch (error) {
    console.error('Unexpected error in user-card-variants PATCH API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}