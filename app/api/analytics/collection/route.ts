// ─────────────────────────────────────────────────────────────────────────────
// app/api/analytics/collection/route.ts
//
// GET /api/analytics/collection
//
// Returns advanced collection analytics for the authenticated Pro user:
//   - topCards:        top 10 owned cards by total EUR value
//   - rarityBreakdown: card count + total EUR value grouped by rarity
//   - valueBySet:      total EUR value + card count grouped by set
//   - bestPerformers:  top 5 cards with highest price gain (%) in last 30 days
//   - worstPerformers: top 5 cards with highest price drop (%) in last 30 days
//
// Auth: Pro-only. Returns 402 { code: 'PRO_REQUIRED' } for free users.
// Cache: private, 5 minutes (user-specific data — must not be CDN-shared).
//
// NOTE on card_price_history.price_usd:
//   Despite the column name, newer rows populated by the tcggo sync store EUR
//   values in price_usd. It is used here only for percentage-change calculations
//   (direction + relative magnitude), never for absolute display. Absolute prices
//   always come from item_prices.price (EUR).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSessionPro, ProRequiredError } from '@/lib/subscription'
import type {
  TopCard,
  RarityBucket,
  SetValueEntry,
  PerformerCard,
} from '@/lib/analytics'

// ─── Local query row types ─────────────────────────────────────────────────

interface OwnedCardRow {
  card_id: string
  quantity: number
  cards: {
    id: string
    name: string
    rarity: string | null
    set_id: string
    tcggo_id: number | null
    /** NOTE: column is named 'image' in the cards table, not 'image_url' */
    image: string | null
    sets: { name: string } | null
  } | null
}

interface PriceRow {
  item_id: string
  price: number
}

interface HistoryRow {
  card_id: string
  /** Legacy column name; stores EUR for tcggo-sourced rows, USD for older tcgplayer rows. */
  price_usd: number
  recorded_at: string
}

// ─── Handler ──────────────────────────────────────────────────────────────

