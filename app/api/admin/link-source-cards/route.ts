import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalise a card name for matching: trim + lowercase. */
function normalizeName(name: string | null): string {
  return (name ?? '').trim().toLowerCase()
}

/**
 * Normalise a card number for matching.
 * "048/196" → "48", "3/132" → "3", "SWSH001" → "SWSH001" (non-numeric kept as-is)
 */
function normalizeNumber(num: string | null): string {
  const raw = (num ?? '').split('/')[0].replace(/^0+/, '')
  return raw || '0'
}

function sseChunk(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

/**
 * Fetch all rows from a Supabase query with automatic range pagination.
 * `buildQuery` must return a Supabase filter-builder (no `.single()` / `.limit()`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllCards(buildQuery: () => any): Promise<any[]> {
  const results: any[] = []
  const batchSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await buildQuery().range(from, from + batchSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    results.push(...data)
    if (data.length < batchSize) break
    from += batchSize
  }

  return results
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(_request: NextRequest) {
  // 1. Auth
  try {
    await requireAdmin()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: unknown) => {
        try { controller.enqueue(sseChunk(payload)) } catch { /* closed */ }
      }

      try {
        emit({ type: 'status', message: 'Fetching all cards with images…' })

        // ── Step 1: build lookup map of imaged cards ──────────────────────
        const imagedCards = await fetchAllCards(() =>
          supabaseAdmin
            .from('cards')
            .select('id, set_id, name, number, image')
            .not('image', 'is', null)
        )

        emit({ type: 'status', message: `Found ${imagedCards.length} cards with images. Building index…` })

        // Map: `${name}::${number}` → Card[]  (may have multiple across sets)
        const byNameNumber = new Map<string, typeof imagedCards>()
        for (const card of imagedCards) {
          const key = `${normalizeName(card.name)}::${normalizeNumber(card.number)}`
          const existing = byNameNumber.get(key) ?? []
          existing.push(card)
          byNameNumber.set(key, existing)
        }

        // ── Step 2: fetch unimaged, unlinked cards ────────────────────────
        emit({ type: 'status', message: 'Fetching cards that need images…' })

        const unimagedCards = await fetchAllCards(() =>
          supabaseAdmin
            .from('cards')
            .select('id, set_id, name, number')
            .is('image', null)
            .is('source_card_id', null)
        )

        emit({ type: 'status', message: `Found ${unimagedCards.length} cards without images. Matching…`, total: unimagedCards.length })

        // ── Step 3: match ─────────────────────────────────────────────────
        const toLink: Array<{ cardId: string; sourceCardId: string }> = []
        const ambiguous: Array<{
          card: { id: string; set_id: string; name: string; number: string }
          candidates: Array<{ id: string; set_id: string; name: string; number: string; image: string }>
        }> = []
        let noMatch = 0

        for (const card of unimagedCards) {
          const key = `${normalizeName(card.name)}::${normalizeNumber(card.number)}`
          const candidates = (byNameNumber.get(key) ?? []).filter(
            (c) => c.set_id !== card.set_id          // never link to own set
          )

          if (candidates.length === 0) {
            noMatch++
          } else if (candidates.length === 1) {
            toLink.push({ cardId: card.id, sourceCardId: candidates[0].id })
          } else {
            ambiguous.push({ card, candidates })
          }
        }

        emit({
          type: 'status',
          message: `Matched ${toLink.length} cards. Applying updates…`,
          toLink: toLink.length,
          noMatch,
          ambiguous: ambiguous.length,
        })

        // ── Step 4: batch-update source_card_id ───────────────────────────
        const batchSize = 20
        let linked = 0

        for (let i = 0; i < toLink.length; i += batchSize) {
          const chunk = toLink.slice(i, i + batchSize)
          await Promise.all(
            chunk.map(({ cardId, sourceCardId }) =>
              supabaseAdmin
                .from('cards')
                .update({ source_card_id: sourceCardId })
                .eq('id', cardId)
            )
          )
          linked += chunk.length
          emit({
            type: 'progress',
            linked,
            total: toLink.length,
          })
        }

        // ── Step 5: done ──────────────────────────────────────────────────
        emit({
          type: 'complete',
          linked,
          noMatch,
          skipped: 0,
          ambiguous,
        })
      } catch (err) {
        emit({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// ── Manual single-card link / unlink ─────────────────────────────────────────

/**
 * PATCH /api/admin/link-source-cards
 * Body: { cardId: string, sourceCardId: string | null }
 * Sets or clears source_card_id for a single card (used by ambiguous review UI).
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body: { cardId: string; sourceCardId: string | null }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { cardId, sourceCardId } = body
  if (!cardId) {
    return new Response(JSON.stringify({ error: 'cardId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { error } = await supabaseAdmin
    .from('cards')
    .update({ source_card_id: sourceCardId ?? null })
    .eq('id', cardId)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
