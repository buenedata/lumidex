import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'
import { generateImageFilename } from '@/lib/imageUpload'

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'card-images'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip leading zeros and everything after the first "/" — "012/165" → "12" */
function normalizeNumber(num: string): string {
  const raw = num.split('/')[0].replace(/^0+/, '')
  return raw || '0'
}

function sseData(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

/**
 * Download an image from an external URL and upload it to the `card-images`
 * storage bucket.  Returns the public URL stored in the `image` column, or
 * `null` on any error so a single bad image never aborts the whole import.
 */
async function downloadAndStoreCardImage(
  imageUrl: string,
  cardNumber: string,
  setId: string,
): Promise<string | null> {
  console.log('[import-card-data] downloadAndStoreCardImage called:', imageUrl)
  try {
    const imgRes = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.pkmn.gg/',
        'Accept': 'image/webp,image/avif,image/png,image/*,*/*;q=0.8',
      },
    })

    if (!imgRes.ok) return null

    const contentType = imgRes.headers.get('content-type') ?? 'image/png'
    if (!contentType.startsWith('image/')) return null

    const imageBuffer = await imgRes.arrayBuffer()
    if (imageBuffer.byteLength === 0) return null

    // Use the same standardised filename convention as the rest of the codebase
    const filename = generateImageFilename(setId, cardNumber)

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filename, imageBuffer, { contentType, upsert: true })

    if (uploadErr) {
      console.error('[import-card-data] upload error:', uploadErr)
      return null
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filename)

    return urlData.publicUrl ?? null
  } catch (err) {
    console.warn('[import-card-data] downloadAndStoreCardImage error:', err)
    return null
  }
}

// ── pkmn.gg scraping ─────────────────────────────────────────────────────────

/** Known Pokémon element types as used by pokemontcg.io */
const POKEMON_ELEMENT_TYPES = new Set([
  'Grass', 'Fire', 'Water', 'Lightning', 'Psychic',
  'Fighting', 'Darkness', 'Metal', 'Fairy', 'Dragon', 'Colorless',
])

interface PkmnCardData {
  /**
   * Card number in "X/Y" format when the set total is known, e.g. "3/15".
   * Falls back to the bare number from pkmn.gg (e.g. "003") when total is unavailable.
   */
  number: string
  /** Pokémon / card name as returned by pkmn.gg — "ex" already normalised to "EX" */
  name: string | null
  artist: string | null
  supertype: string | null
  rarity: string | null
  /** Element type, e.g. "Fire" or "Water/Psychic" — parsed from pkmn.gg card data */
  type: string | null
  /**
   * pokemontcg.io card ID (e.g. "mcd25-1") from pkmn.gg's `dbId` field.
   * Used as a fallback to fetch the element type when pkmn.gg doesn't include it.
   */
  dbId: string | null
  /** Full URL to the large card image from pokemontcg.io */
  largeImageUrl: string | null
  /** Full URL to the thumbnail card image from pokemontcg.io */
  thumbImageUrl: string | null
}

// ── pokemontcg.io batch type lookup ──────────────────────────────────────────

/**
 * Given a pokemontcg.io set ID (e.g. "mcd25"), fetch ALL cards for that set
 * in one API call and return a Map<normalizedNumber, elementType>.
 *
 * Returns an empty Map on any error so the import degrades gracefully.
 */
