import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { syncSingleCard } from '@/services/pricing/pricingJobRunner'

/**
 * POST /api/admin/sync/card/[cardId]
 *
 * Admin-protected endpoint to run the full pricing pipeline for a single card.
 * Returns: { ok, cardId, pricePointsSaved, aggregated }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  // 1. Authenticate — throws if not an authenticated admin
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  // 2. Validate route param
  const { cardId } = await params
  if (!cardId) {
    return NextResponse.json({ ok: false, error: 'Missing cardId' }, { status: 400 })
  }

  // 3. Sync the single card
  try {
    const result = await syncSingleCard(cardId)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
