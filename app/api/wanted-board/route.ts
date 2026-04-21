import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/wanted-board
 *
 * Returns trade-match objects for the authenticated user's friends:
 *  - theyWant: cards the friend has on their wanted list that I own (qty > 0)
 *  - iWant:    cards on my wanted list that the friend owns (qty > 0)
 *
 * Sorted: mutual matches (both sides) first, then by total match score.
 * Uses supabaseAdmin to bypass RLS for cross-user table reads.
 */

interface WBUser {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

interface WBCard {
  id: string
  set_id: string
  name: string | null
  number: string | null
  rarity: string | null
  type: string | null
  image: string | null
  set_name: string | null
  set_logo_url: string | null
}

export interface WantedBoardMatch {
  user: WBUser
  theyWant: WBCard[]
  iWant: WBCard[]
  isMutual: boolean
  matchScore: number
}

export async function GET(_request: NextRequest) {
  let serverClient
  try {
    serverClient = await createSupabaseServerClient()
  } catch (initErr) {
    const msg = initErr instanceof Error ? initErr.message : String(initErr)
    console.error('[wanted-board] createSupabaseServerClient threw:', msg)
    return NextResponse.json({ error: 'Unauthorized', _debug: { step: 'client-init', message: msg } }, { status: 401 })
  }

  const { data: { user }, error: authError } = await serverClient.auth.getUser()

  if (authError || !user) {
    console.error('[wanted-board] Auth failed — authError:', authError?.message ?? null, '| user present:', !!user)
    return NextResponse.json(
      { error: 'Unauthorized', _debug: { step: 'auth', authError: authError?.message ?? null, hasUser: !!user } },
      { status: 401 },
    )
  }

  const me = user.id

  try {
    // ── 1. Accepted friend IDs ───────────────────────────────────────────────
    const { data: friendRows, error: friendsError } = await supabaseAdmin
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
      .eq('status', 'accepted')

    console.log('[wanted-board DIAG] step=1-friendships friendCount=', (friendRows ?? []).length, 'error=', friendsError?.message ?? null)
    if (friendsError) throw friendsError

    const friendIds = (friendRows ?? []).map(f =>
      (f.requester_id as string) === me
        ? (f.addressee_id as string)
        : (f.requester_id as string)
    )
    if (friendIds.length === 0) {
      return NextResponse.json({ matches: [] })
    }

    // ── 2. My owned card IDs (quantity > 0) — use user_card_variants ─────────
    const { data: myVariantRows, error: myCardsError } = await supabaseAdmin
      .from('user_card_variants')
      .select('card_id')
      .eq('user_id', me)
      .gt('quantity', 0)

    if (myCardsError) throw myCardsError
    // De-duplicate (a card may have multiple variant rows)
    const myCardIds = [...new Set((myVariantRows ?? []).map(c => c.card_id as string))]

    // ── 3. My wanted card IDs ────────────────────────────────────────────────
    const { data: myWantedRows, error: myWantedError } = await supabaseAdmin
      .from('wanted_cards')
      .select('card_id')
      .eq('user_id', me)

    if (myWantedError) throw myWantedError
    const myWantedIds = (myWantedRows ?? []).map(w => w.card_id as string)

    // ── 4. "They want cards I own" ───────────────────────────────────────────
    const theyWantRows: { user_id: string; card_id: string }[] = []
    if (myCardIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('wanted_cards')
        .select('user_id, card_id')
        .in('user_id', friendIds)
        .in('card_id', myCardIds)

      if (error) throw error
      theyWantRows.push(...(data ?? []) as { user_id: string; card_id: string }[])
    }

    // ── 5. "I want cards they own" — use user_card_variants ──────────────────
    const iWantRows: { user_id: string; card_id: string }[] = []
    if (myWantedIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('user_card_variants')
        .select('user_id, card_id')
        .in('user_id', friendIds)
        .in('card_id', myWantedIds)
        .gt('quantity', 0)

      if (error) throw error
      // De-duplicate per (user_id, card_id) — a friend may have multiple variants
      const seen = new Set<string>()
      for (const row of (data ?? []) as { user_id: string; card_id: string }[]) {
        const key = `${row.user_id}:${row.card_id}`
        if (!seen.has(key)) { seen.add(key); iWantRows.push(row) }
      }
    }

    // ── Early exit if no matches ─────────────────────────────────────────────
    const involvedIds = new Set([
      ...theyWantRows.map(r => r.user_id),
      ...iWantRows.map(r => r.user_id),
    ])
    if (involvedIds.size === 0) {
      return NextResponse.json({ matches: [] })
    }

    // ── 6. Fetch full card data for all matched card IDs ─────────────────────
    const allCardIds = new Set([
      ...theyWantRows.map(r => r.card_id),
      ...iWantRows.map(r => r.card_id),
    ])

    const { data: cardRows, error: cardsError } = await supabaseAdmin
      .from('cards')
      .select(`id, set_id, name, number, rarity, type, image, sets!set_id(name, logo_url)`)
      .in('id', Array.from(allCardIds))

    if (cardsError) throw cardsError

    const cardMap = new Map<string, WBCard>()
    for (const c of cardRows ?? []) {
      const setInfo = (Array.isArray(c.sets) ? c.sets[0] : c.sets) as Record<string, unknown> | null
      cardMap.set(c.id as string, {
        id:          c.id as string,
        set_id:      c.set_id as string,
        name:        c.name as string | null,
        number:      c.number as string | null,
        rarity:      c.rarity as string | null,
        type:        c.type as string | null,
        image:       c.image as string | null,
        set_name:    (setInfo?.name     as string) ?? null,
        set_logo_url:(setInfo?.logo_url as string) ?? null,
      })
    }

    // ── 7. Fetch friend profile data ─────────────────────────────────────────
    const { data: userRows, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, display_name, username, avatar_url')
      .in('id', Array.from(involvedIds))

    if (usersError) throw usersError

    const userMap = new Map<string, WBUser>()
    for (const u of userRows ?? []) {
      userMap.set(u.id as string, {
        id:           u.id as string,
        display_name: u.display_name    ?? null,
        username:     u.username        ?? null,
        avatar_url:   u.avatar_url      ?? null,
      })
    }

    // ── 8. Build match objects grouped by friend ──────────────────────────────
    const matchMap = new Map<string, WantedBoardMatch>()

    const ensureMatch = (friendId: string) => {
      if (!matchMap.has(friendId)) {
        const friend = userMap.get(friendId)
        if (!friend) return null
        matchMap.set(friendId, { user: friend, theyWant: [], iWant: [], isMutual: false, matchScore: 0 })
      }
      return matchMap.get(friendId)!
    }

    for (const row of theyWantRows) {
      const match = ensureMatch(row.user_id)
      const card  = cardMap.get(row.card_id)
      if (match && card) match.theyWant.push(card)
    }

    for (const row of iWantRows) {
      const match = ensureMatch(row.user_id)
      const card  = cardMap.get(row.card_id)
      if (match && card) match.iWant.push(card)
    }

    // ── 9. Finalise: mutual flag + score + sort ───────────────────────────────
    const matches = Array.from(matchMap.values())
      .map(m => ({
        ...m,
        isMutual:   m.theyWant.length > 0 && m.iWant.length > 0,
        matchScore: m.theyWant.length + m.iWant.length * 2, // mutual side weighted higher
      }))
      .sort((a, b) => {
        if (a.isMutual !== b.isMutual) return a.isMutual ? -1 : 1
        return b.matchScore - a.matchScore
      })

    const response = NextResponse.json({ matches })
    // Private — do not cache on CDN; revalidate quickly
    response.headers.set('Cache-Control', 'private, no-cache')
    return response

  } catch (err) {
    const e = err as Record<string, unknown>
    console.error('[wanted-board] CAUGHT ERROR — code:', e?.code, '| message:', e?.message, '| details:', e?.details, '| hint:', e?.hint)
    return NextResponse.json(
      {
        error: 'Internal server error',
        _debug: {
          code:    e?.code    ?? null,
          message: e?.message ?? null,
          details: e?.details ?? null,
          hint:    e?.hint    ?? null,
        },
      },
      { status: 500 },
    )
  }
}
