import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { runPriceUpdateJob } from '@/services/pricing/pricingJobRunner'

/**
 * POST /api/admin/sync/prices
 *
 * Admin-protected endpoint to trigger the full pricing pipeline.
 * Accepts optional body: { setId?, limit? }
 */
export const maxDuration = 300

export async function POST(req: NextRequest) {
  // 1. Authenticate — throws if not an authenticated admin
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  // 2. Parse body — all fields are optional
  let setId: string | undefined
  let limit: number | undefined

  try {
    const body = await req.json()
    setId = body.setId ?? undefined
    limit = body.limit ?? undefined
  } catch {
    // body may be empty / malformed — all params are optional
  }

  // 3. Run the pipeline
  try {
    const result = await runPriceUpdateJob({ setId, limit })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
