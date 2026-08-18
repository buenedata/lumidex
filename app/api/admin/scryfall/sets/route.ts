import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'
import {
  fetchScryfallSets,
  deriveSetSeries,
  type ScryfallSetListing,
} from '@/lib/scryfall'

/**
 * GET /api/admin/scryfall/sets
 *
 * Returns Scryfall sets (expansion + core + masters) enriched with an
 * `already_imported` flag resolved from the Lumidex `sets` table.
 * Sorted newest → oldest.
 *
 * Query params:
 *   q      – name search (case-insensitive)
 *   limit  – max results to return (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.toLowerCase().trim() ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 500)

  try {
    // ── Fetch sets from Scryfall ───────────────────────────────────────────
    const scryfallSets = await fetchScryfallSets()

    // Apply name search filter
    const filtered = q
      ? scryfallSets.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q),
        )
      : scryfallSets

    const sliced = filtered.slice(0, limit)

    if (sliced.length === 0) {
      return NextResponse.json([])
    }

    // ── Check which sets are already imported ─────────────────────────────
    const codes = sliced.map((s) => s.code)

    const { data: importedSets, error } = await supabaseAdmin
      .from('sets')
      .select('api_set_id')
      .eq('game', 'mtg')
      .in('api_set_id', codes)

    if (error) {
      console.error('[scryfall/sets] DB lookup error:', error)
      // Non-fatal — continue without already_imported info
    }

    const importedCodes = new Set(
      (importedSets ?? []).map((s) => s.api_set_id).filter(Boolean),
    )

    // ── Build enriched response ───────────────────────────────────────────
    const result: ScryfallSetListing[] = sliced.map((s) => ({
      ...s,
      series: deriveSetSeries(s.set_type),
      already_imported: importedCodes.has(s.code),
    }))

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[scryfall/sets] Error:', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
