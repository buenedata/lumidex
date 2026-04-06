#!/usr/bin/env ts-node
/**
 * Smoke-test: verify tcggoCardService fetches prices for Perfect Order episode 399,
 * then check card_prices before/after to confirm the pipeline writes correctly.
 *
 * Run with: npx ts-node scripts/testTcggoSync.ts
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!
const supabase = createClient(supabaseUrl, supabaseSecretKey)

const HOST = 'cardmarket-api-tcg.p.rapidapi.com'

async function fetchTcggoEpisodePrices(episodeId: string) {
  const apiKey = process.env.RAPIDAPI_KEY!
  const all: Array<{ normNum: string; avg7: number | null; avg30: number | null; low: number | null; tcgp: number | null }> = []
  const firstRes = await fetch(`https://${HOST}/pokemon/episodes/${episodeId}/cards?page=1&per_page=20`, {
    headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': HOST },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstJson = await firstRes.json() as { data: any[]; paging: { total: number } }
  const totalPages = firstJson.paging?.total ?? 1

  const parseCards = (data: any[]) => {   // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const c of data ?? []) {
      const cm = c.prices?.cardmarket ?? {}
      const tcp = c.prices?.tcg_player ?? {}
      all.push({
        normNum: String(c.card_number),
        avg7:  cm['7d_average']  != null ? Number(cm['7d_average'])  : null,
        avg30: cm['30d_average'] != null ? Number(cm['30d_average']) : null,
        low:   cm.lowest_near_mint != null ? Number(cm.lowest_near_mint) : null,
        tcgp:  tcp.market_price    != null ? Number(tcp.market_price)    : null,
      })
    }
  }
  parseCards(firstJson.data)

  for (let page = 2; page <= totalPages; page++) {
    const res = await fetch(`https://${HOST}/pokemon/episodes/${episodeId}/cards?page=${page}&per_page=20`, {
      headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': HOST },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as { data: any[] }
    parseCards(json.data)
  }

  return new Map(all.map(e => [e.normNum, e]))
}

async function main() {
  // 1. Test the tcggo service directly
  console.log('🔄 Fetching prices from tcggo for episode 399 (Perfect Order)…\n')
  const priceMap = await fetchTcggoEpisodePrices('399')

  console.log(`✅ Got ${priceMap.size} cards in price map`)

  // Sample first 5 entries
  let count = 0
  for (const [normNum, entry] of priceMap) {
    if (count++ >= 5) break
    console.log(`  Card #${normNum}: CM avg7=${entry.avg7} avg30=${entry.avg30} low=${entry.low} | TCGP market=${entry.tcgp}`)
  }

  // 2. Check current card_prices for me4 (before sync)
  console.log('\n📋 Current card_prices for first 5 me4 cards:')
  const { data: cards } = await supabase
    .from('cards')
    .select('id, name, number')
    .eq('set_id', 'me4')
    .order('number', { ascending: true })
    .limit(5)

  const ids = (cards ?? []).map((c: { id: string }) => c.id)
  const { data: prices } = await supabase
    .from('card_prices')
    .select('card_id, cm_avg_sell, cm_avg_30d, cm_low, cm_trend, tcgp_market, fetched_at')
    .in('card_id', ids)

  const priceDb = new Map((prices ?? []).map((p: { card_id: string }) => [p.card_id, p]))

  for (const card of (cards ?? [])) {
    const p = priceDb.get(card.id) as Record<string, unknown> | undefined
    const normNum = String(parseInt(String(card.number).split('/')[0], 10))
    const tcggo  = priceMap.get(normNum)
    console.log(`  #${card.number} ${card.name}:`)
    console.log(`    DB now   → cm_avg_sell=${p?.cm_avg_sell ?? '-'} tcgp_market=${p?.tcgp_market ?? '-'}`)
    console.log(`    tcggo    → cm avg7=${tcggo?.avg7 ?? '-'} tcgp market=${tcggo?.tcgp ?? '-'}`)
  }

  console.log('\n👉 The card_prices are currently all null (cleared by the fix script).')
  console.log('   Go to Admin → Prices → select "Perfect Order" → click Sync Prices')
  console.log('   After sync, re-run this script to verify cm_avg_sell is populated.')
}

main().catch(console.error)
