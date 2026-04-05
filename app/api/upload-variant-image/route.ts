import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'
import { compressImageToWebP, COMPRESSED_CONTENT_TYPE } from '@/lib/imageCompress'

/**
 * POST /api/upload-variant-image
 *
 * Uploads a variant-specific card image and upserts a row in card_variant_images.
 * After this, hovering the variant in the card modal will cross-fade to this image.
 *
 * Body (multipart/form-data):
 *   file      – image file
 *   cardId    – UUID of the card
 *   variantId – UUID of the variant
 *
 * DELETE /api/upload-variant-image?cardId=...&variantId=...
 *
 * Removes the card_variant_images row (does NOT delete the storage file —
 * storage is cheap and keeping old files avoids broken CDN links in flight).
 */

export async function POST(request: NextRequest) {
  // 1. Admin-only
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  // 2. Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file      = formData.get('file')      as File   | null
  const cardId    = formData.get('cardId')    as string | null
  const variantId = formData.get('variantId') as string | null

  if (!cardId || !variantId) {
    return NextResponse.json(
      { error: 'Missing required fields: cardId, variantId' },
      { status: 400 },
    )
  }

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Image must be smaller than 5 MB' },
      { status: 400 },
    )
  }

  // 3. Compress to WebP
  const fileBuffer = await file.arrayBuffer()
  let uploadBuffer: Buffer | ArrayBuffer
  let uploadContentType: string
  try {
    uploadBuffer      = await compressImageToWebP(fileBuffer)
    uploadContentType = COMPRESSED_CONTENT_TYPE
  } catch {
    // Fallback: upload original bytes if SharpJS is unavailable (e.g. cold start)
    uploadBuffer      = fileBuffer
    uploadContentType = file.type
  }

  // 4. Upload to Supabase Storage
  // Path: variants/<cardId>-<variantId>.webp
  // Using the card-images bucket (same bucket as regular card images)
  const storagePath = `variants/${cardId}-${variantId}.webp`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('card-images')
    .upload(storagePath, uploadBuffer, {
      upsert: true,
      contentType: uploadContentType,
    })

  if (uploadError) {
    console.error('[upload-variant-image] Storage error:', uploadError)
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 502 },
    )
  }

  // 5. Resolve public URL with cache-busting version param
  const { data: urlData } = supabaseAdmin.storage
    .from('card-images')
    .getPublicUrl(storagePath)
  const imageUrl = `${urlData.publicUrl}?v=${Date.now()}`

  // 6. Upsert card_variant_images row
  const { error: dbError } = await supabaseAdmin
    .from('card_variant_images')
    .upsert(
      { card_id: cardId, variant_id: variantId, image_url: imageUrl },
      { onConflict: 'card_id,variant_id' },
    )

  if (dbError) {
    console.error('[upload-variant-image] DB upsert error:', dbError)
    return NextResponse.json(
      { error: `Database upsert failed: ${dbError.message}` },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true, imageUrl })
}

export async function DELETE(request: NextRequest) {
  // Admin-only
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const cardId    = searchParams.get('cardId')
  const variantId = searchParams.get('variantId')

  if (!cardId || !variantId) {
    return NextResponse.json(
      { error: 'Missing required query params: cardId, variantId' },
      { status: 400 },
    )
  }

  const { error } = await supabaseAdmin
    .from('card_variant_images')
    .delete()
    .eq('card_id', cardId)
    .eq('variant_id', variantId)

  if (error) {
    console.error('[upload-variant-image] DELETE error:', error)
    return NextResponse.json(
      { error: `Failed to remove variant image: ${error.message}` },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true })
}
