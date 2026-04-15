import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Variant } from '@/types'

/**
 * GET /api/card-variant-availability?cardId=<uuid>
 *   Returns the variants explicitly configured for a single card.
 *   Response: { variants: Variant[], hasOverrides: boolean, cardSpecificVariants: Variant[] }
 *
 * GET /api/card-variant-availability?setId=<id>
 *   Returns variant config for every card in a set in a single round-trip.
 *   Response: { byCard: { [cardId]: { variants: Variant[], hasOverrides: boolean, cardSpecificVariants: Variant[] } } }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cardId = searchParams.get('cardId')
  const setId  = searchParams.get('setId')
  const cardSpecificOnly = searchParams.get('cardSpecificOnly') === 'true'

  // ── Set-wide bulk fetch ──────────────────────────────────────────────────
  if (setId) {
    // 1. Get all card IDs that belong to this set
    const { data: cardRows, error: cardErr } = await supabaseAdmin
      .from('cards')
      .select('id')
      .eq('set_id', setId)

    if (cardErr) {
      console.error('Error fetching card IDs for set:', cardErr)
      return NextResponse.json({ error: 'Failed to fetch cards for set' }, { status: 500 })
    }

    const cardIds = (cardRows ?? []).map((r: { id: string }) => r.id)

    if (cardIds.length === 0) {
      return NextResponse.json({ byCard: {} })
    }

    // 2. Fetch all card_variant_availability rows for those cards (join variant details)
    const { data: avaRows, error: avaErr } = await supabaseAdmin
      .from('card_variant_availability')
      .select(`
        card_id,
        variants (
          id, key, name, description, color,
          short_label, is_quick_add, sort_order,
          is_official, created_by, created_at, card_id
        )
      `)
      .in('card_id', cardIds)

    if (avaErr) {
      console.error('Error fetching set variant availability:', avaErr)
      return NextResponse.json({ error: 'Failed to fetch variant availability for set' }, { status: 500 })
    }

    // 3. Fetch card-specific variants (variants.card_id IN cardIds)
    const { data: specificRows, error: specificErr } = await supabaseAdmin
      .from('variants')
      .select('id, key, name, description, color, short_label, is_quick_add, sort_order, is_official, created_by, created_at, card_id')
      .in('card_id', cardIds)

    if (specificErr) {
      console.error('Error fetching card-specific variants for set:', specificErr)
      return NextResponse.json({ error: 'Failed to fetch card-specific variants' }, { status: 500 })
    }

    // Build card-specific variant map: cardId → Variant[]
    const specificByCard: Record<string, Variant[]> = {}
    const specificIdsByCard: Record<string, Set<string>> = {}
    for (const v of (specificRows ?? []) as Variant[]) {
      if (!v.card_id) continue
      if (!specificByCard[v.card_id]) specificByCard[v.card_id] = []
      specificByCard[v.card_id].push(v)
      if (!specificIdsByCard[v.card_id]) specificIdsByCard[v.card_id] = new Set()
      specificIdsByCard[v.card_id].add(v.id)
    }

    // 4. Group by card_id
    const byCard: Record<string, { variants: Variant[]; hasOverrides: boolean; cardSpecificVariants: Variant[] }> = {}

    for (const row of (avaRows ?? []) as unknown as { card_id: string; variants: Variant | null }[]) {
      if (!row.variants) continue
      const cid = row.card_id
      const specificIds = specificIdsByCard[cid] ?? new Set()
      // Skip card-specific variants — they are always available and not toggleable globally
      if (specificIds.has(row.variants.id)) continue
      if (!byCard[cid]) byCard[cid] = { variants: [], hasOverrides: false, cardSpecificVariants: [] }
      byCard[cid].variants.push(row.variants)
      byCard[cid].hasOverrides = true
    }

    // Include card-specific variants in every card's entry
    for (const [cid, specifics] of Object.entries(specificByCard)) {
      if (!byCard[cid]) byCard[cid] = { variants: [], hasOverrides: false, cardSpecificVariants: [] }
      byCard[cid].cardSpecificVariants = specifics.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      byCard[cid].hasOverrides = true
    }

    // Sort each card's global variant list
    for (const cid of Object.keys(byCard)) {
      byCard[cid].variants.sort((a, b) => a.sort_order - b.sort_order)
    }

    return NextResponse.json({ byCard })
  }

  // ── Multi-card bulk fetch (explicit comma-separated cardIds list) ─────────
  // Same logic as setId branch but card IDs are provided directly — used by
  // the browse page search results to batch-fetch variant dots for multiple
  // cards that span multiple sets.
  const cardIdsParam = searchParams.get('cardIds')
  if (cardIdsParam) {
    const cardIds = cardIdsParam.split(',').map(s => s.trim()).filter(Boolean)
    if (cardIds.length === 0) return NextResponse.json({ byCard: {} })

    const { data: avaRows, error: avaErr } = await supabaseAdmin
      .from('card_variant_availability')
      .select(`
        card_id,
        variants (
          id, key, name, description, color,
          short_label, is_quick_add, sort_order,
          is_official, created_by, created_at, card_id
        )
      `)
      .in('card_id', cardIds)

    if (avaErr) {
      console.error('Error fetching multi-card variant availability:', avaErr)
      return NextResponse.json({ error: 'Failed to fetch variant availability' }, { status: 500 })
    }

    const { data: specificRows, error: specificErr } = await supabaseAdmin
      .from('variants')
      .select('id, key, name, description, color, short_label, is_quick_add, sort_order, is_official, created_by, created_at, card_id')
      .in('card_id', cardIds)

    if (specificErr) {
      console.error('Error fetching card-specific variants for multi-card:', specificErr)
      return NextResponse.json({ error: 'Failed to fetch card-specific variants' }, { status: 500 })
    }

    const specificByCard: Record<string, Variant[]> = {}
    const specificIdsByCard: Record<string, Set<string>> = {}
    for (const v of (specificRows ?? []) as Variant[]) {
      if (!v.card_id) continue
      if (!specificByCard[v.card_id]) specificByCard[v.card_id] = []
      specificByCard[v.card_id].push(v)
      if (!specificIdsByCard[v.card_id]) specificIdsByCard[v.card_id] = new Set()
      specificIdsByCard[v.card_id].add(v.id)
    }

    const byCard: Record<string, { variants: Variant[]; hasOverrides: boolean; cardSpecificVariants: Variant[] }> = {}

    for (const row of (avaRows ?? []) as unknown as { card_id: string; variants: Variant | null }[]) {
      if (!row.variants) continue
      const cid = row.card_id
      const specificIds = specificIdsByCard[cid] ?? new Set()
      if (specificIds.has(row.variants.id)) continue
      if (!byCard[cid]) byCard[cid] = { variants: [], hasOverrides: false, cardSpecificVariants: [] }
      byCard[cid].variants.push(row.variants)
      byCard[cid].hasOverrides = true
    }

    for (const [cid, specifics] of Object.entries(specificByCard)) {
      if (!byCard[cid]) byCard[cid] = { variants: [], hasOverrides: false, cardSpecificVariants: [] }
      byCard[cid].cardSpecificVariants = specifics.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      byCard[cid].hasOverrides = true
    }

    for (const cid of Object.keys(byCard)) {
      byCard[cid].variants.sort((a, b) => a.sort_order - b.sort_order)
    }

    return NextResponse.json({ byCard })
  }

  // ── Single-card fetch (original behaviour) ───────────────────────────────
  if (!cardId) {
    return NextResponse.json({ error: 'cardId, setId, or cardIds is required' }, { status: 400 })
  }

  // ── Card-specific variants (variants.card_id = cardId) ──────
  // These are always present for this card and not controlled by the toggle system.
  const { data: cardSpecificData, error: cardSpecificError } = await supabaseAdmin
    .from('variants')
    .select('id, key, name, description, color, short_label, is_quick_add, sort_order, is_official, created_by, created_at, card_id')
    .eq('card_id', cardId)

  if (cardSpecificError) {
    console.error('Error fetching card-specific variants:', cardSpecificError)
    return NextResponse.json(
      { error: 'Failed to fetch card-specific variants' },
      { status: 500 }
    )
  }

  const cardSpecificVariants: Variant[] = (cardSpecificData ?? []).map((v: any) => ({
    ...v,
    card_id: v.card_id ?? null,
  }))

  // If only card-specific variants were requested, return early
  if (cardSpecificOnly) {
    return NextResponse.json({
      variants: cardSpecificVariants,
      hasOverrides: false,
      cardSpecificVariants,
    })
  }

  // ── Global override variants (card_variant_availability rows) ─
  const { data, error } = await supabaseAdmin
    .from('card_variant_availability')
    .select(`
      variant_id,
      variants (
        id, key, name, description, color,
        short_label, is_quick_add, sort_order,
        is_official, created_by, created_at
      )
    `)
    .eq('card_id', cardId)
    .order('variant_id')

  if (error) {
    console.error('Error fetching card variant availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch card variant availability' },
      { status: 500 }
    )
  }

  // Card-specific variants are inserted into card_variant_availability too,
  // so filter them out of the global list to avoid duplicates.
  const cardSpecificIds = new Set(cardSpecificVariants.map((v) => v.id))

  const globalOverrideVariants: Variant[] = (data ?? [])
    .map((row: any) => row.variants)
    .filter(Boolean)
    .filter((v: any) => !cardSpecificIds.has(v.id))
    .sort((a: Variant, b: Variant) => a.sort_order - b.sort_order)

  return NextResponse.json({
    variants: globalOverrideVariants,
    hasOverrides: globalOverrideVariants.length > 0,
    cardSpecificVariants,
  })
}

/**
 * POST /api/card-variant-availability
 * Body: {
 *   cardId: string
 *   variantIds?: string[]         — if provided: replaces available variants ([] = revert to rarity rules)
 *                                   if omitted:  availability is left unchanged
 *   defaultVariantId?: string | null — if provided: updates cards.default_variant_id
 *                                       if omitted:  default_variant_id is left unchanged
 * }
 *
 * When variantIds is provided, replaces all overrides for the card.
 * When omitted, only defaultVariantId is updated (useful for Quick Add changes).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cardId, variantIds, defaultVariantId } = body as {
      cardId: string
      variantIds?: string[]
      defaultVariantId?: string | null
    }

    if (!cardId) {
      return NextResponse.json(
        { error: 'cardId is required' },
        { status: 400 }
      )
    }

    // ── Availability overrides — only when variantIds is explicitly provided ──
    if (variantIds !== undefined) {
      if (!Array.isArray(variantIds)) {
        return NextResponse.json(
          { error: 'variantIds must be an array when provided' },
          { status: 400 }
        )
      }

      // Delete all existing overrides for this card (replace semantics)
      const { error: deleteError } = await supabaseAdmin
        .from('card_variant_availability')
        .delete()
        .eq('card_id', cardId)

      if (deleteError) {
        throw new Error(`Failed to clear existing overrides: ${deleteError.message}`)
      }

      // Insert new overrides if any were specified
      if (variantIds.length > 0) {
        const rows = variantIds.map((variantId) => ({
          card_id: cardId,
          variant_id: variantId,
        }))

        const { error: insertError } = await supabaseAdmin
          .from('card_variant_availability')
          .insert(rows)

        if (insertError) {
          throw new Error(`Failed to save overrides: ${insertError.message}`)
        }
      }
    }

    // ── Default variant — only when defaultVariantId is explicitly provided ──
    // (undefined = no change; null or a variant ID = explicit set)
    if (defaultVariantId !== undefined) {
      const { error: cardUpdateError } = await supabaseAdmin
        .from('cards')
        .update({ default_variant_id: defaultVariantId ?? null })
        .eq('id', cardId)

      if (cardUpdateError) {
        throw new Error(`Failed to update default variant: ${cardUpdateError.message}`)
      }
    }

    return NextResponse.json({ success: true, count: variantIds?.length ?? 0 })
  } catch (error: any) {
    console.error('Error saving card variant availability:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save card variant availability' },
      { status: 500 }
    )
  }
}
