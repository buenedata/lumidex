import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

// Allow Vercel Pro functions to run up to 300s (hobby capped at 10s)
export const maxDuration = 300

// ── Constants ─────────────────────────────────────────────────────────────────

// tcggo.com API via RapidAPI — The RapidAPI version doesn't use /{game}/ prefix;
// that prefix is for the main tcggo.com API which is multi-game. The RapidAPI
// wrapper is poker-specific: https://pokemon-tcg-api.p.rapidapi.com/{endpoint}
const RAPIDAPI_HOST = 'pokemon-tcg-api.p.rapidapi.com'
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`

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
interface TcggoCardmarketPrices {
  currency?:            string
  lowest_near_mint?:    number     // main price
  lowest_near_mint_DE?: number
  lowest_near_mint_FR?: number
  avg_sell_price?:      number
  trend_price?:         number
  avg30?:               number
  graded?: Array<{      // graded card prices
    grade:  string      // e.g. "PSA 10", "BGS 9.5"
    price?: number
  }>
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
    cardmarket?: TcggoCardmarketPrices
    tcgplayer?:  TcggoTcgplayerPrices
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface TcggoResponse {
  data?:      TcggoCard[]
  cards?:     TcggoCard[]
  results?:   TcggoCard[]
  page?:      number
  per_page?:  number
  total?:     number
  totalCount?:number
  count?:     number
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

/** Extract a specific grade price from a graded array. Grade string is partial-matched. */
function findGradePrice(graded: Array<{ grade: string; price?: number }> | undefined, gradeKey: string): number | null {
  if (!graded?.length) return null
  const row = graded.find(g => g.grade?.toLowerCase().includes(gradeKey.toLowerCase()))
  return row?.price ?? null
}

function extractCardPriceUpsert(cardUuid: string, apiCard: TcggoCard): Record<string, unknown> {
  const t  = apiCard.prices?.tcgplayer  ?? {}
  const cm = apiCard.prices?.cardmarket ?? {}

  // TCGPlayer prices
  const tcgp_normal       = t.normal?.market             ?? null
  const tcgp_reverse_holo = t.reverseHolofoil?.market    ?? null
  const tcgp_holo         = t.holofoil?.market           ?? null
  const tcgp_1st_edition  = t['1stEditionHolofoil']?.market ?? null
  const tcgp_market       =
    t.market_price ??
    t.holofoil?.market ??
    t.reverseHolofoil?.market ??
    t.normal?.market ??
    null

  // Graded prices — from tcgplayer.graded array OR cardmarket.graded array
  const tcgpGraded = t.graded
  const cmGraded   = cm.graded
  const tcgp_psa10 = findGradePrice(tcgpGraded, 'psa 10')  ?? findGradePrice(cmGraded, 'psa 10')  ?? null
  const tcgp_psa9  = findGradePrice(tcgpGraded, 'psa 9')   ?? findGradePrice(cmGraded, 'psa 9')   ?? null
  const tcgp_bgs95 = findGradePrice(tcgpGraded, 'bgs 9.5') ?? findGradePrice(cmGraded, 'bgs 9.5') ?? null
  const tcgp_bgs9  = findGradePrice(tcgpGraded, 'bgs 9')   ?? findGradePrice(cmGraded, 'bgs 9')   ?? null
  const tcgp_cgc10 = findGradePrice(tcgpGraded, 'cgc 10')  ?? findGradePrice(cmGraded, 'cgc 10')  ?? null

  // CardMarket prices — actual field is lowest_near_mint (EUR)
  const cm_avg_sell = cm.lowest_near_mint ?? cm.avg_sell_price ?? null
  const cm_low      = cm.lowest_near_mint ?? null
  const cm_trend    = cm.trend_price      ?? null
  const cm_avg_30d  = cm.avg30            ?? null

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
  // 1. Auth guard
  try {
    await requireAdmin()
  } catch (err) {
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

  if (!setId) {
    return new Response(JSON.stringify({ error: 'setId is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 3. Stream SSE
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: unknown) => {
        try { controller.enqueue(sseData(payload)) } catch { /* disconnected */ }
      }
      const startTime = Date.now()

      try {
        // ── Step 1: Load DB cards ───────────────────────────────────────────
        const { data: dbCards, error: dbErr } = await supabaseAdmin
          .from('cards')
          .select('id, number, api_id')
          .eq('set_id', setId)

        if (dbErr || !dbCards) {
          emit({ type: 'error', message: `DB lookup failed: ${dbErr?.message}` })
          controller.close(); return
        }
        if (dbCards.length === 0) {
          emit({ type: 'error', message: `No cards in DB for set "${setId}". Import card data first.` })
          controller.close(); return
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
              controller.close(); return
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const json = await res.json() as TcggoResponse & Record<string, any>
            const apiCards: TcggoCard[] = json.data ?? json.cards ?? json.results ?? []
            totalCards = json.total ?? json.totalCount ?? json.count ?? 0

            if (page === 1) {
              const firstCardKeys = apiCards[0] ? Object.keys(apiCards[0]) : []
              console.log(`[prices/sync] Episode mode response keys:`, Object.keys(json))
              console.log(`[prices/sync] First card keys:`, firstCardKeys)
              emit({
                type:      'api_shape',
                topKeys:   Object.keys(json),
                cardKeys:  firstCardKeys,
                rawCounts: { 'apiCards.length': apiCards.length, total: json.total, totalCount: json.totalCount },
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

            emit({ type: 'progress', page, fetched: apiCards.length, matched, unmatched, totalCards })
            hasMore = page * EPISODE_PAGE_SIZE < totalCards
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
            const apiCards: TcggoCard[] = json.data ?? json.cards ?? json.results ?? []

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
          controller.close(); return
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
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection:      'keep-alive',
    },
  })
}
