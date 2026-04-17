// ─────────────────────────────────────────────────────────────────────────────
// lib/price_service.ts  — SERVER-SIDE ONLY
//
// Fetches item prices from the TCGGO API and caches them in item_prices (24h TTL).
// Supports singles, graded cards, and sealed products.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ItemType,
  ItemPriceResult,
  ItemPriceRow,
  TcggoCardResponse,
  TcggoProductResponse,
  TcggoGradedPricesMap,
} from '../types/pricing'
import { supabaseAdmin as db } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const PRICE_TTL_MS   = 24 * 60 * 60 * 1000   // 24 hours
const TCGGO_BASE_URL = 'https://cardmarket-api-tcg.p.rapidapi.com'
const TCGGO_GAME     = 'pokemon'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Append Cardmarket variant query param when needed. */
export function buildCardmarketUrl(baseUrl: string, variant: string): string {
  return variant === 'reverse_holo' ? `${baseUrl}?isReverseHolo=Y` : baseUrl
}

/** Returns true when the cached row is younger than PRICE_TTL_MS. */
export function isFresh(updatedAt: string): boolean {
  return Date.now() - new Date(updatedAt).getTime() < PRICE_TTL_MS
}

/** Extract a graded price from the TCGGO graded price map by variant key. */
function extractGradedPrice(graded: TcggoGradedPricesMap, variant: string): number | null {
  switch (variant) {
    case 'psa10':        return graded.psa?.psa10        ?? null
    case 'psa9':         return graded.psa?.psa9         ?? null
    case 'psa8':         return graded.psa?.psa8         ?? null
    case 'bgs10pristine':return graded.bgs?.bgs10pristine?? null
    case 'bgs10':        return graded.bgs?.bgs10        ?? null
    case 'bgs9':         return graded.bgs?.bgs9         ?? null
    case 'bgs8':         return graded.bgs?.bgs8         ?? null
    case 'cgc10':        return graded.cgc?.cgc10        ?? null
    case 'cgc9':         return graded.cgc?.cgc9         ?? null
    case 'cgc8':         return graded.cgc?.cgc8         ?? null
    default:             return null
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns the cached or freshly-fetched price for a given item.
 *
 * @param itemId   TCGGO internal ID (stored as text)
 * @param itemType 'single' | 'graded' | 'product'
 * @param variant  'normal' | 'reverse_holo' | grade key (e.g. 'psa10')
 */
export async function getItemPrice(
  itemId: string,
  itemType: ItemType,
  variant = 'normal',
): Promise<ItemPriceResult> {
  // Step 1: validate inputs
  if (!['single', 'graded', 'product'].includes(itemType)) {
    throw new Error(`[price_service] Invalid itemType: "${itemType}"`)
  }
  if (typeof variant !== 'string' || !variant) variant = 'normal'

  // Step 2: check DB cache
  const { data: cached } = await db
    .from('item_prices')
    .select('*')
    .eq('item_id', itemId)
    .eq('item_type', itemType)
    .eq('variant', variant)
    .maybeSingle() as { data: ItemPriceRow | null }

  if (cached && isFresh(cached.updated_at)) {
    return { price: cached.price, currency: cached.currency, updated_at: cached.updated_at }
  }

  // Step 3: fetch from TCGGO
  let price: number | null = null
  let source: 'tcggo' | 'cardmarket' = 'tcggo'

  try {
    const endpoint =
      itemType === 'product'
        ? `${TCGGO_BASE_URL}/${TCGGO_GAME}/products?id=${itemId}`
        : `${TCGGO_BASE_URL}/${TCGGO_GAME}/cards/search?id=${itemId}`

    const res = await fetch(endpoint, {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY ?? '',
        'X-RapidAPI-Host': 'cardmarket-api-tcg.p.rapidapi.com',
      },
    })

    if (!res.ok) throw new Error(`TCGGO responded ${res.status} ${res.statusText}`)

    const data = await res.json() as (TcggoCardResponse | TcggoProductResponse)[]
    const item = data[0]
    if (!item) throw new Error('TCGGO returned an empty result array')

    // Step 4: extract price by item type
    if (itemType === 'single') {
      const card = item as TcggoCardResponse
      price  = card.prices.cardmarket?.lowest_near_mint ?? card.prices.tcg_player?.market_price ?? null
      source = 'tcggo'
    } else if (itemType === 'graded') {
      const card   = item as TcggoCardResponse
      const graded = card.prices.cardmarket?.graded
      if (!graded || Array.isArray(graded)) {
        price = null                                       // empty array or absent
      } else {
        price = extractGradedPrice(graded as TcggoGradedPricesMap, variant)
      }
      source = 'cardmarket'
    } else {
      const product = item as TcggoProductResponse
      price  = product.prices.cardmarket?.lowest ?? null
      source = 'tcggo'
    }

    // Step 5: Cardmarket fallback for singles with no price
    if (price === null && itemType === 'single') {
      const card  = item as TcggoCardResponse
      const cmUrl = card.links?.cardmarket
      if (cmUrl) {
        // Build the Cardmarket URL (reverse-holo aware) for future scraping.
        // TODO: Implement Cardmarket HTML scraping to retrieve a live fallback price.
        buildCardmarketUrl(cmUrl, variant)
      }
      source = 'cardmarket'
    }
  } catch (err) {
    console.error('[price_service] TCGGO fetch error:', err)
    // Return stale cache if available; otherwise a null result — never throw.
    if (cached) {
      return { price: cached.price, currency: cached.currency, updated_at: cached.updated_at }
    }
    return { price: null, currency: 'EUR', updated_at: new Date().toISOString() }
  }

  // Step 6: upsert into DB cache
  const now = new Date().toISOString()
  await db.from('item_prices').upsert(
    { item_id: itemId, item_type: itemType, variant, price, currency: 'EUR', source, updated_at: now },
    { onConflict: 'item_id,item_type,variant' },
  )

  // Step 7: return result
  return { price, currency: 'EUR', updated_at: now }
}
