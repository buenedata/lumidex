// ─────────────────────────────────────────────────────────────────────────────
// app/api/admin/prices/sync-all-sets/route.ts
//
// POST /api/admin/prices/sync-all-sets
// Sequentially syncs singles + graded prices for every set that has a TCGGO
// episode ID (api_set_id IS NOT NULL).
//
// Sets are processed one-at-a-time (NOT in parallel) with a 200 ms delay
// between each to respect RapidAPI rate limits.
//
// NOTE: Vercel function timeout is 60 s. For large databases this endpoint may
// time out — run it multiple times if needed.  Each run is idempotent (upsert).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchEpisodeCards, buildPriceRows, batchUpsert } from '../sync-set/route'

const INTER_SET_DELAY_MS = 200

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST() {
  // ── 1. Load all sets with a TCGGO episode ID ──────────────────────────────
  const { data: sets, error: setsError } = await supabaseAdmin
    .from('sets')
    .select('set_id, api_set_id')
    .not('api_set_id', 'is', null)

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
      sets_skipped: 0,
      total_singles: 0,
      total_graded_rows: 0,
      note: 'No sets with api_set_id found',
    })
  }

  // ── 2. Process each set sequentially ─────────────────────────────────────
  let setsSynced       = 0
  let setsSkipped      = 0
  let totalSingles     = 0
  let totalGradedRows  = 0

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i] as { set_id: string; api_set_id: string }

    try {
      const allCards = await fetchEpisodeCards(set.api_set_id)
      const now      = new Date().toISOString()

      const allRows    = allCards.flatMap((card) => buildPriceRows(card, now))
      const singleRows = allRows.filter((r) => r.item_type === 'single')
      const gradedRows = allRows.filter((r) => r.item_type === 'graded')

      await batchUpsert(singleRows)
      await batchUpsert(gradedRows)

      totalSingles    += singleRows.length
      totalGradedRows += gradedRows.length
      setsSynced++
    } catch (err) {
      console.error(`[sync-all-sets] Failed for set ${set.set_id}:`, err)
      setsSkipped++
    }

    // Respect rate limits between sets (skip delay after the last set)
    if (i < sets.length - 1) {
      await new Promise((r) => setTimeout(r, INTER_SET_DELAY_MS))
    }
  }

  // ── 3. Return summary ─────────────────────────────────────────────────────
  return NextResponse.json({
    success:          true,
    sets_synced:      setsSynced,
    sets_skipped:     setsSkipped,
    total_singles:    totalSingles,
    total_graded_rows: totalGradedRows,
  })
}
