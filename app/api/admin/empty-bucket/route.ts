/**
 * POST /api/admin/empty-bucket
 *
 * Admin-only SSE route that deletes every file in a storage bucket in
 * batches, streaming live progress to the browser, then optionally nulls
 * the matching image column in the database.
 *
 * Body: {
 *   bucket: 'card-images' | 'product-images' | 'set-images'
 *   clearDbUrls?: boolean   // default true
 * }
 *
 * SSE event shapes
 * ─────────────────
 *  { type: 'start',    payload: { total: number } }
 *  { type: 'progress', payload: { deleted: number; total: number } }
 *  { type: 'complete', payload: { deleted: number; dbRowsCleared: number } }
 *  { type: 'error',    payload: { message: string } }
 */

import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED_BUCKETS = ['card-images', 'product-images', 'set-images', 'set-symbols'] as const
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number]

const PAGE_SIZE  = 1000
const BATCH_SIZE = 100

function sseData(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

async function listAllPaths(bucket: AllowedBucket): Promise<string[]> {
  const paths: string[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list('', { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`list() failed: ${error.message}`)
    if (!data || data.length === 0) break
    paths.push(
      ...data
        .filter((f) => f.name && f.name !== '.emptyFolderPlaceholder' && !f.name.endsWith('/'))
        .map((f) => f.name),
    )
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return paths
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let body: { bucket?: string; clearDbUrls?: boolean }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const bucket = body.bucket as AllowedBucket | undefined
  const clearDbUrls = body.clearDbUrls !== false

  if (!bucket || !ALLOWED_BUCKETS.includes(bucket)) {
    return new Response(
      JSON.stringify({ error: `bucket must be one of: ${ALLOWED_BUCKETS.join(', ')}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: unknown) => {
        try { controller.enqueue(sseData(payload)) } catch { /* client disconnected */ }
      }

      try {
        // 1. List all files first so we know the total
        const paths = await listAllPaths(bucket)
        const total = paths.length
        emit({ type: 'start', payload: { total } })

        // 2. Delete in batches, streaming progress after each
        let deleted = 0
        for (let i = 0; i < paths.length; i += BATCH_SIZE) {
          const batch = paths.slice(i, i + BATCH_SIZE)
          const { error } = await supabaseAdmin.storage.from(bucket).remove(batch)
          if (error) throw new Error(`remove() batch failed: ${error.message}`)
          deleted += batch.length
          emit({ type: 'progress', payload: { deleted, total } })
        }

        // 3. Clear DB image URLs
        let dbRowsCleared = 0
        if (clearDbUrls && deleted > 0) {
          if (bucket === 'card-images') {
            const { error } = await supabaseAdmin
              .from('cards')
              .update({ image: null })
              .not('image', 'is', null)
            if (error) throw new Error(`DB clear failed (cards): ${error.message}`)
          } else if (bucket === 'product-images') {
            const { error } = await supabaseAdmin
              .from('set_products')
              .update({ image_url: null })
              .not('image_url', 'is', null)
            if (error) throw new Error(`DB clear failed (set_products): ${error.message}`)
          } else if (bucket === 'set-images') {
            const { error } = await supabaseAdmin
              .from('sets')
              .update({ logo_url: null })
              .not('logo_url', 'is', null)
            if (error) throw new Error(`DB clear failed (sets): ${error.message}`)
          }
          dbRowsCleared = deleted // approximate; one DB row per storage file
        }

        emit({ type: 'complete', payload: { deleted, dbRowsCleared } })
      } catch (err) {
        emit({
          type: 'error',
          payload: { message: err instanceof Error ? err.message : 'Unexpected error' },
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
