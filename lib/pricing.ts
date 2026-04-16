/**
 * lib/pricing.ts
 *
 * Real-price lookup from the card_prices / set_products Supabase tables.
 * Cards without a price row are omitted — the UI shows a dash for unpriced cards.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import type { PriceSource, PokemonCard } from '@/types'

// ── Exchange rates (USD = 1.0 base) ───────────────────────────────────────────
// CardMarket prices are EUR — convert via EUR_TO_USD before applying these rates.
// Update these periodically; fine-grained accuracy is not critical for display.
export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1.00,
  EUR: 0.92,
  GBP: 0.79,
  NOK: 10.55,
  SEK: 10.35,
  DKK: 6.88,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 149.00,
  CHF: 0.90,
}

/** EUR → USD conversion factor. CardMarket prices are EUR-denominated. */
export const EUR_TO_USD = 1.09

// Intl locale for each supported currency
const CURRENCY_LOCALES: Record<string, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  NOK: 'nb-NO',
  SEK: 'sv-SE',
  DKK: 'da-DK',
  CAD: 'en-CA',
  AUD: 'en-AU',
  JPY: 'ja-JP',
  CHF: 'de-CH',
}

/**
 * Formats a USD amount into the target currency string.
 *
 * @param usdAmount   Amount in US dollars (source currency for all stored prices)
 * @param toCurrency  ISO 4217 currency code (e.g. 'NOK', 'EUR', 'USD')
 */
