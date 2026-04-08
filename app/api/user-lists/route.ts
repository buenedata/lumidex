import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * /api/user-lists
 *
 * GET  – Returns all custom lists for the authenticated user,
 *         each with a card_count and up to 4 preview card images.
 *         Response: { lists: UserCardList[] }
 *
 * POST – Creates a new list.
 *         Body:     { name: string, description?: string, is_public?: boolean }
 *         Response: { list: UserCardList }
 */

async function getAuthUser() {
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error } = await serverClient.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET(_request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all lists for this user
  const { data: lists, error: listsError } = await supabaseAdmin
    .from('user_card_lists')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (listsError) {
    console.error('[user-lists GET] DB error:', listsError)
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
    console.error('[user-lists GET] items error:', itemsError)
    // Return lists without card counts rather than failing entirely
    return NextResponse.json({
      lists: lists.map((l: Record<string, unknown>) => ({ ...l, card_count: 0, preview_images: [] })),
    })
  }

  // Group items by list_id
  const itemsByList = new Map<string, { card_id: string; image: string | null }[]>()
  for (const item of (items ?? [])) {
    const existing = itemsByList.get(item.list_id) ?? []
    // Supabase may return the joined row as an object or a one-element array
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

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string; description?: string; is_public?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // If is_public not explicitly supplied, fall back to user preference
  let isPublic = body.is_public
  if (typeof isPublic !== 'boolean') {
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('lists_public_by_default')
      .eq('id', user.id)
      .single()
    isPublic = profile?.lists_public_by_default ?? false
  }

  const { data, error } = await supabaseAdmin
    .from('user_card_lists')
    .insert({
      user_id: user.id,
      name,
      description: body.description?.trim() || null,
      is_public: isPublic,
    })
    .select()
    .single()

  if (error) {
    console.error('[user-lists POST] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ list: { ...data, card_count: 0, preview_images: [] } }, { status: 201 })
}
