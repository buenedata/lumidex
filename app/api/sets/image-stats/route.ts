import { NextResponse } from 'next/server'
import { getSetImageStats } from '@/lib/db'

/**
 * GET /api/sets/image-stats
 *
 * Returns image-coverage data for every set in one database round-trip.
 * Shape: Array<{ set_id, total_cards, cards_with_images }>
 *
 * Used by the admin card-image upload tool to show ✅ / ⚠️ / ❌ beside each set.
 */
export async function GET() {
  try {
    const stats = await getSetImageStats()
    const response = NextResponse.json(stats)
    // Revalidate every 60 s; image uploads won't change these numbers very frequently.
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    return response
  } catch (error) {
    console.error('Error fetching set image stats:', error)
    return NextResponse.json({ error: 'Failed to fetch image stats' }, { status: 500 })
  }
}
