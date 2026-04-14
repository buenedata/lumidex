/**
 * services/pricing/tcggoHistoryService.ts
 *
 * Fetches per-card historical price data from the cardmarket-api-tcg RapidAPI
 * (/pokemon/history-prices?id=<tcggoId>&date_from=...&date_to=...) endpoint.
 *
 * The response is a date-keyed map:
 *   {
 *     "2026-03-26": { "cm_low": 0.02, "tcg_player_market": 0.09 },
 *     "2026-03-24": { "cm_low": 0.02, "tcg_player_market": 0.10 },
 *     ...
 *   }
 *
 * Each date entry represents the normal-variant price on that day.
 * Values are:
 *   cm_low          — CardMarket lowest near-mint price (EUR)
 *   tcg_player_market — TCGPlayer market price (USD)
 */

const HOST = 'cardmarket-api-tcg.p.rapidapi.com'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TcggoHistoryPoint {
  /** YYYY-MM-DD */
  date:        string
  /** CardMarket lowest near-mint price (EUR). null when not available. */
  cmLow:       number | null
  /** TCGPlayer market price (USD). null when not available. */
  tcgpMarket:  number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safePrice(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isFinite(n) && n > 0 ? Math.round(n * 10000) / 10000 : null
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch historical CardMarket + TCGPlayer prices for a single card by its
 * tcggo internal card ID.
 *
 * @param tcggoId   The tcggo.com internal card ID (stored in cards.tcggo_id).
 * @param dateFrom  Start of the date range, YYYY-MM-DD (inclusive).
 * @param dateTo    End of the date range, YYYY-MM-DD (inclusive).
 * @returns         Array of daily price points, newest first. Empty on error.
 */
export async function fetchTcggoCardHistory(
  tcggoId:  number,
  dateFrom: string,
  dateTo:   string,
): Promise<TcggoHistoryPoint[]> {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    console.warn('[tcggoHistoryService] RAPIDAPI_KEY not set — skipping history fetch')
    return []
  }

  try {
    const url =
      `https://${HOST}/pokemon/history-prices` +
      `?id=${encodeURIComponent(String(tcggoId))}` +
      `&date_from=${encodeURIComponent(dateFrom)}` +
      `&date_to=${encodeURIComponent(dateTo)}`

    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key':  apiKey,
        'x-rapidapi-host': HOST,
        'Content-Type':    'application/json',
      },
    })

    if (!res.ok) {
      console.warn(
        `[tcggoHistoryService] HTTP ${res.status} for card ${tcggoId} ` +
        `(${dateFrom} → ${dateTo})`
      )
      return []
    }

    const json = await res.json() as {
      data?: Record<string, { cm_low?: unknown; tcg_player_market?: unknown }>
    }

    if (!json.data || typeof json.data !== 'object') return []

    return Object.entries(json.data)
      .map(([date, prices]) => ({
        date,
        cmLow:      safePrice(prices?.cm_low),
        tcgpMarket: safePrice(prices?.tcg_player_market),
      }))
      // Sort newest-first for consistency with price history display
      .sort((a, b) => b.date.localeCompare(a.date))
  } catch (err) {
    console.warn(`[tcggoHistoryService] Error fetching history for card ${tcggoId}:`, err)
    return []
  }
}
