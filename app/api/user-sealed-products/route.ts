import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/user-sealed-products?userId=<uuid>
 * Returns all sealed product quantities for a user.
 * Response: { data: Array<{ product_id: string; quantity: number }> }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('user_sealed_products')
      .select('product_id, quantity')
      .eq('user_id', userId)

    if (error) {
      console.error('[user-sealed-products] GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch sealed products' }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[user-sealed-products] GET unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/user-sealed-products
 * Upserts a sealed product quantity for a user.
 * Body: { userId: string; productId: string; quantity: number }
 * - quantity = 0 → deletes the row
 * - quantity > 0 → upserts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, productId, quantity } = body

    if (!userId || !productId || quantity === undefined) {
      return NextResponse.json(
        { error: 'userId, productId, and quantity are required' },
        { status: 400 }
      )
    }

    if (typeof quantity !== 'number' || quantity < 0) {
      return NextResponse.json(
        { error: 'quantity must be a non-negative number' },
        { status: 400 }
      )
    }

    if (quantity === 0) {
      // Remove from collection
      const { error: deleteError } = await supabaseAdmin
        .from('user_sealed_products')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId)

      if (deleteError) {
        console.error('[user-sealed-products] DELETE error:', deleteError)
        return NextResponse.json({ error: 'Failed to remove sealed product' }, { status: 500 })
      }

      return NextResponse.json({ message: 'Sealed product removed from collection', quantity: 0 })
    }

    // Upsert
    const { data, error } = await supabaseAdmin
      .from('user_sealed_products')
      .upsert(
        { user_id: userId, product_id: productId, quantity },
        { onConflict: 'user_id,product_id' }
      )
      .select('product_id, quantity')

    if (error) {
      console.error('[user-sealed-products] UPSERT error:', error)
      return NextResponse.json({ error: 'Failed to update sealed product' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Sealed product updated',
      data: data?.[0],
      quantity,
    })
  } catch (err) {
    console.error('[user-sealed-products] POST unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/user-sealed-products
 * Removes a sealed product from the user's collection.
 * Body: { userId: string; productId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, productId } = body

    if (!userId || !productId) {
      return NextResponse.json(
        { error: 'userId and productId are required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('user_sealed_products')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId)

    if (error) {
      console.error('[user-sealed-products] DELETE error:', error)
      return NextResponse.json({ error: 'Failed to delete sealed product' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Sealed product removed from collection' })
  } catch (err) {
    console.error('[user-sealed-products] DELETE unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
