import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { fetchPokemonApiPrices } from './pokemonApiService'
import { fetchEbayRawPrices } from './ebayService'
import { fetchEbayGradedPrices } from './ebayGradedService'
import { normalizePoints } from './priceNormalizer'
import { savePricePoints, savePriceHistory } from './priceRepository'
import { aggregatePricesForCard, writeCardPriceCache } from './priceAggregator'
import { findUndervaluedCards } from './undervaluedDetector'
import { NormalizedPricePoint } from './types'

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface UpdatePricesBatchOptions {
  limit?: number
  setId?: string
  includeGraded?: boolean
  /** Optional SSE emit callback — called with progress events during the batch. */
  emit?: (payload: unknown) => void
}

interface BatchResult {
  processed: number
  errors: number
  undervaluedFound: number
  /** Total number of graded price points saved across all cards. */
  gradedPointsSaved: number
}

/**
 * Process a batch of cards through the full pricing pipeline:
 * 1. Fetch raw prices from Pokemon TCG API (tcgplayer + cardmarket)
 * 2. Fetch eBay raw sold listings
 * 3. Fetch eBay graded sold listings (PSA) — when includeGraded=true
 * 4. Normalize all prices to USD
 * 5. Save to price_points
 * 6. Save selected points to price_history
 * 7. Aggregate price_points → update card_prices cache
 * 8. Run undervalued detection
 */
export async function updatePricesBatch(options?: UpdatePricesBatchOptions): Promise<BatchResult> {
  // When limit is undefined (no explicit cap) we fetch ALL cards for the set.
  // Pass a numeric value only when the caller explicitly wants a smaller batch.
  const limit = options?.limit   // undefined → no cap
  const setId = options?.setId
  const includeGraded = options?.includeGraded !== false
  const emit = options?.emit ?? null

  // Step 1 — Load cards from DB
  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('cards')
    .select('id, name, set_id, number, api_id')

  if (setId) {
    query = query.eq('set_id', setId)
  }

  // Only apply a row cap when an explicit limit was provided.
  // Omitting .limit() fetches every card matching the filter (i.e. the full set).
  if (limit !== undefined) {
    query = query.limit(limit)
  }

  const { data: cards, error: dbError } = await query

  if (dbError) {
    console.error('[PricingOrchestrator] Failed to load cards from DB:', dbError.message)
    return { processed: 0, errors: 1, undervaluedFound: 0, gradedPointsSaved: 0 }
  }

  if (!cards || cards.length === 0) {
    console.log('[PricingOrchestrator] No cards found to process.')
    return { processed: 0, errors: 0, undervaluedFound: 0, gradedPointsSaved: 0 }
  }

  console.log(`[PricingOrchestrator] Starting batch: ${cards.length} cards (includeGraded=${includeGraded})`)

  let processed = 0
  let errors = 0
  let gradedPointsSaved = 0
  const processedCardIds: string[] = []

  // Step 2 — Process each card sequentially
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    console.log(`[PricingOrchestrator] Processing card ${i + 1}/${cards.length}: ${card.name}`)

    try {
      // a. Pokemon API prices
      const apiResult = await fetchPokemonApiPrices(card)
      const apiPoints = normalizePoints(apiResult.points)

      // b. eBay raw prices
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

      // c. eBay graded prices (if includeGraded)
      let gradedPoints: NormalizedPricePoint[] = []
      if (includeGraded) {
        const gradedResults = await fetchEbayGradedPrices(card)
        gradedPoints = gradedResults.map(r => ({
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

        gradedPointsSaved += gradedPoints.length

        // Emit per-card graded result for live UI feedback
        if (emit && gradedResults.length > 0) {
          emit({
            type: 'graded_card',
            cardId: card.id,
            cardName: card.name,
            gradesFound: gradedResults.length,
            pointsSaved: gradedPoints.length,
            runningTotal: gradedPointsSaved,
          })
        }
      }

      // d. Combine and save
      const allPoints = [...apiPoints, ...ebayPoints, ...gradedPoints]
      await savePricePoints(allPoints)
      await savePriceHistory(allPoints)

      // e. Aggregate into card_prices cache
      const aggregated = await aggregatePricesForCard(card.id)
      await writeCardPriceCache(aggregated)

      processedCardIds.push(card.id)
      processed++

      // f. Small delay to be respectful to APIs
      await sleep(200)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[PricingOrchestrator] Error processing card ${card.name} (${card.id}):`, message)
      errors++
    }
  }

  // Step 3 — After all cards, run undervalued detection
  let undervaluedFound = 0
  if (processedCardIds.length > 0) {
    try {
      const undervalued = await findUndervaluedCards(processedCardIds)
      undervaluedFound = undervalued.length
      console.log(`[PricingOrchestrator] Undervalued cards found: ${undervaluedFound}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[PricingOrchestrator] Error running undervalued detection:', message)
    }
  }

  console.log(
    `[PricingOrchestrator] Batch complete — processed: ${processed}, errors: ${errors}, ` +
    `undervalued: ${undervaluedFound}, gradedPointsSaved: ${gradedPointsSaved}`
  )

  return { processed, errors, undervaluedFound, gradedPointsSaved }
}
