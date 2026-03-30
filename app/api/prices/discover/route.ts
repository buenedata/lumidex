import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

const RAPIDAPI_HOST = 'pokemon-tcg-api.p.rapidapi.com'
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`

interface ApiSet {
  id:           string
  name:         string
  series?:      string
  total?:       number
  printedTotal?:number
  releaseDate?: string
  [key: string]: unknown
}

/**
 * GET /api/prices/discover?name={setName}
 *
 * Searches the RapidAPI for sets matching the given name.
 * Used by the admin prices page to find the correct API set ID
 * for a Lumidex set (our internal IDs like "sv14" may differ from the API's).
 *
 * Also usable without ?name to return ALL sets from the API.
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

  const name = request.nextUrl.searchParams.get('name')?.trim() ?? ''

  // Try multiple filter approaches and return whichever works
  // tcggo.com API v1 via RapidAPI — sets endpoint
  const attempts = name
    ? [
        `/sets?name=${encodeURIComponent(name)}&per_page=20`,
        `/sets?search=${encodeURIComponent(name)}&per_page=20`,
        `/sets?q=${encodeURIComponent(name)}&per_page=20`,
      ]
    : [`/sets?per_page=500&page=1`]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bestResult: any = null

  for (const path of attempts) {
    try {
      const res = await fetch(`${RAPIDAPI_BASE}${path}`, {
        headers: {
          'x-rapidapi-key':  key,
          'x-rapidapi-host': RAPIDAPI_HOST,
          'Content-Type':    'application/json',
        },
        cache: 'no-store',
      })

      if (!res.ok) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = await res.json() as Record<string, any>
      const sets: ApiSet[] = json.data ?? json.sets ?? json.results ?? []

      if (sets.length > 0) {
        bestResult = { sets, total: json.totalCount ?? json.total ?? sets.length, path }
        // If we found results with name filter, stop trying
        break
      }

      // Even if 0 results, store the response shape for debug
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

  // If no name filter or name search returned 0, post-filter by name client-side
  let sets: ApiSet[] = bestResult.sets
  if (name && sets.length > 0) {
    const lowerName = name.toLowerCase()
    const filtered = sets.filter(s =>
      s.name?.toLowerCase().includes(lowerName) ||
      s.id?.toLowerCase().includes(lowerName)
    )
    // Prefer filtered results if any; otherwise return raw (different filter might be needed)
    if (filtered.length > 0) sets = filtered
  }

  return NextResponse.json({
    sets,
    query: name || '(all)',
    path: bestResult.path,
    topKeys: bestResult.topKeys,
  })
}
