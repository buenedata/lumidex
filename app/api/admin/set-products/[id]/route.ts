import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminSupabaseClient } from '@/lib/admin'

/**
 * PATCH /api/admin/set-products/:id
 * Update a single set_product row (admin only).
 * Body: { product_type: string | null }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  if (!('product_type' in body)) {
    return NextResponse.json({ error: 'Missing product_type field' }, { status: 400 })
  }

  const productType: string | null =
    typeof body.product_type === 'string' ? body.product_type : null

  const supabase = getAdminSupabaseClient()

  const { data, error } = await supabase
    .from('set_products')
    .update({ product_type: productType })
    .eq('id', id)
    .select('id, product_type')
    .single()

  if (error) {
    console.error('[admin set-products PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
