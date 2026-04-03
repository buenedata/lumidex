import { NextRequest, NextResponse } from 'next/server'
import { runPriceUpdateJob } from '@/services/pricing/pricingJobRunner'

/**
 * POST /api/cron/update-prices
 *
 * Triggered every 12 hours by an external cron (Vercel Cron, GitHub Actions, cron-job.org, etc.).
 * Protected by Authorization: Bearer <CRON_SECRET> header.
 *
 * Vercel Pro allows up to 300 seconds for this function.
 */
export const maxDuration = 300

export async function POST(req: NextRequest) {
  // 1. Guard — CRON_SECRET must be configured
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  // 2. Validate Authorization header
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 3. Run the job
  try {
    const result = await runPriceUpdateJob()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
