import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const PRODUCTS_HOST = 'cardmarket-api-tcg.p.rapidapi.com'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductPricingOptions {
  episodeId: string | number
  setId: string
}

export interface ProductPricingResult {
  productCount: number
  errors: number
}

/**
 * Raw product shape as returned by the RapidAPI cardmarket endpoint.
 * Fields are optional because different episodes may omit some.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawProduct = Record<string, any>

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a numeric price from a nested field, returning null when absent/invalid. */
function safePrice(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

/** Normalise a raw product type string to one of the standard categories. */
function normaliseProductType(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.includes('booster box') || lower.includes('display box')) return 'Booster Box'
  if (lower.includes('booster pack') || lower === 'booster')          return 'Booster Pack'
  if (lower.includes('elite trainer') || lower.includes('etb'))       return 'ETB'
  if (lower.includes('tin'))                                           return 'Tin'
  if (lower.includes('collection') || lower.includes('box set'))      return 'Collection'
  return 'Other'
}

/**
 * Extract TCGPlayer price data from a raw product object.
 * Tries every field-name variant observed across tcggo.com API versions.
 */
function extractTcgpPrices(p: RawProduct): {
  market: number | null
  low:    number | null
  high:   number | null
  url:    string | null
} {
  // Nested tcgplayer / tcg object
  const tcgp = p.tcgplayer ?? p.tcg ?? p.tcgp ?? p.tcg_player ?? null

  const market = safePrice(
    tcgp?.market     ?? tcgp?.marketPrice  ?? tcgp?.market_price ??
    p.tcgp_market    ?? p.market_price     ?? p.marketPrice      ?? null,
  )
  const low = safePrice(
    tcgp?.low        ?? tcgp?.lowPrice     ?? tcgp?.low_price    ??
    p.tcgp_low       ?? p.low_price        ?? null,
  )
  const high = safePrice(
    tcgp?.high       ?? tcgp?.highPrice    ?? tcgp?.high_price   ??
    p.tcgp_high      ?? p.high_price       ?? null,
  )
  const url: string | null = tcgp?.url ?? tcgp?.link ?? p.tcgp_url ?? p.tcg_url ?? null

  return { market, low, high, url }
}

/**
 * Extract CardMarket price data from a raw product object.
 * Tries every field-name variant observed across tcggo.com API versions,
 * including a generic `prices` / `price` object that may contain CM data.
 */
