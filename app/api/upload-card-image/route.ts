import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'
import { compressImageToWebP, COMPRESSED_CONTENT_TYPE } from '@/lib/imageCompress'
import { uploadToR2, deleteFromR2, getR2Url } from '@/lib/r2'

/**
 * Mirror of the client-side helper so server doesn't import from lib/imageUpload.
 * cardId is included in the filename to prevent storage collisions between two
 * cards in the same set that share the same card number (e.g. Pokémon #3 and
 * Energy #3 both in the same set would otherwise map to the same file).
 *
 * A Unix-second timestamp suffix is appended so that every upload — including
 * replacements — writes to a NEW R2 key with a NEW public URL.  This prevents
 * the Cloudflare CDN from serving the old cached image when a card is re-uploaded
 * to the same logical filename as before.
 *
 * The card number is sanitised so that special characters (e.g. '?' in secret-rare
 * promos like '#?/28') never end up in the URL, where they would break the CDN path.
 * Any character that is not alphanumeric or a hyphen is replaced with an underscore.
 */
function generateImageFilename(setId: string, number: string, cardId: string): string {
  const rawNumber  = number.split('/')[0]
  const cardNumber = rawNumber.replace(/[^a-zA-Z0-9-]/g, '_')   // e.g. '?' → '_'
  const version    = Math.floor(Date.now() / 1000)               // Unix seconds — short but unique
  return `${setId}-${cardNumber}-${cardId}-${version}.webp`
}

/**
 * Extract the R2 object key from a full public CDN URL.
 * Returns null when the URL doesn't belong to our R2 bucket (e.g. legacy URLs).
 */
function extractR2Key(r2Url: string): string | null {
  try {
    const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '').replace(/\/$/, '')
    if (base && r2Url.startsWith(base + '/')) {
      return r2Url.slice(base.length + 1)
    }
    return null
  } catch {
    return null
  }
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
  // dext TCG
  'dextcg.com',
  'www.dextcg.com',
  'app.dextcg.com',
  'cdn.dextcg.com',
  // Other trusted sources
  'public.getcollectr.com',
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

  // 3. Fetch the card's current image URL so we can delete the old R2 object
  //    after a successful replacement.  Failure here is non-fatal — we just
  //    skip the cleanup step.
  const { data: cardRow } = await supabaseAdmin
    .from('cards')
    .select('image')
    .eq('id', cardId)
    .single()
  const oldImageUrl: string | null = cardRow?.image ?? null

  // --- Branch A: file upload ---
  if (file) {
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be smaller than 5 MB' }, { status: 400 })
    }

    const filename   = generateImageFilename(setId, cardNumber, cardId)
    const fileBuffer = await file.arrayBuffer()

    return uploadAndRecord(filename, fileBuffer, file.type, cardId, oldImageUrl)
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

    const filename = generateImageFilename(setId, cardNumber, cardId)
    return uploadAndRecord(filename, buffer, contentType, cardId, oldImageUrl)
  }

  return NextResponse.json(
    { error: 'Provide either a file upload or a sourceUrl' },
    { status: 400 }
  )
}

/** Upload buffer to R2 and update the cards table. */
async function uploadAndRecord(
  filename: string,
  buffer: ArrayBuffer,
  contentType: string,
  cardId: string,
  oldImageUrl: string | null,
): Promise<NextResponse> {
  // 4. Compress to WebP before uploading to minimise storage usage
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

  // 5. Upload to R2 — versioned filename guarantees a fresh CDN URL every time,
  //    so browsers and Cloudflare never serve a stale cached image on replacement.
  const r2Key = `card-images/${filename}`
  try {
    await uploadToR2(r2Key, uploadBuffer, uploadContentType)
  } catch (err) {
    console.error('[upload-card-image] R2 upload error:', err)
    return NextResponse.json(
      { error: `Storage upload failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 502 }
    )
  }

  // 6. Resolve public URL.  Because the filename is versioned, stableUrl is
  //    always a new URL — no cache-bust query string needed for end users.
  //    We still append ?v=... for the browser response so the admin UI can
  //    distinguish this upload from a prior one in the same session.
  const stableUrl = getR2Url(r2Key)
  const imageUrl  = `${stableUrl}?v=${Date.now()}`   // for browser preview only

  // 7. Update cards table (service-role — bypasses RLS)
  const { error: dbError } = await supabaseAdmin
    .from('cards')
    .update({ image: stableUrl })
    .eq('id', cardId)

  if (dbError) {
    console.error('[upload-card-image] DB update error:', dbError)
    return NextResponse.json(
      { error: `Database update failed: ${dbError.message}` },
      { status: 502 }
    )
  }

  // 8. Delete the previous R2 object (best-effort — never fail the request).
  //    This keeps the bucket tidy now that every upload creates a new key.
  if (oldImageUrl) {
    const oldKey = extractR2Key(oldImageUrl)
    if (oldKey) {
      deleteFromR2(oldKey).catch((err) =>
        console.warn('[upload-card-image] Failed to delete old R2 object:', err),
      )
    }
  }

  // 9. Invalidate the Next.js server-side data cache so getCardsBySet returns
  //    fresh data (including the new image URL) on the next request.
  //    expire: 0 → cached entries are considered stale immediately after invalidation.
  revalidateTag('cards', { expire: 0 })

  return NextResponse.json({ success: true, imageUrl })
}
