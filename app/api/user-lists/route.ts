import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserTier, getCustomListLimit } from '@/lib/subscription'

/**
 * /api/user-lists
 *
 * GET  – Returns all of the authenticated user's custom lists (excludes Wanted list).
 *        Response: { lists: UserCardList[] }
 *
 * POST – Creates a new custom list.
 *        Free tier: max 2 lists. Pro: unlimited.
 *        Body:     { name: string, description?: string, is_public?: boolean }
 *        Response: { list: UserCardList }
 *        Errors:   402 { code: 'PRO_REQUIRED' } when free-tier limit reached
 */

// ─── Shared auth helper ────────────────────────────────────────────────────────

async function getAuthUser() {
  const serverClient = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await serverClient.auth.getUser()
  if (error || !user) return null
  return user
}

// ─── GET /api/user-lists ───────────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('user_card_lists')
    .select('id, name, description, is_public, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[user-lists GET] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const lists = data ?? []

  if (lists.length === 0) {
    return NextResponse.json({ lists: [] })
  }

  // Fetch card counts + preview images for all lists in one query
  const listIds = lists.map(l => l.id)
  const { data: items, error: itemsError } = await supabaseAdmin
    .from('user_card_list_items')
    .select('list_id, card_id, cards(image)')
    .in('list_id', listIds)
    .order('added_at', { ascending: true })

  if (itemsError) {
    console.error('[user-lists GET] items error:', itemsError)
    // Return lists without counts rather than an error
    return NextResponse.json({
      lists: lists.map(l => ({ ...l, card_count: 0, preview_images: [] })),
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

  const enriched = lists.map(l => {
    const listItems = itemsByList.get(l.id) ?? []
    return {
      ...l,
      card_count: listItems.length,
      preview_images: listItems.slice(0, 4).map(i => i.image),
    }
  })

  return NextResponse.json({ lists: enriched })
}

// ─── POST /api/user-lists ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Validate body ──────────────────────────────────────────────────────────
  let body: { name?: string; description?: string; is_public?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (name.length > 80) {
    return NextResponse.json(
      { error: 'name must be 80 characters or fewer' },
      { status: 400 }
    )
  }

  // ── Tier enforcement ───────────────────────────────────────────────────────
  // Count how many custom lists this user already owns.
  // The limit is 2 for free, Infinity for Pro.
  const tier = await getUserTier(user.id)
  const limit = getCustomListLimit(tier)

  // Only hit the DB for the count when the tier actually has a cap
  if (limit !== Infinity) {
    const { count, error: countError } = await supabaseAdmin
      .from('user_card_lists')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countError) {
      console.error('[user-lists POST] count error:', countError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        {
          error: `You've reached the ${limit}-list limit on the free plan. Upgrade to Lumidex Pro for unlimited custom lists.`,
          code: 'PRO_REQUIRED' as const,
          limit,
        },
        { status: 402 }
      )
    }
  }

  // ── Insert ─────────────────────────────────────────────────────────────────
  const { data, error } = await supabaseAdmin
    .from('user_card_lists')
    .insert({
      user_id: user.id,
      name,
      description: body.description?.trim() ?? null,
      is_public: body.is_public ?? false,
    })
    .select('id, name, description, is_public, created_at, updated_at')
    .single()

  if (error) {
    console.error('[user-lists POST] insert error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ list: data }, { status: 201 })
}
