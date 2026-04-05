/**
 * services/pricing/setTierService.ts
 *
 * Determines which sets are due for a price update and in what priority order.
 *
 * Tier logic (automatic — updates as new series are released):
 *   - RECENT  = the two series with the latest release dates (current + previous series)
 *              → update interval: 24 hours
 *   - OLDER   = all other series
 *              → update interval: 48 hours
 *
 * Priority queue order:
 *   1. Recent sets — never synced (prices_last_synced_at IS NULL)
 *   2. Recent sets — most overdue first (oldest prices_last_synced_at)
 *   3. Older sets  — never synced
 *   4. Older sets  — most overdue first
 */

// Use supabaseAdmin (service role) for all reads so that RLS never blocks
// reading prices_last_synced_at or writing it back.
import { supabaseAdmin } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

/** How many series are considered "recent" (current + 1 previous). */
const RECENT_SERIES_COUNT = 2

/** Update intervals in milliseconds. */
const RECENT_INTERVAL_MS = 24 * 60 * 60 * 1000  // 24 hours
const OLDER_INTERVAL_MS  = 48 * 60 * 60 * 1000  // 48 hours

// ── Types ─────────────────────────────────────────────────────────────────────

export type SetTier = 'recent' | 'older'

export interface SetForPricing {
  set_id:                string
  series:                string
  tier:                  SetTier
  prices_last_synced_at: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when a set is due for a price update given its tier and
 * the timestamp of its last sync.
 */
function isDue(tier: SetTier, lastSynced: string | null): boolean {
  if (lastSynced === null) return true  // never synced → always due

  const elapsed = Date.now() - new Date(lastSynced).getTime()
  const threshold = tier === 'recent' ? RECENT_INTERVAL_MS : OLDER_INTERVAL_MS
  return elapsed >= threshold
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns an ordered list of sets that are currently due for a price update.
 *
 * The list is sorted so that the most urgent sets appear first:
 *   recent (null) → recent (oldest sync) → older (null) → older (oldest sync)
 *
 * Callers should process sets in order and stop when their time budget is
 * exhausted — remaining sets will be picked up in the next cron run.
 */
export async function getSetsForPricing(): Promise<SetForPricing[]> {
  const { data, error } = await supabaseAdmin
    .from('sets')
    .select('set_id, series, release_date, prices_last_synced_at')
    .order('release_date', { ascending: false })

  if (error) {
    console.error('[setTierService] getSetsForPricing: DB error:', error.message)
    return []
  }

  const rows = data ?? []
  if (rows.length === 0) return []

  // ── Step 1: Identify the two most-recent series ────────────────────────────

  // Collect series with their latest release date (series can span many sets)
  const seriesLatest = new Map<string, string>()
  for (const row of rows) {
    const series      = (row.series as string | null) ?? 'Unknown'
    const releaseDate = (row.release_date as string | null) ?? ''
    const current     = seriesLatest.get(series) ?? ''
    if (releaseDate > current) seriesLatest.set(series, releaseDate)
  }

  // Sort series by their latest release date (newest first)
  const sortedSeries = [...seriesLatest.entries()]
    .sort(([, a], [, b]) => b.localeCompare(a))
    .map(([series]) => series)

  const recentSeriesSet = new Set(sortedSeries.slice(0, RECENT_SERIES_COUNT))

  // ── Step 2: Assign tier and filter to due sets ─────────────────────────────

  const dueSets: SetForPricing[] = []

  for (const row of rows) {
    const series      = (row.series as string | null) ?? 'Unknown'
    const tier: SetTier = recentSeriesSet.has(series) ? 'recent' : 'older'
    const lastSynced  = (row.prices_last_synced_at as string | null) ?? null

    if (isDue(tier, lastSynced)) {
      dueSets.push({
        set_id:                row.set_id as string,
        series,
        tier,
        prices_last_synced_at: lastSynced,
      })
    }
  }

  // ── Step 3: Sort by priority ───────────────────────────────────────────────

  dueSets.sort((a, b) => {
    // Recent always before older
    if (a.tier !== b.tier) {
      return a.tier === 'recent' ? -1 : 1
    }

    // Within the same tier: null (never synced) first, then oldest sync first
    const aNull = a.prices_last_synced_at === null
    const bNull = b.prices_last_synced_at === null
    if (aNull !== bNull) return aNull ? -1 : 1

    if (a.prices_last_synced_at && b.prices_last_synced_at) {
      return a.prices_last_synced_at.localeCompare(b.prices_last_synced_at)
    }

    return 0
  })

  console.log(
    `[setTierService] getSetsForPricing: ` +
    `${dueSets.filter(s => s.tier === 'recent').length} recent + ` +
    `${dueSets.filter(s => s.tier === 'older').length} older sets due. ` +
    `Recent series: [${[...recentSeriesSet].join(', ')}]`
  )

  return dueSets
}

/**
 * Returns ALL sets ordered by tier priority (recent first, older second),
 * ignoring prices_last_synced_at entirely.
 *
 * Used by the admin bulk-seed endpoint to populate pricing data for ALL sets
 * in one pass, regardless of whether they were recently synced.
 */
export async function getAllSetsForBulkSeed(): Promise<SetForPricing[]> {
  const { data, error } = await supabaseAdmin
    .from('sets')
    .select('set_id, series, release_date, prices_last_synced_at')
    .order('release_date', { ascending: false })

  if (error) {
    console.error('[setTierService] getAllSetsForBulkSeed: DB error:', error.message)
    return []
  }

  const rows = data ?? []
  if (rows.length === 0) return []

  // Identify the two most-recent series (same logic as getSetsForPricing)
  const seriesLatest = new Map<string, string>()
  for (const row of rows) {
    const series      = (row.series as string | null) ?? 'Unknown'
    const releaseDate = (row.release_date as string | null) ?? ''
    const current     = seriesLatest.get(series) ?? ''
    if (releaseDate > current) seriesLatest.set(series, releaseDate)
  }

  const sortedSeries = [...seriesLatest.entries()]
    .sort(([, a], [, b]) => b.localeCompare(a))
    .map(([series]) => series)

  const recentSeriesSet = new Set(sortedSeries.slice(0, RECENT_SERIES_COUNT))

  const allSets: SetForPricing[] = rows.map(row => {
    const series = (row.series as string | null) ?? 'Unknown'
    return {
      set_id:                row.set_id as string,
      series,
      tier:                  recentSeriesSet.has(series) ? 'recent' : 'older',
      prices_last_synced_at: (row.prices_last_synced_at as string | null) ?? null,
    }
  })

  // Sort: recent first, within tier sort by last_synced (null = oldest = first)
  allSets.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === 'recent' ? -1 : 1
    const aNull = a.prices_last_synced_at === null
    const bNull = b.prices_last_synced_at === null
    if (aNull !== bNull) return aNull ? -1 : 1
    if (a.prices_last_synced_at && b.prices_last_synced_at) {
      return a.prices_last_synced_at.localeCompare(b.prices_last_synced_at)
    }
    return 0
  })

  console.log(
    `[setTierService] getAllSetsForBulkSeed: ${allSets.length} total sets ` +
    `(${allSets.filter(s => s.tier === 'recent').length} recent, ` +
    `${allSets.filter(s => s.tier === 'older').length} older)`
  )

  return allSets
}

/**
 * Convenience export: just the two series names currently classified as "recent".
 * Useful for display in admin UI or logging.
 */
export async function getRecentSeriesNames(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('sets')
    .select('series, release_date')

  if (error || !data) return []

  const seriesLatest = new Map<string, string>()
  for (const row of data) {
    const series = (row.series as string | null) ?? 'Unknown'
    const date   = (row.release_date as string | null) ?? ''
    if (date > (seriesLatest.get(series) ?? '')) seriesLatest.set(series, date)
  }

  return [...seriesLatest.entries()]
    .sort(([, a], [, b]) => b.localeCompare(a))
    .slice(0, RECENT_SERIES_COUNT)
    .map(([series]) => series)
}
