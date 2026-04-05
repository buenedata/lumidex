import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchPokemonApiPrices } from './pokemonApiService'
import { fetchEbayRawPrices } from './ebayService'
import { fetchEbayGradedPrices } from './ebayGradedService'
import { normalizePoints } from './priceNormalizer'
import { savePricePoints, savePriceHistory } from './priceRepository'
import { upsertGradedPrices } from './gradedPriceRepository'
import { aggregatePricesForCard, writeCardPriceCache } from './priceAggregator'
import { findUndervaluedCards } from './undervaluedDetector'
import { NormalizedPricePoint } from './types'

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ── Default settings ──────────────────────────────────────────────────────────

/** Stop starting new sets if this many ms have elapsed (Vercel Pro limit is 300s). */
const DEFAULT_TIME_BUDGET_MS = 270_000

// ── Options ───────────────────────────────────────────────────────────────────

export interface UpdatePricesBatchOptions {
  /**
   * Array of set_id strings to process.
   * Each set is fetched and priced in priority order.
   */
  setIds?: string[]

  /**
   * Legacy single-set convenience kept for backwards compatibility with the
   * admin /api/prices/sync route. Treated as setIds: [setId].
   */
  setId?: string

  limit?: number

  /**
   * Include eBay graded price lookups (PSA / CGC / ACE via eBay Browse API).
   * Saved to card_graded_prices. Adds ~600ms per card.
   * Default: true (included in nightly cron).
   * Set false for fast bulk seed (TCG-API-only mode).
   */
  includeGraded?: boolean

  /**
   * Include eBay raw (ungraded) last-sold price lookups.
   *
   * NOTE: eBay raw prices are saved to price_points but are currently NOT
   * aggregated into card_prices or price_history — they do not affect any
   * displayed prices. Skipping this call saves ~600ms per card with no
   * visible impact.
   *
   * Default: false (skipped in all batch modes).
   */
  includeEbayRaw?: boolean

  /**
   * Number of cards to process concurrently within a set.
   * Use 1 for any run that includes eBay calls (rate-limit safety).
   * Use 5+ for TCG-API-only runs (concurrent fetches are safe).
   * Default: auto — 1 if eBay is enabled, 5 if TCG-API-only.
   */
  concurrency?: number

  /**
   * Maximum milliseconds to spend before stopping (leaves time for Vercel cleanup).
   * Default: 270_000 (270s — Vercel Pro serverless limit is 300s).
   */
  timeBudgetMs?: number

  /** Optional SSE emit callback — called with progress events during the batch. */
  emit?: (payload: unknown) => void
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface BatchResult {
  processed:               number
  errors:                  number
  undervaluedFound:        number
  gradedPointsSaved:       number
  setsProcessed:           number
  setsSkippedDueToTimeout: number
}

// ── Concurrency helper ────────────────────────────────────────────────────────

/**
 * Run an async function over an array with a maximum concurrency limit.
 * Processes items in chunks of `concurrency` in parallel.
 */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<Array<R | Error>> {
  const results: Array<R | Error> = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const chunkResults = await Promise.allSettled(
      chunk.map((item, j) => fn(item, i + j))
    )
    for (const r of chunkResults) {
      results.push(r.status === 'fulfilled' ? r.value : r.reason as Error)
    }
  }
  return results
}

// ── Core: process a single set ────────────────────────────────────────────────

interface ProcessSetResult {
  processed:        number
  errors:           number
  gradedPointsSaved: number
  processedCardIds: string[]
}

