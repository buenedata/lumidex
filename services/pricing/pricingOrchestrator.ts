import { supabaseAdmin } from '@/lib/supabase'
import { fetchPokemonApiPrices } from './pokemonApiService'
import { normalizePoints, toUsd } from './priceNormalizer'
import { savePricePoints, savePriceHistory } from './priceRepository'
import { aggregatePricesForCard, writeCardPriceCache } from './priceAggregator'
import { findUndervaluedCards } from './undervaluedDetector'
import { importProductPricing } from './productPricingService'
import { NormalizedPricePoint, CardPriceUpdate } from './types'
import { fetchTcggoEpisodePrices, TcggoCardPriceEntry } from './tcggoCardService'

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
   * Number of cards to process concurrently within a set.
   * Default: 5 (TCG-API-only, safe to parallelise).
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

// ── Tcggo price merge helper ──────────────────────────────────────────────────

/**
 * Merge tcggo.com CardMarket price data into a CardPriceUpdate.
 *
 * tcggo fetches by episode ID + card number (precise), whereas pokemontcg.io
 * maps cards to CardMarket product pages which can point to the wrong listing
 * (e.g. common Charmander matched to the Charmander-ex full-art page).
 *
 * Strategy:
 *   - CardMarket: ALWAYS use tcggo prices when available — overrides
 *     pokemontcg.io prices which are frequently wrong for CM.
 *   - TCGPlayer: only fill in from tcggo when pokemontcg.io has no data.
 *
 * Graded prices (PSA/BGS/CGC) come from CardMarket via the tcggo episode/cards
 * endpoint for valuable cards (≥€5). Stored in tcgp_psa10/psa9/bgs95/bgs9/cgc10.
 *
 * Mutates `agg` in-place. Safe to call when tcggoPriceMap is null (no-op).
 */
function mergeTcggoPrices(
  agg:             CardPriceUpdate,
  cardId:          string,
  tcggoPriceMap:   Map<string, TcggoCardPriceEntry> | null,
  cardIdToNormNum: Map<string, string>,
): void {
  if (!tcggoPriceMap) return

  const normNum = cardIdToNormNum.get(cardId)
  if (!normNum) return

  const tcggo = tcggoPriceMap.get(normNum)
  if (!tcggo) return

  // ── CardMarket: prefer tcggo over pokemontcg.io ───────────────────────────
  // tcggo fetches by episode/card number and is more accurate for CM pricing.
  // Overwrite whatever pokemontcg.io stored — if tcggo has no CM data for
  // this card, leave the existing value untouched.
  const hasTcggoCm = tcggo.cardmarket.avg7 != null || tcggo.cardmarket.avg30 != null
  if (hasTcggoCm) {
    if (tcggo.cardmarket.avg7  != null) agg.cm_avg_sell = tcggo.cardmarket.avg7
    if (tcggo.cardmarket.avg30 != null) agg.cm_avg_30d  = tcggo.cardmarket.avg30
    if (tcggo.cardmarket.low   != null) agg.cm_low      = tcggo.cardmarket.low
    if (tcggo.cardmarket.avg7  != null) agg.cm_trend    = tcggo.cardmarket.avg7
      else if (tcggo.cardmarket.avg30 != null) agg.cm_trend = tcggo.cardmarket.avg30
  }

  // ── TCGPlayer: only fill in when pokemontcg.io has no data ────────────────
  if (agg.tcgp_market == null && tcggo.tcgplayer.market != null) {
    // Note: tcggo API mislabels these as EUR but values are USD
    agg.tcgp_market = tcggo.tcgplayer.market
  }

  // ── Graded: write tcggo graded prices (CardMarket EUR → USD) ─────────────
  // tcggo graded prices come from CardMarket (EUR), not TCGPlayer (USD).
  // We store them in the tcgp_* columns as the best available graded price
  // regardless of source; convert EUR → USD using the normalizer.
  if (tcggo.graded) {
    const g = tcggo.graded
    if (g.psa10 != null) agg.tcgp_psa10 = toUsd(g.psa10, 'EUR')
    if (g.psa9  != null) agg.tcgp_psa9  = toUsd(g.psa9,  'EUR')
    if (g.bgs10 != null) agg.tcgp_bgs95 = toUsd(g.bgs10, 'EUR')
    if (g.bgs9  != null) agg.tcgp_bgs9  = toUsd(g.bgs9,  'EUR')
    if (g.cgc10 != null) agg.tcgp_cgc10 = toUsd(g.cgc10, 'EUR')
  }
}

// ── Core: process a single set ────────────────────────────────────────────────

interface ProcessSetResult {
  processed:        number
  errors:           number
  processedCardIds: string[]
}

