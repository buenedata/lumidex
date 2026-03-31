import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

const RAPIDAPI_HOST = 'pokemon-tcg-api.p.rapidapi.com'
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`

/**
 * GET /api/prices/discover
 *
 * Multi-mode discovery endpoint for exploring the RapidAPI (tcggo.com).
 *
 * ?probe=cards           — fetch 3 cards (no filter) to inspect API response structure
 * ?probe=card&id={id}    — fetch a single card by ID
 * ?name={setName}        — search for sets matching name (tries multiple filter params)
 * (no params)            — fetch all sets from /sets endpoint
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
    return NextResponse.json({ error: 'RAPIDAPI_KEY not set' }, { status: 500 })
  }

  const headers = {
    'x-rapidapi-key':  key,
    'x-rapidapi-host': RAPIDAPI_HOST,
    'Content-Type':    'application/json',
  }

  const fetchApi = async (path: string) =>
    fetch(`${RAPIDAPI_BASE}${path}`, { headers, cache: 'no-store' })

  const probe      = request.nextUrl.searchParams.get('probe')
  const probeId    = request.nextUrl.searchParams.get('id')
  const name       = request.nextUrl.searchParams.get('name')?.trim() ?? ''

  // ── Probe: list a few cards (no filter) ──────────────────────────────────
  if (probe === 'cards') {
    try {
      const res = await fetchApi('/cards?per_page=3&page=1')
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
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }

  // ── Probe: single card by ID ─────────────────────────────────────────────
  if (probe === 'card' && probeId) {
    try {
      const res = await fetchApi(`/cards/${encodeURIComponent(probeId)}`)
      const json = await res.json()
      return NextResponse.json({ probe: 'card', id: probeId, httpStatus: res.status, raw: json })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }

  // ── Episodes (= sets in tcggo.com terminology) search / browse ───────────
  const attempts = name
    ? [
        `/episodes?name=${encodeURIComponent(name)}&per_page=20`,
        `/episodes?search=${encodeURIComponent(name)}&per_page=20`,
        `/episodes?q=${encodeURIComponent(name)}&per_page=20`,
      ]
    : [`/episodes?per_page=500&page=1`]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bestResult: any = null

  for (const path of attempts) {
    try {
      const res = await fetchApi(path)
      if (!res.ok) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = await res.json() as Record<string, any>
      const sets: { id: string; name: string; series?: string }[] =
        json.data ?? json.sets ?? json.results ?? []

      if (sets.length > 0) {
        bestResult = { sets, total: json.totalCount ?? json.total ?? sets.length, path }
        break
      }

      if (!bestResult) {
        bestResult = { sets: [], total: 0, path, topKeys: Object.keys(json) }
      }
    } catch {
      continue
    }
  }

  if (!bestResult) {
    return NextResponse.json({ error: 'All discovery attempts failed', sets: [] })
  }

  let sets: { id: string; name: string; series?: string }[] = bestResult.sets
  if (name && sets.length > 0) {
    const lowerName = name.toLowerCase()
    const filtered = sets.filter(s =>
      s.name?.toLowerCase().includes(lowerName) ||
      s.id?.toLowerCase().includes(lowerName)
    )
    if (filtered.length > 0) sets = filtered
  }

  return NextResponse.json({
    sets,
    query:   name || '(all)',
    path:    bestResult.path,
    topKeys: bestResult.topKeys,
  })
}
