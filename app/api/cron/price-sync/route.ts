// ─────────────────────────────────────────────────────────────────────────────
// app/api/cron/price-sync/route.ts
//
// GET /api/cron/price-sync
// Triggered by cron-job.org on a schedule (e.g. every hour).
// Requires:  Authorization: Bearer <CRON_SECRET>
//
// Each invocation picks the SETS_PER_RUN sets most overdue for a price
// refresh (NULL prices_last_synced_at first) that have a TCGGO episode ID,
// fetches their full card list via the bulk episode endpoint, upserts all
// prices, and stamps prices_last_synced_at on each set.
//
// Bulk fetching (1-2 API calls per set, 100 cards/call) keeps each invocation
// well within Vercel Hobby's 10-second function limit.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  fetchEpisodeCards,
  buildPriceRows,
  batchUpsert,
} from '../../admin/prices/sync-set/route'

// Process this many sets per invocation — 5 sets ≈ 1.5–3 s, safe under 10 s.
const SETS_PER_RUN = 5

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Pick the most-overdue sets ───────────────────────────────────────────────
  const { data: sets, error: setsError } = await supabaseAdmin
    .from('sets')
    .select('set_id, api_set_id, prices_last_synced_at')
    .not('api_set_id', 'is', null)
    .order('prices_last_synced_at', { ascending: true, nullsFirst: true })
    .limit(SETS_PER_RUN)

  if (setsError) {
    return NextResponse.json(
      { error: 'Failed to query sets', detail: setsError.message },
      { status: 500 },
    )
  }

  if (!sets || sets.length === 0) {
    return NextResponse.json({
      success: true,
      sets_synced: 0,
      note: 'No sets with api_set_id found',
    })
  }

  // ── Sync each set ────────────────────────────────────────────────────────────
  let setsSynced      = 0
  let setsSkipped     = 0
  let totalSingles    = 0
  let totalGradedRows = 0

  for (const set of sets as Array<{ set_id: string; api_set_id: string }>) {
    try {
      const allCards = await fetchEpisodeCards(set.api_set_id)
      const now      = new Date().toISOString()

      const allRows    = allCards.flatMap((card) => buildPriceRows(card, now))
      const singleRows = allRows.filter((r) => r.item_type === 'single')
      const gradedRows = allRows.filter((r) => r.item_type === 'graded')

      await batchUpsert(singleRows)
      await batchUpsert(gradedRows)

      // Stamp the set so it moves to the back of the queue
      await supabaseAdmin
        .from('sets')
        .update({ prices_last_synced_at: now })
        .eq('set_id', set.set_id)

      totalSingles    += singleRows.length
      totalGradedRows += gradedRows.length
      setsSynced++

      console.log(
        `[cron/price-sync] Synced set ${set.set_id} — ` +
        `singles: ${singleRows.length}, graded rows: ${gradedRows.length}`,
      )
    } catch (err) {
      console.error(`[cron/price-sync] Failed for set ${set.set_id}:`, err)
      setsSkipped++
    }
  }

  return NextResponse.json({
    success:          true,
    sets_synced:      setsSynced,
    sets_skipped:     setsSkipped,
    total_singles:    totalSingles,
    total_graded_rows: totalGradedRows,
  })
}
