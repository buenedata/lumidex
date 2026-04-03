import { NextRequest, NextResponse } from 'next/server'
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
  let includeGraded: boolean | undefined

  try {
    const body = await req.json()
    setId          = body.setId         ?? undefined
    limit          = body.limit         ?? undefined
    includeGraded  = body.includeGraded ?? undefined
  } catch {
    // body may be empty / malformed — that's fine, all params are optional
  }

  // 3. Run the pipeline
  try {
    const result = await updatePricesBatch({
      setId,
      limit:         limit         ?? undefined,
      includeGraded: includeGraded ?? false,
    })

    // 4. Return success result
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
