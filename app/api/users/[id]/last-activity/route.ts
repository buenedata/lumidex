import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CardActivityItem = {
  type: 'card'
  timestamp: string
  /** ISO 8601 — used with timestamp to detect first-add vs quantity update */
  created_at: string
  quantity: number
  /**
   * Signed integer: positive = increase, negative = decrease, null = unknown
   * (rows that predate the quantity_delta column or were set via the RPC).
   */
  quantity_delta: number | null
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
 * Returns the 10 most recently added or updated card variants and sealed
 * products for the given user, merged and sorted by updated_at DESC.
 *
 * Privacy:
 *  - If the target profile has profile_private = true, only the profile owner
 *    (determined via the session cookie) may see the activity; everyone else
 *    receives an empty array.
 *  - Public profiles are readable by anyone (including unauthenticated visitors).
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
    const isOwner  = requestingUser?.id === userId
    const isPrivate = userResult.data?.profile_private ?? false

    if (isPrivate && !isOwner) {
      return NextResponse.json({ data: [] })
    }

    // ── 2. Fetch raw activity rows in parallel ────────────────────────────────
    const [cardVariantsResult, sealedProductsResult] = await Promise.all([
      supabaseAdmin
        .from('user_card_variants')
        .select('card_id, variant_type, quantity, quantity_delta, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(10),

      supabaseAdmin
        .from('user_sealed_products')
        .select('product_id, quantity, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5),
    ])

    const cardVariants  = cardVariantsResult.data  ?? []
    const sealedProducts = sealedProductsResult.data ?? []

    // ── 3. Enrich card variants ───────────────────────────────────────────────
    const cardItems: CardActivityItem[] = []

    if (cardVariants.length > 0) {
      const cardIds = [...new Set(cardVariants.map(r => r.card_id))]

      const { data: cardsData } = await supabaseAdmin
        .from('cards')
        .select('id, name, number, image, type, set_id')
        .in('id', cardIds)

      if (cardsData && cardsData.length > 0) {
        const setIds = [...new Set(cardsData.map(c => c.set_id).filter(Boolean))]

        const { data: setsData } = await supabaseAdmin
          .from('sets')
          .select('set_id, name, logo_url')
          .in('set_id', setIds)

        const cardMap = new Map(cardsData.map(c  => [c.id,      c]))
        const setMap  = new Map((setsData ?? []).map(s => [s.set_id, s]))

        for (const variant of cardVariants) {
          const card = cardMap.get(variant.card_id)
          if (!card) continue
          const set = setMap.get(card.set_id)

          cardItems.push({
            type:           'card',
            timestamp:      variant.updated_at,
            created_at:     variant.created_at,
            quantity:       variant.quantity ?? 1,
            quantity_delta: variant.quantity_delta ?? null,
            card_id:        card.id,
            card_name:    card.name,
            card_number:  card.number ?? '',
            card_image:   card.image  ?? null,
            card_type:    card.type   ?? null,
            variant_type: variant.variant_type ?? null,
            set_id:       card.set_id,
            set_name:     set?.name ?? '',
          })
        }
      }
    }

    // ── 4. Enrich sealed products ─────────────────────────────────────────────
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

        const productMap    = new Map(productsData.map(p => [p.id,      p]))
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

    // ── 5. Merge, sort and cap at 10 ─────────────────────────────────────────
    const merged: ActivityItem[] = [...cardItems, ...productItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)

    return NextResponse.json({ data: merged })
  } catch (err) {
    console.error('[last-activity] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
