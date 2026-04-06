#!/usr/bin/env ts-node
/**
 * Quick diagnostic: find the Perfect Order set and check api_id coverage on its cards.
 * Run with: npx ts-node scripts/checkPerfectOrder.ts
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey)

async function main() {
  // 1. Find sets with "Perfect Order" in the name
  const { data: sets, error: setErr } = await supabase
    .from('sets')
    .select('set_id, name, series, release_date, api_set_id, prices_last_synced_at')
    .ilike('name', '%perfect order%')

  if (setErr) { console.error('Set query error:', setErr); process.exit(1) }

  if (!sets || sets.length === 0) {
    console.log('❌ No sets found matching "Perfect Order"')
    process.exit(0)
  }

  console.log('\n📦 Matching sets:')
  for (const s of sets) {
    console.log(JSON.stringify(s, null, 2))
  }

  // 2. For each matching set, check api_id coverage on cards
  for (const s of sets) {
    console.log(`\n🃏 Cards in set "${s.name}" (${s.set_id}):`)

    const { data: cards, error: cardErr } = await supabase
      .from('cards')
      .select('id, name, number, api_id')
      .eq('set_id', s.set_id)
      .order('number', { ascending: true })
      .limit(5)

    if (cardErr) { console.error('Card query error:', cardErr); continue }

    const { count: totalCount } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('set_id', s.set_id)

    const { count: missingApiIdCount } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('set_id', s.set_id)
      .is('api_id', null)

    console.log(`  Total cards:           ${totalCount}`)
    console.log(`  Cards missing api_id:  ${missingApiIdCount}`)
    console.log(`  First 5 cards (sample):`)
    for (const c of (cards ?? [])) {
      console.log(`    #${c.number} ${c.name} — api_id: ${c.api_id ?? '(null)'}`)
    }

    // 3. Check card_prices coverage
    const { data: cardIds } = await supabase
      .from('cards')
      .select('id')
      .eq('set_id', s.set_id)

    const ids = (cardIds ?? []).map((c: { id: string }) => c.id)
    if (ids.length > 0) {
      const { count: pricedCount } = await supabase
        .from('card_prices')
        .select('card_id', { count: 'exact', head: true })
        .in('card_id', ids)

      console.log(`  Cards with price rows: ${pricedCount ?? 0} / ${ids.length}`)

      // 4. Check actual price values on the first 3 cards
      const firstIds = ids.slice(0, 3)
      const { data: priceRows } = await supabase
        .from('card_prices')
        .select('card_id, tcgp_normal, tcgp_reverse_holo, tcgp_market, cm_avg_sell, cm_trend, cm_low, cm_reverse_holo, fetched_at')
        .in('card_id', firstIds)

      console.log(`\n  Sample price rows (first 3 cards):`)
      for (const p of (priceRows ?? [])) {
        console.log(JSON.stringify(p, null, 4))
      }

      // 5. Try fetching one card directly from pokemontcg.io to see if it resolves
      const sampleCard = cards?.[0]
      if (sampleCard?.api_id) {
        console.log(`\n  Testing pokemontcg.io API for api_id "${sampleCard.api_id}"…`)
        const apiKey = process.env.POKEMON_TCG_API_KEY || process.env.POKEMONTCG_API_KEY || ''
        const res = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(sampleCard.api_id)}`, {
          headers: apiKey ? { 'X-Api-Key': apiKey } : {},
        })
        console.log(`  HTTP status: ${res.status}`)
        if (res.ok) {
          const json = await res.json() as { data?: { id?: string; tcgplayer?: unknown; cardmarket?: { prices?: Record<string, unknown> } } }
          console.log(`  Card ID from API: ${json?.data?.id}`)
          console.log(`  TCGPlayer data:   ${JSON.stringify(json?.data?.tcgplayer ?? null)}`)
          console.log(`  CardMarket prices: ${JSON.stringify(json?.data?.cardmarket?.prices ?? null)}`)
        } else {
          const body = await res.text()
          console.log(`  Error body: ${body}`)
        }
      }
    }
  }
}

main().catch(console.error)
