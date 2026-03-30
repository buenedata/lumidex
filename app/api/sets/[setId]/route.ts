import { NextRequest, NextResponse } from 'next/server'
import { getSetById } from '@/lib/db'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const { setId } = await params

  try {
    // Use database query instead of external API
    const set = await getSetById(setId)
    
    if (!set) {
      return NextResponse.json({ error: 'Set not found' }, { status: 404 })
    }
    
    // Transform to legacy format for backward compatibility
    const transformedSet = {
      id: set.id,
      name: set.name,
      total_cards: set.total || 0,
      image_url: '', // Logo URL will be added to schema later
      series: set.series,
      release_date: set.release_date
    }

    const response = NextResponse.json(transformedSet)
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return response
  } catch (error) {
    console.error('Database error fetching set:', error)
    return NextResponse.json({ error: 'Failed to fetch set' }, { status: 500 })
  }
}