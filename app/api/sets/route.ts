import { NextRequest, NextResponse } from 'next/server'
import { getSets } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Optional ?game= filter — e.g. /api/sets?game=moomin
    // When absent, all games are returned (backward-compatible default).
    const game = request.nextUrl.searchParams.get('game') ?? undefined

    // Use database query instead of external API
    const sets = await getSets(game)

    // Transform for API consumers, preserving logo_url, symbol_url, and game
    const transformedSets = sets.map((set) => ({
      id: set.id,
      name: set.name,
      total: set.setComplete ?? set.total ?? 0,       // matched to PokemonSet.total used by dashboard
      total_cards: set.setComplete ?? set.total ?? 0, // full count incl. secret rares
      series: set.series,
      release_date: set.release_date,
      logo_url: set.logo_url ?? null,
      symbol_url: set.symbol_url ?? null,
      language: set.language ?? null,
      game: set.game,
    }))

    const response = NextResponse.json({ sets: transformedSets })
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return response
  } catch (error) {
    console.error('Database error fetching sets:', error)
    return NextResponse.json({ error: 'Failed to fetch sets' }, { status: 500 })
  }
}