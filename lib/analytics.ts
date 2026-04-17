// ─────────────────────────────────────────────────────────────────────────────
// lib/analytics.ts
//
// Shared server-only helpers for the Pro Analytics features:
//   - computeCollectionSnapshot: aggregates today's portfolio value and upserts
//     a row in collection_value_snapshots (used by portfolio-history + snapshot routes)
//
// All DB operations use supabaseAdmin (service-role) so that:
//   1. Reads are not restricted by user-scoped RLS policies.
//   2. Writes to collection_value_snapshots succeed (RLS blocks non-service-role writes).
//
// NOTE on card_price_history.price_usd naming:
//   The `price_usd` column in card_price_history is a legacy misnomer — newer rows
//   populated by the tcggo/cardmarket sync store EUR values in that column.
//   API consumers should treat it as a raw price figure for percentage-change
//   calculations only. Absolute EUR display values should come from item_prices.price.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase'

// ─── Exported Types ───────────────────────────────────────────────────────────

export interface CollectionSnapshot {
  totalValueEur: number
  cardCount: number
  setCount: number
}

export interface TopCard {
  cardId: string
  name: string
  setName: string
  setId: string
  rarity: string | null
  imageUrl: string | null
  priceEur: number
  quantity: number
  totalValueEur: number
}

export interface RarityBucket {
  rarity: string
  cardCount: number
  totalValueEur: number
}

export interface SetValueEntry {
  setId: string
  setName: string
  cardCount: number
  totalValueEur: number
}

export interface PerformerCard {
  cardId: string
  name: string
  setName: string
  setId: string
  /** Current EUR price from item_prices.price */
  priceEur: number
  /** Historical price from card_price_history — oldest entry in the last 30 days.
   *  NOTE: stored in the price_usd column (legacy naming) but is EUR for tcggo data. */
  priceEur30dAgo: number
  changePercent: number
}

export interface CollectionAnalytics {
  topCards: TopCard[]
  rarityBreakdown: RarityBucket[]
  valueBySet: SetValueEntry[]
  bestPerformers: PerformerCard[]
  worstPerformers: PerformerCard[]
  currency: 'EUR'
}

export interface PortfolioHistoryPoint {
  date: string         // ISO date string "YYYY-MM-DD"
  totalValueEur: number
  cardCount: number
  setCount: number
}

// ─── Internal row shapes (query return types) ────────────────────────────────

interface OwnedVariantRow {
  card_id: string
  quantity: number
  cards: {
    tcggo_id: number | null
    set_id: string
  } | null
}

// ─── Core helper ─────────────────────────────────────────────────────────────

/**
 * Computes the current collection value for the given user and upserts a row
 * in `collection_value_snapshots` for today's date (UTC).
 *
 * If a snapshot for today already exists it is overwritten with the freshest
 * value (ON CONFLICT DO UPDATE), so calling this multiple times per day is safe.
 *
 * @param userId  - The Supabase auth user UUID whose collection is being snapshotted.
 * @param _client - Optional Supabase client (accepted for API-layer symmetry but not
 *                  used internally — all operations go through supabaseAdmin so that
 *                  RLS does not interfere with multi-table aggregation or writes).
 *
 * @returns { totalValueEur, cardCount, setCount }
 */
export async function computeCollectionSnapshot(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _client?: unknown,
): Promise<CollectionSnapshot> {
  // ── 1. Fetch all owned card variants with quantity > 0 ────────────────────
  const { data: variantRows, error: variantsError } = await supabaseAdmin
    .from('user_card_variants')
    .select('card_id, quantity, cards(tcggo_id, set_id)')
    .eq('user_id', userId)
    .gt('quantity', 0)

  if (variantsError) {
    throw new Error(
      `[analytics] computeCollectionSnapshot — variants query failed: ${variantsError.message}`,
    )
  }

  const rows = (variantRows ?? []) as unknown as OwnedVariantRow[]

  // ── 2. Batch-fetch current EUR prices from item_prices ────────────────────
  // item_prices.item_id is the tcggo_id cast to text.
  // We filter to item_type='single', variant='normal' to get the canonical card price.
  const tcggoIds = [
    ...new Set(
      rows
        .map((v) => v.cards?.tcggo_id)
        .filter((id): id is number => id != null)
        .map(String),
    ),
  ]

  let priceMap = new Map<string, number>()

  if (tcggoIds.length > 0) {
    const { data: priceRows, error: pricesError } = await supabaseAdmin
      .from('item_prices')
      .select('item_id, price')
      .in('item_id', tcggoIds)
      .eq('item_type', 'single')
      .eq('variant', 'normal')
      .not('price', 'is', null)

    if (pricesError) {
      // Non-fatal — log and continue; snapshot will show €0 for unpriced cards
      console.error('[analytics] computeCollectionSnapshot — prices query failed:', pricesError)
    } else {
      priceMap = new Map(
        (priceRows ?? []).map((p) => [p.item_id as string, p.price as number]),
      )
    }
  }

  // ── 3. Aggregate totals ───────────────────────────────────────────────────
  let totalValueEur = 0
  const uniqueCards = new Set<string>()
  const uniqueSets = new Set<string>()

  for (const v of rows) {
    uniqueCards.add(v.card_id)
    if (v.cards?.set_id) uniqueSets.add(v.cards.set_id)

    const tcggoId = v.cards?.tcggo_id != null ? String(v.cards.tcggo_id) : null
    if (tcggoId && priceMap.has(tcggoId)) {
      totalValueEur += priceMap.get(tcggoId)! * v.quantity
    }
  }

  const snapshot: CollectionSnapshot = {
    totalValueEur: Math.round(totalValueEur * 100) / 100,
    cardCount: uniqueCards.size,
    setCount: uniqueSets.size,
  }

  // ── 4. Upsert today's snapshot (service-role write — bypasses RLS) ────────
  const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"

  const { error: upsertError } = await supabaseAdmin
    .from('collection_value_snapshots')
    .upsert(
      {
        user_id: userId,
        snapshot_date: today,
        total_value_eur: snapshot.totalValueEur,
        card_count: snapshot.cardCount,
        set_count: snapshot.setCount,
      },
      { onConflict: 'user_id,snapshot_date' },
    )

  if (upsertError) {
    // Non-fatal: the caller still gets the freshly computed values even if the
    // upsert fails (e.g. transient DB error). Log so it shows up in server logs.
    console.error('[analytics] computeCollectionSnapshot — upsert failed:', upsertError)
  }

  return snapshot
}
