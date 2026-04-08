import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/cards/batch?ids=id1,id2,...
 *
 * Returns full card data (with set info) for the given UUID list.
 * Used by the Trade Hub to resolve pre-filled card IDs from URL params.
 *
 * Response: { cards: CardRow[] }
 */
export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids') ?? ''
  const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean)

  if (ids.length === 0) {
    return NextResponse.json({ cards: [] })
  }

  const { data, error } = await supabaseAdmin
    .from('cards')
    .select(`id, set_id, name, number, rarity, type, image, sets!set_id(name, logo_url)`)
    .in('id', ids)

  if (error) {
    console.error('[cards/batch] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const cards = (data ?? []).map(c => {
    const setInfo = (Array.isArray(c.sets) ? c.sets[0] : c.sets) as Record<string, unknown> | null
    return {
      id:           c.id,
      set_id:       c.set_id,
      name:         c.name,
      number:       c.number,
      rarity:       c.rarity,
      type:         c.type,
      image:        c.image,
      set_name:     setInfo?.name     ?? null,
      set_logo_url: setInfo?.logo_url ?? null,
    }
  })

  const response = NextResponse.json({ cards })
  response.headers.set('Cache-Control', 's-maxage=600, stale-while-revalidate=1800')
  return response
}
