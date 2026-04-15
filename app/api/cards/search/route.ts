import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

/**
 * GET /api/cards/search
 *
 * Query params:
 *   q         – name / number search string (supports "Pikachu 24" compound syntax)
 *   type      – filter by cards.type      e.g. "Fire"
 *   rarity    – filter by cards.rarity    e.g. "Rare Holo"
 *   supertype – filter by cards.supertype e.g. "Pokémon"
 *   limit     – max results (default 100, max 500)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q         = searchParams.get('q')
  const typeParam = searchParams.get('type')?.trim()      || null
  const rarityParam    = searchParams.get('rarity')?.trim()   || null
  const supertypeParam = searchParams.get('supertype')?.trim() || null
  const limit     = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '100', 10), 1), 500)

  // If no q and no filters return empty (needs at least a query)
  if ((!q || q.trim().length === 0) && !typeParam && !rarityParam && !supertypeParam) {
    const emptyResponse = NextResponse.json({ cards: [], total: 0, hasMore: false, query: '' })
    emptyResponse.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return emptyResponse
  }

  try {
    // Parse compound query like "Serperior 6" → name="Serperior", number="6"
    let namePart:   string | null = null
    let numberPart: string | null = null

    if (q && q.trim().length > 0) {
      const parts    = q.trim().split(/\s+/)
      const lastPart = parts[parts.length - 1]
      const isNumberToken = /^\d/.test(lastPart)

      if (isNumberToken && parts.length > 1) {
        namePart   = parts.slice(0, -1).join(' ')
        numberPart = lastPart
      } else if (isNumberToken) {
        numberPart = lastPart
      } else {
        namePart = q.trim()
      }
    }

    // Join cards with their set so we can display set name, series, release_date, and logo
    let dbQuery = supabase
      .from('cards')
      .select('id, name, number, rarity, type, supertype, image, set_id, default_variant_id, sets!inner(name, series, release_date, logo_url)')

    if (namePart)      dbQuery = dbQuery.ilike('name',      `%${namePart}%`)
    if (numberPart)    dbQuery = dbQuery.ilike('number',    `%${numberPart}%`)
    if (typeParam)     dbQuery = dbQuery.ilike('type',      `%${typeParam}%`)
    if (rarityParam)   dbQuery = dbQuery.ilike('rarity',    `%${rarityParam}%`)
    if (supertypeParam) dbQuery = dbQuery.ilike('supertype', `%${supertypeParam}%`)

    const { data, error } = await dbQuery
      .order('name')
      .limit(limit)

    if (error) {
      console.error('Card search database error:', error)
      return NextResponse.json({ error: 'Failed to search cards' }, { status: 500 })
    }

    const cards = data || []

    const transformedCards = cards.map((card) => {
      const set = Array.isArray(card.sets) ? card.sets[0] : card.sets
      return {
        id:                 card.id,
        name:               card.name || 'Unknown Card',
        image_url:          card.image || '',
        number:             card.number || '',
        rarity:             card.rarity || '',
        type:               card.type   || '',
        supertype:          card.supertype || '',
        default_variant_id: card.default_variant_id ?? null,
        variants:           [] as {
          id: string; name: string; color: string
          short_label: string | null; is_quick_add: boolean
          sort_order: number; card_id: string | null
        }[],
        set: {
          id:           card.set_id,
          name:         set?.name         || '',
          series:       set?.series       || '',
          release_date: set?.release_date || '',
          logo_url:     set?.logo_url     || '',
        },
      }
    })

    // ── Batch-fetch variant dots for all result cards ──────────────────────
    // Two parallel queries:
    //   1. card_variant_availability → global overrides per card
    //   2. variants where card_id IN cardIds → card-specific variants
    // Cards with no override rows get variants: [] (no dots shown on browse).
    if (transformedCards.length > 0) {
      const cardIds = transformedCards.map(c => c.id)

      const [avaResult, specificResult] = await Promise.all([
        supabase
          .from('card_variant_availability')
          .select('card_id, variants(id, name, color, short_label, is_quick_add, sort_order, card_id)')
          .in('card_id', cardIds),
        supabase
          .from('variants')
          .select('id, name, color, short_label, is_quick_add, sort_order, card_id')
          .in('card_id', cardIds),
      ])

      // Build byCard map: cardId → variant[]
      const variantsByCard: Record<string, typeof transformedCards[0]['variants']> = {}

      // Global overrides
      for (const row of ((avaResult.data ?? []) as { card_id: string; variants: any }[])) {
        const v = row.variants
        if (!v) continue
        if (!variantsByCard[row.card_id]) variantsByCard[row.card_id] = []
        if (!variantsByCard[row.card_id].find(x => x.id === v.id)) {
          variantsByCard[row.card_id].push({
            id: v.id, name: v.name, color: v.color,
            short_label: v.short_label ?? null, is_quick_add: v.is_quick_add ?? false,
            sort_order: v.sort_order ?? 0, card_id: v.card_id ?? null,
          })
        }
      }

      // Card-specific variants (always shown)
      for (const v of ((specificResult.data ?? []) as any[])) {
        if (!v.card_id) continue
        if (!variantsByCard[v.card_id]) variantsByCard[v.card_id] = []
        variantsByCard[v.card_id].push({
          id: v.id, name: v.name, color: v.color,
          short_label: v.short_label ?? null, is_quick_add: v.is_quick_add ?? false,
          sort_order: v.sort_order ?? 0, card_id: v.card_id,
        })
      }

      // Attach to cards (sort by sort_order)
      for (const card of transformedCards) {
        if (variantsByCard[card.id]) {
          card.variants = variantsByCard[card.id].sort((a, b) => a.sort_order - b.sort_order)
        }
      }
    }

    const response = NextResponse.json({
      cards:   transformedCards,
      total:   transformedCards.length,
      hasMore: false,
      query:   q ?? '',
    })
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return response
  } catch (error) {
    console.error('Card search database error:', error)
    return NextResponse.json({ error: 'Failed to search cards' }, { status: 500 })
  }
}
