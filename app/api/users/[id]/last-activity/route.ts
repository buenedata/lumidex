import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CardActivityItem = {
  type: 'card'
  /** ISO 8601 timestamp of this specific change event */
  timestamp: string
  /** Quantity after the change */
  quantity: number
  /** Signed delta: positive = increase, negative = decrease. Always set. */
  quantity_delta: number
  card_id: string
  card_name: string
  card_number: string
  card_image: string | null
  card_type: string | null
  variant_type: string | null
  set_id: string
  set_name: string
}

export type SealedProductActivityItem = {
  type: 'sealed_product'
  timestamp: string
  /** ISO 8601 — used with timestamp to detect first-add vs quantity update */
  created_at: string
  product_id: string
  product_name: string
  product_type: string | null
  product_image: string | null
  quantity: number
  set_id: string
  set_name: string
}

export type ActivityItem = CardActivityItem | SealedProductActivityItem

// ── Route Handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/users/[id]/last-activity
 *
 * Returns the 10 most recent card changes (from user_card_activity_log) and
 * sealed product updates, merged and sorted by timestamp DESC.
 *
 * Card activity uses the activity log so multiple changes to the same card show
 * as separate events (e.g. ↓2→1 and ↑1→2 are both visible).
 *
 * Privacy:
 *  - profile_private = true → only the profile owner can see activity.
 *  - Public profiles are readable by anyone.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params

  try {
    // ── 1. Privacy check ──────────────────────────────────────────────────────
    const [userResult, serverClient] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('profile_private')
        .eq('id', userId)
        .single(),
      createSupabaseServerClient(),
    ])

    const { data: { user: requestingUser } } = await serverClient.auth.getUser()
    const isOwner   = requestingUser?.id === userId
    const isPrivate = userResult.data?.profile_private ?? false

    if (isPrivate && !isOwner) {
      return NextResponse.json({ data: [] })
    }

    // ── 2. Fetch raw activity rows in parallel ────────────────────────────────
    const [cardLogResult, sealedProductsResult] = await Promise.all([
      // Fetch more rows than we'll display so that rapid multi-click sessions
      // (which produce many rows for the same card+variant) can be merged
      // down to 10 unique card+variant events.
      supabaseAdmin
        .from('user_card_activity_log')
        .select('card_id, variant_id, old_quantity, new_quantity, changed_at')
        .eq('user_id', userId)
        .order('changed_at', { ascending: false })
        .limit(100),

      // Sealed products still use the current-state table (one row per product)
      supabaseAdmin
        .from('user_sealed_products')
        .select('product_id, quantity, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5),
    ])

    const rawLogRows     = cardLogResult.data    ?? []
    const sealedProducts = sealedProductsResult.data ?? []

    // ── 3. Merge rapid consecutive clicks into one session event ─────────────
    //
    // Multiple +1/-1 clicks on the same card+variant within a 5-minute window
    // are collapsed into one event: old_quantity = session start, new_quantity
    // = session end, changed_at = most recent click.
    //
    // rawLogRows is ordered DESC so the first entry per key is the most recent.
    const SESSION_WINDOW_MS = 5 * 60 * 1000

    type LogRow = { card_id: string; variant_id: string; old_quantity: number; new_quantity: number; changed_at: string }
    const sessionMap = new Map<string, LogRow>()

    for (const log of rawLogRows) {
      const key      = `${log.card_id}:${log.variant_id}`
      const existing = sessionMap.get(key)

      if (!existing) {
        sessionMap.set(key, {
          card_id:      log.card_id,
          variant_id:   log.variant_id,
          new_quantity: log.new_quantity,    // most recent end state
          old_quantity: log.old_quantity,    // start (may be extended below)
          changed_at:   log.changed_at,
        })
      } else {
        // This entry is older than the one already in the map.
        // If it falls within the session window, extend old_quantity back.
        const newestMs = new Date(existing.changed_at).getTime()
        const thisMs   = new Date(log.changed_at).getTime()
        if (newestMs - thisMs <= SESSION_WINDOW_MS) {
          sessionMap.set(key, { ...existing, old_quantity: log.old_quantity })
        }
        // Entries outside the window are ignored for this session — they remain
        // available for future fetches if we ever expose multi-session history.
      }
    }

    // Sort merged sessions by most recent changed_at, cap at 10
    const cardLogRows = Array.from(sessionMap.values())
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
      .slice(0, 10)

    // ── 4. Enrich card log rows ───────────────────────────────────────────────
    const cardItems: CardActivityItem[] = []

    if (cardLogRows.length > 0) {
      // Deduplicate card_ids for the cards lookup
      const cardIds    = [...new Set(cardLogRows.map(r => r.card_id))]
      const variantIds = [...new Set(cardLogRows.map(r => r.variant_id))]

      const [cardsResult, variantsResult] = await Promise.all([
        supabaseAdmin
          .from('cards')
          .select('id, name, number, image, type, set_id')
          .in('id', cardIds),
        supabaseAdmin
          .from('variants')
          .select('id, key')
          .in('id', variantIds),
      ])

      const cardsData    = cardsResult.data    ?? []
      const variantsData = variantsResult.data ?? []

      if (cardsData.length > 0) {
        const setIds = [...new Set(cardsData.map(c => c.set_id).filter(Boolean))]

        const { data: setsData } = await supabaseAdmin
          .from('sets')
          .select('set_id, name, logo_url')
          .in('set_id', setIds)

        const cardMap    = new Map(cardsData.map(c    => [c.id,      c]))
        const variantMap = new Map(variantsData.map(v => [v.id,      v]))
        const setMap     = new Map((setsData ?? []).map(s => [s.set_id, s]))

        for (const log of cardLogRows) {
          const card    = cardMap.get(log.card_id)
          const variant = variantMap.get(log.variant_id)
          if (!card) continue
          const set = setMap.get(card.set_id)

          cardItems.push({
            type:           'card',
            timestamp:      log.changed_at,
            quantity:       log.new_quantity,
            quantity_delta: log.new_quantity - log.old_quantity,
            card_id:        card.id,
            card_name:      card.name,
            card_number:    card.number ?? '',
            card_image:     card.image  ?? null,
            card_type:      card.type   ?? null,
            variant_type:   variant?.key ?? null,
            set_id:         card.set_id,
            set_name:       set?.name ?? '',
          })
        }
      }
    }

    // ── 5. Enrich sealed products ─────────────────────────────────────────────
    const productItems: SealedProductActivityItem[] = []

    if (sealedProducts.length > 0) {
      const productIds = [...new Set(sealedProducts.map(p => p.product_id))]

      const { data: productsData } = await supabaseAdmin
        .from('set_products')
        .select('id, name, product_type, image_url, set_id')
        .in('id', productIds)

      if (productsData && productsData.length > 0) {
        const productSetIds = [...new Set(productsData.map(p => p.set_id).filter(Boolean))]

        const { data: productSetsData } = await supabaseAdmin
          .from('sets')
          .select('set_id, name')
          .in('set_id', productSetIds)

        const productMap    = new Map(productsData.map(p     => [p.id,      p]))
        const productSetMap = new Map((productSetsData ?? []).map(s => [s.set_id, s]))

        for (const up of sealedProducts) {
          const product = productMap.get(up.product_id)
          if (!product) continue
          const set = productSetMap.get(product.set_id)

          productItems.push({
            type:          'sealed_product',
            timestamp:     up.updated_at,
            created_at:    up.created_at,
            product_id:    product.id,
            product_name:  product.name,
            product_type:  product.product_type ?? null,
            product_image: product.image_url    ?? null,
            quantity:      up.quantity,
            set_id:        product.set_id,
            set_name:      set?.name ?? '',
          })
        }
      }
    }

    // ── 5. Merge, sort by timestamp DESC, cap at 10 ───────────────────────────
    const merged: ActivityItem[] = [...cardItems, ...productItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)

    return NextResponse.json({ data: merged })
  } catch (err) {
    console.error('[last-activity] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
