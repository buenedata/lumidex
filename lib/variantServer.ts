/**
 * variantServer.ts
 *
 * Server-only helpers for variant data.  Uses supabaseAdmin directly so
 * there is no HTTP round-trip — variant structures are resolved in the same
 * SSR pass as the page and shipped in the initial HTML payload.
 *
 * Do NOT import this file from client components.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getAvailableVariantIds } from '@/lib/variants'
import type { Variant, QuickAddVariant } from '@/types'

/**
 * Replicates the POST /api/variants batch handler without the HTTP round-trip.
 *
 * Returns `Record<cardId, QuickAddVariant[]>` with quantity = 0 for every card.
 * The structure (which variant dots to show) is determined the same way as the
 * API route:
 *   1. Explicit per-card overrides from card_variant_availability
 *   2. Card-specific variants (variants.card_id = cardId)
 *   3. Rarity-based fallback via getAvailableVariantIds()
 *
 * User quantities remain 0 until the Zustand store hydrates client-side; the
 * dots appear on first paint and the "+/-" button values update silently later.
 */
export async function batchFetchVariantStructure(
  cardIds: string[],
): Promise<Record<string, QuickAddVariant[]>> {
  if (cardIds.length === 0) return {}

  // ── 3 parallel queries ────────────────────────────────────────────────────
  const [globalResult, overrideResult, cardSpecificResult] = await Promise.all([
    // 1. Global official variants (not scoped to any card)
    supabaseAdmin
      .from('variants')
      .select('id, name, key, color, short_label, is_quick_add, sort_order, is_official, card_id')
      .eq('is_official', true)
      .is('card_id', null)
      .order('sort_order', { ascending: true }),

    // 2. Per-card availability overrides
    supabaseAdmin
      .from('card_variant_availability')
      .select('card_id, variant_id')
      .in('card_id', cardIds),

    // 3. Card-specific variants
    supabaseAdmin
      .from('variants')
      .select('id, name, key, color, short_label, is_quick_add, sort_order, is_official, card_id')
      .in('card_id', cardIds),
  ])

  const globalVariants = (globalResult.data ?? []) as Variant[]

  // Build override map: cardId → Set<variantId>
  const overrideMap: Record<string, Set<string>> = {}
  for (const row of (overrideResult.data ?? []) as { card_id: string; variant_id: string }[]) {
    if (!overrideMap[row.card_id]) overrideMap[row.card_id] = new Set()
    overrideMap[row.card_id].add(row.variant_id)
  }

  // Build card-specific map: cardId → Variant[]
  const cardSpecificMap: Record<string, Variant[]> = {}
  for (const v of (cardSpecificResult.data ?? []) as (Variant & { card_id: string })[]) {
    if (!cardSpecificMap[v.card_id]) cardSpecificMap[v.card_id] = []
    cardSpecificMap[v.card_id].push(v)
  }

  // ── Rarity-based resolution for cards with no overrides / card-specific ────
  const needsRarityLookup = cardIds.filter(
    cId => !(overrideMap[cId]?.size > 0) && !(cardSpecificMap[cId]?.length > 0),
  )

  const cardInfoMap: Record<string, {
    name: string; number: string; rarity: string; setTotal: number
  }> = {}

  if (needsRarityLookup.length > 0) {
    const { data: cardRows } = await supabaseAdmin
      .from('cards')
      .select('id, name, number, rarity, sets!inner(setTotal)')
      .in('id', needsRarityLookup)

    for (const card of (cardRows ?? []) as any[]) {
      const setData = Array.isArray(card.sets) ? card.sets[0] : card.sets
      cardInfoMap[card.id] = {
        name:     card.name     ?? '',
        number:   card.number   ?? '',
        rarity:   card.rarity   ?? '',
        setTotal: setData?.setTotal ?? 9999,
      }
    }
  }

  // ── Assemble result ───────────────────────────────────────────────────────
  const result: Record<string, QuickAddVariant[]> = {}

  for (const cId of cardIds) {
    const overrideIds = overrideMap[cId]
    const specific    = cardSpecificMap[cId] ?? []
    let applicableGlobal: Variant[]

    if (overrideIds && overrideIds.size > 0) {
      // Explicit override list — honour exactly
      applicableGlobal = globalVariants.filter(v => overrideIds.has(v.id))
    } else if (specific.length > 0) {
      // Card-specific variants present → suppress rarity fallback entirely
      applicableGlobal = []
    } else {
      const info = cardInfoMap[cId]
      if (info) {
        const availableIds = getAvailableVariantIds(
          { number: info.number, name: info.name, rarity: info.rarity },
          info.setTotal,
          globalVariants,
        )
        applicableGlobal = globalVariants.filter(v => availableIds.includes(v.id))
      } else {
        applicableGlobal = globalVariants   // last-resort fallback
      }
    }

    // Merge card-specific on top (deduplicate by id) — same as the API route
    const globalIds      = new Set(applicableGlobal.map(v => v.id))
    const uniqueSpecific = specific.filter(v => !globalIds.has(v.id))
    const merged         = [...applicableGlobal, ...uniqueSpecific]

    result[cId] = merged.map(v => ({
      id:                v.id,
      name:              v.name,
      color:             (v as any).color        as QuickAddVariant['color'],
      short_label:       (v as any).short_label  ?? null,
      quantity:          0,          // filled in client-side once user auth resolves
      sort_order:        (v as any).sort_order   ?? 0,
      card_id:           (v as any).card_id      ?? null,
      is_quick_add:      (v as any).is_quick_add ?? false,
      variant_image_url: null,       // loaded on-demand when the card modal opens
    }))
  }

  return result
}
