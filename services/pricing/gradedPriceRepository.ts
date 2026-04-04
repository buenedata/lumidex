/**
 * Graded Price Repository
 *
 * Handles persistence of eBay graded price data to the card_graded_prices table.
 * Uses upsert on (card_id, grading_company, grade) so repeated syncs update
 * prices in place rather than appending duplicate rows.
 */

import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { EbayGradedResult } from './types';

/**
 * Upsert an array of eBay graded results into card_graded_prices.
 * One row per (card_id, grading_company, grade). Existing rows are updated
 * with new avg_price_usd, sample_size and fetched_at.
 *
 * Inserts in batches of 100. Logs errors but does not throw.
 */
export async function upsertGradedPrices(results: EbayGradedResult[]): Promise<void> {
  if (results.length === 0) return;

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const rows = results.map(r => ({
    card_id:         r.cardId,
    grading_company: r.gradingCompany,
    grade:           r.grade,
    avg_price_usd:   r.average,
    sample_size:     r.sampleSize,
    fetched_at:      now,
  }));

  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('card_graded_prices')
      .upsert(batch, { onConflict: 'card_id,grading_company,grade' });

    if (error) {
      console.error(
        `[gradedPriceRepository] upsertGradedPrices: batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
        error.message
      );
    }
  }
}
