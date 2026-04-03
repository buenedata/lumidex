import { NextRequest, NextResponse } from 'next/server'
import { runPriceUpdateJob } from '@/services/pricing/pricingJobRunner'

// Triggered every 24 hours by external cron (e.g. Vercel Cron, GitHub Actions, or cron-job.org)
// Protected by a secret header, Authorization Bearer token, or query param
export async function GET(req: NextRequest) {
  const secret =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.nextUrl.searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runPriceUpdateJob({ limit: 20, includeGraded: true })
  return NextResponse.json({ ok: true, ...result })
}
