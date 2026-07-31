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

interface GradedCardRow {
  card_id: string
  grading_company: string
  grade: string
  quantity: number
  cards: {
    tcggo_id: number | null
    set_id: string
  } | null
}

/**
 * Maps (grading company, grade label text) → item_prices.variant key for
 * `item_type = 'graded'` rows in the item_prices table.
 *
 * Only the grade labels that have a corresponding TCGGO market price entry are
 * included. Grades not listed here (e.g. PSA 7, ACE, TAG) contribute €0 to
 * collection value because no matching price row exists.
 *
 * Exported so the analytics/collection route can reuse the same mapping.
 */
export const GRADED_VARIANT_KEY: Record<string, Record<string, string>> = {
  PSA: {
    'GEM-MT 10':  'psa10',
    'MINT 9':     'psa9',
    'NM-MT 8':    'psa8',
    'NM-MT+ 8.5': 'psa8',
  },
  BECKETT: {
    'Black Label 10': 'bgs10pristine',
    'Pristine 10':    'bgs10',
    'Gem Mint 9.5':   'bgs9',
    'NM-MT 8':        'bgs8',
    'NM-MT+ 8.5':     'bgs8',
  },
  CGC: {
    'Pristine 10':   'cgc10',
    'Gem Mint 10':   'cgc10',
    'Mint+ 9.5':     'cgc9',
    'Mint 9':        'cgc9',
    'NM/Mint 8':     'cgc8',
    'NM/Mint+ 8.5':  'cgc8',
  },
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

  // ── 2b. Fetch user's graded copies and their EUR market prices ─────────────
  const { data: gradedVariantRows } = await supabaseAdmin
    .from('user_graded_cards')
    .select('card_id, grading_company, grade, quantity, cards(tcggo_id, set_id)')
    .eq('user_id', userId)
    .gt('quantity', 0)

  const gradedRows = (gradedVariantRows ?? []) as unknown as GradedCardRow[]

  // Build a price map for graded items: key = `${tcggo_id}:${variant_key}`
  let gradedPriceMap = new Map<string, number>()

  if (gradedRows.length > 0) {
    const gradedTcggoIds = [
      ...new Set(
        gradedRows
          .map((g) => g.cards?.tcggo_id)
          .filter((id): id is number => id != null)
          .map(String),
      ),
    ]

    if (gradedTcggoIds.length > 0) {
      const { data: gradedPriceRows, error: gradedPriceError } = await supabaseAdmin
        .from('item_prices')
        .select('item_id, variant, price')
        .in('item_id', gradedTcggoIds)
        .eq('item_type', 'graded')
        .not('price', 'is', null)

      if (gradedPriceError) {
        console.error(
          '[analytics] computeCollectionSnapshot — graded prices query failed:',
          gradedPriceError,
        )
      } else {
        for (const row of gradedPriceRows ?? []) {
          gradedPriceMap.set(
            `${row.item_id as string}:${row.variant as string}`,
            row.price as number,
          )
        }
      }
    }
  }

  // ── 3. Aggregate totals: regular variants ────────────────────────────────
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

  // 3b. Aggregate graded card value using their graded market price (EUR).
  //     A card in both user_card_variants AND user_graded_cards is counted
  //     twice (once at regular price, once at graded price) which is correct:
  //     the user owns distinct physical copies of different types.
  for (const g of gradedRows) {
    uniqueCards.add(g.card_id)
    if (g.cards?.set_id) uniqueSets.add(g.cards.set_id)

    const tcggoId = g.cards?.tcggo_id != null ? String(g.cards.tcggo_id) : null
    const variantKey = GRADED_VARIANT_KEY[g.grading_company]?.[g.grade] ?? null
    if (tcggoId && variantKey) {
      const price = gradedPriceMap.get(`${tcggoId}:${variantKey}`) ?? 0
      totalValueEur += price * g.quantity
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
