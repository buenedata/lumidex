import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCardNumber(cardNumber: string | null): number {
  if (!cardNumber) return 0
  const match = cardNumber.match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

/**
 * Compute rarity-based global variant count — used when a card has no explicit
 * card_variant_availability overrides AND no card-specific variants.
 *
 *  - Secret rare (number > setTotal) → 1  (Holo only)
 *  - EX / V card (name or rarity)    → 1  (Holo only)
 *  - Holo rarity (not non-holo)      → 2  (Reverse Holo + Holo)
 *  - Everything else                 → 2  (Normal + Reverse Holo)
 */
function computeRarityVariantCount(
  card: { name: string | null; number: string | null; rarity: string | null },
  setTotal: number,
): number {
  const name   = card.name?.toLowerCase()   ?? ''
  const rarity = card.rarity?.toLowerCase() ?? ''
  const num    = extractCardNumber(card.number)

  if (setTotal > 0 && num > setTotal) return 1

  const isExOrV =
    name.includes(' ex')   || rarity.includes('ex') ||
    name.includes(' v')    || rarity.includes(' v')
  if (isExOrV) return 1

  if (rarity.includes('holo') && !rarity.includes('non-holo')) return 2

  return 2
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: setId } = await params

  try {
    // 1. Fetch setTotal to identify secret rares (number > setTotal)
    const { data: setRow, error: setError } = await supabaseAdmin
      .from('sets')
      .select('set_id, setTotal')
      .eq('set_id', setId)
      .maybeSingle()

    if (setError) throw setError
    if (!setRow) {
      return NextResponse.json({ error: 'Set not found' }, { status: 404 })
    }

    const setTotal: number = (setRow as Record<string, unknown>)['setTotal'] as number ?? 0

    // 2. Fetch all cards for the set with their global variant overrides
    const { data: cards, error: cardsError } = await supabaseAdmin
      .from('cards')
      .select(`
        id,
        name,
        number,
        rarity,
        card_variant_availability ( variant_id )
      `)
      .eq('set_id', setId)

    if (cardsError) throw cardsError

    if (!cards || cards.length === 0) {
      return NextResponse.json(
        { normalCount: 0, mastersetCount: 0, grandmasterCount: 0 },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 3. Fetch card-specific variants (variants.card_id IS NOT NULL for this set's cards).
    //    These are the "grandmaster-only" extras (e.g. Pokéball, Master Ball, Cosmos Holo)
    //    that are merged ON TOP of the global variant set in the card grid.
    const cardIds = cards.map(c => c.id)
    const { data: cardSpecificRows, error: csError } = await supabaseAdmin
      .from('variants')
      .select('card_id')
      .in('card_id', cardIds)

    if (csError) throw csError

    // cardSpecificCountMap: cardId → number of card-specific variants
    const cardSpecificCountMap: Record<string, number> = {}
    cardSpecificRows?.forEach((row: { card_id: string }) => {
      cardSpecificCountMap[row.card_id] = (cardSpecificCountMap[row.card_id] ?? 0) + 1
    })

    // 4. Tally counts
    //
    // Mirror the variant resolution logic from /api/variants variantsForCard():
    //
    //   globalCount (= what shows without card-specific extras):
    //     a) card_variant_availability has rows → overrideCount  (explicit list)
    //     b) card has card-specific variants, no overrides → 0   (rarity suppressed)
    //     c) neither → rarity-based count                        (default)
    //
    //   Masterset  = globalCount × non-promo cards
    //   Grandmaster = (globalCount + cardSpecificCount) × ALL cards (incl. promos)
    //
    let mastersetCount   = 0
    let grandmasterCount = 0

    for (const card of cards) {
      const overrides     = (card as Record<string, unknown>)['card_variant_availability']
      const overrideCount = Array.isArray(overrides) ? overrides.length : 0
      const cardSpecificCount = cardSpecificCountMap[card.id] ?? 0

      const isPromo = card.rarity?.toLowerCase().includes('promo') ?? false

      let globalCount: number
      if (overrideCount > 0) {
        globalCount = overrideCount                      // explicit override list
      } else if (cardSpecificCount > 0) {
        globalCount = 0                                  // rarity suppressed by card-specific
      } else {
        globalCount = computeRarityVariantCount(card, setTotal) // default rarity rules
      }

      if (!isPromo) mastersetCount += globalCount
      grandmasterCount += globalCount + cardSpecificCount
    }

    // Normal set = one slot per unique card design (regardless of variants)
    const normalCount = cards.length

    return NextResponse.json(
      { normalCount, mastersetCount, grandmasterCount },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[binder-stats] Error computing binder stats for set', setId, err)
    return NextResponse.json(
      { error: 'Failed to compute binder stats' },
      { status: 500 }
    )
  }
}