function extractCmPrices(p: RawProduct): {
  avgSell: number | null
  trend:   number | null
  url:     string | null
} {
  // Nested cardmarket / cm object
  const cm     = p.cardmarket ?? p.cm ?? p.card_market ?? null
  // Generic prices object (tcggo.com sometimes wraps all prices here)
  const prices = p.prices ?? p.price ?? null

  const avgSell = safePrice(
    cm?.avg_sell         ?? cm?.averageSellPrice  ?? cm?.average_sell_price ?? cm?.avg     ??
    prices?.avg_sell     ?? prices?.averageSellPrice                                        ??
    prices?.trendPrice   ?? prices?.trend_price                                             ??
    p.cm_avg_sell        ?? p.avg_sell            ?? null,
  )
  const trend = safePrice(
    cm?.trend            ?? cm?.trendPrice        ?? cm?.trend_price        ??
    prices?.trend        ?? prices?.trendPrice    ?? prices?.trend_price    ??
    p.cm_trend           ?? p.trend               ?? null,
  )
  const url: string | null = cm?.url ?? cm?.link ?? p.cm_url ?? null

  return { avgSell, trend, url }
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Fetch sealed product pricing for a Pokémon TCG episode from the
 * cardmarket-api-tcg RapidAPI endpoint and upsert into `set_products`.
 *
 * Also persists the episodeId back to `sets.api_set_id` so the nightly
 * cron can automatically re-sync product prices without admin input.
 *
 * Uses the same RAPIDAPI_KEY env var as the discover endpoint.
 */
export async function importProductPricing(
  opts: ProductPricingOptions,
): Promise<ProductPricingResult> {
  const { episodeId, setId } = opts

  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    console.error('[ProductPricingService] RAPIDAPI_KEY is not set — skipping product import')
    return { productCount: 0, errors: 1 }
  }

  // ── 1. Fetch products from RapidAPI ────────────────────────────────────────
  const url = `https://${PRODUCTS_HOST}/pokemon/episodes/${encodeURIComponent(String(episodeId))}/products`

  let rawProducts: RawProduct[] = []

  try {
    console.log(`[ProductPricingService] Fetching products for episode ${episodeId} → ${url}`)

    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key':  apiKey,
        'x-rapidapi-host': PRODUCTS_HOST,
        'Content-Type':    'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(
        `[ProductPricingService] HTTP ${res.status} fetching products for episode ${episodeId}`,
      )
      return { productCount: 0, errors: 1 }
    }

    // The API may return { data: [...] }, { products: [...] }, or a bare array.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as Record<string, any>
    rawProducts = json.data ?? json.products ?? json.results ?? (Array.isArray(json) ? json : [])

    console.log(`[ProductPricingService] Episode ${episodeId}: received ${rawProducts.length} products`)

    // Log the first product's shape so field-name mismatches surface in logs
    if (rawProducts.length > 0) {
      const sample = rawProducts[0]
      console.log(
        `[ProductPricingService] Episode ${episodeId}: first product keys → ` +
        JSON.stringify(Object.keys(sample)),
      )
    }
  } catch (err) {
    console.error(`[ProductPricingService] Network error for episode ${episodeId}:`, err)
    return { productCount: 0, errors: 1 }
  }

  if (rawProducts.length === 0) {
    return { productCount: 0, errors: 0 }
  }

  // ── 2. Map to set_products rows ────────────────────────────────────────────
  const now = new Date().toISOString()
  let allNullPriceCount = 0

  const rows = rawProducts
    .filter((p): p is RawProduct => p != null && typeof p === 'object')
    .map((p) => {
      // API product id — prefer numeric id as a string for stable dedup
      const apiProductId = p.id != null ? String(p.id) : null

      // Name
      const name: string =
        String(p.name ?? p.title ?? p.description ?? 'Unknown product').trim()

      // Product type
      const productType = normaliseProductType(
        p.type ?? p.product_type ?? p.category ?? p.productType ?? null,
      )

      // Price extraction (expanded to cover more API field-name variants)
      const tcgp = extractTcgpPrices(p)
      const cm   = extractCmPrices(p)

      // Warn when a product has all-null prices — helps diagnose field-name drift
      if (
        tcgp.market === null && tcgp.low === null && tcgp.high === null &&
        cm.avgSell  === null && cm.trend  === null
      ) {
        allNullPriceCount++
      }

      return {
        set_id:         setId,
        api_product_id: apiProductId,
        name,
        product_type:   productType,
        tcgp_market:    tcgp.market,
        tcgp_low:       tcgp.low,
        tcgp_high:      tcgp.high,
        tcgp_url:       tcgp.url,
        cm_avg_sell:    cm.avgSell,
        cm_trend:       cm.trend,
        cm_url:         cm.url,
        fetched_at:     now,
      }
    })
    // Skip rows with no api_product_id — upsert conflict key would be null
    .filter((r) => r.api_product_id != null)

  if (allNullPriceCount > 0) {
    console.warn(
      `[ProductPricingService] Episode ${episodeId}: ${allNullPriceCount}/${rows.length} products ` +
      'have ALL price fields null — the API may be returning prices under unexpected field names. ' +
      'Use GET /api/prices/discover?probe=products&episodeId=' + String(episodeId) + ' to inspect.',
    )
  }

  if (rows.length === 0) {
    console.warn(
      `[ProductPricingService] Episode ${episodeId}: no products with valid IDs to upsert`,
    )
    return { productCount: 0, errors: 0 }
  }

  // ── 3. Upsert into set_products ────────────────────────────────────────────
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from('set_products')
    .upsert(rows, { onConflict: 'api_product_id' })

  if (error) {
    console.error(
      `[ProductPricingService] Upsert failed for episode ${episodeId}:`,
      error.message,
    )
    return { productCount: 0, errors: 1 }
  }

  console.log(
    `[ProductPricingService] Episode ${episodeId}: upserted ${rows.length} products for set "${setId}"`,
  )

  // ── 4. Persist the episodeId on the sets row so the cron can re-use it ─────
  // Use supabaseAdmin (service role) so RLS on the sets table doesn't block this write.
  const { error: setUpdateErr } = await supabaseAdmin
    .from('sets')
    .update({ api_set_id: String(episodeId) })
    .eq('set_id', setId)

  if (setUpdateErr) {
    // Non-fatal: log but don't fail the import
    console.warn(
      `[ProductPricingService] Could not persist api_set_id for set "${setId}":`,
      setUpdateErr.message,
    )
  } else {
    console.log(
      `[ProductPricingService] Persisted api_set_id=${episodeId} on sets row for "${setId}"`,
    )
  }

  return { productCount: rows.length, errors: 0 }
}
