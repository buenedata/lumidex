import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/trade-proposals
 * Returns all trade proposals the current user is party to (sent + received),
 * ordered newest first. Includes cash amounts and full card details.
 *
 * POST /api/trade-proposals
 * Creates a new trade proposal with card items and optional cash amounts.
 * Body: {
 *   receiverId,
 *   notes?,
 *   offering:   [{cardId, quantity}],
 *   requesting: [{cardId, quantity}],
 *   cashOffered?:   number,   // how much cash the proposer adds
 *   cashRequested?: number,   // how much cash the proposer wants back
 *   currencyCode?:  string,   // ISO 4217 e.g. 'EUR', 'USD', 'NOK'
 * }
 */

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(_request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('trade_proposals')
    .select(`
      id, status, notes, created_at, updated_at,
      proposer_id, receiver_id,
      cash_offered, cash_requested, currency_code,
      trade_proposal_items (
        id, direction, quantity,
        cards ( id, set_id, name, number, image, sets!set_id(name, logo_url) )
      )
    `)
    .or(`proposer_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[trade-proposals GET] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Fetch minimal profile for the other party of each proposal
  const otherIds = new Set<string>()
  for (const p of data ?? []) {
    const other = p.proposer_id === user.id ? p.receiver_id : p.proposer_id
    if (other) otherIds.add(other as string)
  }

  const userMap = new Map<string, { id: string; display_name: string | null; username: string | null; avatar_url: string | null }>()
  if (otherIds.size > 0) {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, display_name, username, avatar_url')
      .in('id', Array.from(otherIds))

    for (const u of users ?? []) {
      userMap.set(u.id as string, {
        id:           u.id as string,
        display_name: u.display_name ?? null,
        username:     u.username     ?? null,
        avatar_url:   u.avatar_url   ?? null,
      })
    }
  }

  const proposals = (data ?? []).map(p => {
    const otherId = (p.proposer_id === user.id ? p.receiver_id : p.proposer_id) as string
    return {
      ...p,
      isProposer:   p.proposer_id === user.id,
      otherUser:    userMap.get(otherId) ?? null,
      cash_offered:   (p as Record<string, unknown>).cash_offered   ?? 0,
      cash_requested: (p as Record<string, unknown>).cash_requested ?? 0,
      currency_code:  (p as Record<string, unknown>).currency_code  ?? 'EUR',
    }
  })

  return NextResponse.json({ proposals })
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    receiverId: string
    notes?: string
    offering:   Array<{ cardId: string; quantity: number }>
    requesting: Array<{ cardId: string; quantity: number }>
    cashOffered?:   number
    cashRequested?: number
    currencyCode?:  string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    receiverId,
    notes,
    offering   = [],
    requesting = [],
    cashOffered   = 0,
    cashRequested = 0,
    currencyCode  = 'EUR',
  } = body

  if (!receiverId) {
    return NextResponse.json({ error: 'receiverId is required' }, { status: 400 })
  }

  const hasCash  = cashOffered > 0 || cashRequested > 0
  const hasCards = offering.length > 0 || requesting.length > 0

  if (!hasCards && !hasCash) {
    return NextResponse.json({ error: 'At least one card or cash amount is required' }, { status: 400 })
  }
  if (offering.length === 0 && cashOffered === 0) {
    return NextResponse.json({ error: 'You must offer at least one card or a cash amount' }, { status: 400 })
  }
  if (receiverId === user.id) {
    return NextResponse.json({ error: 'Cannot propose a trade with yourself' }, { status: 400 })
  }

  const validCurrencies = ['EUR','USD','GBP','NOK','SEK','DKK','CAD','AUD','JPY','CHF']
  if (!validCurrencies.includes(currencyCode)) {
    return NextResponse.json({ error: `Invalid currency code: ${currencyCode}` }, { status: 400 })
  }

  // Use serverClient for inserts so RLS auth.uid() = proposer_id check passes
  const { data: proposal, error: propError } = await serverClient
    .from('trade_proposals')
    .insert({
      proposer_id:    user.id,
      receiver_id:    receiverId,
      notes:          notes ?? null,
      cash_offered:   cashOffered,
      cash_requested: cashRequested,
      currency_code:  currencyCode,
    })
    .select('id')
    .single()

  if (propError || !proposal) {
    console.error('[trade-proposals POST] insert error:', propError)
    return NextResponse.json(
      { error: propError?.message ?? 'Failed to create proposal' },
      { status: 500 },
    )
  }

  // Insert card items
  const items = [
    ...offering.map(o  => ({ proposal_id: proposal.id, card_id: o.cardId, direction: 'offering',   quantity: o.quantity })),
    ...requesting.map(r => ({ proposal_id: proposal.id, card_id: r.cardId, direction: 'requesting', quantity: r.quantity })),
  ]

  if (items.length > 0) {
    const { error: itemsError } = await serverClient
      .from('trade_proposal_items')
      .insert(items)

    if (itemsError) {
      console.error('[trade-proposals POST] items insert error:', itemsError)
      await supabaseAdmin.from('trade_proposals').delete().eq('id', proposal.id)
      return NextResponse.json({ error: itemsError.message ?? 'Failed to save proposal items' }, { status: 500 })
    }
  }

  return NextResponse.json({ proposalId: proposal.id }, { status: 201 })
}