async function processSingleSet(
  setId:       string,
  limit:       number | undefined,
  concurrency: number,
  emit:        ((payload: unknown) => void) | null,
): Promise<ProcessSetResult> {
  let query = supabaseAdmin
    .from('cards')
    .select('id, name, set_id, number, api_id, rarity')
    .eq('set_id', setId)

  if (limit !== undefined) {
    query = query.limit(limit)
  }

  const { data: cards, error: dbError } = await query

  if (dbError) {
    console.error(`[PricingOrchestrator] processSingleSet(${setId}): DB error:`, dbError.message)
    return { processed: 0, errors: 1, processedCardIds: [] }
  }

  if (!cards || cards.length === 0) {
    console.log(`[PricingOrchestrator] processSingleSet(${setId}): no cards found.`)
    return { processed: 0, errors: 0, processedCardIds: [] }
  }

  // ── Tcggo episode prices (CardMarket singles source for new/unindexed sets) ──
  // One batch call per set — fetches all pages, builds a normNum→TcggoCardPriceEntry map.
  // Used when pokemontcg.io returns no CardMarket data (e.g. sets not yet indexed by them).
  // Graded prices (PSA/BGS/CGC) also come from this endpoint via mergeTcggoPrices().
  let tcggoPriceMap: Map<string, TcggoCardPriceEntry> | null = null
  const { data: setRow } = await supabaseAdmin
    .from('sets')
    .select('api_set_id')
    .eq('set_id', setId)
    .single()
  const tcggoEpisodeId = setRow?.api_set_id ?? null

  if (tcggoEpisodeId) {
    tcggoPriceMap = await fetchTcggoEpisodePrices(tcggoEpisodeId)
    console.log(
      `[PricingOrchestrator] processSingleSet(${setId}): ` +
      `tcggo episode ${tcggoEpisodeId} → ${tcggoPriceMap.size} card prices loaded`,
    )
  }

  // Build cardId → normalised card number map for tcggo lookup.
  // Normalised = leading zeros stripped, "/total" suffix stripped (e.g. "001/88" → "1").
  const cardIdToNormNum = new Map<string, string>()
  for (const card of cards) {
    const raw    = String(card.number ?? '').split('/')[0]
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed)) cardIdToNormNum.set(card.id as string, String(parsed))
  }

  console.log(
    `[PricingOrchestrator] processSingleSet(${setId}): ` +
    `${cards.length} cards, concurrency=${concurrency}`,
  )

  const allPoints: NormalizedPricePoint[] = []
  let errors = 0
  const processedCardIds: string[] = []
  // cardId → CardMarket URL (from API response, not stored in price_points)
  const cmUrlMap = new Map<string, string>()

  const results = await mapConcurrent(cards, concurrency, async (card) => {
    // fetchPokemonApiPrices returns empty points when card.api_id is null,
    // so Japanese cards (which have no api_id) are handled correctly.
    const apiResult = await fetchPokemonApiPrices(card)
    const apiPoints = normalizePoints(apiResult.points)
    return { card, apiPoints, cmUrl: apiResult.cmUrl ?? null }
  })

  for (const result of results) {
    if (result instanceof Error) {
      console.error(`[PricingOrchestrator] [${setId}] Card error:`, result.message)
      errors++
      continue
    }
    allPoints.push(...result.apiPoints)
    processedCardIds.push(result.card.id)
    if (result.cmUrl) cmUrlMap.set(result.card.id, result.cmUrl)

    // When pokemontcg.io returned no CardMarket prices (common for EU promo
    // sets like McDonald's collections), add a tcggo-sourced CardMarket point
    // so that today's price is also written to card_price_history.
    const hasApiCm = result.apiPoints.some(p => p.source === 'cardmarket')
    if (!hasApiCm && tcggoPriceMap) {
      const normNum = cardIdToNormNum.get(result.card.id)
      const tcggo   = normNum ? tcggoPriceMap.get(normNum) : null
      const cmEur   = tcggo?.cardmarket.avg7 ?? tcggo?.cardmarket.avg30 ?? tcggo?.cardmarket.low ?? null
      if (cmEur != null) {
        allPoints.push({
          cardId:     result.card.id,
          source:     'cardmarket',
          variantKey: 'normal',
          price:      cmEur,
          currency:   'EUR',
          isGraded:   false,
          priceUsd:   toUsd(cmEur, 'EUR'),
        })
      }
    }
  }

  // Batch write all price points for the whole set at once
  if (allPoints.length > 0) {
    await Promise.all([
      savePricePoints(allPoints),
      savePriceHistory(allPoints),
    ])
  }

  // Aggregate each card concurrently and write to card_prices cache.
  // Always runs — even when all price points are empty (e.g. Japanese cards with no
  // api_id) — so that a card_prices row with fetched_at is always written after a sync.
  await mapConcurrent(processedCardIds, 10, async (cardId) => {
    const agg = await aggregatePricesForCard(cardId)
    const cmUrl = cmUrlMap.get(cardId)
    if (cmUrl) agg.cm_url = cmUrl
    // Fill in CardMarket (and TCGPlayer + graded) prices from tcggo
    mergeTcggoPrices(agg, cardId, tcggoPriceMap, cardIdToNormNum)
    await writeCardPriceCache(agg)

    // Persist tcggo_id on the card row so the history-backfill API can use it
    // without needing to re-fetch the full episode card list.
    if (tcggoPriceMap) {
      const normNum = cardIdToNormNum.get(cardId)
      const entry   = normNum ? tcggoPriceMap.get(normNum) : null
      if (entry?.tcggoId) {
        await supabaseAdmin
          .from('cards')
          .update({ tcggo_id: entry.tcggoId })
          .eq('id', cardId)
      }
    }
  })

  const processed = processedCardIds.length
  console.log(
    `[PricingOrchestrator] processSingleSet(${setId}) done: ` +
    `${processed} processed, ${errors} errors, ${allPoints.length} price points`
  )
  return { processed, errors, processedCardIds }
}

