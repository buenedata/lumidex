// ─────────────────────────────────────────────────────────────────────────────
// app/api/analytics/portfolio-history/route.ts
//
// GET /api/analytics/portfolio-history?range=7d|30d|90d|1y
//
// Returns the authenticated Pro user's collection value snapshot history for
// the requested date range, plus a change summary (first vs last snapshot).
//
// Behaviour:
//   - Lazily computes + upserts today's snapshot if it doesn't exist yet,
//     so the chart always includes an up-to-date data point on first load.
//   - Subsequent calls within the same calendar day skip the re-computation
//     (today's snapshot already exists → UNIQUE constraint = no-op path).
//
// Query params:
//   range  →  "7d" | "30d" | "90d" | "1y"   (default: "30d")
//
// Response shape:
//   {
//     snapshots: Array<{ date, totalValueEur, cardCount, setCount }>,
//     change:    { valueEur, changePercent, direction: 'up'|'down'|'flat' },
//     currency:  'EUR'
//   }
//
// Auth: Pro-only. Returns 402 { code: 'PRO_REQUIRED' } for free users.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSessionPro, ProRequiredError } from '@/lib/subscription'
import { computeCollectionSnapshot } from '@/lib/analytics'
import type { PortfolioHistoryPoint } from '@/lib/analytics'

// ─── Range helpers ────────────────────────────────────────────────────────────

type RangeParam = '7d' | '30d' | '90d' | '1y'
const VALID_RANGES = new Set<RangeParam>(['7d', '30d', '90d', '1y'])

function rangeToDays(range: RangeParam): number {
  switch (range) {
    case '7d':  return 7
    case '30d': return 30
    case '90d': return 90
    case '1y':  return 365
    default:    return 30
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. Auth + Pro gate ──────────────────────────────────────────────────────
  let user: Awaited<ReturnType<typeof requireSessionPro>>
  try {
    user = await requireSessionPro()
  } catch (err) {
    if (err instanceof ProRequiredError) {
      return NextResponse.json(
        { error: err.message, code: 'PRO_REQUIRED' },
        { status: 402 },
      )
    }
    throw err
  }

  // 2. Parse range param ────────────────────────────────────────────────────
  const rawRange = req.nextUrl.searchParams.get('range') ?? '30d'
  const range = VALID_RANGES.has(rawRange as RangeParam)
    ? (rawRange as RangeParam)
    : '30d'
  const days = rangeToDays(range)

  // 3. Lazily create today's snapshot if it doesn't exist yet ───────────────
  // This ensures the chart always has an up-to-date data point when the page
  // loads, without requiring the frontend to fire a separate snapshot POST.
  const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"

  const { data: todaySnapshot, error: checkError } = await supabaseAdmin
    .from('collection_value_snapshots')
    .select('id')
    .eq('user_id', user.id)
    .eq('snapshot_date', today)
    .maybeSingle()

  if (checkError) {
    console.error('[analytics/portfolio-history] snapshot check failed:', checkError)
    // Non-fatal — continue to query existing snapshots even if today's check fails
  }

  if (!todaySnapshot) {
    try {
      await computeCollectionSnapshot(user.id)
    } catch (snapErr) {
      // Non-fatal: log but continue. The chart can still render past snapshots.
      console.error('[analytics/portfolio-history] lazy snapshot failed:', snapErr)
    }
  }

  // 4. Query snapshot history for the requested range ───────────────────────
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10) // "YYYY-MM-DD"

  const { data: snapshotRows, error: historyError } = await supabaseAdmin
    .from('collection_value_snapshots')
    .select('snapshot_date, total_value_eur, card_count, set_count')
    .eq('user_id', user.id)
    .gte('snapshot_date', cutoffDate)
    .order('snapshot_date', { ascending: true })

  if (historyError) {
    console.error('[analytics/portfolio-history] history query failed:', historyError)
    return NextResponse.json({ error: historyError.message }, { status: 500 })
  }

  const snapshots: PortfolioHistoryPoint[] = (snapshotRows ?? []).map((row) => ({
    date: row.snapshot_date as string,
    totalValueEur: row.total_value_eur as number,
    cardCount: row.card_count as number,
    setCount: row.set_count as number,
  }))

  // 5. Compute change between first and last snapshot ───────────────────────
  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]

  let valueEur = 0
  let changePercent = 0
  let direction: 'up' | 'down' | 'flat' = 'flat'

  if (first && last && first !== last) {
    valueEur = Math.round((last.totalValueEur - first.totalValueEur) * 100) / 100
    changePercent =
      first.totalValueEur > 0
        ? Math.round(((last.totalValueEur - first.totalValueEur) / first.totalValueEur) * 10000) /
          100
        : 0
    direction = valueEur > 0 ? 'up' : valueEur < 0 ? 'down' : 'flat'
  }

  return NextResponse.json({
    snapshots,
    change: { valueEur, changePercent, direction },
    currency: 'EUR' as const,
  })
}
