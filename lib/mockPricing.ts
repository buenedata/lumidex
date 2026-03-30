/**
 * Mock pricing utilities — used until real pricing data is integrated.
 *
 * Prices are deterministic (same card always gets the same price) using a
 * simple hash of the card ID scaled into a rarity-based USD range.
 *
 * DO NOT use these values for any real financial calculations.
 */

import { PokemonCard } from '@/types'

// ── Deterministic hash: card.id → 0..1 ───────────────────────────────────────
function cardHash(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }
  return h / 0xffffffff
}

// ── Rarity tiers with [min, max] USD ranges (checked top-to-bottom) ──────────
const RARITY_RANGES: { pattern: string; range: [number, number] }[] = [
  { pattern: 'special illustration rare', range: [80,  400] },
  { pattern: 'hyper rare',                range: [80,  350] },
  { pattern: 'rare secret',               range: [60,  300] },
  { pattern: 'rainbow rare',              range: [50,  250] },
  { pattern: 'ultra rare',                range: [30,  150] },
  { pattern: 'illustration rare',         range: [25,  120] },
  { pattern: 'full art',                  range: [20,  100] },
  { pattern: 'rare holo vmax',            range: [10,   60] },
  { pattern: 'rare holo vstar',           range: [8,    50] },
  { pattern: 'rare holo v',               range: [5,    40] },
  { pattern: 'amazing rare',              range: [5,    30] },
  { pattern: 'rare holo',                 range: [2,    20] },
  { pattern: 'rare',                      range: [1,     8] },
  { pattern: 'promo',                     range: [1,    30] },
  { pattern: 'uncommon',                  range: [0.25,  2] },
]

/** Returns a deterministic mock USD price for a card based on rarity + id hash. */
export function getMockPriceUSD(card: PokemonCard): number {
  const noise  = cardHash(card.id)
  const rarity = (card.rarity ?? '').toLowerCase()

  let [min, max] = [0.05, 0.50] as [number, number] // common default
  for (const { pattern, range } of RARITY_RANGES) {
    if (rarity.includes(pattern)) {
      ;[min, max] = range
      break
    }
  }

  const raw = min + noise * (max - min)
  return Math.round(raw * 100) / 100
}

// ── Exchange rates (USD = 1.0) ────────────────────────────────────────────────
export const MOCK_EXCHANGE_RATES: Record<string, number> = {
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
 * Converts a USD amount to the target currency and formats it using Intl.NumberFormat.
 * Falls back to USD formatting if the currency code is unknown.
 */
export function formatPrice(usdAmount: number, currency: string): string {
  const rate      = MOCK_EXCHANGE_RATES[currency] ?? 1
  const converted = usdAmount * rate
  const locale    = CURRENCY_LOCALES[currency] ?? 'en-US'

  return new Intl.NumberFormat(locale, {
    style:                 'currency',
    currency:              currency in MOCK_EXCHANGE_RATES ? currency : 'USD',
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(converted)
}
