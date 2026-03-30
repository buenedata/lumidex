/**
 * lib/pricing.ts
 *
 * Real-price lookup from the card_prices / set_products Supabase tables.
 * Replaces lib/mockPricing.ts as the primary pricing consumer.
 *
 * lib/mockPricing.ts is kept intact and used as a graceful fallback
 * when no DB price row exists for a card.
 */

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
  card_id:          string
  tcgp_normal:      number | null
  tcgp_reverse_holo:number | null
  tcgp_holo:        number | null
  tcgp_1st_edition: number | null
  tcgp_market:      number | null
  tcgp_psa10:       number | null
  tcgp_psa9:        number | null
  tcgp_bgs95:       number | null
  tcgp_bgs9:        number | null
  tcgp_cgc10:       number | null
  cm_avg_sell:      number | null
  cm_low:           number | null
  cm_trend:         number | null
  cm_avg_30d:       number | null
  api_card_id:      string | null
  fetched_at:       string
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
  tcgp_market:  number | null
  tcgp_low:     number | null
  tcgp_high:    number | null
  tcgp_url:     string | null
  cm_avg_sell:  number | null
  cm_trend:     number | null
  cm_url:       string | null
  fetched_at:   string
}

// ── Main query ────────────────────────────────────────────────────────────────

/**
 * Fetches all card prices for a set from the `card_prices` table.
 *
 * Returns a Record<cardId, CardPriceData> keyed by the internal UUID.
 * Cards with no price row are omitted — caller should fall back to
 * getMockPriceUSD() from lib/mockPricing.ts.
 *
 * @param setId       The set's text ID (e.g. "sv1")
 * @param priceSource User preference: 'tcgplayer' | 'cardmarket'
 */
export async function getCardPricesForSet(
  setId: string,
  priceSource: PriceSource = 'tcgplayer',
): Promise<Record<string, CardPriceData>> {
  // Step 1: resolve card UUIDs for this set
  const { data: cardRows, error: cardErr } = await supabaseAdmin
    .from('cards')
    .select('id')
    .eq('set_id', setId)

  if (cardErr) {
    console.error('[pricing] getCardPricesForSet card lookup error:', cardErr)
    return {}
  }

  const cardIds = (cardRows ?? []).map(c => c.id as string)
  if (cardIds.length === 0) return {}

  // Step 2: fetch price rows for those card UUIDs
  const { data, error } = await supabaseAdmin
    .from('card_prices')
    .select('card_id, tcgp_normal, tcgp_reverse_holo, tcgp_holo, tcgp_1st_edition, tcgp_market, tcgp_psa10, tcgp_psa9, tcgp_bgs95, tcgp_bgs9, tcgp_cgc10, cm_avg_sell, cm_low, cm_trend, cm_avg_30d, api_card_id, fetched_at')
    .in('card_id', cardIds)

  if (error) {
    console.error('[pricing] getCardPricesForSet price lookup error:', error)
    return {}
  }

  const result: Record<string, CardPriceData> = {}

  for (const row of (data ?? [])) {
    const r = row as unknown as CardPriceRow

    // Determine the best market price in USD based on user's price source
    let marketUSD: number | null = null

    if (priceSource === 'tcgplayer') {
      marketUSD = r.tcgp_market ?? null
    } else {
      // CardMarket prices are in EUR — convert to USD for uniform math
      const eurPrice = r.cm_avg_sell ?? r.cm_trend ?? null
      marketUSD = eurPrice !== null ? Math.round(eurPrice * EUR_TO_USD * 100) / 100 : null
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
 * Fetches sealed product prices for a set from `set_products`.
 * Returns an empty array if no products are synced for this set.
 */
export async function getSealedProductsForSet(
  setId: string,
): Promise<SetProductPrice[]> {
  const { data, error } = await supabaseAdmin
    .from('set_products')
    .select('id, set_id, name, product_type, tcgp_market, tcgp_low, tcgp_high, tcgp_url, cm_avg_sell, cm_trend, cm_url, fetched_at')
    .eq('set_id', setId)
    .order('product_type')

  if (error) {
    console.error('[pricing] getSealedProductsForSet error:', error)
    return []
  }

  return (data ?? []) as SetProductPrice[]
}

/**
 * Given a CardPriceData (or null) and a fallback mock price, returns the
 * best market price in USD. Prefers real data; falls back to the mock value.
 */
export function resolveCardPriceUSD(
  real: CardPriceData | null | undefined,
  mockUSD: number,
): number {
  return real?.marketUSD ?? mockUSD
}

/**
 * Builds the cardPricesUSD map (card UUID → USD price) for a whole set,
 * merging real prices with mock fallbacks.
 *
 * @param cards         Array of PokemonCard (must have .id; rarity used by mock fallback)
 * @param realPrices    Result of getCardPricesForSet()
 * @param getMockPrice  Reference to getMockPriceUSD from lib/mockPricing
 */
export function buildCardPriceMap(
  cards: PokemonCard[],
  realPrices: Record<string, CardPriceData>,
  getMockPrice: (card: PokemonCard) => number,
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const card of cards) {
    const real = realPrices[card.id]
    map[card.id] = real?.marketUSD ?? getMockPrice(card)
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
