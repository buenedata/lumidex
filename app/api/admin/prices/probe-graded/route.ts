import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { probeEbayGradedSearch } from '@/services/pricing/ebayGradedService'

/**
 * GET /api/admin/prices/probe-graded?cardId=<uuid>
 *
 * Diagnostic endpoint — runs the full eBay graded price search for a single card
 * and returns the raw API response details without saving anything to the database.
 *
 * Useful for debugging why graded prices are returning 0 results.
 */
export async function GET(request: NextRequest) {
  // Auth guard
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 }
    )
  }

  const cardId = request.nextUrl.searchParams.get('cardId')
  if (!cardId?.trim()) {
    return NextResponse.json(
      { error: 'cardId query parameter is required (card UUID)' },
      { status: 400 }
    )
  }

  // Look up the card
  const supabase = await createSupabaseServerClient()
  const { data: card, error: dbError } = await supabase
    .from('cards')
    .select('id, name, number, set_id, api_id')
    .eq('id', cardId.trim())
    .single()

  if (dbError || !card) {
    return NextResponse.json(
      { error: `Card not found: ${cardId}`, detail: dbError?.message },
      { status: 404 }
    )
  }

  // Check env
  const envCheck = {
    EBAY_CLIENT_ID: process.env.EBAY_CLIENT_ID
      ? `set (${process.env.EBAY_CLIENT_ID.slice(0, 10)}…)`
      : '⚠️ MISSING — eBay API calls will fail',
    EBAY_CLIENT_SECRET: process.env.EBAY_CLIENT_SECRET ? 'set' : '⚠️ MISSING',
  }

  try {
    const probe = await probeEbayGradedSearch(card)

    return NextResponse.json({
      card: {
        id: card.id,
        name: card.name,
        number: card.number,
        set_id: card.set_id,
      },
      envCheck,
      ...probe,
    })
  } catch (err) {
    return NextResponse.json(
      {
        card: { id: card.id, name: card.name },
        envCheck,
        error: err instanceof Error ? err.message : 'Probe failed',
      },
      { status: 500 }
    )
  }
}