export async function GET() {
  // 1. Auth + Pro gate ──────────────────────────────────────────────────────
  let user: Awaited<ReturnType<typeof requireSessionPro>>
  try {
    user = await requireSessionPro()
  } catch (err) {
    if (err instanceof ProRequiredError) {
      return NextResponse.json(
        { error: err.message, code: 'PRO_REQUIRED' },
        { status: 402 },
      )
    }
    throw err
  }

  // 2. Fetch all owned card variants (quantity > 0) with card + set metadata ─
  const { data: ownedRaw, error: ownedError } = await supabaseAdmin
    .from('user_card_variants')
    .select(`
      card_id,
      quantity,
      cards (
        id,
        name,
        rarity,
        set_id,
        tcggo_id,
        image,
        sets ( name )
      )
    `)
    .eq('user_id', user.id)
    .gt('quantity', 0)

  if (ownedError) {
    console.error('[analytics/collection] owned query failed:', ownedError)
    return NextResponse.json({ error: ownedError.message }, { status: 500 })
  }

  const owned = (ownedRaw ?? []) as unknown as OwnedCardRow[]

  // 3. Batch-fetch current EUR prices from item_prices ─────────────────────
  // item_prices.item_id = cards.tcggo_id cast to text
  // Filter: item_type='single', variant='normal' → canonical card price
  const tcggoIds = [
    ...new Set(
      owned
        .map((r) => r.cards?.tcggo_id)
        .filter((id): id is number => id != null)
        .map(String),
    ),
  ]

  let priceMap = new Map<string, number>()

  if (tcggoIds.length > 0) {
    const { data: priceRows, error: priceError } = await supabaseAdmin
      .from('item_prices')
      .select('item_id, price')
      .in('item_id', tcggoIds)
      .eq('item_type', 'single')
      .eq('variant', 'normal')
      .not('price', 'is', null)

    if (priceError) {
      console.error('[analytics/collection] prices query failed:', priceError)
    } else {
      priceMap = new Map(
        ((priceRows ?? []) as PriceRow[]).map((p) => [p.item_id, p.price]),
      )
    }
  }

  // 4. Build aggregated analytics in a single pass over owned rows ──────────

  // card_id → { card, totalValueEur, quantity }  (merge duplicate card_ids across variants)
  const cardAgg = new Map<
    string,
    { card: OwnedCardRow['cards']; priceEur: number; quantity: number; totalValueEur: number }
  >()
  // rarity → { cardCount, totalValueEur }
  const rarityAgg = new Map<string, { cardCount: number; totalValueEur: number }>()
  // set_id → { setName, cardCount, totalValueEur }
  const setAgg = new Map<
    string,
    { setName: string; cardCount: number; totalValueEur: number }
  >()
  // card_id → tcggo_id string (for price-history lookup)
  const cardToTcggo = new Map<string, string>()

  for (const row of owned) {
    const card = row.cards
    if (!card) continue

    const tcggoKey = card.tcggo_id != null ? String(card.tcggo_id) : null
    const priceEur = tcggoKey ? (priceMap.get(tcggoKey) ?? 0) : 0
    const rowValue = priceEur * row.quantity
    const rarity = card.rarity ?? 'Unknown'
    const setName = card.sets?.name ?? 'Unknown Set'

    if (tcggoKey) cardToTcggo.set(row.card_id, tcggoKey)

    // Per-card aggregation (sum across variants for same card)
    const existing = cardAgg.get(row.card_id)
    if (existing) {
      existing.quantity += row.quantity
      existing.totalValueEur += rowValue
    } else {
      cardAgg.set(row.card_id, { card, priceEur, quantity: row.quantity, totalValueEur: rowValue })
    }

    // Rarity aggregation
    const rBucket = rarityAgg.get(rarity) ?? { cardCount: 0, totalValueEur: 0 }
    rarityAgg.set(rarity, {
      cardCount: rBucket.cardCount + 1,
      totalValueEur: rBucket.totalValueEur + rowValue,
    })

    // Set aggregation
    const sBucket = setAgg.get(card.set_id) ?? { setName, cardCount: 0, totalValueEur: 0 }
    setAgg.set(card.set_id, {
      setName,
      cardCount: sBucket.cardCount + 1,
      totalValueEur: sBucket.totalValueEur + rowValue,
    })
  }

  // 4a. Top 10 cards by totalValueEur
  const topCards: TopCard[] = [...cardAgg.entries()]
    .map(([cardId, agg]) => ({
      cardId,
      name: agg.card?.name ?? '',
      setName: agg.card?.sets?.name ?? 'Unknown Set',
      setId: agg.card?.set_id ?? '',
      rarity: agg.card?.rarity ?? null,
      imageUrl: agg.card?.image ?? null,
      priceEur: agg.priceEur,
      quantity: agg.quantity,
      totalValueEur: Math.round(agg.totalValueEur * 100) / 100,
    }))
    .sort((a, b) => b.totalValueEur - a.totalValueEur)
    .slice(0, 10)

  // 4b. Rarity breakdown sorted by totalValueEur desc
  const rarityBreakdown: RarityBucket[] = [...rarityAgg.entries()]
    .map(([rarity, bucket]) => ({
      rarity,
      cardCount: bucket.cardCount,
      totalValueEur: Math.round(bucket.totalValueEur * 100) / 100,
    }))
    .sort((a, b) => b.totalValueEur - a.totalValueEur)

  // 4c. Value by set sorted by totalValueEur desc
  const valueBySet: SetValueEntry[] = [...setAgg.entries()]
    .map(([setId, bucket]) => ({
      setId,
      setName: bucket.setName,
      cardCount: bucket.cardCount,
      totalValueEur: Math.round(bucket.totalValueEur * 100) / 100,
    }))
    .sort((a, b) => b.totalValueEur - a.totalValueEur)

  // 5. Best / worst performers ──────────────────────────────────────────────
  // Cards eligible for performer tracking: owned cards that have a current price
  const cardIdsWithPrice = [...cardAgg.entries()]
    .filter(([, agg]) => agg.priceEur > 0)
    .map(([cardId]) => cardId)

  let bestPerformers: PerformerCard[] = []
  let worstPerformers: PerformerCard[] = []

  if (cardIdsWithPrice.length > 0) {
    // Fetch the oldest price-history entry per card in the last 30 days.
    // card_price_history.price_usd is a legacy column name; for tcggo-synced rows
    // (which power this app's prices post-2025) the value is in EUR. We use it
    // only for percentage-change direction, not absolute display.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: historyRaw, error: historyError } = await supabaseAdmin
      .from('card_price_history')
      .select('card_id, price_usd, recorded_at')
      .in('card_id', cardIdsWithPrice)
      .eq('variant_key', 'normal')
      .eq('is_graded', false)
      .gte('recorded_at', thirtyDaysAgo)
      .order('recorded_at', { ascending: true })

    if (historyError) {
      console.error('[analytics/collection] price history query failed:', historyError)
    } else {
      const historyRows = (historyRaw ?? []) as HistoryRow[]

      // Build a map: card_id → oldest history row in the window (ascending order → first = oldest)
      const oldestPriceMap = new Map<string, number>()
      for (const row of historyRows) {
        if (!oldestPriceMap.has(row.card_id)) {
          oldestPriceMap.set(row.card_id, row.price_usd)
        }
      }

      // Compute performers for cards that have both a current price and a historical price
      const performers: PerformerCard[] = []
      for (const [cardId, agg] of cardAgg) {
        const historicalPrice = oldestPriceMap.get(cardId)
        if (!historicalPrice || historicalPrice <= 0 || agg.priceEur <= 0) continue

        const changePercent =
          Math.round(((agg.priceEur - historicalPrice) / historicalPrice) * 10000) / 100

        performers.push({
          cardId,
          name: agg.card?.name ?? '',
          setName: agg.card?.sets?.name ?? 'Unknown Set',
          setId: agg.card?.set_id ?? '',
          priceEur: agg.priceEur,
          priceEur30dAgo: historicalPrice,
          changePercent,
        })
      }

      // Sort ascending → bottom 5 are worst, sort descending → top 5 are best
      const sorted = performers.sort((a, b) => b.changePercent - a.changePercent)
      bestPerformers = sorted.slice(0, 5)
      worstPerformers = sorted.slice(-5).reverse()
    }
  }

  return NextResponse.json(
    {
      topCards,
      rarityBreakdown,
      valueBySet,
      bestPerformers,
      worstPerformers,
      currency: 'EUR' as const,
    },
    {
      headers: {
        // User-specific data — private cache only; 5 min prevents hammering DB on rapid re-nav
        'Cache-Control': 'private, max-age=300',
      },
    },
  )
}
