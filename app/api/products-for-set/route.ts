import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/products-for-set?setId=sv1
 *
 * Returns all set_products rows for the given set_id, including
 * image_url so the admin product-image grid can show thumbnails.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const setId = searchParams.get('setId')

  if (!setId) {
    return NextResponse.json({ error: 'Missing setId query parameter' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('set_products')
    .select('id, set_id, name, product_type, image_url')
    .eq('set_id', setId)
    .order('product_type', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('[products-for-set] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ products: data ?? [] })
}
