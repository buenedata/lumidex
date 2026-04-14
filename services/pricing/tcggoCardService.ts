/**
 * services/pricing/tcggoCardService.ts
 *
 * Fetches per-card price data from the cardmarket-api-tcg RapidAPI
 * (/pokemon/episodes/{episodeId}/cards endpoint).
 *
 * Used as a CardMarket price source for sets where pokemontcg.io does not yet
 * have CardMarket data (e.g. newly released sets). The set must have
 * sets.api_set_id populated for this service to be used.
 *
 * Price fields returned per card:
 *   cardmarket.30d_average  → cm_avg_30d  (EUR)
 *   cardmarket.7d_average   → cm_avg_sell (EUR, closest to current sell price)
 *   cardmarket.lowest_near_mint → cm_low  (EUR)
 *   tcg_player.market_price → tcgp_market (USD — labeled EUR by API but is USD)
 */

const HOST = 'cardmarket-api-tcg.p.rapidapi.com'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TcggoCmPrices {
  /** EUR — 30-day average sell price */
  avg30: number | null
  /** EUR — 7-day average sell price */
  avg7:  number | null
  /** EUR — current lowest near-mint price */
  low:   number | null
}

export interface TcggoTcgpPrices {
  /** USD — market price from TCGPlayer (note: API labels as EUR, but values are USD) */
  market: number | null
}

export interface TcggoCardPriceEntry {
  cardNumber:    number
  /** tcggo.com internal card ID — used for per-card history-price API calls */
  tcggoId:       number | null
  /** CardMarket product ID for the normal variant */
  cardmarketId:  number | null
  cardmarket:    TcggoCmPrices
  tcgplayer:     TcggoTcgpPrices
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Safely extract a positive number, returning null for missing/zero. */
function safeNum(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isFinite(n) && n > 0 ? Math.round(n * 10000) / 10000 : null
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch all card prices for a tcggo.com episode and return them as a Map
 * from normalised card number (string, no leading zeros, no "/total") to
 * TcggoCardPriceEntry.
 *
 * Returns an empty Map on any error so callers can degrade gracefully.
 */
export async function fetchTcggoEpisodePrices(
  episodeId: string | number,
): Promise<Map<string, TcggoCardPriceEntry>> {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    console.warn('[tcggoCardService] RAPIDAPI_KEY not set — skipping tcggo fetch')
    return new Map()
  }

  const allCards: TcggoCardPriceEntry[] = []

  try {
    // Fetch page 1 to discover total page count
    const firstUrl = `https://${HOST}/pokemon/episodes/${encodeURIComponent(String(episodeId))}/cards?page=1&per_page=20`
    const firstRes = await fetch(firstUrl, {
      headers: {
        'x-rapidapi-key':  apiKey,
        'x-rapidapi-host': HOST,
        'Content-Type':    'application/json',
      },
    })

    if (!firstRes.ok) {
      console.warn(
        `[tcggoCardService] HTTP ${firstRes.status} fetching episode ${episodeId} cards — skipping`,
      )
      return new Map()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstJson = await firstRes.json() as { data: any[]; paging: { current: number; total: number; per_page: number } }
    allCards.push(...parseCards(firstJson.data ?? []))

    const totalPages = firstJson.paging?.total ?? 1
    console.log(`[tcggoCardService] Episode ${episodeId}: ${totalPages} page(s) of cards`)

    // Fetch remaining pages in parallel (pages typically small — safe to concurrent)
    if (totalPages > 1) {
      const fetchPage = async (page: number) => {
        const url = `https://${HOST}/pokemon/episodes/${encodeURIComponent(String(episodeId))}/cards?page=${page}&per_page=20`
        const res = await fetch(url, {
          headers: {
            'x-rapidapi-key':  apiKey,
            'x-rapidapi-host': HOST,
            'Content-Type':    'application/json',
          },
        })
        if (!res.ok) {
          console.warn(`[tcggoCardService] HTTP ${res.status} on page ${page} for episode ${episodeId}`)
          return []
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await res.json() as { data: any[] }
        return parseCards(json.data ?? [])
      }

      const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
      const pageResults = await Promise.all(pageNums.map(fetchPage))
      for (const cards of pageResults) allCards.push(...cards)
    }
  } catch (err) {
    console.warn(`[tcggoCardService] Error fetching episode ${episodeId}:`, err)
    return new Map()
  }

  // Build Map<normalizedNumber, entry>
  const map = new Map<string, TcggoCardPriceEntry>()
  for (const entry of allCards) {
    const normNum = String(entry.cardNumber)   // already an integer, no leading zeros
    map.set(normNum, entry)
  }

  console.log(`[tcggoCardService] Episode ${episodeId}: ${map.size} cards with prices`)
  return map
}

/** Parse the raw API card array into TcggoCardPriceEntry[]. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCards(raw: any[]): TcggoCardPriceEntry[] {
  const entries: TcggoCardPriceEntry[] = []
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue
    const cardNumber = typeof c.card_number === 'number' ? c.card_number : parseInt(String(c.card_number), 10)
    if (!isFinite(cardNumber)) continue

    const cm = c.prices?.cardmarket ?? {}
    const tcp = c.prices?.tcg_player ?? c.prices?.tcgplayer ?? {}

    const tcggoId      = typeof c.id === 'number' ? c.id : null
    const cardmarketId = typeof c.cardmarket_id === 'number' ? c.cardmarket_id : null

    entries.push({
      cardNumber,
      tcggoId,
      cardmarketId,
      cardmarket: {
        avg30: safeNum(cm['30d_average']),
        avg7:  safeNum(cm['7d_average']),
        low:   safeNum(cm.lowest_near_mint),
      },
      tcgplayer: {
        // The API labels this EUR but values are USD for TCGPlayer prices
        market: safeNum(tcp.market_price),
      },
    })
  }
  return entries
}