// ── Public export ─────────────────────────────────────────────────────────────

/**
 * Process one or more sets through the full pricing pipeline.
 *
 * Performance characteristics:
 *   ~5–10 seconds per 200-card set (parallel, batch DB writes)
 *
 * Sets are processed in the order given. After each set completes,
 * sets.prices_last_synced_at is updated. Processing stops before starting
 * a new set if the time budget is exceeded.
 */
export async function updatePricesBatch(options?: UpdatePricesBatchOptions): Promise<BatchResult> {
  const limit        = options?.limit
  const emit         = options?.emit ?? null
  const timeBudgetMs = options?.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS
  const concurrency  = options?.concurrency ?? 5

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
    `concurrency=${concurrency}, budget=${timeBudgetMs}ms`
  )

  // ── Path A: setIds provided — process each set sequentially ─────────────────

  if (rawSetIds && rawSetIds.length > 0) {
    let totalProcessed    = 0
    let totalErrors       = 0
    let totalUndervalued  = 0
    let setsProcessed     = 0
    let setsSkipped       = 0

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

      const { processed, errors, processedCardIds } =
        await processSingleSet(setId, limit, concurrency, emit)

      totalProcessed += processed
      totalErrors    += errors

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

      // Sync sealed-product prices if the set has a stored api_set_id
      try {
        const { data: setRow } = await supabaseAdmin
          .from('sets')
          .select('api_set_id')
          .eq('set_id', setId)
          .single()

        if (setRow?.api_set_id) {
          console.log(
            `[PricingOrchestrator] Set "${setId}": syncing product prices ` +
            `(api_set_id=${setRow.api_set_id})…`
          )
          const productResult = await importProductPricing({
            episodeId: setRow.api_set_id,
            setId,
          })
          console.log(
            `[PricingOrchestrator] Set "${setId}": ${productResult.productCount} products synced`,
          )
        }
      } catch (err) {
        console.error(
          `[PricingOrchestrator] Product pricing failed for set "${setId}":`,
          err instanceof Error ? err.message : String(err),
        )
      }

      // Mark this set as synced
      const now = new Date().toISOString()
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
        emit({ type: 'set_done', setId, processed, errors, syncedAt: now })
      }
    }

    const totalElapsed = Date.now() - startTime
    console.log(
      `[PricingOrchestrator] Batch complete — ` +
      `setsProcessed=${setsProcessed}, setsSkipped=${setsSkipped}, ` +
      `cards=${totalProcessed}, errors=${totalErrors}, ` +
      `undervalued=${totalUndervalued}, elapsed=${totalElapsed}ms`
    )

    return {
      processed:               totalProcessed,
      errors:                  totalErrors,
      undervaluedFound:        totalUndervalued,
      setsProcessed,
      setsSkippedDueToTimeout: setsSkipped,
    }
  }

  // ── Path B: no setIds — legacy all-cards pass (admin manual sync) ────────────

  let query = supabaseAdmin
    .from('cards')
    .select('id, name, set_id, number, api_id, rarity')

  if (limit !== undefined) {
    query = query.limit(limit)
  }

  const { data: cards, error: dbError } = await query

  if (dbError) {
    console.error('[PricingOrchestrator] Legacy path: failed to load cards:', dbError.message)
    return { processed: 0, errors: 1, undervaluedFound: 0, setsProcessed: 0, setsSkippedDueToTimeout: 0 }
  }

  if (!cards || cards.length === 0) {
    console.log('[PricingOrchestrator] Legacy path: no cards found.')
    return { processed: 0, errors: 0, undervaluedFound: 0, setsProcessed: 0, setsSkippedDueToTimeout: 0 }
  }

  console.log(`[PricingOrchestrator] Legacy path: ${cards.length} cards`)

  let processed = 0
  let errors = 0
  const processedCardIds: string[] = []

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    console.log(`[PricingOrchestrator] Card ${i + 1}/${cards.length}: ${card.name}`)

    try {
      const apiResult = await fetchPokemonApiPrices(card)
      const apiPoints = normalizePoints(apiResult.points)
      const cmUrl     = apiResult.cmUrl ?? null

      await savePricePoints(apiPoints)
      await savePriceHistory(apiPoints)

      const aggregated = await aggregatePricesForCard(card.id)
      if (cmUrl) aggregated.cm_url = cmUrl
      await writeCardPriceCache(aggregated)

      processedCardIds.push(card.id)
      processed++
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
    setsProcessed:           0,
    setsSkippedDueToTimeout: 0,
  }
}
