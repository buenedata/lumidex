import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getItemPrice } from '@/lib/price_service'

type StaleItem = {
  item_id: string
  item_type: string
  variant: string
  updated_at: string
}

const BATCH_SIZE = 50
const BATCH_DELAY_MS = 750

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runDailyPriceSync(): Promise<{
  checked: number
  updated: number
  skipped: number
  failed: number
}> {
  const { data, error } = await supabaseAdmin
    .from('item_prices')
    .select('item_id, item_type, variant, updated_at')
    .lt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('updated_at', { ascending: true })
    .limit(500)

  if (error) {
    throw new Error(`Failed to query stale items: ${error.message}`)
  }

  const items: StaleItem[] = data ?? []
  console.log(`[price-sync] Found ${items.length} stale items to refresh`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (let batchStart = 0; batchStart < items.length; batchStart += BATCH_SIZE) {
    const batch = items.slice(batchStart, batchStart + BATCH_SIZE)
    const isLastBatch = batchStart + BATCH_SIZE >= items.length

    for (const item of batch) {
      try {
        const result = await getItemPrice(
          item.item_id,
          item.item_type as 'single' | 'graded' | 'product',
          item.variant
        )
        if (result.price !== null) {
          updated++
        } else {
          skipped++
        }
      } catch (err) {
        failed++
        console.error(`[price-sync] Error processing item ${item.item_id}:`, err)
      }
    }

    if (!isLastBatch) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  const checked = items.length
  console.log(
    `[price-sync] Complete — checked: ${checked}, updated: ${updated}, skipped: ${skipped}, failed: ${failed}`
  )

  return { checked, updated, skipped, failed }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { checked, updated, skipped, failed } = await runDailyPriceSync()

  return NextResponse.json({ success: true, checked, updated, skipped, failed })
}
