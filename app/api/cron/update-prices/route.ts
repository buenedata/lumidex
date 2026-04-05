import { NextRequest, NextResponse } from 'next/server'
import { getSetsForPricing } from '@/services/pricing/setTierService'
import { updatePricesBatch } from '@/services/pricing/pricingOrchestrator'

/**
 * POST /api/cron/update-prices
 *
 * Triggered 3× per night by Vercel Cron (vercel.json):
 *   01:00 UTC  (03:00 Oslo)
 *   02:00 UTC  (04:00 Oslo)
 *   03:00 UTC  (05:00 Oslo)
 *
 * Each run:
 *  1. Guards that we are inside the nighttime window (21:00–05:00 UTC).
 *     Pass ?force=true to bypass (admin/testing only).
 *  2. Fetches the priority-ordered list of sets due for a price update:
 *       - Current series + previous series → 24-hour update interval
 *       - All older series → 48-hour update interval
 *  3. Processes them in order within a 270-second time budget.
 *     eBay graded prices (PSA 9/10 and CGC 9/10) are always included.
 *  4. After each set completes, sets.prices_last_synced_at is updated
 *     so that set is skipped by subsequent runs until its interval elapses.
 *
 * Security
 * --------
 * When triggered by Vercel Cron, the platform automatically injects the
 * `Authorization: Bearer <CRON_SECRET>` header.  Manual HTTP callers must
 * include the same header.
 *
 * Vercel Pro serverless function limit: 300 seconds.
 */
export const maxDuration = 300

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when the current UTC hour falls inside the nighttime window.
 * Window: 21:00 – 04:59 UTC  (23:00 – 06:59 Oslo / UTC+2)
 */
function isNighttimeUTC(): boolean {
  const hour = new Date().getUTCHours() // 0–23
  // 21, 22, 23, 0, 1, 2, 3, 4
  return hour >= 21 || hour <= 4
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Authorization
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Nighttime window guard
  const force = req.nextUrl.searchParams.get('force') === 'true'
  if (!force && !isNighttimeUTC()) {
    const utcHour = new Date().getUTCHours()
    console.log(`[cron/update-prices] Outside nighttime window (UTC hour=${utcHour}). Skipping.`)
    return NextResponse.json({
      ok:      true,
      skipped: true,
      reason:  `Outside nighttime window (UTC hour=${utcHour}). Pass ?force=true to override.`,
    })
  }

  // 3. Find sets due for update
  let dueSets: Awaited<ReturnType<typeof getSetsForPricing>>
  try {
    dueSets = await getSetsForPricing()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/update-prices] getSetsForPricing failed:', message)
    return NextResponse.json({ error: `Failed to load sets: ${message}` }, { status: 500 })
  }

  if (dueSets.length === 0) {
    console.log('[cron/update-prices] No sets due for update.')
    return NextResponse.json({ ok: true, message: 'No sets due for update', setsProcessed: 0 })
  }

  const setIds = dueSets.map(s => s.set_id)
  console.log(
    `[cron/update-prices] ${setIds.length} sets due: ` +
    `${dueSets.filter(s => s.tier === 'recent').length} recent, ` +
    `${dueSets.filter(s => s.tier === 'older').length} older.`
  )

  // 4. Run the pricing pipeline
  try {
    const result = await updatePricesBatch({
      setIds,
      includeGraded:  true,
      timeBudgetMs:   270_000,
    })

    return NextResponse.json({
      ok:                      true,
      setsQueued:              setIds.length,
      setsProcessed:           result.setsProcessed,
      setsSkippedDueToTimeout: result.setsSkippedDueToTimeout,
      cardsProcessed:          result.processed,
      errors:                  result.errors,
      gradedPointsSaved:       result.gradedPointsSaved,
      undervaluedFound:        result.undervaluedFound,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/update-prices] updatePricesBatch failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
