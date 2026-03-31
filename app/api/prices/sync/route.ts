import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

// Allow Vercel Pro functions to run up to 300s (hobby capped at 10s)
export const maxDuration = 300

// ── Constants ─────────────────────────────────────────────────────────────────

// Correct RapidAPI host for the tcggo.com / cardmarket Pokémon TCG API.
// Episodes and cards are scoped under the /pokemon path prefix.
// Confirmed working: GET /pokemon/episodes and GET /pokemon/episodes/{id}/cards
const RAPIDAPI_HOST = 'cardmarket-api-tcg.p.rapidapi.com'
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}/pokemon`

// tcggo.com API pagination limits:
// - per_page max 100 when filtering by episode_id
// - per_page max 20 otherwise
const EPISODE_PAGE_SIZE = 100
const BATCH_SIZE        = 50    // Supabase upsert batch size
const FETCH_TIMEOUT_MS  = 30_000 // 30s per API call

// ── SSE helper ────────────────────────────────────────────────────────────────

function sseData(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

// ── Number normalisation ──────────────────────────────────────────────────────

function normalizeNumber(num: string | null | undefined): string {
  if (!num) return ''
  const raw = num.split('/')[0]
  return /^\d+$/.test(raw) ? String(parseInt(raw, 10)) : raw
}

// ── RapidAPI types ────────────────────────────────────────────────────────────

// tcggo.com actual API response structure (confirmed from live API response)

// Graded prices are returned as a nested object:
//   { psa: { psa10: 64, psa9: 29 }, bgs: { bgs95: 120 }, cgc: { cgc10: 80 } }
interface TcggoGradedObject {
  psa?: Record<string, number>
  bgs?: Record<string, number>
  cgc?: Record<string, number>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: Record<string, number> | any
}

interface TcggoCardmarketPrices {
  currency?:            string
  lowest_near_mint?:    number     // main price
  lowest_near_mint_DE?: number
  lowest_near_mint_FR?: number
  avg_sell_price?:      number
  trend_price?:         number
  avg30?:               number          // legacy field name
  '30d_average'?:       number          // actual field returned by tcggo.com API
  '7d_average'?:        number
  // tcggo.com returns graded as a nested object, not an array
  graded?: TcggoGradedObject | Array<{ grade: string; price?: number }>
}

interface TcggoTcgplayerPrices {
  market_price?: number
  low_price?:    number
  mid_price?:    number
  high_price?:   number
  // variant-level prices (if available)
  normal?:             { market?: number }
  reverseHolofoil?:    { market?: number }
  holofoil?:           { market?: number }
  '1stEditionHolofoil'?: { market?: number }
  graded?: Array<{
    grade:  string
    price?: number
  }>
}

interface TcggoCard {
  id:           number | string
  tcgid?:       string        // pokemontcg.io ID e.g. "sv3-223", "me2pt5-1"
  name?:        string
  card_number?: number | string  // NOTE: field is "card_number" not "number"
  episode?:     { id: number; name: string }
  prices?: {
    cardmarket?:  TcggoCardmarketPrices
    tcgplayer?:   TcggoTcgplayerPrices   // fallback (some endpoints use this)
    tcg_player?:  TcggoTcgplayerPrices   // actual field name from tcggo.com API
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface TcggoResponse {
  data?:       TcggoCard[]
  cards?:      TcggoCard[]
  // NOTE: tcggo.com returns `results` as an integer total count, NOT an array of cards
  results?:    number
  page?:       number
  per_page?:   number
  total?:      number
  totalCount?: number
  count?:      number
  // tcggo.com actual pagination wrapper:
  //   paging.total    = total number of PAGES (e.g. 9 for 175 episodes at 20/page)
  //   paging.per_page = items per page
  //   results         = total number of items (e.g. 175)
  paging?:     { total?: number; count?: number; current?: number; per_page?: number }
}

interface TcggoProduct {
  id:       number | string
  tcgid?:   string
  name?:    string
  category?:string
  episode?: { id: number; name: string }
  tcgplayer?: {
    market_price?: number
    low_price?:    number
    high_price?:   number
    url?:          string
  }
  cardmarket?: {
    avg_sell_price?: number
    trend_price?:    number
    url?:            string
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

// ── RapidAPI fetch helper ─────────────────────────────────────────────────────

async function rapidApiFetch(path: string): Promise<Response> {
  const key = process.env.RAPIDAPI_KEY
  if (!key) throw new Error('RAPIDAPI_KEY environment variable is not set')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(`${RAPIDAPI_BASE}${path}`, {
      headers: {
        'x-rapidapi-key':  key,
        'x-rapidapi-host': RAPIDAPI_HOST,
        'Content-Type':    'application/json',
      },
      cache:  'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    if ((err as Error).name === 'AbortError') {
      throw new Error(`RapidAPI request timed out after ${FETCH_TIMEOUT_MS / 1000}s: ${path}`)
    }
    throw err
  }
}

// ── Price extraction ──────────────────────────────────────────────────────────

/**
 * Extract a grade price from the tcggo.com graded structure.
 * The API returns graded as a nested object: { psa: { psa10: 64, psa9: 29 }, bgs: {...} }
 * Falls back to the legacy array format for backwards compatibility.
 */
function extractGradedPrice(
  graded: TcggoGradedObject | Array<{ grade: string; price?: number }> | undefined,
  service: string,   // "psa" | "bgs" | "cgc"
  key:     string,   // "psa10" | "psa9" | "bgs95" | "bgs9" | "cgc10"
): number | null {
  if (!graded) return null
  // Object format: { psa: { psa10: 64 }, ... }
  if (!Array.isArray(graded)) {
    return (graded as TcggoGradedObject)[service]?.[key] ?? null
  }
  // Legacy array format: [{ grade: "PSA 10", price: 64 }]
  const label = `${service} ${key.replace(service, '').replace(/(\d)(\d)$/, '$1.$2')}`.trim()
  const row = (graded as Array<{ grade: string; price?: number }>)
    .find(g => g.grade?.toLowerCase().includes(label.toLowerCase()))
  return row?.price ?? null
}

function extractCardPriceUpsert(cardUuid: string, apiCard: TcggoCard): Record<string, unknown> {
  // tcggo.com API uses "tcg_player" (underscore) not "tcgplayer"
  const t  = apiCard.prices?.tcg_player ?? apiCard.prices?.tcgplayer ?? {}
  const cm = apiCard.prices?.cardmarket ?? {}

  // TCGPlayer prices
  const tcgp_normal       = t.normal?.market                ?? null
  const tcgp_reverse_holo = t.reverseHolofoil?.market       ?? null
  const tcgp_holo         = t.holofoil?.market              ?? null
  const tcgp_1st_edition  = t['1stEditionHolofoil']?.market ?? null
  const tcgp_market       =
    t.market_price ??
    t.holofoil?.market ??
    t.reverseHolofoil?.market ??
    t.normal?.market ??
    null

  // Graded prices — tcggo.com returns { psa: { psa10: N, psa9: N }, bgs: {...}, cgc: {...} }
  // tcg_player graded may also be present; prefer cardmarket graded as it's more reliable
  const tcgpGraded = t.graded
  const cmGraded   = cm.graded
  const tcgp_psa10 = extractGradedPrice(cmGraded, 'psa', 'psa10') ?? extractGradedPrice(tcgpGraded, 'psa', 'psa10') ?? null
  const tcgp_psa9  = extractGradedPrice(cmGraded, 'psa', 'psa9')  ?? extractGradedPrice(tcgpGraded, 'psa', 'psa9')  ?? null
  const tcgp_bgs95 = extractGradedPrice(cmGraded, 'bgs', 'bgs95') ?? extractGradedPrice(tcgpGraded, 'bgs', 'bgs95') ?? null
  const tcgp_bgs9  = extractGradedPrice(cmGraded, 'bgs', 'bgs9')  ?? extractGradedPrice(tcgpGraded, 'bgs', 'bgs9')  ?? null
  const tcgp_cgc10 = extractGradedPrice(cmGraded, 'cgc', 'cgc10') ?? extractGradedPrice(tcgpGraded, 'cgc', 'cgc10') ?? null

  // CardMarket prices — tcggo.com returns "30d_average" not "avg30"
  const cm_avg_sell = cm.lowest_near_mint ?? cm.avg_sell_price ?? null
  const cm_low      = cm.lowest_near_mint ?? null
  const cm_trend    = cm.trend_price      ?? null
  const cm_avg_30d  = cm['30d_average']   ?? cm.avg30          ?? null

  return {
    card_id:           cardUuid,
    api_card_id:       apiCard.tcgid ?? String(apiCard.id),
    tcgp_normal,
    tcgp_reverse_holo,
    tcgp_holo,
    tcgp_1st_edition,
    tcgp_market,
    tcgp_psa10,
    tcgp_psa9,
    tcgp_bgs95,
    tcgp_bgs9,
    tcgp_cgc10,
    cm_avg_sell,
    cm_low,
    cm_trend,
    cm_avg_30d,
    fetched_at: new Date().toISOString(),
  }
}

function normalizeProductType(category: string | undefined): string {
  const c = (category ?? '').toLowerCase()
  if (c.includes('booster box'))                   return 'Booster Box'
  if (c.includes('booster pack') || c === 'pack')  return 'Booster Pack'
  if (c.includes('elite trainer') || c === 'etb')  return 'ETB'
  if (c.includes('collection'))                    return 'Collection'
  if (c.includes('tin'))                           return 'Tin'
  return 'Other'
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log('[prices/sync] POST handler invoked')

  // 1. Auth guard
  try {
    await requireAdmin()
    console.log('[prices/sync] Auth OK')
  } catch (err) {
    console.log('[prices/sync] Auth FAILED:', err instanceof Error ? err.message : err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 2. Parse body
  // apiSetId: the tcggo.com episode_id (integer string) for this set.
  //           If omitted, the route attempts to use cards' tcgid (api_id) for direct lookup.
  let body: { setId?: string; apiSetId?: string }
  try { body = await request.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const setId          = body.setId?.trim()
  const episodeId      = body.apiSetId?.trim() // tcggo.com episode_id (integer)
  const episodeIsInt   = episodeId ? /^\d+$/.test(episodeId) : false

  console.log('[prices/sync] Body received — setId:', setId, '| apiSetId (episodeId):', episodeId ?? '(none — stale closure?)')

  if (!setId) {
    return new Response(JSON.stringify({ error: 'setId is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 3. Stream SSE
  // Use TransformStream + fire-and-forget IIFE so the async work is in-flight
  // BEFORE we return the Response.  With ReadableStream({ async start() }), Vercel
  // can terminate the serverless function before the async start() begins, producing
  // a 200 with an empty body.  The IIFE pattern guarantees the writer is already
  // active when the client starts reading.
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  const emit = (payload: unknown) => {
    try { void writer.write(sseData(payload)) } catch { /* disconnected */ }
  }

  // ⬇ fire-and-forget: MUST be called before `return new Response(readable, ...)`
  ;(async () => {
    console.log('[prices/sync] Sync worker started — setId:', setId, 'episodeId:', episodeId ?? '(none)')
    const startTime = Date.now()

    try {
        // ── Step 1: Load DB cards ───────────────────────────────────────────
        const { data: dbCards, error: dbErr } = await supabaseAdmin
          .from('cards')
          .select('id, number, api_id')
          .eq('set_id', setId)

        if (dbErr || !dbCards) {
          emit({ type: 'error', message: `DB lookup failed: ${dbErr?.message}` })
          await writer.close().catch(() => {}); return
        }
        if (dbCards.length === 0) {
          emit({ type: 'error', message: `No cards in DB for set "${setId}". Import card data first.` })
          await writer.close().catch(() => {}); return
        }

        // Build lookup maps
        const apiIdMap   = new Map<string, string>()   // tcgid (e.g. sv14-1) → DB uuid
        const numberMap  = new Map<string, string>()   // normalized card number → DB uuid
        const missingApiId = new Set<string>()

        for (const card of dbCards) {
          const uuid = card.id as string
          numberMap.set(normalizeNumber(String(card.number ?? '')), uuid)
          if (card.api_id) {
            apiIdMap.set(card.api_id as string, uuid)
          } else {
            missingApiId.add(uuid)
          }
        }

        const cardsWithTcgId = dbCards.filter(c => c.api_id)
        const useEpisodeMode = episodeIsInt
        const useTcgIdMode   = cardsWithTcgId.length > 0

        emit({
          type:           'start',
          setId,
          episodeId:      episodeId ?? null,
          mode:           useEpisodeMode ? 'episode_id' : useTcgIdMode ? 'tcgid_batch' : 'number_match_fallback',
          dbCardCount:    dbCards.length,
          cardsWithTcgId: cardsWithTcgId.length,
          message:        useEpisodeMode
            ? `Fetching via episode_id=${episodeId}…`
            : useTcgIdMode
              ? `Fetching ${cardsWithTcgId.length} cards via tcgid batch lookup…`
              : `No tcgids — will attempt set_id filter fallback`,
        })

        let matched   = 0
        let unmatched = 0
        const priceUpserts: Record<string, unknown>[] = []
        const apiIdBackfills: { uuid: string; tcgid: string }[] = []

        // ── Step 2a: Episode-ID mode ─────────────────────────────────────────
        // Correct endpoint: GET /episodes/{episodeId}/cards (path param, not query)
        if (useEpisodeMode) {
          let page = 1
          let totalCards = 0
          let hasMore = true

          while (hasMore) {
            const apiPath = `/episodes/${encodeURIComponent(episodeId!)}/cards?per_page=${EPISODE_PAGE_SIZE}&page=${page}`
            emit({ type: 'fetching', message: `Calling API: ${apiPath}`, page })

            const res = await rapidApiFetch(apiPath)
            emit({ type: 'fetched', httpStatus: res.status, page, ok: res.ok })

            if (!res.ok) {
              // Read body for more info
              const errBody = await res.text().catch(() => '')
              emit({ type: 'error', message: `RapidAPI HTTP ${res.status}: ${errBody.slice(0, 200)}` })
              await writer.close().catch(() => {}); return
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const json = await res.json() as TcggoResponse & Record<string, any>
            const apiCards: TcggoCard[] = json.data ?? json.cards ?? []
            // tcggo.com: `results` is the integer total card count; `paging.total` is total pages
            if (page === 1) {
              console.log('[prices/sync] paging object:', JSON.stringify(json.paging ?? null))
              console.log('[prices/sync] results (total items):', json.results)
            }
            // Prefer `results` (total items), fall back to legacy fields
            totalCards = json.results ?? json.total ?? json.totalCount ?? json.count ?? 0

            if (page === 1) {
              const firstCard   = apiCards[0]
              const firstCardKeys = firstCard ? Object.keys(firstCard) : []
              // Log the full price shape of the first card so we can see the actual API structure
              console.log(`[prices/sync] Episode mode response keys:`, Object.keys(json))
              console.log(`[prices/sync] First card keys:`, firstCardKeys)
              console.log(`[prices/sync] First card prices field:`, JSON.stringify(firstCard?.prices ?? null))
              console.log(`[prices/sync] First card tcgplayer (top-level):`, JSON.stringify((firstCard as Record<string,unknown>)?.tcgplayer ?? null))
              console.log(`[prices/sync] First card cardmarket (top-level):`, JSON.stringify((firstCard as Record<string,unknown>)?.cardmarket ?? null))
              emit({
                type:      'api_shape',
                topKeys:   Object.keys(json),
                cardKeys:  firstCardKeys,
                rawCounts: {
                  'apiCards.length': apiCards.length,
                  total:             json.total,
                  totalCount:        json.totalCount,
                  count:             json.count,
                  paging:            JSON.stringify(json.paging ?? null),
                },
              })
            }

            for (const apiCard of apiCards) {
              const tcgid   = apiCard.tcgid ?? null
              // API field is card_number (integer), not number
              const normNum = normalizeNumber(String(apiCard.card_number ?? ''))
              const uuid    = (tcgid ? apiIdMap.get(tcgid) : null) ?? numberMap.get(normNum)

              if (!uuid) { unmatched++; continue }
              matched++
              priceUpserts.push(extractCardPriceUpsert(uuid, apiCard))
              if (tcgid && missingApiId.has(uuid)) apiIdBackfills.push({ uuid, tcgid })
            }

            emit({ type: 'progress', page, fetched: apiCards.length, matched, unmatched, totalApiCards: totalCards })

            // If the API returned a total count, use it; otherwise keep paginating
            // as long as we received a full page (guards against APIs that omit totals).
            if (totalCards > 0) {
              hasMore = page * EPISODE_PAGE_SIZE < totalCards
            } else {
              hasMore = apiCards.length === EPISODE_PAGE_SIZE
            }
            page++
          }
        }
        // ── Step 2b: tcgid batch lookup mode ─────────────────────────────────
        else if (useTcgIdMode) {
          const tcgids = cardsWithTcgId.map(c => c.api_id as string)
          const BATCH  = 20  // API max per batch

          for (let i = 0; i < tcgids.length; i += BATCH) {
            const chunk = tcgids.slice(i, i + BATCH)
            const res   = await rapidApiFetch(`/cards?tcgids=${chunk.map(encodeURIComponent).join(',')}&per_page=${BATCH}`)

            if (!res.ok) {
              emit({ type: 'warning', message: `Batch ${Math.ceil(i / BATCH) + 1}: HTTP ${res.status}` })
              continue
            }

            const json: TcggoResponse = await res.json()
            const apiCards: TcggoCard[] = json.data ?? json.cards ?? []

            if (i === 0) {
              const firstCardKeys = apiCards[0] ? Object.keys(apiCards[0]) : []
              console.log(`[prices/sync] tcgid batch first card keys:`, firstCardKeys)
              emit({ type: 'api_shape', topKeys: Object.keys(json), cardKeys: firstCardKeys, rawCounts: { 'batch.length': apiCards.length } })
            }

            for (const apiCard of apiCards) {
              const tcgid   = apiCard.tcgid ?? null
              const normNum = normalizeNumber(String(apiCard.card_number ?? ''))
              const uuid    = (tcgid ? apiIdMap.get(tcgid) : null) ?? numberMap.get(normNum)
              if (!uuid) { unmatched++; continue }
              matched++
              priceUpserts.push(extractCardPriceUpsert(uuid, apiCard))
            }

            emit({ type: 'progress', page: Math.ceil(i / BATCH) + 1, fetched: apiCards.length, matched, unmatched, totalCards: tcgids.length })
          }
        }
        // ── Step 2c: No tcgid / no episode_id ────────────────────────────────
        else {
          emit({
            type: 'error',
            message: 'No cards have tcgid (api_id) and no episode_id provided. ' +
              'Either re-import card data so cards get their tcgid populated, ' +
              'or enter the tcggo.com episode_id for this set in the "API Set ID" field.',
          })
          await writer.close().catch(() => {}); return
        }

        // ── Step 2.5: pokemontcg.io supplemental fetch ───────────────────────
        // tcggo.com doesn't return TCGPlayer variant prices (normal/reverseHolo/holo)
        // or CardMarket trend.  pokemontcg.io has both — we merge it in here.
        const ptcgoSetId = (() => {
          const firstTcgId = dbCards.find(c => c.api_id)?.api_id as string | undefined
          if (!firstTcgId) return null
          // Strip the card-number suffix after the last hyphen.
          // Works for numeric ("sv13-1" → "sv13"), alphanumeric ("swsh12pt5gg-GG1" → "swsh12pt5gg"),
          // and promo-style suffixes ("swsh8-183" → "swsh8", "sv8pt5-1" → "sv8pt5").
          const idx = firstTcgId.lastIndexOf('-')
          return idx > 0 ? firstTcgId.slice(0, idx) : null
        })()

        if (ptcgoSetId) {
          emit({ type: 'fetching', message: `pokemontcg.io: fetching set ${ptcgoSetId}…`, page: 0 })
          try {
            const ptcgoKey = process.env.POKEMONTCG_API_KEY
            const ptcgoHeaders: Record<string, string> = {}
            if (ptcgoKey) ptcgoHeaders['X-Api-Key'] = ptcgoKey

            let ptcgoPage = 1
            let ptcgoDone = false
            let ptcgoMerged = 0

            while (!ptcgoDone) {
              const controller2 = new AbortController()
              const t2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT_MS)
              let ptcgoRes: Response
              try {
                ptcgoRes = await fetch(
                  `https://api.pokemontcg.io/v2/cards?q=set.id:${encodeURIComponent(ptcgoSetId)}&pageSize=250&page=${ptcgoPage}`,
                  { headers: ptcgoHeaders, cache: 'no-store', signal: controller2.signal },
                )
              } finally { clearTimeout(t2) }

              if (!ptcgoRes.ok) {
                emit({ type: 'warning', message: `pokemontcg.io HTTP ${ptcgoRes.status} — variant prices unavailable` })
                break
              }

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const ptcgoJson = await ptcgoRes.json() as { data?: any[]; totalCount?: number; count?: number }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const ptcgoCards: any[] = ptcgoJson.data ?? []

              for (const pc of ptcgoCards) {
                const uuid = apiIdMap.get(pc.id as string)
                          ?? numberMap.get(normalizeNumber(String(pc.number ?? '')))
                if (!uuid) continue

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tp: any = pc.tcgplayer?.prices  ?? {}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cm2: any = pc.cardmarket?.prices ?? {}

                const tcgp_normal       = tp.normal?.market                ?? null
                const tcgp_reverse_holo = tp.reverseHolofoil?.market       ?? null
                const tcgp_holo         = tp.holofoil?.market              ?? null
                const tcgp_1st_edition  = tp['1stEditionHolofoil']?.market ?? tp['1stEditionNormal']?.market ?? null
                const tcgp_market_p     = tp.holofoil?.market ?? tp.reverseHolofoil?.market ?? tp.normal?.market ?? null
                const cm_trend          = cm2.trendPrice       ?? null
                const cm_avg_30d_p      = cm2.avg30            ?? null
                const cm_avg_sell_p     = cm2.averageSellPrice ?? null
                const cm_low_p          = cm2.lowPrice         ?? null

                const existingIdx = priceUpserts.findIndex(r => r.card_id === uuid)
                if (existingIdx >= 0) {
                  const row = priceUpserts[existingIdx]
                  // Always overwrite variant prices (pokemontcg.io is the authoritative source)
                  if (tcgp_normal       != null) row.tcgp_normal       = tcgp_normal
                  if (tcgp_reverse_holo != null) row.tcgp_reverse_holo = tcgp_reverse_holo
                  if (tcgp_holo         != null) row.tcgp_holo         = tcgp_holo
                  if (tcgp_1st_edition  != null) row.tcgp_1st_edition  = tcgp_1st_edition
                  if (cm_trend          != null) row.cm_trend          = cm_trend
                  // Fill gaps only (don't overwrite tcggo.com values)
                  if (tcgp_market_p != null && row.tcgp_market == null) row.tcgp_market = tcgp_market_p
                  if (cm_avg_30d_p  != null && row.cm_avg_30d  == null) row.cm_avg_30d  = cm_avg_30d_p
                  if (cm_avg_sell_p != null && row.cm_avg_sell == null) row.cm_avg_sell = cm_avg_sell_p
                  if (cm_low_p      != null && row.cm_low      == null) row.cm_low      = cm_low_p
                } else {
                  // Card wasn't found by tcggo.com — add pokemontcg.io-only row
                  priceUpserts.push({
                    card_id: uuid, api_card_id: pc.id as string,
                    tcgp_normal, tcgp_reverse_holo, tcgp_holo, tcgp_1st_edition,
                    tcgp_market: tcgp_market_p,
                    tcgp_psa10: null, tcgp_psa9: null, tcgp_bgs95: null, tcgp_bgs9: null, tcgp_cgc10: null,
                    cm_avg_sell: cm_avg_sell_p, cm_low: cm_low_p, cm_trend, cm_avg_30d: cm_avg_30d_p,
                    fetched_at: new Date().toISOString(),
                  })
                  matched++
                }
                ptcgoMerged++
              }

              const pageTotal = ptcgoJson.totalCount ?? 0
              ptcgoDone = pageTotal > 0 ? ptcgoPage * 250 >= pageTotal : ptcgoCards.length < 250
              ptcgoPage++
            }

            emit({ type: 'fetched', httpStatus: 200, page: 0, ok: true,
              message: `pokemontcg.io merged ${ptcgoMerged} cards` })
          } catch (ptcgoErr) {
            emit({ type: 'warning', message: `pokemontcg.io failed (non-critical): ${ptcgoErr instanceof Error ? ptcgoErr.message : String(ptcgoErr)}` })
          }
        }

        // ── Step 3: Upsert card prices ────────────────────────────────────────
        let upsertedCount = 0
        for (let i = 0; i < priceUpserts.length; i += BATCH_SIZE) {
          const batch = priceUpserts.slice(i, i + BATCH_SIZE)
          const { error: uErr } = await supabaseAdmin
            .from('card_prices')
            .upsert(batch, { onConflict: 'card_id' })
          if (uErr) {
            emit({ type: 'warning', message: `Upsert batch failed: ${uErr.message}` })
          } else {
            upsertedCount += batch.length
          }
        }

        // ── Step 3.5: Record price history snapshot ───────────────────────────
        // One row per non-null variant price per card. Powers the Price tab chart.
        const historyRows: Record<string, unknown>[] = []
        const historyTs = new Date().toISOString()
        for (const row of priceUpserts) {
          const cid = row.card_id as string
          const variants: [string, string][] = [
            ['normal',       'tcgp_normal'],
            ['reverse_holo', 'tcgp_reverse_holo'],
            ['holo',         'tcgp_holo'],
            ['1st_edition',  'tcgp_1st_edition'],
          ]
          for (const [variantKey, field] of variants) {
            const price = (row as Record<string, unknown>)[field]
            if (price != null) {
              historyRows.push({
                card_id:     cid,
                variant_key: variantKey,
                price_usd:   price,
                source:      'tcgplayer',
                recorded_at: historyTs,
              })
            }
          }
        }
        if (historyRows.length > 0) {
          let historyInserted = 0
          for (let i = 0; i < historyRows.length; i += BATCH_SIZE) {
            const batch = historyRows.slice(i, i + BATCH_SIZE)
            const { error: hErr } = await supabaseAdmin
              .from('card_price_history')
              .insert(batch)
            if (hErr) {
              emit({ type: 'warning', message: `Price history insert failed: ${hErr.message}` })
            } else {
              historyInserted += batch.length
            }
          }
          emit({ type: 'history', count: historyInserted })
        }

        // ── Step 4: Backfill tcgid → api_id ──────────────────────────────────
        for (const { uuid, tcgid } of apiIdBackfills) {
          await supabaseAdmin.from('cards').update({ api_id: tcgid }).eq('id', uuid)
        }
        if (apiIdBackfills.length > 0) emit({ type: 'backfill', count: apiIdBackfills.length })

        // ── Step 5: Products ─────────────────────────────────────────────────
        let productCount = 0
        try {
          // Products via episode path: GET /episodes/{id}/products
          const prodPath = useEpisodeMode
            ? `/episodes/${encodeURIComponent(episodeId!)}/products?per_page=100`
            : null

          if (prodPath) {
            const prodRes = await rapidApiFetch(prodPath)
            if (prodRes.ok) {
              const prodJson       = await prodRes.json() as { data?: TcggoProduct[]; results?: TcggoProduct[] }
              const products: TcggoProduct[] = prodJson.data ?? prodJson.results ?? []
              if (products.length > 0) {
                const productRows = products.map(p => ({
                  set_id:         setId,
                  api_product_id: String(p.id),
                  name:           p.name ?? 'Unknown Product',
                  product_type:   normalizeProductType(p.category),
                  tcgp_market:    p.tcgplayer?.market_price ?? null,
                  tcgp_low:       p.tcgplayer?.low_price    ?? null,
                  tcgp_high:      p.tcgplayer?.high_price   ?? null,
                  tcgp_url:       p.tcgplayer?.url          ?? null,
                  cm_avg_sell:    p.cardmarket?.avg_sell_price ?? null,
                  cm_trend:       p.cardmarket?.trend_price    ?? null,
                  cm_url:         p.cardmarket?.url ?? null,
                  fetched_at:     new Date().toISOString(),
                }))
                const { error: pErr } = await supabaseAdmin
                  .from('set_products')
                  .upsert(productRows, { onConflict: 'api_product_id' })
                if (!pErr) {
                  productCount = products.length
                  emit({ type: 'products', count: productCount })
                }
              }
            }
          }
        } catch { /* products not critical */ }

        // ── Done ─────────────────────────────────────────────────────────────
        emit({
          type:          'complete',
          setId,
          matched,
          unmatched,
          upsertedCount,
          productCount,
          backfillCount: apiIdBackfills.length,
          elapsed:       Date.now() - startTime,
        })

      } catch (err) {
        emit({ type: 'error', message: err instanceof Error ? err.message : 'Unexpected error' })
      } finally {
        await writer.close().catch(() => {})
      }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
