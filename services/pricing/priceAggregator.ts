import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { CardPriceUpdate } from './types'

/** Compute the arithmetic mean of an array of numbers. Returns null for empty arrays. */
function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Return the minimum value of an array. Returns null for empty arrays. */
function minimum(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.min(...values)
}

/**
 * For a given cardId, read recent price_points (last 24 hours) and compute
 * aggregated values to write to card_prices.
 *
 * TCGPlayer ungraded:
 *   normal   → tcgp_normal  (average)
 *   reverse  → tcgp_reverse_holo (average)
 *   holo     → tcgp_holo (average)
 *   tcgp_market = holo ?? reverse ?? normal
 *
 * TCGPlayer graded:
 *   PSA 10  → tcgp_psa10
 *   PSA 9   → tcgp_psa9
 *
 * CardMarket ungraded (normal variant):
 *   cm_avg_sell = average
 *   cm_low      = minimum
 *   cm_trend    = most-recent price
 *
 * Note: eBay graded prices (PSA/CGC/ACE) are stored in card_graded_prices,
 * not in card_prices. The aggregator only handles TCGPlayer and CardMarket data.
 */
export async function aggregatePricesForCard(cardId: string): Promise<CardPriceUpdate> {
  const supabase = await createSupabaseServerClient()

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('price_points')
    .select('source, variant_key, price, is_graded, grade, grading_company, recorded_at')
    .eq('card_id', cardId)
    .gte('recorded_at', since)

  if (error) {
    console.error(`[PriceAggregator] aggregatePricesForCard(${cardId}): fetch error:`, error.message)
    return { cardId }
  }

  const rows = data ?? []

  // ── TCGPlayer ungraded ───────────────────────────────────────────────────
  const tcgpUngraded = rows.filter(r => r.source === 'tcgplayer' && !r.is_graded)

  const tcgpNormalPrices  = tcgpUngraded.filter(r => r.variant_key === 'normal').map(r => r.price as number)
  const tcgpReversePrices = tcgpUngraded.filter(r => r.variant_key === 'reverse').map(r => r.price as number)
  const tcgpHoloPrices    = tcgpUngraded.filter(r => r.variant_key === 'holo').map(r => r.price as number)

  const tcgp_normal       = average(tcgpNormalPrices)
  const tcgp_reverse_holo = average(tcgpReversePrices)
  const tcgp_holo         = average(tcgpHoloPrices)
  const tcgp_market       = tcgp_holo ?? tcgp_reverse_holo ?? tcgp_normal ?? null

  // ── TCGPlayer graded ─────────────────────────────────────────────────────
  const tcgpGraded = rows.filter(r => r.source === 'tcgplayer' && r.is_graded)

  const tcgpPsa10Prices = tcgpGraded
    .filter(r => r.grade === 10 && r.grading_company === 'PSA')
    .map(r => r.price as number)
  const tcgpPsa9Prices = tcgpGraded
    .filter(r => r.grade === 9 && r.grading_company === 'PSA')
    .map(r => r.price as number)

  const tcgp_psa10 = average(tcgpPsa10Prices)
  const tcgp_psa9  = average(tcgpPsa9Prices)

  // ── CardMarket ungraded (normal variant) ─────────────────────────────────
  const cmNormalRows = rows
    .filter(r => r.source === 'cardmarket' && !r.is_graded && r.variant_key === 'normal')
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())

  const cmNormalPrices = cmNormalRows.map(r => r.price as number)

  const cm_avg_sell = average(cmNormalPrices)
  const cm_low      = minimum(cmNormalPrices)
  const cm_trend    = cmNormalRows.length > 0 ? (cmNormalRows[0].price as number) : null

  // ── CardMarket ungraded (reverse holo variant) ────────────────────────────
  const cmReverseRows = rows
    .filter(r => r.source === 'cardmarket' && !r.is_graded && r.variant_key === 'reverse')
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())

  const cmReversePrices = cmReverseRows.map(r => r.price as number)

  const cm_reverse_holo = average(cmReversePrices)

  return {
    cardId,
    tcgp_normal,
    tcgp_reverse_holo,
    tcgp_holo,
    tcgp_market,
    tcgp_psa10,
    tcgp_psa9,
    cm_avg_sell,
    cm_low,
    cm_trend,
    cm_reverse_holo,
    // cm_avg_30d not computed here — requires wider time window; leave undefined
    // cm_url is not in price_points; it is set directly by the job runner
  }
}

/**
 * Write a CardPriceUpdate to card_prices using upsert on card_id.
 * Only updates the columns listed in CardPriceUpdate plus fetched_at.
 * Never alters the structure of card_prices.
 * Logs errors but does not throw.
 */
export async function writeCardPriceCache(update: CardPriceUpdate): Promise<void> {
  const supabase = await createSupabaseServerClient()

  // Build the upsert payload — only include defined (non-undefined) fields
  const payload: Record<string, unknown> = {
    card_id: update.cardId,
    fetched_at: new Date().toISOString(),
  }

  if (update.tcgp_normal       !== undefined) payload.tcgp_normal       = update.tcgp_normal
  if (update.tcgp_reverse_holo !== undefined) payload.tcgp_reverse_holo = update.tcgp_reverse_holo
  if (update.tcgp_holo         !== undefined) payload.tcgp_holo         = update.tcgp_holo
  if (update.tcgp_1st_edition  !== undefined) payload.tcgp_1st_edition  = update.tcgp_1st_edition
  if (update.tcgp_market       !== undefined) payload.tcgp_market       = update.tcgp_market
  if (update.tcgp_psa10        !== undefined) payload.tcgp_psa10        = update.tcgp_psa10
  if (update.tcgp_psa9         !== undefined) payload.tcgp_psa9         = update.tcgp_psa9
  if (update.cm_avg_sell       !== undefined) payload.cm_avg_sell       = update.cm_avg_sell
  if (update.cm_low            !== undefined) payload.cm_low            = update.cm_low
  if (update.cm_trend          !== undefined) payload.cm_trend          = update.cm_trend
  if (update.cm_avg_30d        !== undefined) payload.cm_avg_30d        = update.cm_avg_30d
  if (update.cm_reverse_holo   !== undefined) payload.cm_reverse_holo   = update.cm_reverse_holo
  if (update.cm_url            !== undefined) payload.cm_url            = update.cm_url

  const { error } = await supabase
    .from('card_prices')
    .upsert(payload, { onConflict: 'card_id' })

  if (error) {
    console.error(
      `[PriceAggregator] writeCardPriceCache(${update.cardId}): upsert failed:`,
      error.message
    )
  }
}
