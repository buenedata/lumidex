import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const RAPIDAPI_HOST = 'pokemon-tcg-api.p.rapidapi.com'
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`
const PAGE_SIZE     = 250   // maximum cards per page
const BATCH_SIZE    = 50    // upsert batch size to stay within Supabase payload limits

// ── Helpers ───────────────────────────────────────────────────────────────────

function sseData(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

/**
 * Strips leading zeros and the "/total" suffix from a card number.
 * "012/165" → "12",  "TG01" → "TG01",  "001" → "1"
 * Returns "" for null/undefined inputs (card is skipped in matching).
 */
function normalizeNumber(num: string | null | undefined): string {
  if (!num) return ''
  const raw = num.split('/')[0]
  // Preserve non-numeric prefixes like "TG", "GG", "SWSH"
  const onlyDigits = /^\d+$/.test(raw)
  return onlyDigits ? String(parseInt(raw, 10)) : raw
}

// ── RapidAPI types ────────────────────────────────────────────────────────────

interface TcgpPriceEntry {
  low?:    number
  mid?:    number
  high?:   number
  market?: number
}

interface TcgpPrices {
  normal?:                 TcgpPriceEntry
  reverseHolofoil?:        TcgpPriceEntry
  holofoil?:               TcgpPriceEntry
  '1stEditionHolofoil'?:   TcgpPriceEntry
  '1stEditionNormal'?:     TcgpPriceEntry
  // Graded variants — key names logged on first sync for verification
  gradedPsa10?:            TcgpPriceEntry
  gradedPsa9?:             TcgpPriceEntry
  gradedBgs9_5?:           TcgpPriceEntry
  gradedBgs9?:             TcgpPriceEntry
  gradedCgc10?:            TcgpPriceEntry
  // Alternate key formats that some API versions use
  'PSA 10'?:               TcgpPriceEntry
  'PSA 9'?:                TcgpPriceEntry
  'BGS 9.5'?:              TcgpPriceEntry
  'BGS 9'?:                TcgpPriceEntry
  'CGC 10'?:               TcgpPriceEntry
}

interface RapidApiCard {
  id:      string
  number:  string
  tcgplayer?: {
    updatedAt?: string
    prices?:    TcgpPrices
  }
  cardmarket?: {
    updatedAt?: string
    prices?: {
      averageSellPrice?: number
      lowPrice?:         number
      trendPrice?:       number
      avg30?:            number
    }
  }
}

interface RapidApiResponse {
  // pokemontcg.io standard field names
  data?:       RapidApiCard[]
  page?:       number
  pageSize?:   number
  count?:      number
  totalCount?: number
  // Alternative field names used by some RapidAPI wrappers
  cards?:      RapidApiCard[]
  results?:    RapidApiCard[]
  total?:      number
  per_page?:   number
  total_pages?: number
}

interface RapidApiProduct {
  id:       string
  name:     string
  set?:     { id: string }
  category?: string
  tcgplayer?: {
    url?: string
    prices?: { normal?: { market?: number; low?: number; high?: number } }
  }
  cardmarket?: {
    url?: string
    prices?: { averageSellPrice?: number; trendPrice?: number }
  }
}

interface RapidApiProductResponse {
  data:       RapidApiProduct[]
  totalCount: number
}

// ── RapidAPI fetch helper ─────────────────────────────────────────────────────

async function rapidApiFetch(path: string): Promise<Response> {
  const key = process.env.RAPIDAPI_KEY
  if (!key) throw new Error('RAPIDAPI_KEY environment variable is not set')

  return fetch(`${RAPIDAPI_BASE}${path}`, {
    headers: {
      'x-rapidapi-key':  key,
      'x-rapidapi-host': RAPIDAPI_HOST,
      'Content-Type':    'application/json',
    },
    cache: 'no-store',
  })
}

// ── Price extraction helpers ──────────────────────────────────────────────────

/** Extract the best "market" price for graded variants, trying multiple key formats. */
function extractGradedPrice(prices: TcgpPrices, ...keys: (keyof TcgpPrices)[]): number | null {
  for (const key of keys) {
    const entry = prices[key] as TcgpPriceEntry | undefined
    if (entry?.market != null) return entry.market
  }
  return null
}

function buildCardPriceUpsert(
  cardId:     string,
  apiCardId:  string,
  card:       RapidApiCard,
): Record<string, unknown> {
  const t = card.tcgplayer?.prices ?? {}
  const cm = card.cardmarket?.prices

  // Best market price: holofoil → reverse → normal → 1st edition
  const tcgp_market =
    t.holofoil?.market ??
    t.reverseHolofoil?.market ??
    t.normal?.market ??
    t['1stEditionHolofoil']?.market ??
    t['1stEditionNormal']?.market ??
    null

  return {
    card_id:           cardId,
    api_card_id:       apiCardId,
    tcgp_normal:       t.normal?.market           ?? null,
    tcgp_reverse_holo: t.reverseHolofoil?.market  ?? null,
    tcgp_holo:         t.holofoil?.market         ?? null,
    tcgp_1st_edition:  t['1stEditionHolofoil']?.market ?? t['1stEditionNormal']?.market ?? null,
    tcgp_market,
    // Graded — try both camelCase and spaced key formats
    tcgp_psa10:  extractGradedPrice(t, 'gradedPsa10', 'PSA 10'),
    tcgp_psa9:   extractGradedPrice(t, 'gradedPsa9',  'PSA 9'),
    tcgp_bgs95:  extractGradedPrice(t, 'gradedBgs9_5','BGS 9.5'),
    tcgp_bgs9:   extractGradedPrice(t, 'gradedBgs9',  'BGS 9'),
    tcgp_cgc10:  extractGradedPrice(t, 'gradedCgc10', 'CGC 10'),
    // CardMarket
    cm_avg_sell:     cm?.averageSellPrice ?? null,
    cm_low:          cm?.lowPrice         ?? null,
    cm_trend:        cm?.trendPrice       ?? null,
    cm_avg_30d:      cm?.avg30            ?? null,
    tcgp_updated_at: card.tcgplayer?.updatedAt ?? null,
    cm_updated_at:   card.cardmarket?.updatedAt ?? null,
    fetched_at:      new Date().toISOString(),
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
  // 1. Auth guard — admin only
  try {
    await requireAdmin()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 2. Parse body
  let body: { setId?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const setId = body.setId?.trim()
  if (!setId) {
    return new Response(JSON.stringify({ error: 'setId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 3. Stream SSE response
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: unknown) => {
        try { controller.enqueue(sseData(payload)) } catch { /* client disconnected */ }
      }
      const startTime = Date.now()

      try {
        // ── Step 1: Load DB cards for this set ──────────────────────────────
        const { data: dbCards, error: dbErr } = await supabaseAdmin
          .from('cards')
          .select('id, number, api_id')
          .eq('set_id', setId)

        if (dbErr || !dbCards) {
          emit({ type: 'error', message: `DB card lookup failed: ${dbErr?.message}` })
          controller.close()
          return
        }

        if (dbCards.length === 0) {
          emit({ type: 'error', message: `No cards found in DB for set "${setId}". Import card data first.` })
          controller.close()
          return
        }

        // Build lookup maps
        // Primary:  api_id (exact match)  → card UUID
        // Fallback: normalized number     → card UUID  (safe within a single set)
        const apiIdMap  = new Map<string, string>()   // "sv1-25" → uuid
        const numberMap = new Map<string, string>()   // "25"     → uuid
        const missingApiId = new Set<string>()        // uuids that need api_id backfilled

        for (const card of dbCards) {
          const uuid = card.id as string
          numberMap.set(normalizeNumber(String(card.number ?? '')), uuid)
          if (card.api_id) {
            apiIdMap.set(card.api_id as string, uuid)
          } else {
            missingApiId.add(uuid)
          }
        }

        emit({
          type: 'start',
          setId,
          dbCardCount: dbCards.length,
          message: `Fetching prices for ${dbCards.length} cards from RapidAPI…`,
        })

        // ── Step 2: Paginate RapidAPI cards ─────────────────────────────────
        let page = 1
        let totalApiCards = 0
        let matched   = 0
        let unmatched = 0
        const priceUpserts: Record<string, unknown>[] = []
        const apiIdBackfills: { uuid: string; apiCardId: string }[] = []

        // Log all price keys seen on the first card — helps verify graded key names
        let gradedKeysLogged = false

        // Determine which filter syntax the API uses on the first page
        // We try q=set.id:{setId} first (pokemontcg.io v2 standard), then fallback to set_id=
        let cardQueryFilter = `q=set.id:${encodeURIComponent(setId)}`

        let hasMore = true
        while (hasMore) {
          const res = await rapidApiFetch(
            `/cards?${cardQueryFilter}&per_page=${PAGE_SIZE}&page=${page}`,
          )

          if (!res.ok) {
            emit({ type: 'error', message: `RapidAPI HTTP ${res.status} on page ${page}` })
            controller.close()
            return
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const json = await res.json() as RapidApiResponse & Record<string, any>

          // Support multiple response shapes
          const apiCards: RapidApiCard[] = json.data ?? json.cards ?? json.results ?? []
          totalApiCards = json.totalCount ?? json.total ?? json.count ?? 0

          // Probe the response shape on the first page and emit for debugging
          if (page === 1) {
            const topKeys = Object.keys(json)
            const firstItem = apiCards[0]
            const cardKeys = firstItem ? Object.keys(firstItem) : []
            console.log(`[prices/sync] Response top-level keys:`, topKeys)
            console.log(`[prices/sync] Cards returned: ${apiCards.length}, totalApiCards: ${totalApiCards}`)
            console.log(`[prices/sync] First card keys:`, cardKeys)
            emit({
              type:        'api_shape',
              topKeys,
              cardKeys,
              rawCounts: {
                'apiCards.length': apiCards.length,
                data:       json.data?.length,
                cards:      json.cards?.length,
                results:    json.results?.length,
                totalCount: json.totalCount,
                total:      json.total,
                count:      json.count,
              },
            })

            // If q=set.id: returned 0 cards, try the set_id= param format
            if (apiCards.length === 0 && cardQueryFilter.startsWith('q=')) {
              console.log(`[prices/sync] q=set.id: returned 0 cards — retrying with set_id= param`)
              cardQueryFilter = `set_id=${encodeURIComponent(setId)}`
              emit({ type: 'debug', message: `q=set.id: returned 0 — retrying with set_id=` })

              const retryRes = await rapidApiFetch(
                `/cards?${cardQueryFilter}&per_page=${PAGE_SIZE}&page=${page}`,
              )
              if (retryRes.ok) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const retryJson = await retryRes.json() as RapidApiResponse & Record<string, any>
                const retryCards: RapidApiCard[] = retryJson.data ?? retryJson.cards ?? retryJson.results ?? []
                totalApiCards = retryJson.totalCount ?? retryJson.total ?? retryJson.count ?? 0
                emit({
                  type: 'api_shape',
                  topKeys:  Object.keys(retryJson),
                  cardKeys: retryCards[0] ? Object.keys(retryCards[0]) : [],
                  rawCounts: {
                    'retry apiCards.length': retryCards.length,
                    totalCount: retryJson.totalCount,
                    total:      retryJson.total,
                    count:      retryJson.count,
                  },
                })
                // If the retry worked, use those cards instead
                if (retryCards.length > 0) {
                  // Process retry cards by appending to the outer scope
                  for (const apiCard of retryCards) {
                    if (!apiCard.id) { unmatched++; continue }
                    const normNum = normalizeNumber(apiCard.number ?? '')
                    const cardUuid = apiIdMap.get(apiCard.id) ?? numberMap.get(normNum)
                    if (!cardUuid) { unmatched++; continue }
                    matched++
                    priceUpserts.push(buildCardPriceUpsert(cardUuid, apiCard.id, apiCard))
                    if (missingApiId.has(cardUuid)) apiIdBackfills.push({ uuid: cardUuid, apiCardId: apiCard.id })
                  }
                  hasMore = page * PAGE_SIZE < totalApiCards
                  page++
                  emit({ type: 'progress', page: page - 1, fetched: retryCards.length, matched, unmatched, totalApiCards })
                  continue
                }
              }
            }
          } // end if (page === 1)

          // Log price keys on first card of first page
          if (!gradedKeysLogged && apiCards.length > 0) {
            const samplePriceKeys = Object.keys(apiCards[0].tcgplayer?.prices ?? {})
            console.log(`[prices/sync] TCGPlayer price keys for ${setId}:`, samplePriceKeys)
            emit({ type: 'debug', priceKeys: samplePriceKeys, sample: apiCards[0].id })
            gradedKeysLogged = true
          }

          for (const apiCard of apiCards) {
            // Guard: skip cards with no number (shouldn't happen but API can return partial data)
            if (!apiCard.id) { unmatched++; continue }
            const normNum = normalizeNumber(apiCard.number ?? '')
            const cardUuid =
              apiIdMap.get(apiCard.id) ??          // exact match via stored api_id
              numberMap.get(normNum)               // fallback: normalized number within set

            if (!cardUuid) {
              unmatched++
              console.warn(`[prices/sync] No DB card for API card ${apiCard.id} (set ${setId}, number ${apiCard.number})`)
              continue
            }

            matched++
            priceUpserts.push(buildCardPriceUpsert(cardUuid, apiCard.id, apiCard))

            // Track api_id backfills needed
            if (missingApiId.has(cardUuid)) {
              apiIdBackfills.push({ uuid: cardUuid, apiCardId: apiCard.id })
            }
          }

          emit({
            type: 'progress',
            page,
            fetched: apiCards.length,
            matched,
            unmatched,
            totalApiCards,
          })

          hasMore = page * PAGE_SIZE < totalApiCards
          page++
        }

        // ── Step 3: Upsert card prices in batches ────────────────────────────
        let upsertedCount = 0
        for (let i = 0; i < priceUpserts.length; i += BATCH_SIZE) {
          const batch = priceUpserts.slice(i, i + BATCH_SIZE)
          const { error: upsertErr } = await supabaseAdmin
            .from('card_prices')
            .upsert(batch, { onConflict: 'card_id' })

          if (upsertErr) {
            console.error('[prices/sync] upsert error:', upsertErr)
            emit({ type: 'warning', message: `Batch ${Math.floor(i / BATCH_SIZE) + 1} upsert failed: ${upsertErr.message}` })
          } else {
            upsertedCount += batch.length
          }
        }

        // ── Step 4: Backfill api_id on cards that were missing it ────────────
        if (apiIdBackfills.length > 0) {
          for (const { uuid, apiCardId } of apiIdBackfills) {
            await supabaseAdmin
              .from('cards')
              .update({ api_id: apiCardId })
              .eq('id', uuid)
          }
          console.log(`[prices/sync] Backfilled api_id for ${apiIdBackfills.length} cards`)
          emit({ type: 'backfill', count: apiIdBackfills.length })
        }

        // ── Step 5: Products (conditional) ──────────────────────────────────
        let productCount = 0
        try {
          const prodRes = await rapidApiFetch(
            `/products?q=set.id:${encodeURIComponent(setId)}&per_page=100`,
          )

          if (prodRes.ok) {
            const prodJson = await prodRes.json() as RapidApiProductResponse
            const products = prodJson.data ?? []

            if (products.length > 0) {
              const productRows = products.map((p) => ({
                set_id:         setId,
                api_product_id: p.id,
                name:           p.name,
                product_type:   normalizeProductType(p.category),
                tcgp_market:    p.tcgplayer?.prices?.normal?.market ?? null,
                tcgp_low:       p.tcgplayer?.prices?.normal?.low    ?? null,
                tcgp_high:      p.tcgplayer?.prices?.normal?.high   ?? null,
                tcgp_url:       p.tcgplayer?.url ?? null,
                cm_avg_sell:    p.cardmarket?.prices?.averageSellPrice ?? null,
                cm_trend:       p.cardmarket?.prices?.trendPrice       ?? null,
                cm_url:         p.cardmarket?.url ?? null,
                fetched_at:     new Date().toISOString(),
              }))

              const { error: prodErr } = await supabaseAdmin
                .from('set_products')
                .upsert(productRows, { onConflict: 'api_product_id' })

              if (prodErr) {
                console.error('[prices/sync] product upsert error:', prodErr)
              } else {
                productCount = products.length
                emit({ type: 'products', count: productCount })
              }
            }
          }
          // Non-ok response (e.g. 404) means products endpoint doesn't exist — skip silently
        } catch (prodFetchErr) {
          // Network error on products endpoint — not fatal
          console.warn('[prices/sync] products fetch skipped:', prodFetchErr)
        }

        // ── Done ─────────────────────────────────────────────────────────────
        const elapsed = Date.now() - startTime
        emit({
          type:          'complete',
          setId,
          matched,
          unmatched,
          upsertedCount,
          productCount,
          backfillCount: apiIdBackfills.length,
          elapsed,
        })

      } catch (err) {
        emit({
          type:    'error',
          message: err instanceof Error ? err.message : 'Unexpected error during price sync',
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
      Connection:      'keep-alive',
    },
  })
}
