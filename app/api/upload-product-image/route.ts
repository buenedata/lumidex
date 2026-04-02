import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'
import { compressImageToWebP, COMPRESSED_CONTENT_TYPE } from '@/lib/imageCompress'

/** Standardised filename for a product image: "{productId}.jpg" */
function generateProductImageFilename(productId: string): string {
  return `${productId}.jpg`
}

// Domains permitted for server-side URL fetching (mirrors proxy-image allow-list)
const ALLOWED_SOURCE_DOMAINS = [
  'public.getcollectr.com',
  'pkmn.gg',
  'www.pkmn.gg',
  'assets.pkmn.gg',
  'site.pkmn.gg',
  'tcgcollector.com',
  'www.tcgcollector.com',
  'static.tcgcollector.com',
  'limitlesstcg.com',
  'www.limitlesstcg.com',
  'bulbapedia.bulbagarden.net',
  'archives.bulbagarden.net',
]

/**
 * Fetch an image from a trusted external URL server-side.
 * Returns { buffer, contentType } or throws on failure.
 */
async function fetchExternalImage(
  sourceUrl: string,
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  let parsed: URL
  try {
    parsed = new URL(sourceUrl)
  } catch {
    throw new Error('Invalid source URL')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Only https URLs are allowed as image sources')
  }

  if (!ALLOWED_SOURCE_DOMAINS.includes(parsed.hostname)) {
    throw new Error(`Source domain not allowed: ${parsed.hostname}`)
  }

  const response = await fetch(sourceUrl, {
    headers: {
      Referer: `https://${parsed.hostname}/`,
      'User-Agent': 'Mozilla/5.0 (compatible; Lumidex/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Upstream fetch failed: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  if (!contentType.startsWith('image/')) {
    throw new Error(`Upstream response is not an image: ${contentType}`)
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > 5 * 1024 * 1024) {
    throw new Error('Remote image exceeds 5 MB limit')
  }

  return { buffer, contentType }
}

export async function POST(request: NextRequest) {
  // 1. Verify caller is an admin (reads auth cookie server-side)
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 }
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
  const sourceUrl = formData.get('sourceUrl') as string | null
  const productId = formData.get('productId') as string | null

  if (!productId) {
    return NextResponse.json(
      { error: 'Missing required field: productId' },
      { status: 400 }
    )
  }

  // --- Branch A: file upload ---
  if (file) {
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be smaller than 5 MB' }, { status: 400 })
    }

    const filename   = generateProductImageFilename(productId)
    const fileBuffer = await file.arrayBuffer()

    return uploadAndRecord(filename, fileBuffer, file.type, productId)
  }

  // --- Branch B: URL import ---
  if (sourceUrl) {
    let buffer: ArrayBuffer
    let contentType: string
    try {
      ;({ buffer, contentType } = await fetchExternalImage(sourceUrl))
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to fetch source URL' },
        { status: 400 }
      )
    }

    const filename = generateProductImageFilename(productId)
    return uploadAndRecord(filename, buffer, contentType, productId)
  }

  return NextResponse.json(
    { error: 'Provide either a file upload or a sourceUrl' },
    { status: 400 }
  )
}

/** Upload buffer to the product-images bucket and update set_products. */
async function uploadAndRecord(
  filename: string,
  buffer: ArrayBuffer,
  contentType: string,
  productId: string,
): Promise<NextResponse> {
  // Compress to WebP before uploading to minimise storage usage
  let uploadBuffer: Buffer | ArrayBuffer
  let uploadContentType: string
  try {
    uploadBuffer = await compressImageToWebP(buffer)
    uploadContentType = COMPRESSED_CONTENT_TYPE
  } catch {
    // Fallback: upload original bytes if compression unexpectedly fails
    uploadBuffer = buffer
    uploadContentType = contentType
  }

  // Upload to Supabase storage (service-role — bypasses RLS)
  const { error: uploadError } = await supabaseAdmin.storage
    .from('product-images')
    .upload(filename, uploadBuffer, {
      upsert: true,
      contentType: uploadContentType,
    })

  if (uploadError) {
    console.error('[upload-product-image] Storage error:', uploadError)
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 502 }
    )
  }

  // Resolve public URL — append version timestamp to bust CDN cache
  const { data: urlData } = supabaseAdmin.storage
    .from('product-images')
    .getPublicUrl(filename)
  const imageUrl = `${urlData.publicUrl}?v=${Date.now()}`

  // Update set_products table (service-role — bypasses RLS)
  const { error: dbError } = await supabaseAdmin
    .from('set_products')
    .update({ image_url: imageUrl })
    .eq('id', productId)

  if (dbError) {
    console.error('[upload-product-image] DB update error:', dbError)
    return NextResponse.json(
      { error: `Database update failed: ${dbError.message}` },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true, imageUrl })
}