async function fetchSetTypesFromTcgApi(
  tcgSetId: string,
): Promise<{ typeMap: Map<string, string>; totalCards: number }> {
  const typeMap = new Map<string, string>()
  let totalCards = 0
  try {
    const headers: Record<string, string> = { 'User-Agent': 'Lumidex/1.0' }
    if (process.env.POKEMON_TCG_API_KEY) {
      headers['X-Api-Key'] = process.env.POKEMON_TCG_API_KEY
    }

    // pageSize=250 covers the largest sets.
    // Note: no AbortSignal.timeout() — requires Node 17.3+; use promise-race instead.
    const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${encodeURIComponent(tcgSetId)}&pageSize=250`
    console.log('[import-card-data] TCG batch fetch:', url)

    const fetchPromise = fetch(url, { headers })
    // 20 s manual timeout compatible with all Node versions
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TCG batch fetch timed out after 20s')), 20000),
    )

    const res = await Promise.race([fetchPromise, timeoutPromise])
    if (!res.ok) {
      console.warn(`[import-card-data] TCG batch API ${res.status} for set ${tcgSetId}`)
      return { typeMap, totalCards }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards: any[] = json?.data ?? []
    totalCards = cards.length
    console.log(`[import-card-data] TCG batch returned ${cards.length} cards for set ${tcgSetId}`)

    for (const card of cards) {
      const rawNumber = String(card.number ?? '')
      if (!rawNumber) continue
      const normNum = normalizeNumber(rawNumber)
      const types: unknown = card.types
      if (Array.isArray(types)) {
        const matched = types.filter(
          (t): t is string => typeof t === 'string' && POKEMON_ELEMENT_TYPES.has(t),
        )
        if (matched.length > 0) typeMap.set(normNum, matched.join('/'))
      }
    }

    console.log(`[import-card-data] TCG batch type map: ${typeMap.size} entries`)
  } catch (err) {
    console.warn(`[import-card-data] TCG batch fetch failed for set ${tcgSetId}:`, err)
  }
  return { typeMap, totalCards }
}

/**
 * Fetch a pkmn.gg set page and extract card metadata.
 * pkmn.gg is a Next.js app — its __NEXT_DATA__ blob contains structured card
 * data sourced from pokemontcg.io, including name, artist, hp, supertype,
 * subtypes and types.
 *
 * @param setTotal - DB setTotal value used as fallback when pkmn.gg doesn't
 *   include a totalDisplay field (common on promo/unusual sets).
 */
async function extractCardDataFromPkmnGg(pkmnGgUrl: string, setTotal: number | null): Promise<PkmnCardData[]> {
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

  // pkmn.gg stores its card list at:
  //   • pageProps.cardData  — standard set/series pages
  //   • pageProps.cards     — collection/list pages (e.g. /collections/prize-pack-series-1)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = nextData as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cards: any[] | undefined =
    d?.props?.pageProps?.cardData ?? d?.props?.pageProps?.cards

  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error(
      'No card data found in the pkmn.gg page. ' +
        'Make sure the URL is a set page (e.g. https://www.pkmn.gg/series/scarlet-violet/151) ' +
        'or a collection page (e.g. https://www.pkmn.gg/collections/prize-pack-series-1).',
    )
  }

  // pkmn.gg set-page cardData exposes name, artist, supertype, rarity, types and image URLs.
  // Log first card raw fields to diagnose what's actually available
  if (cards.length > 0) {
    const sample = cards[0]
    console.log('[import-card-data] SAMPLE CARD RAW FIELDS:', {
      id: sample.id,
      dbId: sample.dbId,
      number: sample.number,
      numberDisplay: sample.numberDisplay,
      totalDisplay: sample.totalDisplay,
      set_total: sample.set?.total,
      set_printedTotal: sample.set?.printedTotal,
      rarity: sample.rarity,
      subtypes: sample.subtypes,
      types: sample.types,
      type: sample.type,
      category: sample.category,
      supertype: sample.supertype,
    })
  }

  return cards
    .map((card) => {
      // ── Number: construct "X/Y" format ────────────────────────────────────
      //    Priority order for the total:
      //      1. card.totalDisplay from pkmn.gg (e.g. "088" → 88)
      //      2. setTotal passed in from the DB sets table
      //    If neither is available, fall back to the bare card.number string.
      const bareNumber = parseInt(String(card.number ?? '0'), 10)
      const totalFromDisplay = card.totalDisplay
        ? parseInt(String(card.totalDisplay), 10)
        : null
      const resolvedTotal = totalFromDisplay ?? setTotal
      const number =
        !isNaN(bareNumber) && bareNumber > 0 && resolvedTotal
          ? `${bareNumber}/${resolvedTotal}`
          : String(card.number ?? '')

      // ── Name: normalise "ex" (suffix) → "EX" ─────────────────────────────
      const rawName = card.name ? String(card.name) : null
      const name = rawName ? rawName.replace(/\bex\b/g, 'EX') : null

      // ── Element type ──────────────────────────────────────────────────────
      //    pkmn.gg exposes the element type in multiple places depending on
      //    the set page version.  Check them all; first match wins:
      //      1. card.category — pkmn.gg's own flat field ("Fire", "Water", …)
      //         Present on most set pages including promo sets.
      //      2. card.types   — pokemontcg.io array (["Fire"]), may be absent.
      //      3. card.type    — singular flat field, last resort.
      //    Language codes (EN, JA, …) are rejected by the allowlist in all cases.

      // 1. category (flat string)
      let elementType: string | null = null
      if (typeof card.category === 'string' && POKEMON_ELEMENT_TYPES.has(card.category)) {
        elementType = card.category
      }

      // 2. types array
      if (!elementType) {
        const rawTypes: unknown = card.types
        if (Array.isArray(rawTypes)) {
          const matched = rawTypes.filter(
            (t): t is string => typeof t === 'string' && POKEMON_ELEMENT_TYPES.has(t),
          )
          if (matched.length > 0) elementType = matched.join('/')
        }
      }

      // 3. type singular
      if (!elementType && typeof card.type === 'string' && POKEMON_ELEMENT_TYPES.has(card.type)) {
        elementType = card.type
      }

      const type: string | null = elementType

      // ── Supertype: Pokemon/Trainer/Energy ─────────────────────────────────
      const supertype: string | null = card.supertype ? String(card.supertype) : null

      // ── Rarity ────────────────────────────────────────────────────────────
      //    Try card.rarity first (standard pokemontcg.io field).
      //    For promo cards pkmn.gg sometimes omits this; fall back to
      //    card.rarity from nested set data or leave null.
      const rarity: string | null =
        card.rarity
          ? String(card.rarity)
          : card.set?.rarity
          ? String(card.set.rarity)
          : null

      // ── Image URLs: pkmn.gg may use flat fields (largeImageUrl / thumbImageUrl)
      //    or the nested pokemontcg.io format (images.large / images.small).
      const largeImageUrl =
        card.largeImageUrl
          ? String(card.largeImageUrl)
          : card.images?.large
          ? String(card.images.large)
          : null
      const thumbImageUrl =
        card.thumbImageUrl
          ? String(card.thumbImageUrl)
          : card.images?.small
          ? String(card.images.small)
          : null

      // ── pokemontcg.io card ID ─────────────────────────────────────────────
      //    pkmn.gg's top-level `id` field IS the pokemontcg.io card ID
      //    (e.g. "mcd25-3").  `card.dbId` is an internal pkmn.gg numeric key.
      //    We validate by requiring a hyphen so plain numbers are ignored.
      const tcgCardId: string | null =
        card.id && String(card.id).includes('-') ? String(card.id) : null

      return {
        number,
        name,
        artist: card.artist ? String(card.artist) : null,
        supertype,
        rarity,
        type,
        dbId: tcgCardId,
        largeImageUrl,
        thumbImageUrl,
      }
    })
    .filter((c) => c.number !== '')
}

// ── DB card type ──────────────────────────────────────────────────────────────

interface DbCard {
  id: string
  name: string
  number: string
  artist: string | null
  supertype: string | null
  type: string | null
  image: string | null
}

// ── SSE event types (shared with the frontend component) ─────────────────────

export interface ProgressPayload {
  cardId: string
  /** Card number from the DB (used for display) */
  number: string
  /** Card name currently stored in the DB */
  name: string
  /** Card name sourced from pkmn.gg (may differ from DB name) */
  pkmnName: string | null
  artist: string | null
  supertype: string | null
  type: string | null
  status: 'success' | 'skipped' | 'no_match' | 'failed' | 'created'
  error?: string
  /** True when an image was successfully downloaded and stored during this import */
  imageSaved?: boolean
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
  let body: { pkmnGgUrl?: string; setId?: string; overwrite?: boolean; importImages?: boolean; lookupTypes?: boolean; language?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fix A: parse booleans with strict === true so that stringified "true" or
  // missing fields never accidentally enable/disable these flags.
  const pkmnGgUrl = body.pkmnGgUrl
  const setId = body.setId
  const overwrite = body.overwrite === true
  const importImages = body.importImages === true
  const lookupTypes = body.lookupTypes === true
  const language = body.language === 'ja' ? 'ja' : 'en'
  console.log('[import-card-data] importImages:', importImages, '| overwrite:', overwrite, '| lookupTypes:', lookupTypes, '| language:', language)

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
        // ── Tag the set with its language ────────────────────────────────────
        await supabaseAdmin
          .from('sets')
          .update({ language })
          .eq('set_id', setId)

        // ── Fetch set total from DB (fallback for number formatting) ─────────
        const { data: setRow } = await supabaseAdmin
          .from('sets')
          .select('setTotal, setComplete')
          .eq('set_id', setId)
          .single()
        // Prefer setTotal (excl. secret rares); fall back to setComplete
        const dbSetTotal: number | null =
          setRow?.setTotal ?? setRow?.setComplete ?? null
        console.log('[import-card-data] dbSetTotal for', setId, '=', dbSetTotal)

        // ── Fetch DB cards for this set ──────────────────────────────────────
        const { data: dbCards, error: dbError } = await supabaseAdmin
          .from('cards')
          .select('id, name, number, artist, supertype, type, image')
          .eq('set_id', setId)

        if (dbError || !dbCards) {
          emit({
            type: 'error',
            payload: { message: `DB error: ${dbError?.message ?? 'no cards returned'}` },
          })
          controller.close()
          return
        }

        // Build a lookup map: normalizedNumber → DbCard
        const dbByNumber = new Map<string, DbCard>()
        for (const c of dbCards as DbCard[]) {
          if (c.number) {
            dbByNumber.set(normalizeNumber(c.number), c)
          }
        }

        // ── Fetch pkmn.gg card data ──────────────────────────────────────────
        let pkmnCards: PkmnCardData[]
        try {
          pkmnCards = await extractCardDataFromPkmnGg(pkmnGgUrl, dbSetTotal)
        } catch (err) {
          emit({
            type: 'error',
            payload: { message: err instanceof Error ? err.message : 'Scraping failed' },
          })
          controller.close()
          return
        }

        // ── Batch-fetch element types from pokemontcg.io (one request) ───────
        // Only runs when lookupTypes is enabled. Extract the TCG set ID from
        // the first card's dbId (e.g. "mcd25-3" → tcgSetId "mcd25"), then
        // fetch all cards for that set and build a normalizedNumber→type map.
        const tcgTypeMap = new Map<string, string>()
        let tcgDebug: { firstId: string | null; tcgSetId: string | null; totalCards: number; mapSize: number } = {
          firstId: null, tcgSetId: null, totalCards: 0, mapSize: 0,
        }
        if (lookupTypes) {
          const firstId = pkmnCards.find((c) => c.dbId)?.dbId ?? null
          tcgDebug.firstId = firstId
          if (firstId) {
            // TCG set ID = everything before the last "-"  ("mcd25-3" → "mcd25")
            const tcgSetId = firstId.split('-').slice(0, -1).join('-')
            tcgDebug.tcgSetId = tcgSetId
            console.log(`[import-card-data] TCG batch lookup for set ${tcgSetId} (from dbId ${firstId})`)
            const fetched = await fetchSetTypesFromTcgApi(tcgSetId)
            for (const [k, v] of fetched.typeMap) tcgTypeMap.set(k, v)
            tcgDebug.totalCards = fetched.totalCards
            tcgDebug.mapSize = tcgTypeMap.size
          } else {
            console.warn('[import-card-data] lookupTypes enabled but no card has a dbId — skipping batch fetch')
          }
        }

        emit({ type: 'start', payload: { total: pkmnCards.length, tcgDebug: lookupTypes ? tcgDebug : undefined } })

        // ── Process each card ────────────────────────────────────────────────
        let succeeded = 0
        let skipped = 0
        let failed = 0
        let no_match = 0
        let created = 0

        for (const pkmnCard of pkmnCards) {
          const normNum = normalizeNumber(pkmnCard.number)
          const dbCard = dbByNumber.get(normNum)

          // The best available image URL from pkmn.gg for this card
          const externalImageUrl = pkmnCard.largeImageUrl ?? pkmnCard.thumbImageUrl ?? null
          console.log('[import-card-data] imageUrl:', pkmnCard.largeImageUrl, pkmnCard.thumbImageUrl)

          if (!dbCard) {
            // No existing DB card — INSERT a new one from pkmn.gg data.
            // `id` and `created_at` are auto-generated; `set_id` and `name`
            // are the only NOT NULL columns that must be supplied explicitly.

            // Resolve element type: pkmn.gg value, or batch TCG map lookup.
            const normNumForType = normalizeNumber(pkmnCard.number)
            let resolvedType = pkmnCard.type ?? tcgTypeMap.get(normNumForType) ?? null
            if (resolvedType) console.log(`[import-card-data] type for #${pkmnCard.number} = ${resolvedType}`)

            const insertPayload: Record<string, unknown> = {
              set_id: setId,
              number: pkmnCard.number,
              name: pkmnCard.name ?? '',             // NOT NULL — fall back to ''
              artist: pkmnCard.artist ?? null,
              supertype: pkmnCard.supertype ?? null,  // card category
              rarity: pkmnCard.rarity ?? null,
              type: resolvedType ?? null,             // element type
            }

            // Optionally download and store the card image before inserting.
            // Always use the bare pkmnCard.number for the filename (generateImageFilename
            // splits on '/' anyway, so "100/88" and "100" both produce the same filename).
            let imageSaved = false
            if (importImages && externalImageUrl) {
              console.log('[import-card-data] Attempting image download for new card', pkmnCard.number, externalImageUrl)
              const storedUrl = await downloadAndStoreCardImage(
                externalImageUrl,
                pkmnCard.number,
                setId,
              )
              if (storedUrl) {
                insertPayload.image = storedUrl
                imageSaved = true
              } else {
                console.error('[import-card-data] Image download/upload returned null for new card', pkmnCard.number)
              }
            }

            const { data: inserted, error: insertError } = await supabaseAdmin
              .from('cards')
              .insert(insertPayload)
              .select('id')
              .single()

            if (insertError || !inserted) {
              failed++
              emit({
                type: 'progress',
                payload: {
                  cardId: '',
                  number: pkmnCard.number,
                  name: pkmnCard.name ?? '',
                  pkmnName: pkmnCard.name,
                  artist: pkmnCard.artist,
                  supertype: pkmnCard.supertype,
                  type: pkmnCard.type,
                  status: 'failed',
                  error: insertError?.message ?? 'Insert returned no data',
                } satisfies ProgressPayload,
              })
            } else {
              created++
              emit({
                type: 'progress',
                payload: {
                  cardId: inserted.id,
                  number: pkmnCard.number,
                  name: pkmnCard.name ?? '',
                  pkmnName: pkmnCard.name,
                  artist: pkmnCard.artist,
                  supertype: pkmnCard.supertype,
                  type: pkmnCard.type,
                  status: 'created',
                  imageSaved,
                } satisfies ProgressPayload,
              })
            }
            continue
          }

          // Determine which fields actually need updating
          const dbNameBlank = !dbCard.name.trim()
          const nameNeedsUpdate = pkmnCard.name !== null && (overwrite || dbNameBlank)

          // Whether the card is missing an image and we should try to fetch one
          const needsImage = importImages && !dbCard.image && externalImageUrl !== null

          // Fix bare numbers: if the DB number has no "/" (was imported before the fix)
          // and pkmn.gg provides a formatted number with "/", update it.
          const numberNeedsUpdate =
            pkmnCard.number.includes('/') &&
            (!dbCard.number.includes('/') || overwrite)

          // Whether the DB type column could accept a write at all
          const typeCouldUpdate = dbCard.type === null || overwrite

          // typeNeedsUpdate: there is something to write.
          //  • pkmn.gg already resolved a type, OR
          //  • lookupTypes is on and the card has a dbId we can query
          const typeNeedsUpdate =
            typeCouldUpdate &&
            (pkmnCard.type !== null || (lookupTypes && !!pkmnCard.dbId))

          // Skip the card entirely when overwrite is off and all importable
          // fields (artist, supertype, name, number, type, image) are already populated.
          const alreadyFull =
            !overwrite &&
            dbCard.artist !== null &&
            dbCard.supertype !== null &&
            !nameNeedsUpdate &&
            !numberNeedsUpdate &&
            !typeNeedsUpdate &&
            !needsImage

          if (alreadyFull) {
            skipped++
            emit({
              type: 'progress',
              payload: {
                cardId: dbCard.id,
                number: pkmnCard.number,
                name: dbCard.name,
                pkmnName: pkmnCard.name,
                artist: dbCard.artist,
                supertype: dbCard.supertype,
                type: dbCard.type,
                status: 'skipped',
              } satisfies ProgressPayload,
            })
            continue
          }

          // Only write fields that have actual scraped values — never overwrite with null
          const updatePayload: Record<string, unknown> = {}
          if (pkmnCard.artist !== null) updatePayload.artist = pkmnCard.artist
          if (pkmnCard.supertype !== null) updatePayload.supertype = pkmnCard.supertype
          // Fix previously-bare number ("100" → "100/88") when numberDisplay provides it
          if (numberNeedsUpdate) updatePayload.number = pkmnCard.number
          // Populate name from pkmn.gg when the DB entry is blank or overwrite is on
          if (nameNeedsUpdate && pkmnCard.name !== null) updatePayload.name = pkmnCard.name
          // Resolve element type: use pkmn.gg value; fall back to TCG API lookup
          // when type is still null and lookupTypes is enabled.
          // Resolve element type: pkmn.gg value, or batch TCG map lookup.
          const normNumForType = normalizeNumber(pkmnCard.number)
          const resolvedType = pkmnCard.type ?? tcgTypeMap.get(normNumForType) ?? null
          if (resolvedType) console.log(`[import-card-data] type for #${pkmnCard.number} = ${resolvedType}`)

          // Write element type (Fire, Water, …) when resolved.
          // Use typeCouldUpdate (not typeNeedsUpdate) so TCG-lookup results
          // are always written even though typeNeedsUpdate was true only
          // because of the fallback branch.
          if (resolvedType !== null && typeCouldUpdate) {
            updatePayload.type = resolvedType
          }
          // Clear corrupted type values (language codes like "EN") left from
          // old imports when no valid type was resolved.
          if (resolvedType === null && dbCard.type && /^[A-Z]{1,3}$/.test(dbCard.type)) {
            updatePayload.type = null
          }

          // Download and store the image if requested and the card doesn't already have one
          let imageSaved = false
          if (needsImage && externalImageUrl) {
            const storedUrl = await downloadAndStoreCardImage(
              externalImageUrl,
              pkmnCard.number,
              setId,
            )
            if (storedUrl) {
              updatePayload.image = storedUrl
              imageSaved = true
            }
          }

          if (Object.keys(updatePayload).length === 0) {
            skipped++
            emit({
              type: 'progress',
              payload: {
                cardId: dbCard.id,
                number: pkmnCard.number,
                name: dbCard.name,
                pkmnName: pkmnCard.name,
                artist: pkmnCard.artist,
                supertype: pkmnCard.supertype,
                type: pkmnCard.type,
                status: 'skipped',
              } satisfies ProgressPayload,
            })
            continue
          }

          const { error: updateError } = await supabaseAdmin
            .from('cards')
            .update(updatePayload)
            .eq('id', dbCard.id)

          if (updateError) {
            failed++
            emit({
              type: 'progress',
              payload: {
                cardId: dbCard.id,
                number: pkmnCard.number,
                name: dbCard.name,
                pkmnName: pkmnCard.name,
                artist: pkmnCard.artist,
                supertype: pkmnCard.supertype,
                type: pkmnCard.type,
                status: 'failed',
                error: updateError.message,
              } satisfies ProgressPayload,
            })
          } else {
            succeeded++
            emit({
              type: 'progress',
              payload: {
                cardId: dbCard.id,
                number: pkmnCard.number,
                // Reflect the newly written name when it was updated
                name: updatePayload.name ? String(updatePayload.name) : dbCard.name,
                pkmnName: pkmnCard.name,
                artist: pkmnCard.artist,
                supertype: pkmnCard.supertype,
                type: pkmnCard.type,
                status: 'success',
                imageSaved,
              } satisfies ProgressPayload,
            })
          }
        }

        emit({
          type: 'complete',
          payload: { succeeded, skipped, failed, no_match, created },
        })
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
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// ── GET: inspect raw pkmn.gg card fields ─────────────────────────────────────
// Usage: GET /api/import-card-data?pkmnGgUrl=https://www.pkmn.gg/series/...
// Returns the first 3 raw card objects so you can verify available field names.

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const url = request.nextUrl.searchParams.get('pkmnGgUrl')
  if (!url) {
    return NextResponse.json({ error: 'pkmnGgUrl query param required' }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!response.ok) {
      return NextResponse.json({ error: `pkmn.gg returned HTTP ${response.status}` }, { status: 502 })
    }
    const html = await response.text()
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    )
    if (!match) {
      return NextResponse.json({ error: '__NEXT_DATA__ not found in page' }, { status: 502 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextData = JSON.parse(match[1]) as any
    // Support both set pages (pageProps.cardData) and collection pages (pageProps.cards)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards: any[] | undefined =
      nextData?.props?.pageProps?.cardData ?? nextData?.props?.pageProps?.cards
    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json(
        { error: 'No cardData found in pageProps (tried cardData and cards keys)' },
        { status: 502 },
      )
    }
    // Return the first 3 cards raw so field names are visible
    return NextResponse.json({
      total: cards.length,
      sample: cards.slice(0, 3),
      availableKeys: Object.keys(cards[0] ?? {}),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
