/**
 * lib/currency.ts
 *
 * Client-safe currency utilities — no server-only imports.
 * The conversion constants mirror those in lib/pricing.ts so both the
 * server-side aggregation layer and client components use the same rates.
 */

// ── Exchange rates (USD = 1.0 base) ───────────────────────────────────────────
// All stored CardMarket prices are EUR-denominated.
// Convert EUR → USD first (via EUR_TO_USD), then USD → target via these rates.
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

/** CardMarket prices are EUR — multiply by this to get USD equivalent. */
export const EUR_TO_USD = 1.09

/** Intl locale string for each supported currency code. */
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
 * Format a USD amount into the target currency string.
 *
 * @param usdAmount  Amount in US dollars (base for all stored TCGPlayer prices)
 * @param toCurrency ISO 4217 code (e.g. 'NOK', 'EUR', 'USD')
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

/**
 * Format a raw price object `{ eur, usd }` — as returned by /api/cards/prices —
 * into the user's preferred currency string. EUR prices are converted via
 * EUR_TO_USD before applying the target exchange rate.
 *
 * Returns null when both eur and usd are null.
 */
export function fmtCardPrice(
  price: { eur: number | null; usd: number | null } | undefined,
  currency: string,
): string | null {
  if (!price) return null

  if (price.eur != null) {
    // CardMarket price is EUR → convert to USD first, then to the target
    return formatPrice(price.eur * EUR_TO_USD, currency)
  }
  if (price.usd != null) {
    return formatPrice(price.usd, currency)
  }
  return null
}

/**
 * Sum the card-price totals for a list of items and return a formatted string.
 * EUR prices are converted → USD → target currency.
 * Returns null if no priced cards exist.
 */
export function sumAndFormatPrices(
  cardIds: string[],
  prices: Record<string, { eur: number | null; usd: number | null }>,
  currency: string,
): string | null {
  let totalUsd = 0
  let hasPrice = false

  for (const id of cardIds) {
    const p = prices[id]
    if (!p) continue
    if (p.eur != null) {
      totalUsd += p.eur * EUR_TO_USD
      hasPrice = true
    } else if (p.usd != null) {
      totalUsd += p.usd
      hasPrice = true
    }
  }

  return hasPrice ? formatPrice(totalUsd, currency) : null
}
