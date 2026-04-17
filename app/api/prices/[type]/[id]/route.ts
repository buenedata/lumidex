import { NextRequest, NextResponse } from 'next/server'
import { getItemPrice } from '@/lib/price_service'
import type { ItemType } from '@/types/pricing'

const VALID_TYPES = new Set<ItemType>(['single', 'graded', 'product'])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params
  const variant = request.nextUrl.searchParams.get('variant') ?? 'normal'

  if (!VALID_TYPES.has(type as ItemType)) {
    return NextResponse.json(
      { error: 'Invalid item type. Must be: single, graded, or product' },
      { status: 400 },
    )
  }

  if (!id) {
    return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
  }

  try {
    const result = await getItemPrice(id, type as ItemType, variant)
    const response = NextResponse.json(result)
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400',
    )
    return response
  } catch (error) {
    console.error('[prices GET] error:', error)
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 })
  }
}
