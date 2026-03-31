import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

const EPISODES_HOST = 'cardmarket-api-tcg.p.rapidapi.com'
const EPISODES_URL  = `https://${EPISODES_HOST}/pokemon/episodes`

// Legacy cards-probe host (unchanged)
const CARDS_HOST = 'pokemon-tcg-api.p.rapidapi.com'
const CARDS_BASE = `https://${CARDS_HOST}`

/**
 * GET /api/prices/discover
 *
 * Multi-mode discovery endpoint for exploring the tcggo.com / RapidAPI.
 *
 * ?probe=cards    — fetch 3 cards to inspect API response structure
 * ?name={name}    — fetch ALL episodes, then filter by name server-side
 * (no params)     — fetch ALL episodes (single call, no pagination needed)
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

  const probe = request.nextUrl.searchParams.get('probe')
  const name  = request.nextUrl.searchParams.get('name')?.trim() ?? ''

  // ── Probe: raw episodes response to inspect pagination structure ──────────
  if (probe === 'episodes') {
    try {
      const res  = await fetch(EPISODES_URL, {
        headers: {
          'x-rapidapi-key':  key,
          'x-rapidapi-host': EPISODES_HOST,
          'Content-Type':    'application/json',
        },
        cache: 'no-store',
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = await res.json() as Record<string, any>
      const episodes = json.data ?? json.episodes ?? json.results ?? (Array.isArray(json) ? json : [])
      return NextResponse.json({
        probe:       'episodes',
        httpStatus:  res.status,
        topKeys:     Object.keys(json),
        episodeCount: episodes.length,
        firstEpisode: episodes[0] ?? null,
        rawMeta:      { total: json.total, totalCount: json.totalCount, meta: json.meta, pagination: json.pagination, per_page: json.per_page, current_page: json.current_page, last_page: json.last_page },
      })
    } catch (e) {
      return NextResponse.json({ probe: 'episodes', error: String(e) })
    }
  }

  // ── Probe: list a few cards to inspect API data structure ─────────────────
  if (probe === 'cards') {
    try {
      const res = await fetch(`${CARDS_BASE}/cards?per_page=3&page=1`, {
        headers: {
          'x-rapidapi-key':  key,
          'x-rapidapi-host': CARDS_HOST,
          'Content-Type':    'application/json',
        },
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

  // ── Fetch ALL episodes with pagination ───────────────────────────────────
  // API returns: { data: [...], paging: { current, total, per_page }, results: N }
  // where paging.total = total number of pages and results = total episode count.
  type Episode = { id?: unknown; name?: string; series?: unknown }
  let allEpisodes: Episode[] = []
  let topKeys: string[] = []

  const episodeHeaders = {
    'x-rapidapi-key':  key,
    'x-rapidapi-host': EPISODES_HOST,
    'Content-Type':    'application/json',
  }

  try {
    // Page 1 — also tells us how many pages there are
    const firstRes = await fetch(`${EPISODES_URL}?page=1`, {
      headers: episodeHeaders,
      cache: 'no-store',
    })
    if (!firstRes.ok) {
      return NextResponse.json({
        sets:  [],
        error: `API returned HTTP ${firstRes.status} for ${EPISODES_URL}`,
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstJson = await firstRes.json() as Record<string, any>
    topKeys = Object.keys(firstJson)

    const page1Episodes: Episode[] = firstJson.data ?? []
    const totalPages: number = firstJson.paging?.total ?? 1

    allEpisodes = [...page1Episodes]

    // Fetch remaining pages in parallel
    if (totalPages > 1) {
      const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
      const pageResults = await Promise.all(
        pageNums.map(async (page) => {
          try {
            const res = await fetch(`${EPISODES_URL}?page=${page}`, {
              headers: episodeHeaders,
              cache: 'no-store',
            })
            if (!res.ok) return [] as Episode[]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const json = await res.json() as Record<string, any>
            return (json.data ?? []) as Episode[]
          } catch {
            return [] as Episode[]
          }
        })
      )
      for (const pageData of pageResults) allEpisodes.push(...pageData)
    }
  } catch (e) {
    return NextResponse.json({
      sets:  [],
      error: `Episodes fetch failed: ${String(e)}`,
    })
  }

  // ── Name filter (Find in API button) ─────────────────────────────────────
  if (name) {
    const lq = name.toLowerCase()
    const filtered = allEpisodes.filter(e =>
      e.name?.toLowerCase().includes(lq) || String(e.id ?? '').includes(lq)
    )
    return NextResponse.json({
      sets:    filtered.length > 0 ? filtered : allEpisodes,
      query:   name,
      total:   allEpisodes.length,
      topKeys,
    })
  }

  // ── Browse all (no filter) ────────────────────────────────────────────────
  return NextResponse.json({
    sets:      allEpisodes,
    total:     allEpisodes.length,
    topKeys,
    firstItem: allEpisodes[0] ?? null,
  })
}
