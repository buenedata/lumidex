import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminSupabaseClient } from '@/lib/admin'
import { isValidGame } from '@/lib/games'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert an arbitrary string into a URL-safe slug. */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ── Input types ───────────────────────────────────────────────────────────────

interface CardInput {
  name: string
  number: string
  rarity?: string
  image_url?: string
  artist?: string
  type?: string
}

interface SetInput {
  name: string
  series?: string
  release_date?: string  // YYYY-MM-DD
  total?: number
  logo_url?: string
  symbol_url?: string
  language?: string      // default 'en'
  cards: CardInput[]
}

interface ImportBody {
  game: string
  sets: SetInput[]
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/import-cards
 *
 * Idempotent bulk import of sets + cards for any non-Pokémon game.
 * Existing sets (matched by name + game) and cards (matched by number + set_id)
 * are silently skipped — safe to re-run with the same payload.
 *
 * Returns: { setsCreated, setsSkipped, cardsCreated, cardsSkipped }
 */
export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: ImportBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { game, sets } = body

  // ── Validate game ────────────────────────────────────────────────────────────
  if (!game || typeof game !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid "game" field' }, { status: 400 })
  }

  if (!isValidGame(game)) {
    return NextResponse.json(
      { error: `Unknown game: "${game}". Valid games are: pokemon, moomin` },
      { status: 400 },
    )
  }

  if (game === 'pokemon') {
    return NextResponse.json(
      { error: 'Use the dedicated Pokémon import tool for Pokémon data' },
      { status: 400 },
    )
  }

  // ── Validate sets array ──────────────────────────────────────────────────────
  if (!Array.isArray(sets) || sets.length === 0) {
    return NextResponse.json({ error: '"sets" must be a non-empty array' }, { status: 400 })
  }

  // ── Import ───────────────────────────────────────────────────────────────────
  const supabase = getAdminSupabaseClient()

  let setsCreated = 0
  let setsSkipped = 0
  let cardsCreated = 0
  let cardsSkipped = 0

  for (const setInput of sets) {
    if (!setInput.name || typeof setInput.name !== 'string') {
      console.warn('[import-cards] Skipping set with missing name:', setInput)
      continue
    }

    // ── Check if set already exists ──────────────────────────────────────────
    const { data: existingSet, error: lookupError } = await supabase
      .from('sets')
      .select('set_id')
      .eq('name', setInput.name)
      .eq('game', game)
      .maybeSingle()

    if (lookupError) {
      console.error('[import-cards] set lookup error:', lookupError)
      return NextResponse.json(
        { error: `DB error checking set "${setInput.name}": ${lookupError.message}` },
        { status: 500 },
      )
    }

    let setId: string

    if (existingSet) {
      // Set already in DB — skip creation but still process its cards
      setId = existingSet.set_id
      setsSkipped++
    } else {
      // ── Generate a deterministic, URL-safe set_id ──────────────────────────
      const baseSlug = `${game}-${slugify(setInput.name)}`

      // Guard against the rare case where two different set names produce the
      // same slug (e.g. 'Moomin: Deluxe' and 'Moomin  Deluxe').
      const { data: conflictSet } = await supabase
        .from('sets')
        .select('set_id')
        .eq('set_id', baseSlug)
        .maybeSingle()

      setId = conflictSet ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug

      // ── Insert the set ─────────────────────────────────────────────────────
      const { error: insertSetError } = await supabase.from('sets').insert({
        set_id: setId,
        name: setInput.name,
        series: setInput.series ?? null,
        release_date: setInput.release_date ?? null,
        setTotal: setInput.total ?? null,
        setComplete: setInput.total ?? null,
        logo_url: setInput.logo_url ?? null,
        symbol_url: setInput.symbol_url ?? null,
        language: setInput.language ?? 'en',
        game,
      })

      if (insertSetError) {
        console.error('[import-cards] set insert error:', insertSetError)
        return NextResponse.json(
          { error: `Failed to create set "${setInput.name}": ${insertSetError.message}` },
          { status: 500 },
        )
      }

      setsCreated++
    }

    // ── Process cards ────────────────────────────────────────────────────────
    if (!Array.isArray(setInput.cards)) continue

    for (const cardInput of setInput.cards) {
      if (!cardInput.name || !cardInput.number) {
        console.warn('[import-cards] Skipping card with missing name/number:', cardInput)
        continue
      }

      // Check if this card already exists in the set
      const { data: existingCard, error: cardLookupError } = await supabase
        .from('cards')
        .select('id')
        .eq('set_id', setId)
        .eq('number', String(cardInput.number))
        .maybeSingle()

      if (cardLookupError) {
        console.error('[import-cards] card lookup error:', cardLookupError)
        // Non-fatal — skip this card and continue
        cardsSkipped++
        continue
      }

      if (existingCard) {
        cardsSkipped++
        continue
      }

      // Insert the card
      const { error: insertCardError } = await supabase.from('cards').insert({
        set_id: setId,
        name: cardInput.name,
        number: String(cardInput.number),
        rarity: cardInput.rarity ?? null,
        image: cardInput.image_url ?? null,
        artist: cardInput.artist ?? null,
        type: cardInput.type ?? null,
      })

      if (insertCardError) {
        console.error('[import-cards] card insert error:', insertCardError)
        // Non-fatal — log and count as skipped
        cardsSkipped++
        continue
      }

      cardsCreated++
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  return NextResponse.json({ setsCreated, setsSkipped, cardsCreated, cardsSkipped })
}
