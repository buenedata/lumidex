#!/usr/bin/env ts-node
/**
 * Fetch all episodes from cardmarket-api-tcg RapidAPI, match them to DB sets
 * by name (case-insensitive) or release date, and update sets.api_set_id.
 *
 * Run with: npx ts-node scripts/matchEpisodeIds.ts
 * Use --dry-run to preview without writing.
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!
const rapidApiKey = process.env.RAPIDAPI_KEY!
const HOST = 'cardmarket-api-tcg.p.rapidapi.com'

const DRY_RUN = process.argv.includes('--dry-run')

if (!supabaseUrl || !supabaseSecretKey) { console.error('❌ Missing Supabase env vars'); process.exit(1) }
if (!rapidApiKey) { console.error('❌ Missing RAPIDAPI_KEY'); process.exit(1) }

const supabase = createClient(supabaseUrl, supabaseSecretKey)

interface Episode {
  id: number
  name: string
  code: string | null
  released_at: string | null
  series?: { name: string } | null
}

async function fetchAllEpisodes(): Promise<Episode[]> {
  const all: Episode[] = []
  // Get total page count from first request
  const firstRes = await fetch(`https://${HOST}/pokemon/episodes?page=1&per_page=20`, {
    headers: { 'x-rapidapi-key': rapidApiKey, 'x-rapidapi-host': HOST },
  })
  const firstJson = await firstRes.json() as { data: Episode[]; paging: { total: number; per_page: number } }
  all.push(...(firstJson.data ?? []))
  const totalPages = firstJson.paging?.total ?? 1
  console.log(`📦 Fetching ${totalPages} pages of episodes…`)

  for (let page = 2; page <= totalPages; page++) {
    const res = await fetch(`https://${HOST}/pokemon/episodes?page=${page}&per_page=20`, {
      headers: { 'x-rapidapi-key': rapidApiKey, 'x-rapidapi-host': HOST },
    })
    const json = await res.json() as { data: Episode[] }
    all.push(...(json.data ?? []))
  }
  return all
}

/** Normalise a set name for fuzzy matching: lowercase, strip punctuation/spaces */
function normName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no DB writes\n' : '🚀 LIVE RUN — will update DB\n')

  const episodes = await fetchAllEpisodes()
  console.log(`✅ Fetched ${episodes.length} episodes from RapidAPI\n`)

  // Load all DB sets
  const { data: dbSets, error } = await supabase
    .from('sets')
    .select('set_id, name, release_date, api_set_id, series')
    .order('release_date', { ascending: false })

  if (error) { console.error('DB error:', error); process.exit(1) }
  console.log(`📋 ${dbSets?.length ?? 0} sets in DB\n`)

  // Build lookup: normalised name → episode
  const episodeByNormName = new Map<string, Episode>()
  // Also: release_date (YYYY-MM-DD) + normName → episode (for disambiguation)
  const episodeByDateAndName = new Map<string, Episode>()

  for (const ep of episodes) {
    episodeByNormName.set(normName(ep.name), ep)
    if (ep.released_at) {
      const date = ep.released_at.split('T')[0]
      episodeByDateAndName.set(`${date}::${normName(ep.name)}`, ep)
    }
  }

  let updated = 0
  let alreadySet = 0
  let unmatched = 0

  for (const set of (dbSets ?? [])) {
    const nName = normName(set.name)
    const date = set.release_date?.split('T')[0] ?? ''

    // Try date+name first (most specific), then name only
    const match =
      episodeByDateAndName.get(`${date}::${nName}`) ??
      episodeByNormName.get(nName) ??
      null

    if (!match) {
      console.log(`  ⚠️  No match: "${set.name}" (${set.set_id}) release=${date}`)
      unmatched++
      continue
    }

    const newId = String(match.id)

    if (set.api_set_id === newId) {
      console.log(`  ✓  Already set: "${set.name}" → episode ${newId}`)
      alreadySet++
      continue
    }

    const from = set.api_set_id ? `"${set.api_set_id}"` : 'null'
    console.log(`  → "${set.name}" (${set.set_id}): api_set_id ${from} → "${newId}"`)

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('sets')
        .update({ api_set_id: newId })
        .eq('set_id', set.set_id)

      if (upErr) {
        console.error(`     ❌ Update failed:`, upErr.message)
      } else {
        updated++
      }
    } else {
      updated++ // count as "would update" in dry-run
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   ${updated} sets ${DRY_RUN ? 'would be' : ''} updated`)
  console.log(`   ${alreadySet} already correct`)
  console.log(`   ${unmatched} unmatched (no episode found)`)
  console.log(`\n💡 Tip: sets with no episode in the RapidAPI (old sets) will stay unmatched — that's expected.`)
  if (DRY_RUN) console.log('\n🔁 Run without --dry-run to apply changes.')
}

main().catch(console.error)
