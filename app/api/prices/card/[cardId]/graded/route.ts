import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

/**
 * GET /api/prices/card/[cardId]/graded
 *
 * Returns eBay last-sold graded prices for a card from card_graded_prices,
 * grouped by grading company.
 *
 * Response shape:
 * {
 *   cardId: string,
 *   byCompany: {
 *     PSA?: Array<{ grade: number; avgPriceUsd: number; sampleSize: number; fetchedAt: string }>,
 *     CGC?: Array<...>,
 *     ACE?: Array<...>,
 *   }
 * }
 *
 * Grades within each company are sorted descending (10 → 1).
 * Companies with no data are omitted from byCompany.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params

  if (!cardId?.trim()) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('card_graded_prices')
    .select('grading_company, grade, avg_price_usd, sample_size, fetched_at')
    .eq('card_id', cardId.trim())
    .order('grading_company', { ascending: true })
    .order('grade', { ascending: false })

  if (error) {
    console.error(`[/api/prices/card/${cardId}/graded] DB error:`, error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group rows by grading company
  type GradeRow = { grade: number; avgPriceUsd: number; sampleSize: number; fetchedAt: string }
  type ByCompany = Record<string, GradeRow[]>

  const byCompany: ByCompany = {}

  for (const row of data ?? []) {
    const company = row.grading_company as string
    if (!byCompany[company]) byCompany[company] = []
    byCompany[company].push({
      grade:        row.grade,
      avgPriceUsd:  row.avg_price_usd,
      sampleSize:   row.sample_size,
      fetchedAt:    row.fetched_at,
    })
  }

  return NextResponse.json({ cardId, byCompany })
}