async function processSingleSet(
  setId:          string,
  limit:          number | undefined,
  includeGraded:  boolean,
  includeEbayRaw: boolean,
  concurrency:    number,
  emit:           ((payload: unknown) => void) | null,
): Promise<ProcessSetResult> {
  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('cards')
    .select('id, name, set_id, number, api_id, rarity')
    .eq('set_id', setId)

  if (limit !== undefined) {
    query = query.limit(limit)
  }

  const { data: cards, error: dbError } = await query

  if (dbError) {
    console.error(`[PricingOrchestrator] processSingleSet(${setId}): DB error:`, dbError.message)
    return { processed: 0, errors: 1, gradedPointsSaved: 0, processedCardIds: [] }
  }

  if (!cards || cards.length === 0) {
    console.log(`[PricingOrchestrator] processSingleSet(${setId}): no cards found.`)
    return { processed: 0, errors: 0, gradedPointsSaved: 0, processedCardIds: [] }
  }

  const mode = includeEbayRaw || includeGraded ? 'full' : 'fast'
  console.log(
    `[PricingOrchestrator] processSingleSet(${setId}): ` +
    `${cards.length} cards, mode=${mode}, concurrency=${concurrency}, ` +
    `includeGraded=${includeGraded}, includeEbayRaw=${includeEbayRaw}`
  )

  // ── FAST PATH: TCG-API-only, parallel processing, batch DB writes ────────────
  if (!includeEbayRaw && !includeGraded) {
    const allPoints: NormalizedPricePoint[] = []
    let errors = 0
    const processedCardIds: string[] = []
    // cardId → CardMarket URL (from API response, not stored in price_points)
    const cmUrlMap = new Map<string, string>()

    const results = await mapConcurrent(cards, concurrency, async (card) => {
      const apiResult = await fetchPokemonApiPrices(card)
      const apiPoints = normalizePoints(apiResult.points)
      return { card, apiPoints, cmUrl: apiResult.cmUrl ?? null }
    })

    for (const result of results) {
      if (result instanceof Error) {
        console.error(`[PricingOrchestrator] [${setId}] Fast-path card error:`, result.message)
        errors++
        continue
      }
      allPoints.push(...result.apiPoints)
      processedCardIds.push(result.card.id)
      if (result.cmUrl) cmUrlMap.set(result.card.id, result.cmUrl)
    }

    // Batch write all price points for the whole set at once
    if (allPoints.length > 0) {
      await Promise.all([
        savePricePoints(allPoints),
        savePriceHistory(allPoints),
      ])

      // Aggregate each card concurrently (DB fan-out, not HTTP)
      // Merge in cmUrl from the API response — it is not stored in price_points
      await mapConcurrent(processedCardIds, 10, async (cardId) => {
        const agg = await aggregatePricesForCard(cardId)
        const cmUrl = cmUrlMap.get(cardId)
        if (cmUrl) agg.cm_url = cmUrl
        await writeCardPriceCache(agg)
      })
    }

    const processed = processedCardIds.length
    console.log(
      `[PricingOrchestrator] processSingleSet(${setId}) fast-path done: ` +
      `${processed} processed, ${errors} errors, ${allPoints.length} price points`
    )
    return { processed, errors, gradedPointsSaved: 0, processedCardIds }
  }

  // ── FULL PATH: eBay-included, sequential processing (rate-limit safe) ────────
  let processed = 0
  let errors = 0
  let gradedPointsSaved = 0
  const processedCardIds: string[] = []

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    console.log(`[PricingOrchestrator] [${setId}] Card ${i + 1}/${cards.length}: ${card.name}`)

    try {
      // a. Pokemon TCG API prices (TCGPlayer + CardMarket in one call)
      // cmUrl comes from the API response body and is not stored in price_points
      const apiResult = await fetchPokemonApiPrices(card)
      const apiPoints = normalizePoints(apiResult.points)
      const cmUrl     = apiResult.cmUrl ?? null

      // b. eBay raw ungraded sold prices (optional — currently not aggregated into card_prices)
      let ebayPoints: NormalizedPricePoint[] = []
      if (includeEbayRaw) {
        const ebayResult = await fetchEbayRawPrices(card)
        if (ebayResult) {
          ebayPoints = [{
            cardId:     card.id,
            source:     'ebay',
            variantKey: ebayResult.variantKey,
            price:      ebayResult.average,
            priceUsd:   ebayResult.average,
            currency:   'USD',
            isGraded:   false,
          }]
        }
      }

      // c. eBay graded sold prices (PSA/CGC/ACE) — saved to card_graded_prices
      if (includeGraded) {
        const gradedResults = await fetchEbayGradedPrices(card)

        if (gradedResults.length > 0) {
          await upsertGradedPrices(gradedResults)
          gradedPointsSaved += gradedResults.length

          if (emit) {
            emit({
              type:         'graded_card',
              cardId:       card.id,
              cardName:     card.name,
              gradesFound:  gradedResults.length,
              pointsSaved:  gradedResults.length,
              runningTotal: gradedPointsSaved,
            })
          }
        }
      }

      // d. Combine ungraded points and save
      const allPoints = [...apiPoints, ...ebayPoints]
      await savePricePoints(allPoints)
      await savePriceHistory(allPoints)

      // e. Aggregate into card_prices cache; merge in cm_url from API response
      const aggregated = await aggregatePricesForCard(card.id)
      if (cmUrl) aggregated.cm_url = cmUrl
      await writeCardPriceCache(aggregated)

      processedCardIds.push(card.id)
      processed++

      // f. Polite delay — needed when making eBay Browse API calls
      await sleep(200)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[PricingOrchestrator] [${setId}] Error on card ${card.name} (${card.id}):`, message)
      errors++
    }
  }

  return { processed, errors, gradedPointsSaved, processedCardIds }
}

// ── Public export ─────────────────────────────────────────────────────────────

/**
 * Process one or more sets through the full pricing pipeline.
 *
 * Performance characteristics:
 *   TCG-API-only (includeEbayRaw=false, includeGraded=false):
 *     ~5–10 seconds per 200-card set (parallel, batch DB writes)
 *   Full with eBay graded (includeGraded=true):
 *     ~3–4 minutes per 200-card set (sequential, eBay rate-limit safe)
 *
 * Sets are processed in the order given. After each set completes,
 * sets.prices_last_synced_at is updated. Processing stops before starting
 * a new set if the time budget is exceeded.
 */
export async function updatePricesBatch(options?: UpdatePricesBatchOptions): Promise<BatchResult> {
  const limit          = options?.limit
  const includeGraded  = options?.includeGraded !== false
  const includeEbayRaw = options?.includeEbayRaw === true   // default: SKIP eBay raw
  const emit           = options?.emit ?? null
  const timeBudgetMs   = options?.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS

  // Auto-determine concurrency: parallel when no eBay calls, serial when eBay is involved
  const hasEbay    = includeEbayRaw || includeGraded
  const concurrency = options?.concurrency ?? (hasEbay ? 1 : 5)

  // Resolve the list of set IDs to process
  const rawSetIds: string[] | undefined =
    options?.setIds && options.setIds.length > 0
      ? options.setIds
      : options?.setId
        ? [options.setId]
        : undefined

  const startTime = Date.now()

  console.log(
    `[PricingOrchestrator] updatePricesBatch start — ` +
    `sets=${rawSetIds?.length ?? 'all'}, ` +
    `includeGraded=${includeGraded}, includeEbayRaw=${includeEbayRaw}, ` +
    `concurrency=${concurrency}, budget=${timeBudgetMs}ms`
  )

  // ── Path A: setIds provided — process each set sequentially ─────────────────

  if (rawSetIds && rawSetIds.length > 0) {
    let totalProcessed       = 0
    let totalErrors          = 0
    let totalGradedPoints    = 0
    let totalUndervalued     = 0
    let setsProcessed        = 0
    let setsSkipped          = 0

    const supabase = await createSupabaseServerClient()

    for (const setId of rawSetIds) {
      const elapsed = Date.now() - startTime
      if (elapsed >= timeBudgetMs) {
        const remaining = rawSetIds.length - setsProcessed - setsSkipped
        console.log(
          `[PricingOrchestrator] Time budget reached (${elapsed}ms / ${timeBudgetMs}ms). ` +
          `Skipping remaining ${remaining} sets.`
        )
        setsSkipped += remaining
        break
      }

      console.log(
        `[PricingOrchestrator] Starting set "${setId}" ` +
        `(elapsed ${Math.round(elapsed / 1000)}s / budget ${Math.round(timeBudgetMs / 1000)}s)`
      )

      if (emit) {
        emit({ type: 'set_start', setId, message: `Starting price sync for set "${setId}"…` })
      }

      const { processed, errors, gradedPointsSaved, processedCardIds } =
        await processSingleSet(setId, limit, includeGraded, includeEbayRaw, concurrency, emit)

      totalProcessed    += processed
      totalErrors       += errors
      totalGradedPoints += gradedPointsSaved

      // Run undervalued detection for this set's cards
      if (processedCardIds.length > 0) {
        try {
          const undervalued = await findUndervaluedCards(processedCardIds)
          totalUndervalued += undervalued.length
        } catch (err) {
          console.error(
            `[PricingOrchestrator] Undervalued detection failed for set "${setId}":`,
            err instanceof Error ? err.message : String(err)
          )
        }
      }

      // Mark this set as synced
      const now = new Date().toISOString()
      // Use supabaseAdmin (service role) for the sets write — anon key is blocked by RLS
      const { error: updateErr } = await supabaseAdmin
        .from('sets')
        .update({ prices_last_synced_at: now })
        .eq('set_id', setId)

      if (updateErr) {
        console.error(
          `[PricingOrchestrator] Failed to update prices_last_synced_at for "${setId}":`,
          updateErr.message
        )
      } else {
        console.log(`[PricingOrchestrator] Set "${setId}" synced at ${now}`)
      }

      setsProcessed++

      if (emit) {
        emit({ type: 'set_done', setId, processed, errors, gradedPointsSaved, syncedAt: now })
      }
    }

    const totalElapsed = Date.now() - startTime
    console.log(
      `[PricingOrchestrator] Batch complete — ` +
      `setsProcessed=${setsProcessed}, setsSkipped=${setsSkipped}, ` +
      `cards=${totalProcessed}, errors=${totalErrors}, ` +
      `graded=${totalGradedPoints}, undervalued=${totalUndervalued}, ` +
      `elapsed=${totalElapsed}ms`
    )

    return {
      processed:               totalProcessed,
      errors:                  totalErrors,
      undervaluedFound:        totalUndervalued,
      gradedPointsSaved:       totalGradedPoints,
      setsProcessed,
      setsSkippedDueToTimeout: setsSkipped,
    }
  }

  // ── Path B: no setIds — legacy all-cards pass (admin manual sync) ────────────

  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('cards')
    .select('id, name, set_id, number, api_id, rarity')

  if (limit !== undefined) {
    query = query.limit(limit)
  }

  const { data: cards, error: dbError } = await query

  if (dbError) {
    console.error('[PricingOrchestrator] Legacy path: failed to load cards:', dbError.message)
    return { processed: 0, errors: 1, undervaluedFound: 0, gradedPointsSaved: 0, setsProcessed: 0, setsSkippedDueToTimeout: 0 }
  }

  if (!cards || cards.length === 0) {
    console.log('[PricingOrchestrator] Legacy path: no cards found.')
    return { processed: 0, errors: 0, undervaluedFound: 0, gradedPointsSaved: 0, setsProcessed: 0, setsSkippedDueToTimeout: 0 }
  }

  console.log(`[PricingOrchestrator] Legacy path: ${cards.length} cards (includeGraded=${includeGraded})`)

  let processed = 0
  let errors = 0
  let gradedPointsSaved = 0
  const processedCardIds: string[] = []

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    console.log(`[PricingOrchestrator] Card ${i + 1}/${cards.length}: ${card.name}`)

    try {
      const apiResult = await fetchPokemonApiPrices(card)
      const apiPoints = normalizePoints(apiResult.points)
      const cmUrl     = apiResult.cmUrl ?? null

      let ebayPoints: NormalizedPricePoint[] = []
      if (includeEbayRaw) {
        const ebayResult = await fetchEbayRawPrices(card)
        if (ebayResult) {
          ebayPoints = [{
            cardId:     card.id,
            source:     'ebay',
            variantKey: ebayResult.variantKey,
            price:      ebayResult.average,
            priceUsd:   ebayResult.average,
            currency:   'USD',
            isGraded:   false,
          }]
        }
      }

      if (includeGraded) {
        const gradedResults = await fetchEbayGradedPrices(card)
        if (gradedResults.length > 0) {
          await upsertGradedPrices(gradedResults)
          gradedPointsSaved += gradedResults.length

          if (emit) {
            emit({
              type:         'graded_card',
              cardId:       card.id,
              cardName:     card.name,
              gradesFound:  gradedResults.length,
              pointsSaved:  gradedResults.length,
              runningTotal: gradedPointsSaved,
            })
          }
        }
      }

      const allPoints = [...apiPoints, ...ebayPoints]
      await savePricePoints(allPoints)
      await savePriceHistory(allPoints)

      const aggregated = await aggregatePricesForCard(card.id)
      if (cmUrl) aggregated.cm_url = cmUrl
      await writeCardPriceCache(aggregated)

      processedCardIds.push(card.id)
      processed++

      if (includeEbayRaw || includeGraded) await sleep(200)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[PricingOrchestrator] Error on card ${card.name} (${card.id}):`, message)
      errors++
    }
  }

  let undervaluedFound = 0
  if (processedCardIds.length > 0) {
    try {
      const undervalued = await findUndervaluedCards(processedCardIds)
      undervaluedFound = undervalued.length
    } catch (err) {
      console.error('[PricingOrchestrator] Undervalued detection error:', err instanceof Error ? err.message : String(err))
    }
  }

  console.log(
    `[PricingOrchestrator] Legacy batch complete — ` +
    `processed=${processed}, errors=${errors}, elapsed=${Date.now() - startTime}ms`
  )

  return {
    processed,
    errors,
    undervaluedFound,
    gradedPointsSaved,
    setsProcessed:           0,
    setsSkippedDueToTimeout: 0,
  }
}
