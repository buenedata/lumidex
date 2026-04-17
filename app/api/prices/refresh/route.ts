import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getItemPrice } from '@/lib/price_service'
import type { ItemType } from '@/types/pricing'

const VALID_TYPES = new Set<ItemType>(['single', 'graded', 'product'])

export async function POST(request: NextRequest) {
  let body: { itemId?: string; itemType?: string; variant?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { itemId, itemType, variant = 'normal' } = body

  if (!itemId) {
    return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
  }

  if (!itemType || !VALID_TYPES.has(itemType as ItemType)) {
    return NextResponse.json(
      { error: 'itemType is required and must be: single, graded, or product' },
      { status: 400 },
    )
  }

  try {
    await supabaseAdmin
      .from('item_prices')
      .delete()
      .eq('item_id', itemId)
      .eq('item_type', itemType)
      .eq('variant', variant)

    const result = await getItemPrice(itemId, itemType as ItemType, variant)
    return NextResponse.json({
      success: true,
      price: result.price,
      currency: result.currency,
      updated_at: result.updated_at,
    })
  } catch (error) {
    console.error('[prices refresh POST] error:', error)
    return NextResponse.json({ error: 'Failed to refresh price' }, { status: 500 })
  }
}
