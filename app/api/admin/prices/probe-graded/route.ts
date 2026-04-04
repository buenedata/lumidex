import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { probeEbayGradedSearch } from '@/services/pricing/ebayGradedService'

/**
 * GET /api/admin/prices/probe-graded?cardId=<uuid>
 *
 * Diagnostic endpoint — runs the eBay Browse API graded price search for a single
 * card and returns full debug data without saving anything to the database.
 *
 * Response includes:
 *   - tokenSnippet    : first 20 chars of the OAuth token (confirms auth works)
 *   - tokenError      : non-null if OAuth token fetch failed
 *   - httpStatus      : HTTP status code from the Browse API call
 *   - searchKeywords  : the full query string sent to eBay
 *   - rawItemCount    : number of items eBay returned
 *   - apiTotal        : total matches eBay reported
 *   - itemsSample     : first 5 titles + prices
 *   - parsedGrades    : per-grade price counts and averages before MIN_ITEMS filter
 *   - finalResults    : grades that passed all filters (what would be saved to DB)
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

  // Check critical env vars up front
  const envCheck = {
    EBAY_CLIENT_ID:     process.env.EBAY_CLIENT_ID     ? `set (${process.env.EBAY_CLIENT_ID.slice(0, 10)}…)`     : '⚠️ MISSING',
    EBAY_CLIENT_SECRET: process.env.EBAY_CLIENT_SECRET ? 'set' : '⚠️ MISSING — OAuth token refresh will fail',
  }

  try {
    const probe = await probeEbayGradedSearch(card)

    return NextResponse.json({
      card: { id: card.id, name: card.name, number: card.number, set_id: card.set_id },
      envCheck,
      ...probe,
    })
  } catch (err) {
    return NextResponse.json(
      {
        card:     { id: card.id, name: card.name },
        envCheck,
        error:    err instanceof Error ? err.message : 'Probe failed',
      },
      { status: 500 }
    )
  }
}
