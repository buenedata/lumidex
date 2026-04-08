import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * /api/user-lists/[listId]/cards
 *
 * GET    – Returns full card data for all cards in the list.
 *           Also works for public lists (no auth required).
 *           Response: { cards: PokemonCard[], list: UserCardList }
 *
 * POST   – Adds a card to the list (owner only).
 *           Body:     { cardId: string }
 *           Response: { added: true }
 *
 * DELETE – Removes a card from the list (owner only).
 *           Body:     { cardId: string }
 *           Response: { removed: true }
 */

async function getAuthUser() {
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error } = await serverClient.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  const { listId } = await params

  // Fetch the list metadata — must be public or owned by the current user
  const user = await getAuthUser()

  const { data: list, error: listError } = await supabaseAdmin
    .from('user_card_lists')
    .select('*')
    .eq('id', listId)
    .single()

  if (listError || !list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }

  // Access control: private lists are only visible to their owner
  if (!list.is_public && list.user_id !== user?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch cards via the items join
  const { data: items, error: itemsError } = await supabaseAdmin
    .from('user_card_list_items')
    .select(`
      added_at,
      cards (
        id, set_id, name, number, rarity, type, image,
        artist, hp, supertype, subtypes, created_at
      )
    `)
    .eq('list_id', listId)
    .order('added_at', { ascending: true })

  if (itemsError) {
    console.error('[list-cards GET] DB error:', itemsError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Unwrap the nested cards objects
  const cards = (items ?? [])
    .map((item: { added_at: string; cards: unknown }) => {
      const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
      return card ?? null
    })
    .filter(Boolean)

  return NextResponse.json({ list, cards })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { listId } = await params

  let body: { cardId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  // Verify the list belongs to this user
  const { data: list, error: listError } = await supabaseAdmin
    .from('user_card_lists')
    .select('id')
    .eq('id', listId)
    .eq('user_id', user.id)
    .single()

  if (listError || !list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('user_card_list_items')
    .upsert(
      { list_id: listId, card_id: body.cardId },
      { onConflict: 'list_id,card_id' },
    )

  if (error) {
    console.error('[list-cards POST] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Keep updated_at fresh on the parent list
  await supabaseAdmin
    .from('user_card_lists')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', listId)

  return NextResponse.json({ added: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { listId } = await params

  let body: { cardId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  // Verify ownership via join — admin client makes this safe
  const { data: list, error: listError } = await supabaseAdmin
    .from('user_card_lists')
    .select('id')
    .eq('id', listId)
    .eq('user_id', user.id)
    .single()

  if (listError || !list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('user_card_list_items')
    .delete()
    .eq('list_id', listId)
    .eq('card_id', body.cardId)

  if (error) {
    console.error('[list-cards DELETE] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Keep updated_at fresh on the parent list
  await supabaseAdmin
    .from('user_card_lists')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', listId)

  return NextResponse.json({ removed: true })
}
