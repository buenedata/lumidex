#!/usr/bin/env ts-node
/**
 * Search CardMarket episode names for a keyword.
 * Run with: npx ts-node scripts/searchEpisodes.ts <keyword>
 * Example:  npx ts-node scripts/searchEpisodes.ts ninja
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const rapidApiKey = process.env.RAPIDAPI_KEY!
const HOST = 'cardmarket-api-tcg.p.rapidapi.com'
const keyword = (process.argv[2] ?? '').toLowerCase()

if (!keyword) {
  console.error('Usage: npx ts-node scripts/searchEpisodes.ts <keyword>')
  process.exit(1)
}

interface Episode {
  id: number
  name: string
  code: string | null
  released_at: string | null
  series?: { name: string } | null
}

async function main() {
  const all: Episode[] = []
  const firstRes = await fetch(`https://${HOST}/pokemon/episodes?page=1&per_page=20`, {
    headers: {
      'x-rapidapi-key': rapidApiKey,
      'x-rapidapi-host': HOST,
    } as Record<string, string>,
  })
  const firstJson = await firstRes.json() as { data: Episode[]; paging: { total: number } }
  all.push(...(firstJson.data ?? []))
  const totalPages = firstJson.paging?.total ?? 1

  for (let page = 2; page <= totalPages; page++) {
    const res = await fetch(`https://${HOST}/pokemon/episodes?page=${page}&per_page=20`, {
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': HOST,
      } as Record<string, string>,
    })
    const json = await res.json() as { data: Episode[] }
    all.push(...(json.data ?? []))
  }

  console.log(`Fetched ${all.length} total episodes. Searching for "${keyword}"...\n`)

  const hits = all.filter(e => e.name.toLowerCase().includes(keyword))

  if (hits.length === 0) {
    console.log('No matches found.')
    // Print the 20 most recent episodes as context
    console.log('\nMost recent 20 episodes:')
    all
      .sort((a, b) => (b.released_at ?? '').localeCompare(a.released_at ?? ''))
      .slice(0, 20)
      .forEach(e => console.log(`  [${e.id}] "${e.name}"  released=${e.released_at ?? 'null'}  series=${e.series?.name ?? 'null'}`))
  } else {
    hits.forEach(e =>
      console.log(`  [${e.id}] "${e.name}"  released=${e.released_at ?? 'null'}  series=${e.series?.name ?? 'null'}`)
    )
  }
}

main().catch(err => { console.error(err); process.exit(1) })
