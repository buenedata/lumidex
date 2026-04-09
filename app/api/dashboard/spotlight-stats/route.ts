import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/dashboard/spotlight-stats?mostOwnedCardId=<uuid>
 *
 * Returns enriched stats for the Collection Spotlight widget:
 *  - mostOwnedCard:     name + image for the card ID supplied by the client
 *  - mostExpensiveCard: name + image + price for the highest-priced card in
 *                       the user's collection (looks at card_prices)
 *
 * Auth is resolved server-side via the cookie session.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mostOwnedCardId = searchParams.get('mostOwnedCardId')?.trim() || null

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result: {
    mostOwnedCard: { name: string; image: string } | null
    mostExpensiveCard: { name: string; image: string; price: number } | null
  } = {
    mostOwnedCard: null,
    mostExpensiveCard: null,
  }

  // ── Most Owned Card ───────────────────────────────────────────────────────
  if (mostOwnedCardId) {
    const { data: cardRow } = await supabaseAdmin
      .from('cards')
      .select('id, name, image')
      .eq('id', mostOwnedCardId)
      .single()

    if (cardRow) {
      result.mostOwnedCard = {
        name:  cardRow.name  ?? 'Unknown Card',
        image: cardRow.image ?? '',
      }
    }
  }

  // ── Most Expensive Card ───────────────────────────────────────────────────
  // 1. Get all distinct card IDs the user owns
  const { data: variantRows, error: variantErr } = await supabaseAdmin
    .from('user_card_variants')
    .select('card_id')
    .eq('user_id', user.id)
    .gt('quantity', 0)

  if (!variantErr && variantRows && variantRows.length > 0) {
    // Deduplicate card IDs
    const cardIds = [...new Set(variantRows.map(r => r.card_id as string))]

    // 2. Fetch prices for all owned cards (cap at 500 to stay within URL/query limits)
    const cappedIds = cardIds.slice(0, 500)
    const { data: priceRows } = await supabaseAdmin
      .from('card_prices')
      .select('card_id, tcgp_market, tcgp_normal, cm_avg_sell')
      .in('card_id', cappedIds)

    if (priceRows && priceRows.length > 0) {
      // 3. Find the card ID with the best price in JS
      let bestCardId: string | null = null
      let bestPrice = 0

      for (const row of priceRows) {
        const price =
          (row.tcgp_market as number | null) ??
          (row.tcgp_normal as number | null) ??
          (row.cm_avg_sell as number | null) ??
          0
        if (price > bestPrice) {
          bestPrice  = price
          bestCardId = row.card_id as string
        }
      }

      // 4. Fetch card details for the winner
      if (bestCardId && bestPrice > 0) {
        const { data: expensiveCard } = await supabaseAdmin
          .from('cards')
          .select('id, name, image')
          .eq('id', bestCardId)
          .single()

        if (expensiveCard) {
          result.mostExpensiveCard = {
            name:  expensiveCard.name  ?? 'Unknown Card',
            image: expensiveCard.image ?? '',
            price: bestPrice,
          }
        }
      }
    }
  }

  const response = NextResponse.json(result)
  // Cache briefly — collection changes are infrequent but data should stay fresh
  response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120')
  return response
}
