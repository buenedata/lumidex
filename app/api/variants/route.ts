import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Variant, UserCardVariant, VariantWithQuantity } from '@/types'
import { getAvailableVariantIds } from '@/lib/variants'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const cardId = searchParams.get('cardId')
    const cardIds = searchParams.get('cardIds') // Support batch requests
    const quickAddOnly = searchParams.get('quickAddOnly') === 'true'
    const userId = searchParams.get('userId')

    // Global catalog: official variants with no card scope.
    // Card-specific variants (card_id IS NOT NULL) are merged separately per-card.
    let query = supabaseAdmin
      .from('variants')
      .select('*')
      .eq('is_official', true)
      .is('card_id', null)

    if (quickAddOnly) {
      query = query.eq('is_quick_add', true)
    }

    query = query.order('sort_order', { ascending: true })

    const { data: variants, error: variantsError } = await query

    if (variantsError) {
      console.error('Error fetching variants:', variantsError)
      return NextResponse.json(
        { error: 'Failed to fetch variants' },
        { status: 500 }
      )
    }

    if (!variants || variants.length === 0) {
      const emptyResponse = NextResponse.json(cardIds ? {} : [])
      emptyResponse.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
      return emptyResponse
    }

    const variantIds = variants.map((v: Variant) => v.id)

    // BATCH REQUEST: return Record<cardId, VariantWithQuantity[]>
    if (cardIds) {
      const cardIdList = cardIds.split(',')

      // 1. Fetch per-card variant overrides (one query)
      const { data: overrideRows, error: overrideErr } = await supabaseAdmin
        .from('card_variant_availability')
        .select('card_id, variant_id')
        .in('card_id', cardIdList)

      if (overrideErr) {
        console.error('[variants batch] overrides query failed:', overrideErr)
        return NextResponse.json({ error: `Override query failed: ${overrideErr.message}` }, { status: 500 })
      }

      // Build override map: cardId → Set<variantId>
      const overrideMap: Record<string, Set<string>> = {}
      overrideRows?.forEach((row: { card_id: string; variant_id: string }) => {
        if (!overrideMap[row.card_id]) overrideMap[row.card_id] = new Set()
        overrideMap[row.card_id].add(row.variant_id)
      })

      // 1b. Fetch card-specific variants (variants.card_id IN cardIdList)
      const { data: cardSpecificRows, error: cardSpecificErr } = await supabaseAdmin
        .from('variants')
        .select('*')
        .in('card_id', cardIdList)

      if (cardSpecificErr) {
        console.error('[variants batch] card-specific query failed:', cardSpecificErr)
        return NextResponse.json({ error: `Card-specific query failed: ${cardSpecificErr.message}` }, { status: 500 })
      }

      // Build card-specific map: cardId → Variant[]
      const cardSpecificMap: Record<string, Variant[]> = {}
      cardSpecificRows?.forEach((v: any) => {
        if (!cardSpecificMap[v.card_id]) cardSpecificMap[v.card_id] = []
        cardSpecificMap[v.card_id].push(v as Variant)
      })

      // 2. For cards without overrides AND without card-specific variants,
      //    fetch card + set data to apply rarity rules server-side.
      //    Cards with card-specific variants skip rarity — those variants already define what shows.
      const cardIdsWithoutOverrides = cardIdList.filter(
        cId => !(overrideMap[cId]?.size > 0) && !(cardSpecificMap[cId]?.length > 0)
      )

      // cardId → { name, number, rarity, setTotal }
      const cardInfoMap: Record<string, { name: string; number: string; rarity: string; setTotal: number }> = {}

      if (cardIdsWithoutOverrides.length > 0) {
        const { data: cardRows } = await supabaseAdmin
          .from('cards')
          .select('id, name, number, rarity, sets!inner(setTotal)')
          .in('id', cardIdsWithoutOverrides)

        cardRows?.forEach((card: any) => {
          const setData = Array.isArray(card.sets) ? card.sets[0] : card.sets
          cardInfoMap[card.id] = {
            name:     card.name     ?? '',
            number:   card.number   ?? '',
            rarity:   card.rarity   ?? '',
            setTotal: setData?.setTotal ?? 9999,
          }
        })
      }

      /**
       * For a given cardId, return the variants that apply:
       *   1. Explicit global overrides (card_variant_availability rows) → use only those
       *   2. Card-specific variants exist (variants.card_id = cardId) → show only those,
       *      suppress rarity fallback so Normal/Reverse Holo don't bleed in
       *   3. No overrides, no card-specific → apply rarity rules server-side
       */
      const variantsForCard = (cId: string): Variant[] => {
        const overrideIds  = overrideMap[cId]
        const specific     = cardSpecificMap[cId] ?? []
        let globalVariants: Variant[]

        if (overrideIds && overrideIds.size > 0) {
          // Explicit global override list — honour it exactly
          globalVariants = variants.filter((v: Variant) => overrideIds.has(v.id))
        } else if (specific.length > 0) {
          // Card-specific variants present → suppress rarity fallback entirely
          globalVariants = []
        } else {
          const info = cardInfoMap[cId]
          if (info) {
            const availableIds = getAvailableVariantIds(
              { number: info.number, name: info.name, rarity: info.rarity },
              info.setTotal,
              variants as Variant[]
            )
            globalVariants = (variants as Variant[]).filter(v => availableIds.includes(v.id))
          } else {
            globalVariants = variants as Variant[] // last-resort fallback
          }
        }

        // Merge card-specific variants (deduplicate by id)
        const globalIds = new Set(globalVariants.map(v => v.id))
        const uniqueSpecific = specific.filter(v => !globalIds.has(v.id))
        return [...globalVariants, ...uniqueSpecific]
      }

      if (userId) {
        // Fetch user quantities for all requested cards + these variants
        const { data: userVariants, error: userVariantsError } = await supabaseAdmin
          .from('user_card_variants')
          .select('variant_id, quantity, card_id')
          .eq('user_id', userId)
          .in('card_id', cardIdList)
          .in('variant_id', variantIds)

        if (userVariantsError) {
          console.error('Error fetching user variants:', userVariantsError)
          return NextResponse.json(
            { error: 'Failed to fetch user variant quantities' },
            { status: 500 }
          )
        }

        // Build quantity map: cardId -> variantId -> quantity
        const quantityMap: Record<string, Record<string, number>> = {}
        userVariants?.forEach((uv) => {
          if (!quantityMap[uv.card_id]) quantityMap[uv.card_id] = {}
          quantityMap[uv.card_id][uv.variant_id] = uv.quantity
        })

        // Return override-filtered variants + user quantities per card
        const groupedResults: Record<string, VariantWithQuantity[]> = {}
        cardIdList.forEach(cId => {
          const cardQuantities = quantityMap[cId] || {}
          groupedResults[cId] = variantsForCard(cId).map((variant: Variant) => ({
            ...variant,
            quantity: cardQuantities[variant.id] || 0
          }))
        })

        const batchUserResponse = NextResponse.json(groupedResults)
        batchUserResponse.headers.set('Cache-Control', 'no-store')
        return batchUserResponse
      }

      // No userId — return override-filtered variants with 0 quantity
      const groupedResults: Record<string, VariantWithQuantity[]> = {}
      cardIdList.forEach(cId => {
        groupedResults[cId] = variantsForCard(cId).map((variant: Variant) => ({
          ...variant,
          quantity: 0
        }))
      })
      const batchResponse = NextResponse.json(groupedResults)
      batchResponse.headers.set('Cache-Control', 'no-store')
      return batchResponse
    }

    // SINGLE / NO CARD REQUEST: return flat VariantWithQuantity[]
    // Apply override or rarity-rule filtering when cardId is provided
    let filteredVariants: Variant[] = variants as Variant[]
    if (cardId) {
      // Check for explicit overrides first
      const { data: cvaRows } = await supabaseAdmin
        .from('card_variant_availability')
        .select('variant_id')
        .eq('card_id', cardId)

      // Always fetch card-specific variants up front — they must be merged on top
      // of whatever the base set is (override OR rarity-rules).
      // Mirrors the POST batch variantsForCard() logic so the modal and card tiles
      // are consistent.
      const { data: cardSpecificRows } = await supabaseAdmin
        .from('variants')
        .select('*')
        .eq('card_id', cardId)

      const cardSpecificVariants = (cardSpecificRows ?? []) as Variant[]

      if (cvaRows && cvaRows.length > 0) {
        // Explicit global override list — honour it exactly, card-specific merged below
        const overrideIds = new Set(cvaRows.map((r: { variant_id: string }) => r.variant_id))
        filteredVariants = (variants as Variant[]).filter(v => overrideIds.has(v.id))
      } else if (cardSpecificVariants.length > 0) {
        // Card-specific variants present, no global overrides → suppress rarity fallback
        filteredVariants = []
      } else {
        // No overrides, no card-specific → apply rarity rules
        const { data: cardRow } = await supabaseAdmin
          .from('cards')
          .select('name, number, rarity, sets!inner(setTotal)')
          .eq('id', cardId)
          .single()

        if (cardRow) {
          const setData = Array.isArray(cardRow.sets) ? (cardRow.sets as any[])[0] : cardRow.sets as any
          const availableIds = getAvailableVariantIds(
            { number: cardRow.number ?? '', name: cardRow.name ?? '', rarity: cardRow.rarity ?? '' },
            setData?.setTotal ?? 9999,
            variants as Variant[]
          )
          filteredVariants = (variants as Variant[]).filter(v => availableIds.includes(v.id))
        }
      }

      // Merge card-specific variants on top (deduplicate by id).
      // Matches the POST batch variantsForCard() merge so modal and card tiles are consistent.
      const filteredIds = new Set(filteredVariants.map((v: Variant) => v.id))
      const uniqueSpecific = cardSpecificVariants.filter((v: Variant) => !filteredIds.has(v.id))
      filteredVariants = [...filteredVariants, ...uniqueSpecific]
    }

    if (userId) {
      let userQuery = supabaseAdmin
        .from('user_card_variants')
        .select('variant_id, quantity, card_id')
        .eq('user_id', userId)
        .in('variant_id', filteredVariants.map(v => v.id))

      if (cardId) {
        userQuery = userQuery.eq('card_id', cardId)
      }

      const { data: userVariants, error: userVariantsError } = await userQuery

      if (userVariantsError) {
        console.error('Error fetching user variants:', userVariantsError)
        return NextResponse.json(
          { error: 'Failed to fetch user variant quantities' },
          { status: 500 }
        )
      }

      const userQuantityMap = new Map(
        (userVariants as UserCardVariant[])?.map((uv: UserCardVariant) => [uv.variant_id, uv.quantity]) || []
      )

      const variantsWithQuantities: VariantWithQuantity[] = filteredVariants.map((variant: Variant) => ({
        ...variant,
        quantity: userQuantityMap.get(variant.id) || 0
      }))

      const singleUserResponse = NextResponse.json(variantsWithQuantities)
      singleUserResponse.headers.set('Cache-Control', 'no-store')
      return singleUserResponse
    }

    // No userId — return flat array with 0 quantities (filtered by override/rarity)
    const variantsWithZeroQuantities: VariantWithQuantity[] = filteredVariants.map((variant: Variant) => ({
      ...variant,
      quantity: 0
    }))

    const singleResponse = NextResponse.json(variantsWithZeroQuantities)
    singleResponse.headers.set('Cache-Control', 'no-store')
    return singleResponse

  } catch (error) {
    console.error('Unexpected error in variants API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/variants
 *
 * Two modes depending on the request body:
 *
 * 1. Batch fetch  — { cardIds: string[], userId?: string }
 *    Returns Record<cardId, VariantWithQuantity[]>.
 *    Used by CardGrid for large sets where the GET ?cardIds=... URL would
 *    exceed the Node.js ~8 KB header-size limit (HTTP 431).
 *
 * 2. Variant upsert  — { name, key, description, color, … }
 *    Creates or updates a single variant by key.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // ── BATCH FETCH ────────────────────────────────────────────────────────
    if (Array.isArray(body.cardIds)) {
      const cardIdList: string[] = body.cardIds
      const userId: string | undefined = body.userId

      if (cardIdList.length === 0) {
        return NextResponse.json({ error: 'cardIds must be non-empty' }, { status: 400 })
      }

      // Debug: log which key/URL supabaseAdmin is actually using at runtime
      const _dbgUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30)
      const _dbgSvc  = process.env.SUPABASE_SECRET_KEY?.slice(0, 15)
      const _dbgPub  = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.slice(0, 15)
      console.log('[variants POST] url_prefix:', _dbgUrl, '| svc_key_prefix:', _dbgSvc ?? 'MISSING', '| pub_key_prefix:', _dbgPub)

      // 1. Global variant catalogue
      const { data: variants, error: variantsError } = await supabaseAdmin
        .from('variants')
        .select('*')
        .eq('is_official', true)
        .is('card_id', null)
        .order('sort_order', { ascending: true })

      if (variantsError) {
        console.error('[variants POST batch] global variants:', variantsError)
        return NextResponse.json({
          error: 'Failed to fetch global variants',
          detail: variantsError.message,
          code: variantsError.code,
          debug: { url_prefix: _dbgUrl, svc_key_prefix: _dbgSvc ?? 'MISSING', pub_key_prefix: _dbgPub },
        }, { status: 500 })
      }

      if (!variants || variants.length === 0) {
        const r = NextResponse.json({})
        r.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
        return r
      }

      const variantIds = variants.map((v: Variant) => v.id)

      // 2. Per-card global overrides
      const { data: overrideRows, error: overrideErr } = await supabaseAdmin
        .from('card_variant_availability')
        .select('card_id, variant_id')
        .in('card_id', cardIdList)

      if (overrideErr) {
        console.error('[variants POST batch] overrides:', overrideErr)
        return NextResponse.json({ error: `Override query failed: ${overrideErr.message}` }, { status: 500 })
      }

      const overrideMap: Record<string, Set<string>> = {}
      overrideRows?.forEach((row: { card_id: string; variant_id: string }) => {
        if (!overrideMap[row.card_id]) overrideMap[row.card_id] = new Set()
        overrideMap[row.card_id].add(row.variant_id)
      })

      // 3. Card-specific variants
      const { data: cardSpecificRows, error: cardSpecificErr } = await supabaseAdmin
        .from('variants')
        .select('*')
        .in('card_id', cardIdList)

      if (cardSpecificErr) {
        console.error('[variants POST batch] card-specific:', cardSpecificErr)
        return NextResponse.json({ error: `Card-specific query failed: ${cardSpecificErr.message}` }, { status: 500 })
      }

      const cardSpecificMap: Record<string, Variant[]> = {}
      cardSpecificRows?.forEach((v: any) => {
        if (!cardSpecificMap[v.card_id]) cardSpecificMap[v.card_id] = []
        cardSpecificMap[v.card_id].push(v as Variant)
      })

      // 4. Rarity-rule card data (only cards with no overrides and no card-specific variants)
      const cardIdsWithoutOverrides = cardIdList.filter(
        cId => !(overrideMap[cId]?.size > 0) && !(cardSpecificMap[cId]?.length > 0)
      )
      const cardInfoMap: Record<string, { name: string; number: string; rarity: string; setTotal: number }> = {}

      if (cardIdsWithoutOverrides.length > 0) {
        const { data: cardRows } = await supabaseAdmin
          .from('cards')
          .select('id, name, number, rarity, sets!inner(setTotal)')
          .in('id', cardIdsWithoutOverrides)

        cardRows?.forEach((card: any) => {
          const setData = Array.isArray(card.sets) ? card.sets[0] : card.sets
          cardInfoMap[card.id] = {
            name:     card.name   ?? '',
            number:   card.number ?? '',
            rarity:   card.rarity ?? '',
            setTotal: setData?.setTotal ?? 9999,
          }
        })
      }

      const variantsForCard = (cId: string): Variant[] => {
        const overrideIds = overrideMap[cId]
        const specific    = cardSpecificMap[cId] ?? []
        let globalVariants: Variant[]

        if (overrideIds && overrideIds.size > 0) {
          globalVariants = variants.filter((v: Variant) => overrideIds.has(v.id))
        } else if (specific.length > 0) {
          globalVariants = []
        } else {
          const info = cardInfoMap[cId]
          if (info) {
            const availableIds = getAvailableVariantIds(
              { number: info.number, name: info.name, rarity: info.rarity },
              info.setTotal,
              variants as Variant[]
            )
            globalVariants = (variants as Variant[]).filter(v => availableIds.includes(v.id))
          } else {
            globalVariants = variants as Variant[]
          }
        }

        const globalIds      = new Set(globalVariants.map(v => v.id))
        const uniqueSpecific = specific.filter(v => !globalIds.has(v.id))
        return [...globalVariants, ...uniqueSpecific]
      }

      // 5. User quantities
      if (userId) {
        const { data: userVariants, error: uvErr } = await supabaseAdmin
          .from('user_card_variants')
          .select('variant_id, quantity, card_id')
          .eq('user_id', userId)
          .in('card_id', cardIdList)
          .in('variant_id', variantIds)

        if (uvErr) {
          console.error('[variants POST batch] user quantities:', uvErr)
          return NextResponse.json({ error: 'Failed to fetch user variant quantities' }, { status: 500 })
        }

        const quantityMap: Record<string, Record<string, number>> = {}
        userVariants?.forEach((uv) => {
          if (!quantityMap[uv.card_id]) quantityMap[uv.card_id] = {}
          quantityMap[uv.card_id][uv.variant_id] = uv.quantity
        })

        const grouped: Record<string, VariantWithQuantity[]> = {}
        cardIdList.forEach(cId => {
          const q = quantityMap[cId] || {}
          grouped[cId] = variantsForCard(cId).map((v: Variant) => ({ ...v, quantity: q[v.id] || 0 }))
        })

        const r = NextResponse.json(grouped)
        r.headers.set('Cache-Control', 'no-store')
        return r
      }

      const grouped: Record<string, VariantWithQuantity[]> = {}
      cardIdList.forEach(cId => {
        grouped[cId] = variantsForCard(cId).map((v: Variant) => ({ ...v, quantity: 0 }))
      })
      const r = NextResponse.json(grouped)
      r.headers.set('Cache-Control', 'no-store')
      return r
    }

    // ── VARIANT UPSERT ────────────────────────────────────────────────────
    const { name, key, description, color, short_label, is_quick_add, sort_order, is_official, created_by } = body

    if (!name || !key) {
      return NextResponse.json({ error: 'name and key are required' }, { status: 400 })
    }

    const { data: variant, error: variantError } = await supabaseAdmin
      .from('variants')
      .upsert({
        name,
        key,
        description:  description  || null,
        color:        color        || 'gray',
        short_label:  short_label  || null,
        is_quick_add: is_quick_add || false,
        sort_order:   sort_order   || 0,
        is_official:  is_official !== undefined ? is_official : true,
        created_by:   created_by   || null,
      }, { onConflict: 'key', ignoreDuplicates: false })
      .select('*')
      .single()

    if (variantError) {
      console.error('Error creating/updating variant:', variantError)
      return NextResponse.json({ error: 'Failed to create/update variant' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: variant, message: 'Variant created/updated successfully' })

  } catch (error) {
    console.error('Error in POST /api/variants:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, sort_order } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('variants')
      .update({ sort_order })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in PATCH /api/variants:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const variantId = searchParams.get('id')

    if (!variantId) {
      return NextResponse.json(
        { error: 'Variant ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('variants')
      .delete()
      .eq('id', variantId)

    if (error) {
      console.error('Error deleting variant:', error)
      return NextResponse.json(
        { error: 'Failed to delete variant' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Variant deleted successfully'
    })

  } catch (error) {
    console.error('Error in DELETE /api/variants:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
