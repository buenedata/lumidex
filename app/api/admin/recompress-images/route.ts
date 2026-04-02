/**
 * POST /api/admin/recompress-images
 *
 * Admin-only SSE route that walks every file in a storage bucket,
 * re-compresses it with sharp (WebP 82 %, max 500 px wide) and
 * re-uploads it in-place.  Streams granular progress events so the
 * browser UI can show a live log.
 *
 * Body: { bucket: 'card-images' | 'product-images' | 'set-images' }
 *
 * SSE event shapes
 * ─────────────────
 *  { type: 'start',    payload: { total: number } }
 *  { type: 'progress', payload: ProgressPayload }
 *  { type: 'complete', payload: { succeeded, skipped, failed, savedBytes } }
 *  { type: 'error',    payload: { message: string } }
 */

import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'
import { compressImageToWebP, COMPRESSED_CONTENT_TYPE } from '@/lib/imageCompress'

// ── Constants ─────────────────────────────────────────────────────────────────

const CONCURRENCY = 3
const PAGE_SIZE   = 1000   // Supabase max per list() call

const ALLOWED_BUCKETS = ['card-images', 'product-images', 'set-images'] as const
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number]

// ── Helpers ───────────────────────────────────────────────────────────────────

function sseData(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

interface StorageFile {
  name: string
  metadata?: { size?: number; mimetype?: string } | null
}

/** Recursively list all files in a bucket (handles >1 000 files via offset). */
async function listAllFiles(bucket: AllowedBucket): Promise<StorageFile[]> {
  const files: StorageFile[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list('', { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } })

    if (error) throw new Error(`Failed to list bucket "${bucket}": ${error.message}`)
    if (!data || data.length === 0) break

    // Filter out placeholder entries (empty-folder sentinels)
    const real = data.filter(
      (f) => f.name && f.name !== '.emptyFolderPlaceholder' && !f.name.endsWith('/'),
    )
    files.push(...real)

    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return files
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Admin guard
  try {
    await requireAdmin()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 2. Parse + validate body
  let body: { bucket?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const bucket = body.bucket as AllowedBucket | undefined
  if (!bucket || !ALLOWED_BUCKETS.includes(bucket)) {
    return new Response(
      JSON.stringify({ error: `bucket must be one of: ${ALLOWED_BUCKETS.join(', ')}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 3. Stream SSE
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: unknown) => {
        try { controller.enqueue(sseData(payload)) } catch { /* client disconnected */ }
      }

      try {
        // ── Discover all files ───────────────────────────────────────────────
        const allFiles = await listAllFiles(bucket)
        emit({ type: 'start', payload: { total: allFiles.length } })

        let succeeded  = 0
        let skipped    = 0
        let failed     = 0
        let savedBytes = 0

        // ── Per-file worker ──────────────────────────────────────────────────
        const processFile = async (file: StorageFile) => {
          try {
            // Download current bytes
            const { data: blob, error: dlErr } = await supabaseAdmin.storage
              .from(bucket)
              .download(file.name)

            if (dlErr || !blob) {
              throw new Error(`Download failed: ${dlErr?.message ?? 'no data returned'}`)
            }

            const originalBuffer = await blob.arrayBuffer()
            const originalBytes  = originalBuffer.byteLength

            // Compress
            const compressed = await compressImageToWebP(originalBuffer)
            const compressedBytes = compressed.byteLength

            // Skip if compression didn't actually help (e.g. already tiny WebP)
            if (compressedBytes >= originalBytes) {
              skipped++
              emit({
                type: 'progress',
                payload: {
                  filename: file.name,
                  status: 'skipped',
                  reason: 'already optimal',
                  originalBytes,
                  compressedBytes,
                },
              })
              return
            }

            // Re-upload in-place
            const { error: upErr } = await supabaseAdmin.storage
              .from(bucket)
              .upload(file.name, compressed, {
                contentType: COMPRESSED_CONTENT_TYPE,
                upsert: true,
              })

            if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

            const delta = originalBytes - compressedBytes
            savedBytes += delta
            succeeded++
            emit({
              type: 'progress',
              payload: {
                filename: file.name,
                status: 'success',
                originalBytes,
                compressedBytes,
                savedBytes: delta,
              },
            })
          } catch (err) {
            failed++
            emit({
              type: 'progress',
              payload: {
                filename: file.name,
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
              },
            })
          }
        }

        // ── Concurrency pool ─────────────────────────────────────────────────
        const queue: StorageFile[] = [...allFiles]
        const worker = async () => {
          while (queue.length > 0) {
            const file = queue.shift()!
            await processFile(file)
          }
        }
        await Promise.all(Array.from({ length: CONCURRENCY }, worker))

        emit({ type: 'complete', payload: { succeeded, skipped, failed, savedBytes } })
      } catch (err) {
        emit({
          type: 'error',
          payload: { message: err instanceof Error ? err.message : 'Unexpected server error' },
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
