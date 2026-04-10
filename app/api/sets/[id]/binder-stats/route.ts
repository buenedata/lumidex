import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCardNumber(cardNumber: string | null): number {
  if (!cardNumber) return 0
  const match = cardNumber.match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

/**
 * Compute the BASE number of variant slots for a card using rarity rules only.
 * Used for Masterset (standard variants, no card-specific overrides, no promos).
 *
 *  - Secret rare (number > setTotal) → 1  (Holo only)
 *  - EX / V card (name or rarity)    → 1  (Holo only)
 *  - Holo rarity (not non-holo)      → 2  (Reverse Holo + Holo)
 *  - Everything else                 → 2  (Normal + Reverse Holo)
 */
function computeBaseVariantCount(
  card: { name: string | null; number: string | null; rarity: string | null },
  setTotal: number,
): number {
  const name   = card.name?.toLowerCase()   ?? ''
  const rarity = card.rarity?.toLowerCase() ?? ''
  const num    = extractCardNumber(card.number)

  // Secret rares sit above the numbered set total
  if (setTotal > 0 && num > setTotal) return 1

  // EX / V cards are holo-only
  const isExOrV =
    name.includes(' ex')   || rarity.includes('ex') ||
    name.includes(' v')    || rarity.includes(' v')
  if (isExOrV) return 1

  // Holo-rarity cards (not the "Non-Holo Rare" text variant)
  if (rarity.includes('holo') && !rarity.includes('non-holo')) return 2

  // Common / regular cards: Normal + Reverse Holo
  return 2
}

/**
 * Compute the FULL number of variant slots for a card.
 * Used for Grandmaster Set (all variants including card-specific overrides, including promos).
 *
 * Priority:
 *  1. If there are admin-configured overrides (card_variant_availability rows) → use that count.
 *  2. Otherwise fall back to rarity rules (same as computeBaseVariantCount).
 */
function computeFullVariantCount(
  card: { name: string | null; number: string | null; rarity: string | null },
  setTotal: number,
  overrideCount: number
): number {
  if (overrideCount > 0) return overrideCount
  return computeBaseVariantCount(card, setTotal)
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

    // 2. Fetch all cards for the set, including any per-card variant overrides
    //    We LEFT JOIN card_variant_availability via Supabase nested select.
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
        { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
      )
    }

    // 3. Tally counts
    let mastersetCount    = 0
    let grandmasterCount  = 0

    for (const card of cards) {
      // card_variant_availability is returned as an array of objects by Supabase
      const overrides     = (card as Record<string, unknown>)['card_variant_availability']
      const overrideCount = Array.isArray(overrides) ? overrides.length : 0

      const isPromo = card.rarity?.toLowerCase().includes('promo') ?? false

      // Masterset: standard rarity-based variants only (no card-specific overrides), non-promo cards
      if (!isPromo) mastersetCount += computeBaseVariantCount(card, setTotal)

      // Grandmaster: all variants including card-specific overrides, all cards incl. promos
      grandmasterCount += computeFullVariantCount(card, setTotal, overrideCount)
    }

    // Normal set = one of any variant per card (one slot per unique card design)
    const normalCount = cards.length

    return NextResponse.json(
      { normalCount, mastersetCount, grandmasterCount },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
    )
  } catch (err) {
    console.error('[binder-stats] Error computing binder stats for set', setId, err)
    return NextResponse.json(
      { error: 'Failed to compute binder stats' },
      { status: 500 }
    )
  }
}
