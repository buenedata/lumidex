import { supabaseAdmin } from '@/lib/supabase'
import { NormalizedPricePoint } from './types'
import { toUsd } from './priceNormalizer'

/**
 * Save an array of normalized price points to the price_points table.
 * Each point maps to one row. Uses INSERT (not upsert) since price_points is append-only.
 * Inserts in batches of 100 to avoid payload limits.
 * Logs errors but does not throw — partial saves are acceptable.
 */
export async function savePricePoints(points: NormalizedPricePoint[]): Promise<void> {
  if (points.length === 0) return

  const supabase = supabaseAdmin
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

  const supabase = supabaseAdmin
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

// ── Backfill types ────────────────────────────────────────────────────────────

export interface BackfillPricePoint {
  cardId:     string
  variantKey: string
  /** Numeric price in the given currency */
  price:      number
  /** 'USD' or 'EUR' — EUR prices are converted to USD before saving */
  currency:   string
  source:     string
  /** Explicit ISO 8601 date string — e.g. "2026-03-26" or "2026-03-26T00:00:00Z" */
  recordedAt: string
}

/**
 * Insert historical price points into card_price_history using the ACTUAL
 * historical dates supplied by the tcggo history-prices API (not `now()`).
 *
 * Uses INSERT (not upsert) so duplicate-protection is caller's responsibility.
 * Duplicate rows for the same card+date+source are benign for the price chart
 * (duplicates just add small noise when averaging), but callers should pass
 * only NEW data to keep the table clean.
 *
 * EUR prices are converted to USD using the same exchange rate as priceNormalizer.
 * Inserts in batches of 100.
 */
export async function savePriceHistoryBackfill(points: BackfillPricePoint[]): Promise<void> {
  if (points.length === 0) return

  const supabase = supabaseAdmin

  const rows = points.map(p => ({
    card_id:     p.cardId,
    variant_key: p.variantKey,
    price_usd:   toUsd(p.price, p.currency),
    source:      p.source,
    recorded_at: p.recordedAt.length === 10
      // "YYYY-MM-DD" → store as midnight UTC so it's a clean day boundary
      ? `${p.recordedAt}T00:00:00Z`
      : p.recordedAt,
    is_graded:   false,
  }))

  const BATCH_SIZE = 100
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('card_price_history').insert(batch)
    if (error) {
      console.error(
        `[PriceRepository] savePriceHistoryBackfill: batch ${i / BATCH_SIZE + 1} failed:`,
        error.message
      )
    }
  }
}
