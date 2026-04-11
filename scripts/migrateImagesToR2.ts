// scripts/migrateImagesToR2.ts
// Migrates all Supabase Storage image URLs to Cloudflare R2,
// then updates the database records to point to R2 URLs.
//
// Run:      npx tsx scripts/migrateImagesToR2.ts
// Dry run:  DRY_RUN=true npx tsx scripts/migrateImagesToR2.ts

import dotenv from 'dotenv'
// Load .env.local first (Next.js convention), then fall back to .env
dotenv.config({ path: '.env.local' })
dotenv.config()

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { uploadToR2, getR2Url } from '../lib/r2'

// ── Configuration ────────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === 'true'
const BATCH_SIZE = 50

const supabaseUrl       = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey    = process.env.SUPABASE_SECRET_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SECRET_KEY')
  process.exit(1)
}

/** Service-role client — bypasses RLS so we can update any row. */
const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the R2 object key from a Supabase Storage URL.
 * Query strings (e.g. ?v=timestamp) are stripped so the R2 key is clean.
 *
 * Input:  https://xxxx.supabase.co/storage/v1/object/public/set-images/sv9pt5-logo.webp?v=123
 * Output: set-images/sv9pt5-logo.webp
 */
function supabaseUrlToR2Key(url: string): string {
  // Strip query string first so ?v=timestamp never ends up in the R2 key
  const cleanUrl = url.split('?')[0]
  const match = cleanUrl.match(/\/object\/public\/(.+)$/)
  if (!match) {
    throw new Error(`Cannot extract R2 key — URL does not contain "/object/public/": ${url}`)
  }
  return match[1]
}

/**
 * Determine if a URL is a Supabase Storage URL that needs migration.
 * Returns false for OAuth avatar URLs (Google, Discord, etc.) and
 * for URLs already served from R2.
 */
function needsMigration(url: string | null | undefined): boolean {
  if (!url) return false
  if (url.includes('r2.dev') || url.includes('r2.cloudflarestorage.com')) return false
  return url.includes('supabase.co')
}

/**
 * Download a file from a Supabase CDN URL, upload it to R2, and
 * return the new public R2 URL.
 *
 * The R2 key and the fetch URL both have query strings stripped — Supabase CDN
 * returns 400 when ?v=timestamp (or any unexpected query param) is present.
 */
async function migrateUrl(supabaseUrl: string): Promise<string> {
  // Clean key: strip ?v=timestamp so R2 stores a canonical path
  const key = supabaseUrlToR2Key(supabaseUrl)

  // Clean fetch URL: Supabase CDN returns 400 for URLs with arbitrary query params
  const fetchUrl = supabaseUrl.split('?')[0]

  const response = await fetch(fetchUrl)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${fetchUrl}`)
  }

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
  const arrayBuffer = await response.arrayBuffer()
  const buffer      = Buffer.from(arrayBuffer)

  await uploadToR2(key, buffer, contentType)
  return getR2Url(key)
}

// ── Generic table migrator ────────────────────────────────────────────────────

interface MigrateTableOptions {
  /** Human-readable label used in log output, e.g. "SETS › logo_url" */
  label: string
  table: string
  column: string
  /** Primary key column name (default: "id") */
  idColumn?: string
  /** If true, process rows in batches of BATCH_SIZE */
  batched?: boolean
  /**
   * Optional extra filter function applied after the "contains supabase.co"
   * server filter.  Useful for skipping OAuth URLs on users.avatar_url.
   */
  extraFilter?: (value: string) => boolean
}

async function migrateTable({
  label,
  table,
  column,
  idColumn = 'id',
  batched  = false,
  extraFilter,
}: MigrateTableOptions): Promise<void> {
  console.log(`\n[${label}] Querying rows with Supabase Storage URLs…`)

  // Fetch all rows where the column still points at Supabase Storage.
  // We use ilike for a broad match; needsMigration() provides the precise check.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawData, error } = await supabase
    .from(table)
    .select(`${idColumn}, ${column}`)
    .ilike(column, '%supabase.co%')

  if (error) {
    console.error(`[${label}] ❌ Query failed:`, error.message)
    return
  }

  // Cast via unknown — dynamic column selects defeat Supabase's strict type inference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = rawData as unknown as Record<string, unknown>[] | null

  if (!data || data.length === 0) {
    console.log(`[${label}] ✅ Nothing to migrate.`)
    return
  }

  // Apply extra client-side filter (e.g. skip OAuth URLs)
  const rows = data.filter((row) => {
    const val = row[column] as string | null
    if (!needsMigration(val)) return false
    if (extraFilter && val && !extraFilter(val)) return false
    return true
  })

  if (rows.length === 0) {
    console.log(`[${label}] ✅ All matching rows are already migrated or excluded.`)
    return
  }

  console.log(`[${label}] Migrating ${rows.length} row(s)${DRY_RUN ? ' [DRY RUN]' : ''}…`)

  if (batched) {
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE)
    for (let b = 0; b < totalBatches; b++) {
      const batch = rows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE)
      console.log(`[${label}] Batch ${b + 1}/${totalBatches} (${batch.length} rows)`)
      await processBatch(batch, { label, table, column, idColumn })
    }
  } else {
    await processBatch(rows, { label, table, column, idColumn })
  }
}

interface BatchMeta {
  label: string
  table: string
  column: string
  idColumn: string
}

async function processBatch(
  rows: Record<string, unknown>[],
  { label, table, column, idColumn }: BatchMeta,
): Promise<void> {
  for (const row of rows) {
    const id  = row[idColumn] as string
    const url = row[column]  as string

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would migrate: ${url}`)
      continue
    }

    try {
      const r2Url = await migrateUrl(url)

      const { error: updateError } = await supabase
        .from(table)
        .update({ [column]: r2Url })
        .eq(idColumn, id)

      if (updateError) {
        console.error(`  ❌ DB update failed for ${idColumn}=${id}: ${updateError.message}`)
      } else {
        console.log(`  ✔ ${id} → ${r2Url}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ❌ Migration failed for ${url}: ${msg}`)
      // Continue with remaining rows
    }
  }
}

