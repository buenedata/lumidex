// ─────────────────────────────────────────────────────────────────────────────
// app/api/analytics/portfolio-snapshot/route.ts
//
// POST /api/analytics/portfolio-snapshot
//
// Computes (or refreshes) today's collection value snapshot for the
// authenticated Pro user and upserts it into collection_value_snapshots.
//
// Called explicitly when the client wants a fresh snapshot (e.g. after the
// user updates their collection). The portfolio-history route also triggers
// this lazily on first load of each calendar day.
//
// Response shape:
//   { date: "YYYY-MM-DD", totalValueEur: number, cardCount: number, setCount: number }
//
// Auth: Pro-only. Returns 402 { code: 'PRO_REQUIRED' } for free users.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { requireSessionPro, ProRequiredError } from '@/lib/subscription'
import { computeCollectionSnapshot } from '@/lib/analytics'

export async function POST() {
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

  // 2. Compute + upsert today's snapshot ───────────────────────────────────
  let snapshot: Awaited<ReturnType<typeof computeCollectionSnapshot>>
  try {
    snapshot = await computeCollectionSnapshot(user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[analytics/portfolio-snapshot] computeCollectionSnapshot failed:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 3. Return the snapshot ──────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"

  return NextResponse.json({
    date: today,
    totalValueEur: snapshot.totalValueEur,
    cardCount: snapshot.cardCount,
    setCount: snapshot.setCount,
  })
}
