import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

/**
 * PATCH /api/admin/prices/patch
 *
 * Manually sets one or more price fields on a card_prices row.
 * Intended for fields that cannot be auto-fetched from the pokemontcg.io API,
 * e.g. cm_cosmos_holo (Cosmos Holo CardMarket price, EUR).
 *
 * Admin-only endpoint.
 *
 * Body:
 *   {
 *     cardId: string,
 *     fields: {
 *       cm_cosmos_holo?: number | null,
 *       // Future manually-settable fields can be added here
 *     }
 *   }
 *
 * Behaviour:
 *  - Upserts a card_prices row for the given cardId (creates it if none exists).
 *  - Only updates the fields provided in `fields` — all other columns are untouched.
 *  - Setting a field to null clears the value.
 */

/** Whitelist of columns that may be set via this endpoint. */
const ALLOWED_FIELDS = new Set(['cm_cosmos_holo'])

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { cardId?: string; fields?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { cardId, fields } = body

  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'fields object is required and must be non-empty' }, { status: 400 })
  }

  // Filter to only allowed fields
  const payload: Record<string, unknown> = { card_id: cardId }
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_FIELDS.has(key)) {
      return NextResponse.json(
        { error: `Field "${key}" is not allowed. Allowed fields: ${[...ALLOWED_FIELDS].join(', ')}` },
        { status: 400 }
      )
    }
    // Validate numeric fields are numbers or null
    if (value !== null && typeof value !== 'number') {
      return NextResponse.json(
        { error: `Field "${key}" must be a number or null` },
        { status: 400 }
      )
    }
    payload[key] = value
  }

  const { error } = await supabaseAdmin
    .from('card_prices')
    .upsert(payload, { onConflict: 'card_id' })

  if (error) {
    console.error('[admin/prices/patch] upsert error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
