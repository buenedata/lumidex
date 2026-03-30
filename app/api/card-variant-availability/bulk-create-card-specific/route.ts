import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/card-variant-availability/bulk-create-card-specific
 *
 * Creates a card-specific variant (variants.card_id = cardId) for each
 * card in the batch. Unlike global variants, card-specific variants have no
 * uniqueness constraint on name across different cards — so multiple sets can
 * all have a "Holiday Stamp" variant with different descriptions.
 *
 * Body:
 * {
 *   cardIds:     string[]         — cards to create the variant for
 *   name:        string           — variant name (e.g. "Holiday Stamp")
 *   color:       string           — one of blue|green|purple|red|pink|yellow|gray
 *   shortLabel?: string           — e.g. "Stamp"
 *   description?: string          — e.g. "2022 Halloween Trick or Trade"
 * }
 *
 * Response: { success: true, createdCount: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cardIds, name, color, shortLabel, description, sortOrder } = body as {
      cardIds: string[]
      name: string
      color: string
      shortLabel?: string
      description?: string
      sortOrder?: number
    }

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json(
        { error: 'cardIds must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const validColors = ['green', 'blue', 'purple', 'red', 'pink', 'yellow', 'gray', 'orange', 'teal']
    if (!validColors.includes(color)) {
      return NextResponse.json({ error: 'Invalid color' }, { status: 400 })
    }

    const trimmedName  = name.trim()
    const trimmedLabel = shortLabel?.trim() || null
    const trimmedDesc  = description?.trim() || null
    const baseKey = trimmedName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    // Build one row per card — same name is fine because each row has a different card_id.
    // The key column has a global unique constraint, so we suffix with a short card ID fragment.
    const rows = cardIds.map((cardId) => ({
      key:          `${baseKey}_${cardId.replace(/-/g, '').slice(0, 12)}`,
      name:         trimmedName,
      description:  trimmedDesc,
      color,
      short_label:  trimmedLabel,
      is_quick_add: true,
      sort_order:   sortOrder ?? 0,
      is_official:  true,
      card_id:      cardId,
    }))

    const { data, error } = await supabaseAdmin
      .from('variants')
      .insert(rows)
      .select('id')

    if (error) {
      throw new Error(`Failed to create card-specific variants: ${error.message}`)
    }

    return NextResponse.json({ success: true, createdCount: (data ?? []).length })
  } catch (error: any) {
    console.error('Error in bulk-create-card-specific:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create card-specific variants' },
      { status: 500 }
    )
  }
}
