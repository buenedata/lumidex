import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/user-lists/public/[userId]
 *
 * Returns all PUBLIC custom lists for a given user UUID.
 * No authentication required — intentionally public data.
 *
 * Response: { lists: UserCardList[] }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params

  if (!userId?.trim()) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  // Fetch only public lists for this user
  const { data: lists, error: listsError } = await supabaseAdmin
    .from('user_card_lists')
    .select('*')
    .eq('user_id', userId.trim())
    .eq('is_public', true)
    .order('created_at', { ascending: true })

  if (listsError) {
    console.error('[user-lists/public GET] DB error:', listsError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!lists || lists.length === 0) {
    return NextResponse.json({ lists: [] })
  }

  // Fetch card counts and preview images for all lists in one query
  const listIds = lists.map((l: { id: string }) => l.id)

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('user_card_list_items')
    .select('list_id, card_id, cards(image)')
    .in('list_id', listIds)
    .order('added_at', { ascending: true })

  if (itemsError) {
    console.error('[user-lists/public GET] items error:', itemsError)
    return NextResponse.json({
      lists: lists.map((l: Record<string, unknown>) => ({ ...l, card_count: 0, preview_images: [] })),
    })
  }

  // Group items by list_id
  const itemsByList = new Map<string, { card_id: string; image: string | null }[]>()
  for (const item of (items ?? [])) {
    const existing = itemsByList.get(item.list_id) ?? []
    const cardsRow = item.cards as unknown
    const image: string | null =
      Array.isArray(cardsRow)
        ? (cardsRow[0]?.image ?? null)
        : ((cardsRow as { image: string | null } | null)?.image ?? null)
    existing.push({ card_id: item.card_id, image })
    itemsByList.set(item.list_id, existing)
  }

  const enriched = lists.map((l: Record<string, unknown>) => {
    const listItems = itemsByList.get(l.id as string) ?? []
    return {
      ...l,
      card_count: listItems.length,
      preview_images: listItems.slice(0, 4).map(i => i.image),
    }
  })

  return NextResponse.json({ lists: enriched })
}
