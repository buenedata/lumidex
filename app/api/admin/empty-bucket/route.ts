/**
 * POST /api/admin/empty-bucket
 *
 * Admin-only route that deletes every file in a storage bucket and
 * optionally nulls out the corresponding image column in the database
 * so the admin grid shows cards as needing re-upload.
 *
 * Body: {
 *   bucket: 'card-images' | 'product-images' | 'set-images'
 *   clearDbUrls?: boolean   // default true
 * }
 *
 * Response: { deleted: number, dbRowsCleared: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED_BUCKETS = ['card-images', 'product-images', 'set-images'] as const
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number]

const PAGE_SIZE  = 1000   // Supabase max per list() call
const BATCH_SIZE = 100    // remove() batch size

/** List every file path in a bucket via paginated list(). */
async function listAllPaths(bucket: AllowedBucket): Promise<string[]> {
  const paths: string[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list('', { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } })

    if (error) throw new Error(`list() failed: ${error.message}`)
    if (!data || data.length === 0) break

    const real = data
      .filter((f) => f.name && f.name !== '.emptyFolderPlaceholder' && !f.name.endsWith('/'))
      .map((f) => f.name)

    paths.push(...real)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return paths
}

/** Delete file paths in batches; returns total deleted count. */
async function deletePaths(bucket: AllowedBucket, paths: string[]): Promise<number> {
  let deleted = 0
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE)
    const { error } = await supabaseAdmin.storage.from(bucket).remove(batch)
    if (error) throw new Error(`remove() batch failed: ${error.message}`)
    deleted += batch.length
  }
  return deleted
}

export async function POST(request: NextRequest) {
  // 1. Admin guard
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  // 2. Parse body
  let body: { bucket?: string; clearDbUrls?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const bucket = body.bucket as AllowedBucket | undefined
  const clearDbUrls = body.clearDbUrls !== false // default true

  if (!bucket || !ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json(
      { error: `bucket must be one of: ${ALLOWED_BUCKETS.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    // 3. List all files
    const paths = await listAllPaths(bucket)

    // 4. Delete all files
    const deleted = paths.length > 0 ? await deletePaths(bucket, paths) : 0

    // 5. Optionally clear DB image URLs
    let dbRowsCleared = 0

    if (clearDbUrls) {
      if (bucket === 'card-images') {
        const { error } = await supabaseAdmin
          .from('cards')
          .update({ image: null })
          .not('image', 'is', null)
        if (error) throw new Error(`DB clear failed (cards): ${error.message}`)
        dbRowsCleared = deleted // approximate: one DB row per storage file
      } else if (bucket === 'product-images') {
        const { error } = await supabaseAdmin
          .from('set_products')
          .update({ image_url: null })
          .not('image_url', 'is', null)
        if (error) throw new Error(`DB clear failed (set_products): ${error.message}`)
        dbRowsCleared = deleted
      } else if (bucket === 'set-images') {
        const { error } = await supabaseAdmin
          .from('sets')
          .update({ logo_url: null })
          .not('logo_url', 'is', null)
        if (error) throw new Error(`DB clear failed (sets): ${error.message}`)
        dbRowsCleared = deleted
      }
    }

    return NextResponse.json({ deleted, dbRowsCleared })
  } catch (err) {
    console.error('[empty-bucket]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    )
  }
}
