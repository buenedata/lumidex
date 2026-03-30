import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

/** Mirror of the client-side helper so server doesn't import from lib/imageUpload */
function generateImageFilename(setId: string, number: string): string {
  const cardNumber = number.split('/')[0]
  return `${setId}-${cardNumber}.jpg`
}

// Domains permitted for server-side URL fetching (mirrors proxy-image allow-list)
const ALLOWED_SOURCE_DOMAINS = [
  'pkmn.gg',
  'www.pkmn.gg',
  'assets.pkmn.gg',
  'site.pkmn.gg',
  'tcgcollector.com',
  'www.tcgcollector.com',
  'static.tcgcollector.com',
  'public.getcollectr.com',
  'limitlesstcg.com',
  'www.limitlesstcg.com',
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

  const file       = formData.get('file')       as File   | null
  const sourceUrl  = formData.get('sourceUrl')  as string | null
  const cardId     = formData.get('cardId')     as string | null
  const setId      = formData.get('setId')      as string | null
  const cardNumber = formData.get('cardNumber') as string | null

  if (!cardId || !setId || !cardNumber) {
    return NextResponse.json(
      { error: 'Missing required fields: cardId, setId, cardNumber' },
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

    const filename   = generateImageFilename(setId, cardNumber)
    const fileBuffer = await file.arrayBuffer()

    return uploadAndRecord(filename, fileBuffer, file.type, cardId)
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

    const filename = generateImageFilename(setId, cardNumber)
    return uploadAndRecord(filename, buffer, contentType, cardId)
  }

  return NextResponse.json(
    { error: 'Provide either a file upload or a sourceUrl' },
    { status: 400 }
  )
}

/** Upload buffer to storage and update the cards table. */
async function uploadAndRecord(
  filename: string,
  buffer: ArrayBuffer,
  contentType: string,
  cardId: string,
): Promise<NextResponse> {
  // 4. Upload to Supabase storage (service-role — bypasses RLS)
  const { error: uploadError } = await supabaseAdmin.storage
    .from('card-images')
    .upload(filename, buffer, {
      upsert: true,
      contentType,
    })

  if (uploadError) {
    console.error('[upload-card-image] Storage error:', uploadError)
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 502 }
    )
  }

  // 5. Resolve public URL
  const { data: urlData } = supabaseAdmin.storage
    .from('card-images')
    .getPublicUrl(filename)
  const imageUrl = urlData.publicUrl

  // 6. Update cards table (service-role — bypasses RLS)
  const { error: dbError } = await supabaseAdmin
    .from('cards')
    .update({ image: imageUrl })
    .eq('id', cardId)

  if (dbError) {
    console.error('[upload-card-image] DB update error:', dbError)
    return NextResponse.json(
      { error: `Database update failed: ${dbError.message}` },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true, imageUrl })
}
