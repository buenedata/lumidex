import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { runPriceUpdateJob } from '@/services/pricing/pricingJobRunner'
import { importProductPricing } from '@/services/pricing/productPricingService'

// Allow Vercel Pro functions to run up to 300s (hobby capped at 10s)
export const maxDuration = 300

// ── SSE helper ────────────────────────────────────────────────────────────────

function sseData(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log('[prices/sync] POST handler invoked')

  // 1. Auth guard
  try {
    await requireAdmin()
    console.log('[prices/sync] Auth OK')
  } catch (err) {
    console.log('[prices/sync] Auth FAILED:', err instanceof Error ? err.message : err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 2. Parse body
  let body: { setId?: string; apiSetId?: string | number }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const setId = body.setId?.trim()

  if (!setId) {
    return new Response(JSON.stringify({ error: 'setId is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 3. Stream SSE
  // Use TransformStream + fire-and-forget IIFE so the async work is in-flight
  // BEFORE we return the Response.  With ReadableStream({ async start() }), Vercel
  // can terminate the serverless function before the async start() begins, producing
  // a 200 with an empty body.  The IIFE pattern guarantees the writer is already
  // active when the client starts reading.
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  const emit = (payload: unknown) => {
    try { void writer.write(sseData(payload)) } catch { /* disconnected */ }
  }

  // ⬇ fire-and-forget: MUST be called before `return new Response(readable, ...)`
  ;(async () => {
    console.log('[prices/sync] Sync worker started — setId:', setId)
    const startTime = Date.now()

    // Capture apiSetId for product pricing (parsed before the worker fires)
    const apiSetId = body.apiSetId

    try {
      // Emit start event
      emit({
        type:    'start',
        setId,
        message: `Starting price sync for set "${setId}"…`,
      })

      // Emit a fetching event so the UI shows "in progress"
      emit({
        type:    'fetching',
        message: `Running price update job for set "${setId}"…`,
        page:    1,
      })

      // Run the unified pricing pipeline (no limit → fetch all cards in the set)
      const result = await runPriceUpdateJob({ setId })

      // Optionally import sealed-product prices from the cardmarket RapidAPI
      let productCount = 0
      if (apiSetId) {
        emit({
          type:    'fetching',
          message: `Importing product prices for episode ${apiSetId}…`,
          page:    2,
        })
        try {
          const productResult = await importProductPricing({ episodeId: apiSetId, setId })
          productCount = productResult.productCount
          emit({ type: 'products', count: productCount })
        } catch (productErr) {
          console.error('[prices/sync] Product pricing import failed:', productErr)
          emit({ type: 'warning', message: 'Product price import failed — card prices were still saved' })
        }
      }

      const elapsed = Date.now() - startTime

      // Emit complete event — shape must match what page.tsx expects:
      //   event.upsertedCount → message line
      //   event.productCount  → message line + products state
      //   event.elapsed       → message line
      //   event.matched       → matched state
      //   event.unmatched     → total = matched + unmatched
      emit({
        type:          'complete',
        setId,
        matched:       result.processed,
        unmatched:     result.errors,
        upsertedCount: result.processed,
        productCount,
        backfillCount: 0,
        elapsed,
      })
    } catch (err) {
      emit({ type: 'error', message: err instanceof Error ? err.message : 'Unexpected error' })
    } finally {
      await writer.close().catch(() => {})
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
