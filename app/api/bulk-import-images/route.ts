import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'
import { generateImageFilename } from '@/lib/imageUpload'
import { compressImageToWebP, COMPRESSED_CONTENT_TYPE } from '@/lib/imageCompress'

const STORAGE_BUCKET = 'card-images'
const CONCURRENCY = 3

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip leading zeros and everything after the first "/" — "012/165" → "12" */
function normalizeNumber(num: string): string {
  const raw = num.split('/')[0]
  // Strip leading zeros after an optional letter prefix so that e.g.
  // "H032" (DB) and "H32" (pkmn.gg) both normalise to "H32".
  return raw.replace(/^([A-Za-z]*)0+(\d)/, '$1$2') || '0'
}

function sseData(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

// ── pkmn.gg scraping ─────────────────────────────────────────────────────────

interface PkmnCard {
  number: string
  imageUrl: string
}

/**
 * Fetch a pkmn.gg set page and extract card image URLs.
 * pkmn.gg is a Next.js app — its __NEXT_DATA__ blob contains structured card data
 * with pokemontcg.io image URLs.
 */
async function extractCardsFromPkmnGg(pkmnGgUrl: string): Promise<PkmnCard[]> {
  const response = await fetch(pkmnGgUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch pkmn.gg page (HTTP ${response.status})`)
  }

  const html = await response.text()

  // Extract Next.js __NEXT_DATA__ blob
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  )
  if (!match) {
    throw new Error(
      'Could not find __NEXT_DATA__ on the pkmn.gg page. The page structure may have changed.',
    )
  }

  let nextData: unknown
  try {
    nextData = JSON.parse(match[1])
  } catch {
    throw new Error('Failed to parse __NEXT_DATA__ JSON from pkmn.gg page.')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = nextData as any
  const pageProps = d?.props?.pageProps

  // Diagnostic: log all top-level keys of pageProps so we can see what's available.
  console.log('[bulk-import] pkmn.gg pageProps keys:', Object.keys(pageProps ?? {}))

  // pkmn.gg uses different data shapes depending on the page type, and sets with
  // multiple card groups (e.g. regular + secret/H-series) may store each group in
  // a separate array.  We therefore collect cards from ALL known array properties
  // and merge them rather than stopping at the first one found.
  //
  // Known paths:
  //   /series/*      → pageProps.cardData           (regular cards)
  //   /series/*      → pageProps.secretCards, pageProps.crystalCards,
  //                    pageProps.holoCards, pageProps.promoCards  (secret/H cards)
  //   /collections/* → pageProps.collection.cards
  //   fallback       → pageProps.cards
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidateArrays: any[][] = [
    pageProps?.cardData,
    pageProps?.secretCards,
    pageProps?.crystalCards,
    pageProps?.holoCards,
    pageProps?.promoCards,
    pageProps?.collection?.cards,
    pageProps?.cards,
  ].filter((arr): arr is any[] => Array.isArray(arr) && arr.length > 0)

  if (candidateArrays.length === 0) {
    throw new Error(
      'No card data found in the pkmn.gg page. ' +
        'Supported URL formats:\n' +
        '  • https://www.pkmn.gg/series/scarlet-violet/151\n' +
        '  • https://www.pkmn.gg/collections/trick-or-trade-2022',
    )
  }

  // Merge all arrays and deduplicate by card number (last write wins — same
  // card should have the same image URL in every group it appears in).
  const merged = candidateArrays.flat()
  console.log(
    `[bulk-import] pkmn.gg card arrays found: ${candidateArrays.length} ` +
    `(sizes: ${candidateArrays.map(a => a.length).join(', ')}) → ${merged.length} total before dedup`,
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byNumber = new Map<string, any>()
  for (const card of merged) {
    const num = String(card.number ?? card.cardNumber ?? '')
    if (num) byNumber.set(num, card)
  }

  return [...byNumber.values()]
    .map((card) => ({
      // Collections pages may use "cardNumber" instead of "number"
      number: String(card.number ?? card.cardNumber ?? ''),
      imageUrl: (card.largeImageUrl ?? card.thumbImageUrl ?? card.imageUrl ?? '') as string,
    }))
    .filter((c) => c.number !== '' && c.imageUrl !== '')
}

// ── DB card type ──────────────────────────────────────────────────────────────

interface DbCard {
  id: string
  set_id: string
  name: string
  number: string
  rarity: string | null
  image: string | null
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Auth guard — must be admin
  try {
    await requireAdmin()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 2. Parse body
  let body: { pkmnGgUrl?: string; setId?: string; overwrite?: boolean }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { pkmnGgUrl, setId, overwrite = false } = body

  if (!pkmnGgUrl || !setId) {
    return new Response(
      JSON.stringify({ error: 'pkmnGgUrl and setId are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 3. Stream SSE
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: unknown) => {
        try {
          controller.enqueue(sseData(payload))
        } catch {
          // controller may already be closed if client disconnected
        }
      }

      try {
        // ── Fetch DB cards for this set ──────────────────────────────────────
        const { data: dbCards, error: dbError } = await supabaseAdmin
          .from('cards')
          .select('id, set_id, name, number, rarity, image')
          .eq('set_id', setId)

        if (dbError || !dbCards) {
          emit({
            type: 'error',
            payload: { message: `Failed to fetch cards from database: ${dbError?.message ?? 'unknown error'}` },
          })
          controller.close()
          return
        }

        if (dbCards.length === 0) {
          emit({
            type: 'error',
            payload: { message: `No cards found in the database for set ID "${setId}".` },
          })
          controller.close()
          return
        }

        // ── Scrape pkmn.gg ───────────────────────────────────────────────────
        let pkmnCards: PkmnCard[]
        try {
          pkmnCards = await extractCardsFromPkmnGg(pkmnGgUrl)
        } catch (err) {
          emit({
            type: 'error',
            payload: {
              message: err instanceof Error ? err.message : 'Failed to fetch pkmn.gg page',
            },
          })
          controller.close()
          return
        }

        // Build lookup: normalised number → image URL
        const pkmnByNumber = new Map<string, string>()
        for (const c of pkmnCards) {
          pkmnByNumber.set(normalizeNumber(c.number), c.imageUrl)
        }

        // ── DIAGNOSTIC: Detect duplicate card numbers in DB ──────────────────
        const dbNumberCount = new Map<string, DbCard[]>()
        for (const card of dbCards) {
          const norm = normalizeNumber(card.number)
          const existing = dbNumberCount.get(norm) ?? []
          existing.push(card)
          dbNumberCount.set(norm, existing)
        }
        const duplicateGroups = [...dbNumberCount.entries()].filter(([, cards]) => cards.length > 1)
        if (duplicateGroups.length > 0) {
          console.warn(
            `[bulk-import] DUPLICATE card numbers detected in DB for set "${setId}":`,
            duplicateGroups.map(([norm, cards]) => ({
              normalizedNumber: norm,
              rawNumbers: cards.map(c => c.number),
              cardIds: cards.map(c => c.id),
            })),
          )
        }

        // ── DIAGNOSTIC: Detect same-filename collisions ───────────────────────
        const filenameMap = new Map<string, DbCard[]>()
        for (const card of dbCards) {
          const filename = generateImageFilename(card.set_id, card.number, card.id)
          const existing = filenameMap.get(filename) ?? []
          existing.push(card)
          filenameMap.set(filename, existing)
        }
        const filenameCollisions = [...filenameMap.entries()].filter(([, cards]) => cards.length > 1)
        if (filenameCollisions.length > 0) {
          console.warn(
            `[bulk-import] FILENAME COLLISION — these DB cards would upload to the same file for set "${setId}":`,
            filenameCollisions.map(([filename, cards]) => ({
              filename,
              cards: cards.map(c => ({ id: c.id, number: c.number, name: c.name })),
            })),
          )
        }

        // ── DIAGNOSTIC: Log pkmn.gg normalized-number duplicates ─────────────
        const pkmnNormCount = new Map<string, string[]>()
        for (const c of pkmnCards) {
          const norm = normalizeNumber(c.number)
          const existing = pkmnNormCount.get(norm) ?? []
          existing.push(c.number)
          pkmnNormCount.set(norm, existing)
        }
        const pkmnDups = [...pkmnNormCount.entries()].filter(([, nums]) => nums.length > 1)
        if (pkmnDups.length > 0) {
          console.warn(
            `[bulk-import] pkmn.gg returned cards with colliding normalized numbers (only last survives in map):`,
            pkmnDups.map(([norm, nums]) => ({ normalizedNumber: norm, rawNumbers: nums })),
          )
        }

        console.log(
          `[bulk-import] set="${setId}" dbCards=${dbCards.length} pkmnCards=${pkmnCards.length} `+
          `dbDuplicateGroups=${duplicateGroups.length} filenameCollisions=${filenameCollisions.length} pkmnDups=${pkmnDups.length}`,
        )
        // ─────────────────────────────────────────────────────────────────────

        // ── Per-card processing function ─────────────────────────────────────
        let succeeded = 0
        let skipped = 0
        let failed = 0
        let no_match = 0

        const processCard = async (card: DbCard) => {
          const normNum = normalizeNumber(card.number)
          const externalImageUrl = pkmnByNumber.get(normNum)

          // No match found on pkmn.gg
          if (!externalImageUrl) {
            no_match++
            emit({
              type: 'progress',
              payload: {
                cardId: card.id,
                number: card.number,
                name: card.name,
                status: 'no_match',
              },
            })
            return
          }

          // Skip if already has image and overwrite is off
          if (card.image && !overwrite) {
            skipped++
            emit({
              type: 'progress',
              payload: {
                cardId: card.id,
                number: card.number,
                name: card.name,
                status: 'skipped',
              },
            })
            return
          }

          // Fetch + upload
          try {
            const imgRes = await fetch(externalImageUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            })

            if (!imgRes.ok) {
              throw new Error(`Image download failed (HTTP ${imgRes.status})`)
            }

            const imageBuffer = await imgRes.arrayBuffer()

            // Compress to WebP before uploading to minimise storage usage
            let uploadBuffer: Buffer | ArrayBuffer
            let uploadContentType: string
            try {
              uploadBuffer = await compressImageToWebP(imageBuffer)
              uploadContentType = COMPRESSED_CONTENT_TYPE
            } catch {
              // Fallback: store original bytes if compression fails
              uploadBuffer = imageBuffer
              uploadContentType = imgRes.headers.get('content-type') ?? 'image/png'
            }

            // Use the card-ID-scoped filename to prevent collisions between
            // cards in the same set that share the same number (e.g. #3).
            const filename = generateImageFilename(card.set_id, card.number, card.id)

            const { error: uploadErr } = await supabaseAdmin.storage
              .from(STORAGE_BUCKET)
              .upload(filename, uploadBuffer, { contentType: uploadContentType, upsert: true })

            if (uploadErr) {
              throw new Error(`Storage upload failed: ${uploadErr.message}`)
            }

            // Append a version timestamp so each upload produces a distinct URL,
            // bypassing Supabase CDN / browser cache for overwritten files.
            const { data: urlData } = supabaseAdmin.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(filename)
            const imageUrl = `${urlData.publicUrl}?v=${Date.now()}`

            const { error: dbUpdateErr } = await supabaseAdmin
              .from('cards')
              .update({ image: imageUrl })
              .eq('id', card.id)

            if (dbUpdateErr) {
              throw new Error(`Database update failed: ${dbUpdateErr.message}`)
            }

            succeeded++
            emit({
              type: 'progress',
              payload: {
                cardId: card.id,
                number: card.number,
                name: card.name,
                status: 'success',
                imageUrl,
              },
            })
          } catch (err) {
            failed++
            emit({
              type: 'progress',
              payload: {
                cardId: card.id,
                number: card.number,
                name: card.name,
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
              },
            })
          }
        }

        // ── Deduplicate DB cards by normalised number ────────────────────────
        // If the DB has duplicate rows for the same card number (e.g. from a
        // CSV imported multiple times) we only process the first occurrence.
        // Without this guard every duplicate row triggers a separate upload to
        // the same storage file, multiplying work and SSE events needlessly.
        const seenNumbers = new Set<string>()
        const uniqueDbCards = dbCards.filter((card) => {
          const norm = normalizeNumber(card.number)
          if (seenNumbers.has(norm)) return false
          seenNumbers.add(norm)
          return true
        })
        if (uniqueDbCards.length !== dbCards.length) {
          console.warn(
            `[bulk-import] Deduplicated DB cards for set "${setId}": ` +
              `${dbCards.length} rows → ${uniqueDbCards.length} unique numbers. ` +
              `${dbCards.length - uniqueDbCards.length} duplicate rows skipped.`,
          )
        }

        // ── Emit start (after dedup so total reflects actual work) ───────────
        emit({ type: 'start', payload: { total: uniqueDbCards.length } })

        // ── Concurrency pool (CONCURRENCY workers share a queue) ─────────────
        // JavaScript is single-threaded so queue.shift() inside async functions
        // is safe — each await yields to the next coroutine atomically.
        const queue: DbCard[] = [...uniqueDbCards]
        const worker = async () => {
          while (queue.length > 0) {
            const card = queue.shift()!
            await processCard(card)
          }
        }

        await Promise.all(Array.from({ length: CONCURRENCY }, worker))

        // ── Emit complete ────────────────────────────────────────────────────
        emit({
          type: 'complete',
          payload: { succeeded, skipped, failed, no_match },
        })
      } catch (err) {
        emit({
          type: 'error',
          payload: {
            message: err instanceof Error ? err.message : 'Unexpected server error',
          },
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
      'X-Accel-Buffering': 'no', // disable Nginx buffering for SSE
    },
  })
}