// ── SQL cleanup for malformed R2 URLs ────────────────────────────────────────

/**
 * Strip any `?v=…` query strings from R2 URLs that were previously stored
 * with a malformed key (the bug in supabaseUrlToR2Key that has since been fixed).
 *
 * Also logs a count breakdown of Supabase vs R2 vs other image URLs in `cards`.
 */
async function cleanupMalformedR2Urls(): Promise<void> {
  console.log('\n[CLEANUP] Checking for malformed R2 URLs in cards.image…')

  if (DRY_RUN) {
    console.log('[CLEANUP] DRY RUN — would run:')
    console.log("  UPDATE cards SET image = split_part(image, '?', 1) WHERE image LIKE '%r2.dev%?%'")
  } else {
    // supabase-js v2 doesn't support UPDATE … SET col=expression, so we
    // fetch malformed rows client-side, strip the query string, then update each.
    const { data: malformed, error: fetchErr } = await supabase
      .from('cards')
      .select('id, image')
      .ilike('image', '%r2.dev%?%')

    if (fetchErr) {
      console.error('[CLEANUP] ❌ Failed to query malformed R2 URLs:', fetchErr.message)
    } else if (!malformed || malformed.length === 0) {
      console.log('[CLEANUP] ✅ No malformed R2 URLs found.')
    } else {
      console.log(`[CLEANUP] Found ${malformed.length} malformed R2 URL(s) — stripping query strings…`)
      for (const row of malformed) {
        const cleanImage = (row.image as string).split('?')[0]
        const { error: updateErr } = await supabase
          .from('cards')
          .update({ image: cleanImage })
          .eq('id', row.id)
        if (updateErr) {
          console.error(`  ❌ Failed to update card id=${row.id}: ${updateErr.message}`)
        } else {
          console.log(`  ✔ card id=${row.id} cleaned → ${cleanImage}`)
        }
      }
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  console.log('\n[CLEANUP] Card image URL distribution:')

  const { count: supabaseCount } = await supabase
    .from('cards').select('*', { count: 'exact', head: true }).ilike('image', '%supabase.co%')
  const { count: r2Count } = await supabase
    .from('cards').select('*', { count: 'exact', head: true }).ilike('image', '%r2.dev%')

  console.log(`  Supabase URLs : ${supabaseCount ?? '?'}`)
  console.log(`  R2 URLs       : ${r2Count ?? '?'}`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════')
  console.log(' Lumidex – Phase 3: Migrate Images to Cloudflare R2')
  console.log(`  Mode:     ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '🚀 LIVE'}`)
  console.log(`  Batch:    ${BATCH_SIZE} rows`)
  console.log('═══════════════════════════════════════════════════════')

  // ── 0. Strip any malformed ?v= query strings from previously migrated R2 URLs
  await cleanupMalformedR2Urls()

  // ── 1. sets.logo_url ──────────────────────────────────────────────────────
  await migrateTable({
    label:  'SETS › logo_url',
    table:  'sets',
    column: 'logo_url',
    idColumn: 'set_id',
  })

  // ── 2. sets.symbol_url ────────────────────────────────────────────────────
  await migrateTable({
    label:  'SETS › symbol_url',
    table:  'sets',
    column: 'symbol_url',
    idColumn: 'set_id',
  })

  // ── 3. cards.image — may be thousands of rows; process in batches ─────────
  await migrateTable({
    label:   'CARDS › image',
    table:   'cards',
    column:  'image',
    idColumn: 'id',
    batched: true,
  })

  // ── 4. set_products.image_url ─────────────────────────────────────────────
  await migrateTable({
    label:  'SET PRODUCTS › image_url',
    table:  'set_products',
    column: 'image_url',
    idColumn: 'id',
  })

  // ── 5. card_variant_images.image_url ──────────────────────────────────────
  await migrateTable({
    label:  'CARD VARIANT IMAGES › image_url',
    table:  'card_variant_images',
    column: 'image_url',
    idColumn: 'id',
  })

  // ── 6. users.avatar_url — skip Google / Discord OAuth URLs ────────────────
  //    OAuth URLs from Google contain "googleusercontent.com",
  //    Discord URLs contain "cdn.discordapp.com".
  //    needsMigration() already skips non-supabase.co URLs so the extra
  //    filter here is a safety net for any edge cases.
  await migrateTable({
    label:  'USERS › avatar_url',
    table:  'users',
    column: 'avatar_url',
    idColumn: 'id',
    extraFilter: (url) =>
      !url.includes('googleusercontent.com') &&
      !url.includes('discordapp.com') &&
      !url.includes('discord.com'),
  })

  // ── 7. users.banner_url ───────────────────────────────────────────────────
  await migrateTable({
    label:  'USERS › banner_url',
    table:  'users',
    column: 'banner_url',
    idColumn: 'id',
  })

  console.log('\n═══════════════════════════════════════════════════════')
  console.log(DRY_RUN ? ' Dry run complete — no changes were made.' : ' Migration complete.')
  console.log('═══════════════════════════════════════════════════════\n')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