export function formatPrice(usdAmount: number, toCurrency: string): string {
  const rate      = EXCHANGE_RATES[toCurrency] ?? 1
  const converted = usdAmount * rate
  const locale    = CURRENCY_LOCALES[toCurrency] ?? 'en-US'
  const currency  = toCurrency in EXCHANGE_RATES ? toCurrency : 'USD'

  return new Intl.NumberFormat(locale, {
    style:                 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(converted)
}

// ── DB row shape ──────────────────────────────────────────────────────────────

interface CardPriceRow {
  card_id:           string
  tcgp_normal:       number | null
  tcgp_reverse_holo: number | null
  tcgp_holo:         number | null
  tcgp_1st_edition:  number | null
  tcgp_market:       number | null
  tcgp_psa10:        number | null
  tcgp_psa9:         number | null
  tcgp_bgs95:        number | null
  tcgp_bgs9:         number | null
  tcgp_cgc10:        number | null
  cm_avg_sell:       number | null
  cm_low:            number | null
  cm_trend:          number | null
  cm_avg_30d:        number | null
  /** CardMarket avg sell price for the reverse holo variant (EUR) */
  cm_reverse_holo:   number | null
  /** CardMarket avg sell price for the Cosmos Holo variant (EUR) — manually set */
  cm_cosmos_holo:    number | null
  /** Direct URL to this card on CardMarket */
  cm_url:            string | null
  fetched_at:        string
}

export interface CardGradedPrices {
  psa10: number | null
  psa9:  number | null
  bgs95: number | null
  bgs9:  number | null
  cgc10: number | null
}

export interface CardPriceData {
  /** Best market price in USD (tcgp_market or cm equivalent converted to USD) */
  marketUSD:   number | null
  /** Graded prices — all in USD */
  graded:      CardGradedPrices
  /** Raw row for consumers that need specific variant prices */
  raw:         CardPriceRow
}

export interface SetProductPrice {
  id:           string
  set_id:       string
  name:         string
  product_type: string | null
  image_url:    string | null
  tcgp_market:  number | null
  tcgp_low:     number | null
  tcgp_high:    number | null
  tcgp_url:     string | null
  cm_avg_sell:  number | null
  cm_trend:     number | null
  cm_url:       string | null
  fetched_at:   string
}

export interface SeriesProductGroup {
  /** Series name, e.g. "Scarlet & Violet" */
  series:  string
  sets: Array<{
    setId:    string
    setName:  string
    logoUrl:  string | null
    products: SetProductPrice[]
  }>
}

// ── Main query ────────────────────────────────────────────────────────────────

/**
 * Fetches all card prices for a set from the `card_prices` table.
 *
 * Returns a Record<cardId, CardPriceData> keyed by the internal UUID.
 * Cards with no price row are omitted — those cards should show no price.
 *
 * @param setId              The set's text ID (e.g. "sv1")
 * @param priceSource        User preference: 'tcgplayer' | 'cardmarket'
 * @param preloadedCardIds   Optional card UUIDs already fetched by the caller
 *                           (e.g. from getCardsBySet). When provided the initial
 *                           SELECT id FROM cards query is skipped entirely,
 *                           saving one DB round-trip (~100–200 ms).
 */
// ── Private inner — the actual DB logic ──────────────────────────────────────
async function _fetchCardPricesForSet(
  setId: string,
  priceSource: PriceSource,
  preloadedCardIds?: string[],
): Promise<Record<string, CardPriceData>> {
  let cardIds: string[]

  if (preloadedCardIds && preloadedCardIds.length > 0) {
    // Caller already has the card UUIDs — skip the extra DB round-trip.
    cardIds = preloadedCardIds
  } else {
    // Step 1: resolve card UUIDs for this set (fallback when not pre-loaded)
    const { data: cardRows, error: cardErr } = await supabaseAdmin
      .from('cards')
      .select('id')
      .eq('set_id', setId)

    if (cardErr) {
      console.error('[pricing] getCardPricesForSet card lookup error:', cardErr)
      return {}
    }

    cardIds = (cardRows ?? []).map(c => c.id as string)
    if (cardIds.length === 0) return {}
  }

  if (cardIds.length === 0) return {}

  // Fetch price rows for those card UUIDs
  const { data, error } = await supabaseAdmin
    .from('card_prices')
    .select('card_id, tcgp_normal, tcgp_reverse_holo, tcgp_holo, tcgp_1st_edition, tcgp_market, tcgp_psa10, tcgp_psa9, tcgp_bgs95, tcgp_bgs9, tcgp_cgc10, cm_avg_sell, cm_low, cm_trend, cm_avg_30d, fetched_at')
    .in('card_id', cardIds)

  if (error) {
    console.error('[pricing] getCardPricesForSet price lookup error:', error)
    return {}
  }

  const result: Record<string, CardPriceData> = {}

  for (const row of (data ?? [])) {
    const r = row as unknown as CardPriceRow

    // Determine the best market price in USD based on user's price source.
    // When the preferred source has no data (e.g. TCGPlayer hasn't indexed a
    // newly released set yet), fall back to the other source so prices still
    // appear instead of showing a dash for every card.
    let marketUSD: number | null = null

    if (priceSource === 'tcgplayer') {
      if (r.tcgp_market != null) {
        marketUSD = r.tcgp_market
      } else {
        // TCGPlayer has no market price yet — fall back to CardMarket (EUR → USD)
        const eurPrice = r.cm_avg_sell ?? r.cm_trend ?? null
        marketUSD = eurPrice !== null ? Math.round(eurPrice * EUR_TO_USD * 100) / 100 : null
      }
    } else {
      // CardMarket prices are in EUR — convert to USD for uniform math
      const eurPrice = r.cm_avg_sell ?? r.cm_trend ?? null
      if (eurPrice != null) {
        marketUSD = Math.round(eurPrice * EUR_TO_USD * 100) / 100
      } else {
        // CardMarket has no price yet — fall back to TCGPlayer
        marketUSD = r.tcgp_market ?? null
      }
    }

    result[r.card_id] = {
      marketUSD,
      graded: {
        psa10: r.tcgp_psa10,
        psa9:  r.tcgp_psa9,
        bgs95: r.tcgp_bgs95,
        bgs9:  r.tcgp_bgs9,
        cgc10: r.tcgp_cgc10,
      },
      raw: r,
    }
  }

  return result
}

/**
 * Fetches all card prices for a set from the `card_prices` table — unstable_cache-wrapped.
 *
 * Returns a Record<cardId, CardPriceData> keyed by the internal UUID.
 * Cards with no price row are omitted — those cards should show no price.
 *
 * Prices are written by a background cron job, not by user actions, so a
 * 5-minute stale window is safe and dramatically reduces cold-start latency.
 * Cache key is setId + priceSource; preloadedCardIds is an optimisation hint
 * passed through on cache-miss to skip the redundant cards lookup.
 *
 * @param setId              The set's text ID (e.g. "sv1")
 * @param priceSource        User preference: 'tcgplayer' | 'cardmarket'
 * @param preloadedCardIds   Optional card UUIDs already fetched by the caller
 *                           (e.g. from getCardsBySet). Skips one DB round-trip
 *                           on cache miss; ignored on cache hit.
 */
export function getCardPricesForSet(
  setId: string,
  priceSource: PriceSource = 'tcgplayer',
  preloadedCardIds?: string[],
): Promise<Record<string, CardPriceData>> {
  return unstable_cache(
    () => _fetchCardPricesForSet(setId, priceSource, preloadedCardIds),
    [`pricing:cardPrices:${setId}:${priceSource}`],
    { revalidate: 300, tags: ['prices', `set-prices:${setId}`] },
  )()
}

/**
 * Fetches sealed product prices for a set from `set_products`.
 * Returns an empty array if no products are synced for this set.
 */
export async function getSealedProductsForSet(
  setId: string,
): Promise<SetProductPrice[]> {
  const { data, error } = await supabaseAdmin
    .from('set_products')
    .select('id, set_id, name, product_type, image_url, tcgp_market, tcgp_low, tcgp_high, tcgp_url, cm_avg_sell, cm_trend, cm_url, fetched_at')
    .eq('set_id', setId)
    .order('product_type')

  if (error) {
    console.error('[pricing] getSealedProductsForSet error:', error)
    return []
  }

  return (data ?? []) as SetProductPrice[]
}

// ── Private cached inner — returns string[] because Set is not JSON-serialisable
// and unstable_cache serialises return values via JSON.
const _getSeriesWithProductsCached = unstable_cache(
  async (): Promise<string[]> => {
    // Single JOIN query — collapses the former 2-step sequential round-trip
    // (fetch set_ids THEN fetch series) into one Supabase call.
    const { data, error } = await supabaseAdmin
      .from('set_products')
      .select('sets!inner(series)')

    if (error) {
      console.error('[pricing] getSeriesWithProducts error:', error)
      return []
    }

    const seriesSet = new Set<string>()
    for (const row of (data ?? []) as any[]) {
      const series = (row as any).sets?.series
      if (series) seriesSet.add(series as string)
    }
    return [...seriesSet]
  },
  ['pricing:getSeriesWithProducts'],
  { revalidate: 600, tags: ['sets', 'products'] },
)

/**
 * Returns the set of series names that have at least one sealed product
 * in `set_products`. Used by the Sets page to conditionally show the
 * "Products" entry card per series.
 *
 * Cached for 10 minutes — invariant to user actions, only changes when an
 * admin adds/removes products. Previously made 2 sequential DB round-trips;
 * now uses a single JOIN query and Vercel Data Cache.
 */
export async function getSeriesWithProducts(): Promise<Set<string>> {
  const series = await _getSeriesWithProductsCached()
  return new Set(series)
}

/**
 * Fetches ALL sealed products across ALL series and groups them by series
 * then by set. Used by the /products page.
 *
 * Returns SeriesProductGroup[] sorted the same way as the Sets page
 * (newest series first by latest release date within the series).
 */
export async function getSealedProductsForAllSeries(): Promise<SeriesProductGroup[]> {
  // Step 1: fetch all products
  const { data: products, error: prodErr } = await supabaseAdmin
    .from('set_products')
    .select('id, set_id, name, product_type, image_url, tcgp_market, tcgp_low, tcgp_high, tcgp_url, cm_avg_sell, cm_trend, cm_url, fetched_at')
    .order('product_type')

  if (prodErr) {
    console.error('[pricing] getSealedProductsForAllSeries product error:', prodErr)
    return []
  }

  const allProducts = (products ?? []) as SetProductPrice[]
  if (allProducts.length === 0) return []

  // Step 2: fetch the sets that have products
  const setIds = [...new Set(allProducts.map(p => p.set_id))]
  const { data: setRows, error: setErr } = await supabaseAdmin
    .from('sets')
    .select('set_id, name, series, logo_url, release_date')
    .in('set_id', setIds)

  if (setErr) {
    console.error('[pricing] getSealedProductsForAllSeries set error:', setErr)
    return []
  }

  // Build a map of setId → set metadata
  type SetMeta = { setId: string; setName: string; logoUrl: string | null; series: string; releaseDate: string | null }
  const setMap = new Map<string, SetMeta>()
  for (const row of (setRows ?? [])) {
    setMap.set(row.set_id as string, {
      setId:        row.set_id as string,
      setName:      row.name as string,
      logoUrl:      (row.logo_url as string | null) ?? null,
      series:       (row.series as string) ?? 'Other',
      releaseDate:  (row.release_date as string | null) ?? null,
    })
  }

  // Step 3: group products by series → set
  // series → setId → products
  const groupMap = new Map<string, Map<string, SetProductPrice[]>>()
  for (const product of allProducts) {
    const meta = setMap.get(product.set_id)
    if (!meta) continue
    const series = meta.series
    if (!groupMap.has(series)) groupMap.set(series, new Map())
    const setGroup = groupMap.get(series)!
    if (!setGroup.has(product.set_id)) setGroup.set(product.set_id, [])
    setGroup.get(product.set_id)!.push(product)
  }

  // Step 4: compute latest release date per series for sorting (newest first)
  const seriesLatestDate = new Map<string, string>()
  for (const [series, setGroup] of groupMap) {
    for (const setId of setGroup.keys()) {
      const meta = setMap.get(setId)
      if (meta?.releaseDate && (meta.releaseDate > (seriesLatestDate.get(series) ?? ''))) {
        seriesLatestDate.set(series, meta.releaseDate)
      }
    }
  }

  // Step 5: build output sorted newest series first, "Other" last
  const sortedSeries = [...groupMap.keys()].sort((a, b) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return (seriesLatestDate.get(b) ?? '').localeCompare(seriesLatestDate.get(a) ?? '')
  })

  return sortedSeries.map(series => {
    const setGroup = groupMap.get(series)!
    // Sort sets within a series by release date (newest first)
    const sortedSets = [...setGroup.entries()]
      .map(([setId, prods]) => ({ setId, meta: setMap.get(setId)! , products: prods }))
      .sort((a, b) => (b.meta.releaseDate ?? '').localeCompare(a.meta.releaseDate ?? ''))

    return {
      series,
      sets: sortedSets.map(entry => ({
        setId:    entry.setId,
        setName:  entry.meta.setName,
        logoUrl:  entry.meta.logoUrl,
        products: entry.products,
      })),
    }
  })
}

/**
 * Builds the cardPricesUSD map (card UUID → USD price) for a whole set.
 * Only cards with a real price row are included — cards without data are
 * omitted so the UI can show a dash instead of a fake price.
 *
 * @param cards       Array of PokemonCard (must have .id)
 * @param realPrices  Result of getCardPricesForSet()
 */
export function buildCardPriceMap(
  cards: PokemonCard[],
  realPrices: Record<string, CardPriceData>,
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const card of cards) {
    const price = realPrices[card.id]?.marketUSD
    if (price != null) {
      map[card.id] = price
    }
  }
  return map
}

/**
 * Returns the fraction of cards in realPrices that have a non-null market price.
 * Used for the "prices are live" indicator on the set page.
 */
export function getPriceCoverage(
  cards: Array<{ id: string }>,
  realPrices: Record<string, CardPriceData>,
): number {
  if (cards.length === 0) return 0
  const covered = cards.filter(c => realPrices[c.id]?.marketUSD != null).length
  return Math.round((covered / cards.length) * 100)
}
