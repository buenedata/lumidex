import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/admin'
import { updatePricesBatch } from '@/services/pricing/pricingOrchestrator'

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
    // body may be empty / malformed — that's fine, all params are optional
  }

  // 3. Run the pipeline
  try {
    const result = await updatePricesBatch({
      setId,
      limit: limit ?? undefined,
    })

    // 4. Bust the Next.js Data Cache so the set page immediately reflects the
    //    new prices rather than serving the pre-sync cached-empty result.
    //    revalidateTag('prices') covers the global tag; set-specific tag covers
    //    getCardPricesForSet() which is keyed by setId.
    revalidateTag('prices', { expire: 0 })
    if (setId) revalidateTag(`set-prices:${setId}`, { expire: 0 })

    // 5. Return success result
    return NextResponse.json({
      ok:               true,
      processed:        result.processed,
      errors:           result.errors,
      undervaluedFound: result.undervaluedFound,
    })
  } catch (err) {
    // 5. Internal error
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
