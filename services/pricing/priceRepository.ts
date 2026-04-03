import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { NormalizedPricePoint } from './types'

/**
 * Save an array of normalized price points to the price_points table.
 * Each point maps to one row. Uses INSERT (not upsert) since price_points is append-only.
 * Inserts in batches of 100 to avoid payload limits.
 * Logs errors but does not throw — partial saves are acceptable.
 */
export async function savePricePoints(points: NormalizedPricePoint[]): Promise<void> {
  if (points.length === 0) return

  const supabase = await createSupabaseServerClient()
  const now = new Date().toISOString()

  const rows = points.map(point => ({
    card_id: point.cardId,
    source: point.source,
    variant_key: point.variantKey ?? null,
    price: point.priceUsd,
    currency: 'USD',
    condition: point.condition ?? null,
    is_graded: point.isGraded,
    grade: point.grade ?? null,
    grading_company: point.gradingCompany ?? null,
    recorded_at: now,
  }))

  const BATCH_SIZE = 100
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('price_points').insert(batch)
    if (error) {
      console.error(
        `[PriceRepository] savePricePoints: failed to insert batch ${i / BATCH_SIZE + 1}:`,
        error.message
      )
    }
  }
}

/**
 * Save a price point also to card_price_history for trend tracking.
 * Only saves TCGPlayer and CardMarket points (not eBay — too noisy for history).
 * Only saves non-graded points (graded history not needed currently).
 * Inserts in batches of 100 to avoid payload limits.
 */
export async function savePriceHistory(points: NormalizedPricePoint[]): Promise<void> {
  const historyPoints = points.filter(
    p => (p.source === 'tcgplayer' || p.source === 'cardmarket') && !p.isGraded
  )

  if (historyPoints.length === 0) return

  const supabase = await createSupabaseServerClient()
  const now = new Date().toISOString()

  const rows = historyPoints.map(point => ({
    card_id: point.cardId,
    variant_key: point.variantKey ?? 'normal',
    price_usd: point.priceUsd,
    source: point.source,
    recorded_at: now,
    is_graded: false,
    grade: null,
    grading_company: null,
  }))

  const BATCH_SIZE = 100
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('card_price_history').insert(batch)
    if (error) {
      console.error(
        `[PriceRepository] savePriceHistory: failed to insert batch ${i / BATCH_SIZE + 1}:`,
        error.message
      )
    }
  }
}
