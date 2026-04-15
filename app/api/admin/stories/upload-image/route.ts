import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { compressImageToWebP, COMPRESSED_CONTENT_TYPE } from '@/lib/imageCompress'
import { uploadToR2, getR2Url } from '@/lib/r2'

/**
 * POST /api/admin/stories/upload-image
 * Accepts a multipart form with:
 *   file     — the image file
 *   storyId  — the story uuid (used for the R2 key prefix)
 *   type     — "cover" | "block" (optional label, doesn't affect storage path)
 *
 * Compresses to WebP, uploads to R2 under story-images/{storyId}/{timestamp}-{name}.webp
 * Returns { url: string } — the public CDN URL.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file    = formData.get('file')    as File   | null
  const storyId = formData.get('storyId') as string | null

  if (!file || !storyId) {
    return NextResponse.json(
      { error: 'Missing required fields: file, storyId' },
      { status: 400 },
    )
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be smaller than 5 MB' }, { status: 400 })
  }

  // Build a safe filename: timestamp + sanitised original name
  const timestamp   = Date.now()
  const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
  const baseName    = safeName.replace(/\.[^.]+$/, '') // strip extension
  const r2Key       = `story-images/${storyId}/${timestamp}-${baseName}.webp`
  const fileBuffer  = await file.arrayBuffer()

  let uploadBuffer: Buffer | ArrayBuffer
  let uploadContentType: string
  try {
    uploadBuffer      = await compressImageToWebP(fileBuffer)
    uploadContentType = COMPRESSED_CONTENT_TYPE
  } catch {
    // Fallback: upload original if compression fails
    uploadBuffer      = fileBuffer
    uploadContentType = file.type
  }

  try {
    await uploadToR2(r2Key, uploadBuffer, uploadContentType)
  } catch (err) {
    console.error('[upload-image] R2 upload failed:', err)
    return NextResponse.json({ error: 'Upload to storage failed' }, { status: 500 })
  }

  const url = getR2Url(r2Key)
  return NextResponse.json({ url }, { status: 201 })
}
