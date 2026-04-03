import { createSupabaseServerClient } from '@/lib/supabaseServer'

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

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Fetch sealed product pricing for a Pokémon TCG episode from the
 * cardmarket-api-tcg RapidAPI endpoint and upsert into `set_products`.
 *
 * Uses the same RAPIDAPI_KEY env var as the discover endpoint.
 * Uses the same createSupabaseServerClient pattern as the rest of the pipeline.
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
  } catch (err) {
    console.error(`[ProductPricingService] Network error for episode ${episodeId}:`, err)
    return { productCount: 0, errors: 1 }
  }

  if (rawProducts.length === 0) {
    return { productCount: 0, errors: 0 }
  }

  // ── 2. Map to set_products rows ────────────────────────────────────────────
  const now = new Date().toISOString()

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

      // TCGPlayer prices — look for nested objects or flat fields
      const tcgp  = p.tcgplayer ?? p.tcg ?? null
      const tcgpMarket = safePrice(tcgp?.market  ?? p.tcgp_market  ?? null)
      const tcgpLow    = safePrice(tcgp?.low     ?? p.tcgp_low     ?? null)
      const tcgpHigh   = safePrice(tcgp?.high    ?? p.tcgp_high    ?? null)
      const tcgpUrl: string | null = tcgp?.url ?? p.tcgp_url ?? null

      // CardMarket prices
      const cm       = p.cardmarket ?? p.cm ?? null
      const cmAvgSell = safePrice(cm?.avg_sell   ?? cm?.averageSellPrice ?? p.cm_avg_sell ?? null)
      const cmTrend   = safePrice(cm?.trend      ?? cm?.trendPrice       ?? p.cm_trend   ?? null)
      const cmUrl: string | null = cm?.url ?? p.cm_url ?? null

      return {
        set_id:         setId,
        api_product_id: apiProductId,
        name,
        product_type:   productType,
        tcgp_market:    tcgpMarket,
        tcgp_low:       tcgpLow,
        tcgp_high:      tcgpHigh,
        tcgp_url:       tcgpUrl,
        cm_avg_sell:    cmAvgSell,
        cm_trend:       cmTrend,
        cm_url:         cmUrl,
        fetched_at:     now,
      }
    })
    // Skip rows with no api_product_id — upsert conflict key would be null
    .filter((r) => r.api_product_id != null)

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

  return { productCount: rows.length, errors: 0 }
}
