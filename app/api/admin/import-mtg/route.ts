import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'
import {
  fetchScryfallSet,
  fetchScryfallSetCards,
  getCardImageUrl,
  normaliseRarity,
  deriveSetSeries,
  isImportableSetType,
} from '@/lib/scryfall'

/**
 * POST /api/admin/import-mtg
 *
 * Imports one MTG set from Scryfall into the Lumidex database.
 * Returns a Server-Sent Events (SSE) stream so the admin UI can display
 * real-time progress.
 *
 * Request body: { setCode: string }
 *
 * SSE event format (each line is JSON):
 *   { "type": "status",   "message": string }
 *   { "type": "progress", "current": number, "total": number }
 *   { "type": "done",     "setsCreated": number, "cardsCreated": number, "cardsSkipped": number }
 *   { "type": "error",    "message": string }
 */
export async function POST(request: NextRequest) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  try {
    await requireAdmin()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return new Response(JSON.stringify({ error: msg }), { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let setCode: string
  try {
    const body = await request.json()
    setCode = (body.setCode as string)?.trim().toLowerCase()
    if (!setCode) throw new Error('setCode is required')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid request body'
    return new Response(JSON.stringify({ error: msg }), { status: 400 })
  }

  // ── SSE stream setup ──────────────────────────────────────────────────────
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // ── 1. Fetch set metadata from Scryfall ─────────────────────────────
        emit({ type: 'status', message: `Fetching set metadata for "${setCode}" from Scryfall…` })

        const scryfallSet = await fetchScryfallSet(setCode)

        if (!isImportableSetType(scryfallSet.set_type)) {
          emit({
            type: 'error',
            message: `Set type "${scryfallSet.set_type}" is not in the import scope (expansion, core, masters only).`,
          })
          controller.close()
          return
        }

        const lumidexSetId = `mtg-${setCode}`
        const series = deriveSetSeries(scryfallSet.set_type)

        emit({
          type: 'status',
          message: `Found: "${scryfallSet.name}" (${scryfallSet.card_count} cards, ${series})`,
        })

        // ── 2. Upsert the set ───────────────────────────────────────────────
        const { error: setError } = await supabaseAdmin
          .from('sets')
          .upsert(
            {
              set_id:      lumidexSetId,
              name:        scryfallSet.name,
              series,
              release_date: scryfallSet.released_at ?? null,
              setTotal:    scryfallSet.card_count,
              setComplete: scryfallSet.card_count,
              symbol_url:  scryfallSet.icon_svg_uri ?? null,
              logo_url:    null,
              language:    'en',
              game:        'mtg',
              api_set_id:  setCode,
            },
            { onConflict: 'set_id' },
          )

        if (setError) {
          emit({ type: 'error', message: `Failed to upsert set: ${setError.message}` })
          controller.close()
          return
        }

        let setsCreated = 1

        // ── 3. Fetch cards from Scryfall (paginated) ────────────────────────
        emit({ type: 'status', message: 'Fetching cards from Scryfall (this may take a moment)…' })

        const cards = await fetchScryfallSetCards(setCode, (fetched, total) => {
          emit({ type: 'progress', current: fetched, total })
        })

        emit({ type: 'status', message: `Fetched ${cards.length} cards. Checking for existing records…` })

        // ── 4. Fetch existing card numbers for this set ─────────────────────
        // cards table has no UNIQUE(set_id, number) constraint, so we use the
        // same pattern as /api/admin/import-cards: lookup first, insert only new.
        const { data: existingCards, error: existingError } = await supabaseAdmin
          .from('cards')
          .select('number')
          .eq('set_id', lumidexSetId)

        if (existingError) {
          emit({ type: 'error', message: `Failed to check existing cards: ${existingError.message}` })
          controller.close()
          return
        }

        const existingNumbers = new Set((existingCards ?? []).map((c) => c.number))
        const toInsert = cards.filter((c) => !existingNumbers.has(c.collector_number))
        const cardsSkipped = cards.length - toInsert.length

        if (cardsSkipped > 0) {
          emit({ type: 'status', message: `${cardsSkipped} cards already in DB — inserting ${toInsert.length} new cards…` })
        } else {
          emit({ type: 'status', message: `Inserting ${toInsert.length} cards…` })
        }

        // ── 5. Insert new cards in batches ──────────────────────────────────
        let cardsCreated = 0
        const BATCH_SIZE = 50

        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
          const batch = toInsert.slice(i, i + BATCH_SIZE)

          const rows = batch.map((card) => ({
            set_id: lumidexSetId,
            name:   card.name,
            number: card.collector_number,
            rarity: normaliseRarity(card.rarity),
            artist: card.artist ?? null,
            type:   card.type_line ?? null,
            image:  getCardImageUrl(card),
            api_id: card.id,
            // hp, subtypes, supertype intentionally omitted (not in MTG)
          }))

          const { data: inserted, error: cardError } = await supabaseAdmin
            .from('cards')
            .insert(rows)
            .select('id')

          if (cardError) {
            // Emit the actual error so it's visible in the import log
            emit({ type: 'error', message: `Card insert error (batch starting at ${i}): ${cardError.message}` })
            console.error(`[import-mtg] card insert error (batch ${i}):`, cardError)
            // Continue — don't abort the whole import for one bad batch
          } else {
            cardsCreated += inserted?.length ?? batch.length
          }

          emit({
            type: 'progress',
            current: Math.min(i + BATCH_SIZE, toInsert.length),
            total: toInsert.length,
          })
        }

        // ── 5. Done ─────────────────────────────────────────────────────────
        emit({
          type: 'done',
          setsCreated,
          cardsCreated,
          cardsSkipped,
          setId: lumidexSetId,
          setName: scryfallSet.name,
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[import-mtg] unexpected error:', message)
        emit({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
