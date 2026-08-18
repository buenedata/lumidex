/**
 * scripts/importMtgData.ts
 *
 * CLI bulk import of MTG sets and cards from Scryfall into Lumidex.
 *
 * Uses the Scryfall "default_cards" bulk-data dump for the initial load —
 * a single ~100 MB download containing all English MTG cards, which avoids
 * per-page rate limiting.
 *
 * Usage:
 *   npm run import:mtg                       # 20 newest expansion/core/masters sets
 *   npm run import:mtg -- --set dsk          # single set by Scryfall code
 *   npm run import:mtg -- --limit 50         # top 50 newest sets
 *   npm run import:mtg -- --type masters     # Masters sets only
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import {
  fetchScryfallSets,
  fetchScryfallBulkDataUrl,
  getCardImageUrl,
  normaliseRarity,
  deriveSetSeries,
  isImportableSetType,
  MTG_IMPORTED_SET_TYPES,
  type ScryfallCard,
  type ScryfallSet,
  type MtgImportedSetType,
} from '../lib/scryfall'

// ── Env / Supabase ────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('✗ Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

function getArg(flag: string): string | null {
  const idx = args.indexOf(flag)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null
}

const singleSetCode = getArg('--set')?.toLowerCase() ?? null
const limitArg = parseInt(getArg('--limit') ?? '20', 10)
const typeArg = getArg('--type')?.toLowerCase() ?? null

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧙 Lumidex MTG Import — Scryfall bulk data')
  console.log('─'.repeat(50))

  // ── 1. Determine which sets to import ─────────────────────────────────────
  let setsToImport: ScryfallSet[]

  if (singleSetCode) {
    console.log(`→ Single set mode: ${singleSetCode}`)
    const all = await fetchScryfallSets()
    const found = all.find((s) => s.code === singleSetCode)
    if (!found) {
      console.error(`✗ Set "${singleSetCode}" not found in importable set types (expansion, core, masters)`)
      process.exit(1)
    }
    setsToImport = [found]
  } else {
    console.log('→ Fetching MTG sets from Scryfall…')
    let all = await fetchScryfallSets() // already filtered to expansion+core+masters, newest first

    if (typeArg) {
      if (!isImportableSetType(typeArg)) {
        console.error(`✗ --type "${typeArg}" is not valid. Choose from: ${MTG_IMPORTED_SET_TYPES.join(', ')}`)
        process.exit(1)
      }
      all = all.filter((s) => s.set_type === typeArg)
    }

    setsToImport = all.slice(0, limitArg)
    console.log(`→ Will import ${setsToImport.length} sets (limit: ${limitArg}, type: ${typeArg ?? 'all'})`)
  }

  if (setsToImport.length === 0) {
    console.log('No sets to import.')
    return
  }

  // ── 2. Download bulk-data dump ────────────────────────────────────────────
  const setCodes = new Set(setsToImport.map((s) => s.code))
  console.log('\n→ Downloading Scryfall bulk-data dump (default_cards)…')
  console.log('  (this is a ~100 MB file — one-time download)')

  const bulkUrl = await fetchScryfallBulkDataUrl()
  const bulkRes = await fetch(bulkUrl, {
    headers: { 'User-Agent': 'Lumidex/1.0 (collector platform)' },
  })

  if (!bulkRes.ok) {
    console.error(`✗ Bulk data download failed: ${bulkRes.status} ${bulkRes.statusText}`)
    process.exit(1)
  }

  const allCards: ScryfallCard[] = await bulkRes.json()
  console.log(`  ✓ Downloaded ${allCards.length.toLocaleString()} total cards`)

  // Group physical, English cards by set code, filtered to our target sets
  const cardsBySet = new Map<string, ScryfallCard[]>()
  for (const card of allCards) {
    if (!setCodes.has(card.set)) continue
    if (card.digital) continue
    if (card.lang !== 'en') continue
    const existing = cardsBySet.get(card.set) ?? []
    existing.push(card)
    cardsBySet.set(card.set, existing)
  }

  console.log(`  ✓ Filtered to ${[...cardsBySet.values()].flat().length.toLocaleString()} cards across ${cardsBySet.size} sets`)

  // ── 3. Import each set ────────────────────────────────────────────────────
  let totalSetsCreated = 0
  let totalCardsCreated = 0
  let totalCardsSkipped = 0

  for (const scryfallSet of setsToImport) {
    const cards = cardsBySet.get(scryfallSet.code) ?? []
    const lumidexSetId = `mtg-${scryfallSet.code}`
    const series = deriveSetSeries(scryfallSet.set_type)

    process.stdout.write(
      `\n[${scryfallSet.code.toUpperCase()}] ${scryfallSet.name} (${cards.length} cards, ${series})… `,
    )

    // Upsert set
    const { error: setError } = await supabase
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
          api_set_id:  scryfallSet.code,
        },
        { onConflict: 'set_id' },
      )

    if (setError) {
      console.error(`\n  ✗ Set upsert failed: ${setError.message}`)
      continue
    }

    totalSetsCreated++

    // Check which card numbers already exist for this set.
    // cards has no UNIQUE(set_id, number) constraint, so we deduplicate
    // manually to avoid duplicate rows on re-runs.
    const { data: existingCards, error: existingErr } = await supabase
      .from('cards')
      .select('number')
      .eq('set_id', lumidexSetId)

    if (existingErr) {
      console.error(`\n  ✗ Failed to check existing cards: ${existingErr.message}`)
      continue
    }

    const existingNumbers = new Set((existingCards ?? []).map((c: { number: string }) => c.number))

    // Sort by collector_number and exclude already-imported cards
    const sorted = [...cards]
      .sort((a, b) =>
        a.collector_number.localeCompare(b.collector_number, undefined, { numeric: true }),
      )
      .filter((c) => !existingNumbers.has(c.collector_number))

    const setCardsSkipped = cards.length - sorted.length
    let setCardsCreated = 0
    const BATCH = 100

    for (let i = 0; i < sorted.length; i += BATCH) {
      const batch = sorted.slice(i, i + BATCH)
      const rows = batch.map((card) => ({
        set_id: lumidexSetId,
        name:   card.name,
        number: card.collector_number,
        rarity: normaliseRarity(card.rarity),
        artist: card.artist ?? null,
        type:   card.type_line ?? null,
        image:  getCardImageUrl(card),
        api_id: card.id,
      }))

      const { data: inserted, error: cardError } = await supabase
        .from('cards')
        .insert(rows)
        .select('id')

      if (cardError) {
        console.error(`\n  ✗ Card insert error (batch at ${i}): ${cardError.message}`)
      } else {
        setCardsCreated += inserted?.length ?? batch.length
      }
    }

    console.log(`✓ (${setCardsCreated} new${setCardsSkipped > 0 ? `, ${setCardsSkipped} already existed` : ''})`)
    totalCardsCreated += setCardsCreated
    totalCardsSkipped += setCardsSkipped
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50))
  console.log(`✓ Import complete`)
  console.log(`  Sets imported:   ${totalSetsCreated}`)
  console.log(`  Cards imported:  ${totalCardsCreated.toLocaleString()}`)
  console.log(`  Cards skipped:   ${totalCardsSkipped.toLocaleString()}`)
  console.log('')
  console.log('Next steps:')
  console.log('  • Run the MTG variant migration: database/migration_mtg_variants.sql')
  console.log('  • Visit /admin/mtg-import to import more sets via the UI')
  console.log('  • Use /admin/recompress to mirror card images to R2 (optional)')
}

main().catch((err) => {
  console.error('✗ Fatal error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
