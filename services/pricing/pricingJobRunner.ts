import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { updatePricesBatch } from './pricingOrchestrator'
import { fetchPokemonApiPrices } from './pokemonApiService'
import { fetchEbayRawPrices } from './ebayService'
import { fetchEbayGradedPrices, isRaritySkippedForGraded } from './ebayGradedService'
import { normalizePoints } from './priceNormalizer'
import { savePricePoints, savePriceHistory } from './priceRepository'
import { upsertGradedPrices, deleteGradedPricesForCard } from './gradedPriceRepository'
import { aggregatePricesForCard, writeCardPriceCache } from './priceAggregator'
import { NormalizedPricePoint } from './types'

// ── ENV startup checks ────────────────────────────────────────────────────────

if (!process.env.EBAY_CLIENT_ID) {
  console.error('[PricingJobRunner] Missing env: EBAY_CLIENT_ID')
}

if (!process.env.EBAY_CLIENT_SECRET) {
  console.warn('[PricingJobRunner] Missing env: EBAY_CLIENT_SECRET — OAuth token refresh will fail')
}

if (!process.env.POKEMON_TCG_API_KEY && !process.env.POKEMONTCG_API_KEY) {
  console.error('[PricingJobRunner] Missing env: POKEMON_TCG_API_KEY')
}

if (!process.env.CRON_SECRET) {
  console.warn('[PricingJobRunner] Missing env: CRON_SECRET — cron endpoint will reject all requests')
}

if (process.env.NODE_ENV !== 'test') {
  console.log(`
[PricingJobRunner] Setup cron:
- URL: /api/cron/update-prices
- Method: GET  (Vercel Cron always uses GET)
- Header: Authorization: Bearer <CRON_SECRET>
- Schedule: 01:00, 02:00, 03:00 UTC (nightly)
`)
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PriceUpdateJobOptions {
  setId?: string
  limit?: number
  includeGraded?: boolean
  /** Optional SSE emit callback forwarded to the orchestrator. */
  emit?: (payload: unknown) => void
}

interface SyncSingleCardResult {
  cardId: string
  pricePointsSaved: number
  aggregated: boolean
}

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * Wrapper around updatePricesBatch() with structured logging and error handling.
 * Safe to call from both cron endpoints and admin UI.
 */
export async function runPriceUpdateJob(opts?: PriceUpdateJobOptions) {
  const startTime = Date.now()
  console.log('[PricingJobRunner] runPriceUpdateJob: start', { opts })

  try {
    const result = await updatePricesBatch({
      setId:          opts?.setId,
      limit:          opts?.limit,
      includeGraded:  opts?.includeGraded,
      emit:           opts?.emit,
    })
    const duration = Date.now() - startTime
    console.log(
      `[PricingJobRunner] runPriceUpdateJob: complete — ` +
      `processed=${result.processed}, errors=${result.errors}, ` +
      `gradedPointsSaved=${result.gradedPointsSaved}, ` +
      `undervaluedFound=${result.undervaluedFound}, duration=${duration}ms`
    )
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[PricingJobRunner] runPriceUpdateJob: FAILED —', message)
    throw err
  }
}

/**
 * Run the full pricing pipeline for a single card by its UUID.
 * Fetches prices from all sources, saves to price_points, then aggregates to card_prices.
 */
export async function syncSingleCard(cardId: string): Promise<SyncSingleCardResult> {
  console.log(`[PricingJobRunner] syncSingleCard: start — cardId=${cardId}`)

  // Step 1 — Fetch card from DB
  const supabase = await createSupabaseServerClient()
  const { data: card, error: dbError } = await supabase
    .from('cards')
    .select('id, name, number, set_id, api_id, rarity')
    .eq('id', cardId)
    .single()

  if (dbError || !card) {
    throw new Error(
      `[PricingJobRunner] syncSingleCard: card not found — cardId=${cardId}` +
      (dbError ? ` (${dbError.message})` : '')
    )
  }

  console.log(`[PricingJobRunner] syncSingleCard: found card "${card.name}" (${card.id})`)

  // Step 2a — Pokemon TCG API prices (TCGPlayer + CardMarket; cmUrl carried separately)
  // fetchPokemonApiPrices returns empty points when card.api_id is null (e.g. Japanese
  // cards imported without a pokemontcg.io ID), so no extra language check is needed.
  console.log(`[PricingJobRunner] syncSingleCard: fetching Pokémon TCG API prices…`)
  const apiResult = await fetchPokemonApiPrices(card)
  const apiPoints = normalizePoints(apiResult.points)
  const cmUrl     = apiResult.cmUrl ?? null
  console.log(`[PricingJobRunner] syncSingleCard: Pokémon TCG API → ${apiPoints.length} points`)

  // Step 2b — eBay raw sold prices
  console.log(`[PricingJobRunner] syncSingleCard: fetching eBay raw prices…`)
  const ebayResult = await fetchEbayRawPrices(card)
  let ebayPoints: NormalizedPricePoint[] = []
  if (ebayResult) {
    ebayPoints = [{
      cardId: card.id,
      source: 'ebay',
      variantKey: ebayResult.variantKey,
      price: ebayResult.average,
      priceUsd: ebayResult.average,
      currency: 'USD',
      isGraded: false,
    }]
  }
  console.log(`[PricingJobRunner] syncSingleCard: eBay raw → ${ebayPoints.length} points`)

  // Step 2c — eBay graded sold prices
  console.log(`[PricingJobRunner] syncSingleCard: fetching eBay graded prices…`)
  const gradedResults = await fetchEbayGradedPrices(card)
  const gradedPoints: NormalizedPricePoint[] = gradedResults.map(r => ({
    cardId: card.id,
    source: 'ebay',
    variantKey: r.variantKey,
    price: r.average,
    priceUsd: r.average,
    currency: 'USD',
    isGraded: true,
    grade: r.grade,
    gradingCompany: r.gradingCompany,
  }))
  console.log(`[PricingJobRunner] syncSingleCard: eBay graded → ${gradedPoints.length} points`)

  // Sync card_graded_prices table: upsert new data or delete stale rows when
  // the eBay call returned nothing for a non-skipped card (e.g. wrong-card filter
  // removed all results from a previous bad sync).
  if (gradedResults.length > 0) {
    await upsertGradedPrices(gradedResults)
  } else if (!isRaritySkippedForGraded(card.rarity)) {
    await deleteGradedPricesForCard(card.id)
  }

  // Step 3 — Save all points
  const allPoints = [...apiPoints, ...ebayPoints, ...gradedPoints]
  console.log(`[PricingJobRunner] syncSingleCard: saving ${allPoints.length} price points…`)
  await savePricePoints(allPoints)
  await savePriceHistory(allPoints)

  // Step 4 — Aggregate into card_prices cache; merge cm_url from API response
  console.log(`[PricingJobRunner] syncSingleCard: aggregating prices for card ${cardId}…`)
  let aggregated = false
  try {
    const aggregateResult = await aggregatePricesForCard(cardId)
    if (cmUrl) aggregateResult.cm_url = cmUrl
    await writeCardPriceCache(aggregateResult)
    aggregated = true
    console.log(`[PricingJobRunner] syncSingleCard: aggregation complete`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[PricingJobRunner] syncSingleCard: aggregation failed —`, message)
  }

  const result: SyncSingleCardResult = {
    cardId,
    pricePointsSaved: allPoints.length,
    aggregated,
  }
  console.log(`[PricingJobRunner] syncSingleCard: done —`, result)
  return result
}
