import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

/**
 * GET /api/card-cm-urls?cardId=<uuid>
 *
 * Returns all per-variant CardMarket URL overrides for the given card.
 * Public endpoint — CM URLs are public data.
 *
 * Response:
 *   { urls: { [variantKey: string]: string } }
 *
 * Example:
 *   { urls: { normal: "https://www.cardmarket.com/.../Charmander-V1-MEW004",
 *             cosmos_holo: "https://www.cardmarket.com/.../Charmander-V5-MEW004" } }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cardId = searchParams.get('cardId')

  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('card_cm_url_overrides')
    .select('variant_key, cm_url')
    .eq('card_id', cardId)

  if (error) {
    console.error('[card-cm-urls] GET error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const urls: Record<string, string> = {}
  for (const row of (data ?? [])) {
    urls[row.variant_key as string] = row.cm_url as string
  }

  return NextResponse.json({ urls })
}

/**
 * POST /api/card-cm-urls
 *
 * Upserts a per-variant CardMarket URL override for a card.
 * Admin-only endpoint.
 *
 * Body:
 *   { cardId: string, variantKey: string, cmUrl: string }
 *
 * To delete an override, POST with cmUrl = "" (empty string) — the row will be deleted.
 */
export async function POST(request: NextRequest) {
  // Auth check — admin only
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { cardId?: string; variantKey?: string; cmUrl?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { cardId, variantKey, cmUrl } = body

  if (!cardId || !variantKey) {
    return NextResponse.json({ error: 'cardId and variantKey are required' }, { status: 400 })
  }

  // Empty cmUrl = delete the override
  if (cmUrl === '' || cmUrl == null) {
    const { error } = await supabaseAdmin
      .from('card_cm_url_overrides')
      .delete()
      .eq('card_id', cardId)
      .eq('variant_key', variantKey)

    if (error) {
      console.error('[card-cm-urls] DELETE error:', error.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, action: 'deleted' })
  }

  // Validate URL format — must start with https://
  if (!cmUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'cmUrl must start with https://' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('card_cm_url_overrides')
    .upsert(
      { card_id: cardId, variant_key: variantKey, cm_url: cmUrl, updated_at: new Date().toISOString() },
      { onConflict: 'card_id,variant_key' }
    )

  if (error) {
    console.error('[card-cm-urls] UPSERT error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true, action: 'upserted' })
}
