import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Admin-only, uncached card listing for a set.
 *
 * The public /api/cards/[setId] route wraps getCardsBySet in unstable_cache
 * (60 s TTL, 'cards' tag).  After a bulk image import the cache isn't
 * invalidated until revalidateTag('cards') fires, so the admin grid shows
 * stale URLs.  This route talks directly to supabaseAdmin — no cache layer —
 * so freshly-uploaded R2 images are visible immediately.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ setId: string }> },
) {
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  const { setId } = await params

  const { data, error } = await supabaseAdmin
    .from('cards')
    .select(
      'id, set_id, name, number, rarity, type, image, source_card_id, source:source_card_id(image)',
    )
    .eq('set_id', setId)
    .order('number', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cards = (data ?? []).map((raw: any) => {
    const { source, image, ...rest } = raw
    const sourceImage: string | null = source?.image ?? null
    return {
      ...rest,
      /** Raw value stored in cards.image — the card's own uploaded URL */
      own_image: image ?? null,
      /** Inherited from source_card_id when there is no own upload */
      source_image: image ? null : sourceImage,
    }
  })

  const response = NextResponse.json(cards)
  // Never cache admin responses — the whole point is live data
  response.headers.set('Cache-Control', 'no-store')
  return response
}
