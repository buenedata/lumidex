import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

const RAPIDAPI_HOST = 'pokemon-tcg-api.p.rapidapi.com'
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`

/**
 * GET /api/prices/discover
 *
 * Multi-mode discovery endpoint for exploring the tcggo.com / RapidAPI.
 *
 * ?probe=cards           — fetch 3 cards to inspect API response structure
 * ?name={setName}        — search for episodes matching name
 * (no params)            — browse all episodes (limited to 100)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const key = process.env.RAPIDAPI_KEY
  if (!key) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY not set', sets: [] })
  }

  const makeHeaders = () => ({
    'x-rapidapi-key':  key,
    'x-rapidapi-host': RAPIDAPI_HOST,
    'Content-Type':    'application/json',
  })

  const probe = request.nextUrl.searchParams.get('probe')
  const name  = request.nextUrl.searchParams.get('name')?.trim() ?? ''

  // ── Probe: list a few cards to inspect API data structure ─────────────────
  if (probe === 'cards') {
    try {
      const res = await fetch(`${RAPIDAPI_BASE}/cards?per_page=3&page=1`, {
        headers: makeHeaders(),
        cache: 'no-store',
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = await res.json() as Record<string, any>
      const cards = json.data ?? json.cards ?? json.results ?? []
      return NextResponse.json({
        probe:         'cards',
        httpStatus:    res.status,
        topKeys:       Object.keys(json),
        cardCount:     cards.length,
        firstCardKeys: cards[0] ? Object.keys(cards[0]) : [],
        firstCard:     cards[0] ?? null,
      })
    } catch (e) {
      return NextResponse.json({ probe: 'cards', error: String(e), sets: [] })
    }
  }

  // ── Episodes search (name filter) ─────────────────────────────────────────
  if (name) {
    const endpoints = [
      `/episodes?name=${encodeURIComponent(name)}&per_page=20`,
      `/episodes?search=${encodeURIComponent(name)}&per_page=20`,
    ]

    for (const path of endpoints) {
      try {
        const res = await fetch(`${RAPIDAPI_BASE}${path}`, {
          headers: makeHeaders(),
          cache: 'no-store',
        })
        if (!res.ok) {
          console.log(`[discover] ${path} → HTTP ${res.status}`)
          continue
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await res.json() as Record<string, any>
        const episodes = json.data ?? json.episodes ?? json.results ?? []
        if (episodes.length > 0) {
          const lq = name.toLowerCase()
          const filtered = episodes.filter((e: { id?: unknown; name?: string }) =>
            e.name?.toLowerCase().includes(lq) || String(e.id).includes(lq)
          )
          return NextResponse.json({
            sets:   filtered.length > 0 ? filtered : episodes,
            query:  name,
            path,
            topKeys: Object.keys(json),
          })
        }
      } catch (e) {
        console.warn(`[discover] error for ${path}:`, e)
        continue
      }
    }

    // All attempts returned 0 — report what happened
    return NextResponse.json({
      sets:    [],
      query:   name,
      message: `No episodes found for "${name}". Try "Browse all API episodes" to see what the API has.`,
    })
  }

  // ── Browse all episodes ───────────────────────────────────────────────────
  try {
    const res = await fetch(`${RAPIDAPI_BASE}/episodes?per_page=100&page=1`, {
      headers: makeHeaders(),
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({
        sets:    [],
        error:   `API returned HTTP ${res.status} for /episodes endpoint. This endpoint may not exist on this API.`,
        topKeys: [],
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as Record<string, any>
    const episodes = json.data ?? json.episodes ?? json.results ?? []

    return NextResponse.json({
      sets:      episodes,
      total:     json.total ?? json.totalCount ?? episodes.length,
      topKeys:   Object.keys(json),
      firstItem: episodes[0] ?? null,
    })
  } catch (e) {
    return NextResponse.json({
      sets:  [],
      error: `Browse failed: ${String(e)}`,
    })
  }
}
