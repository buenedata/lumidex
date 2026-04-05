import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { getAllSetsForBulkSeed, getSetsForPricing } from '@/services/pricing/setTierService'
import { updatePricesBatch } from '@/services/pricing/pricingOrchestrator'

/**
 * POST /api/admin/sync/prices/bulk
 *
 * Admin-authenticated endpoint to trigger a fast bulk price seed using the
 * Pokémon TCG API only (TCGPlayer + CardMarket prices per card).
 *
 * eBay graded pricing is excluded by default so each set completes in
 * ~5–15 seconds rather than ~3 minutes. eBay graded prices are populated
 * by the nightly cron once TCG API prices are in place.
 *
 * Call this endpoint repeatedly until `remaining === 0` to populate all sets.
 * Each call processes as many sets as it can within 270 seconds.
 *
 * Body (all optional):
 *   forceAll    boolean  — process every set, ignoring prices_last_synced_at (default: false)
 *   concurrency number   — cards processed in parallel per set (default: 5)
 *   setsPerRun  number   — max sets to process per call (default: 3)
 *                          Keep low so the client receives progress updates quickly.
 *
 * Response:
 *   setsQueued     — how many sets were ready to process this run
 *   setsProcessed  — how many sets were fully completed
 *   remaining      — sets still unsynced (call again to continue)
 *   cardsProcessed — total card price rows updated
 *   errors         — number of card-level errors
 */
export const maxDuration = 300

export async function POST(req: NextRequest) {
  // 1. Admin auth
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  // 2. Parse body
  let forceAll    = false
  let concurrency = 5
  let setsPerRun  = 3

  try {
    const body = await req.json()
    forceAll    = body.forceAll    === true
    concurrency = typeof body.concurrency === 'number' ? body.concurrency : 5
    setsPerRun  = typeof body.setsPerRun  === 'number' ? body.setsPerRun  : 3
  } catch {
    // body is optional
  }

  // 3. Determine which sets to process
  const dueSets = forceAll
    ? await getAllSetsForBulkSeed()        // ALL sets regardless of last sync
    : await getSetsForPricing()           // only sets that are actually due

  if (dueSets.length === 0) {
    return NextResponse.json({
      ok:            true,
      message:       forceAll
        ? 'No sets found in database.'
        : 'All sets are up-to-date. Pass forceAll: true to re-seed anyway.',
      setsQueued:    0,
      setsProcessed: 0,
      remaining:     0,
      cardsProcessed: 0,
      errors:        0,
    })
  }

  // Slice: only process setsPerRun sets this call; the rest are "remaining"
  const setsToProcess = dueSets.slice(0, setsPerRun)
  const setIds        = setsToProcess.map(s => s.set_id)
  // remaining = sets that are due but won't be processed this call
  const remainingAfterRun = Math.max(0, dueSets.length - setsPerRun)

  const tierSummary = `${dueSets.filter(s => s.tier === 'recent').length} recent, ${dueSets.filter(s => s.tier === 'older').length} older`

  console.log(
    `[admin/sync/prices/bulk] Run: ${setIds.length}/${dueSets.length} sets this call ` +
    `(${tierSummary}), concurrency=${concurrency}, forceAll=${forceAll}`
  )

  // 4. Run the fast TCG-API-only pipeline
  try {
    const result = await updatePricesBatch({
      setIds,
      includeGraded:  false,   // eBay graded runs during nightly cron
      includeEbayRaw: false,   // eBay raw not aggregated into card_prices at all
      concurrency,
      timeBudgetMs:   270_000,
    })

    // Recalculate remaining: any sets skipped due to timeout are also remaining
    const remaining = remainingAfterRun + result.setsSkippedDueToTimeout

    return NextResponse.json({
      ok:            true,
      setsQueued:    dueSets.length,
      setsProcessed: result.setsProcessed,
      remaining,
      cardsProcessed: result.processed,
      errors:        result.errors,
      message: remaining > 0
        ? `${result.setsProcessed} sets done. ${remaining} remaining — continuing…`
        : `All sets seeded! ${result.setsProcessed} sets · ${result.processed} cards updated.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/sync/prices/bulk] updatePricesBatch failed:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
