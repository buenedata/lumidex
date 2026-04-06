#!/usr/bin/env ts-node
/**
 * Fix api_id values for the Perfect Order set (me4).
 *
 * Problem: cards were imported with api_id = "POR-{number}" which returns 404
 * from the pokemontcg.io API. The correct API set ID is "me3", so card IDs
 * should be "me3-{number}" (e.g. "me3-1", "me3-10", "me3-100").
 *
 * This script:
 *  1. Fetches all cards for set me3 from pokemontcg.io to get canonical IDs
 *  2. Matches them to DB cards by card number
 *  3. Updates api_id in the DB
 *  4. Clears the all-null card_prices rows so the next sync starts fresh
 *
 * Run with: npx ts-node scripts/fixPerfectOrderApiIds.ts
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!
const apiKey = process.env.POKEMON_TCG_API_KEY || process.env.POKEMONTCG_API_KEY || ''

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey)

/** Strip leading zeros from a card number, e.g. "001" → "1", "1/88" → "1" */
function normalizeNumber(num: string): string {
  const raw = num.split('/')[0].replace(/^0+/, '')
  return raw || '0'
}

async function main() {
  console.log('🔍 Fetching all Perfect Order (me3) cards from pokemontcg.io…')

  // Fetch all me3 cards from the API (pageSize=250 covers the full set of 124)
  const url = `https://api.pokemontcg.io/v2/cards?q=set.id:me3&pageSize=250`
  const res = await fetch(url, {
    headers: apiKey ? { 'X-Api-Key': apiKey } : {},
  })

  if (!res.ok) {
    console.error(`❌ pokemontcg.io returned ${res.status}:`, await res.text())
    process.exit(1)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = await res.json() as { data: any[] }
  const apiCards: Array<{ id: string; number: string; name: string }> = json.data ?? []
  console.log(`✅ Got ${apiCards.length} cards from pokemontcg.io`)

  // Build map: normalizedNumber → pokemontcg.io card ID
  const numberToApiId = new Map<string, string>()
  for (const c of apiCards) {
    numberToApiId.set(normalizeNumber(String(c.number)), c.id)
  }

  // Fetch our DB cards for me4 (Lumidex internal set_id)
  console.log('\n📦 Loading DB cards for set me4…')
  const { data: dbCards, error } = await supabase
    .from('cards')
    .select('id, name, number, api_id')
    .eq('set_id', 'me4')

  if (error) { console.error('DB error:', error); process.exit(1) }
  console.log(`   ${dbCards?.length ?? 0} cards found in DB`)

  let updated = 0
  let skipped = 0
  let missing = 0

  for (const card of (dbCards ?? [])) {
    const normNum = normalizeNumber(String(card.number))
    const correctApiId = numberToApiId.get(normNum)

    if (!correctApiId) {
      console.warn(`  ⚠️  No pokemontcg.io match for card #${card.number} (${card.name}) — normNum="${normNum}"`)
      missing++
      continue
    }

    if (card.api_id === correctApiId) {
      skipped++
      continue
    }

    // Update the api_id
    const { error: updateErr } = await supabase
      .from('cards')
      .update({ api_id: correctApiId })
      .eq('id', card.id)

    if (updateErr) {
      console.error(`  ❌ Failed to update #${card.number} ${card.name}:`, updateErr.message)
    } else {
      console.log(`  ✅ #${card.number} ${card.name}: "${card.api_id}" → "${correctApiId}"`)
      updated++
    }
  }

  console.log(`\n📊 Summary: ${updated} updated, ${skipped} already correct, ${missing} unmatched`)

  // Clear the all-null card_prices rows so the next price sync starts fresh
  if (updated > 0) {
    console.log('\n🗑️  Clearing stale (all-null) card_prices rows for me4 so next sync starts fresh…')
    const { data: cardIds } = await supabase
      .from('cards')
      .select('id')
      .eq('set_id', 'me4')

    const ids = (cardIds ?? []).map((c: { id: string }) => c.id)
    if (ids.length > 0) {
      const { error: delErr } = await supabase
        .from('card_prices')
        .delete()
        .in('card_id', ids)

      if (delErr) {
        console.error('   ❌ Failed to clear card_prices:', delErr.message)
      } else {
        console.log(`   ✅ Cleared card_prices rows for ${ids.length} cards`)
        console.log('\n👉 Next step: go to Admin → Prices → select "Perfect Order" → Sync Prices')
      }
    }
  }
}

main().catch(console.error)
