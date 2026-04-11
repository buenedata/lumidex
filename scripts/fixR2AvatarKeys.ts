// scripts/fixR2AvatarKeys.ts
// ─────────────────────────────────────────────────────────────────────────────
// Part 1 — Fix malformed R2 object keys that have `?t=timestamp` baked in.
//           R2 / S3 treats `?` as query-string, making those keys unreachable.
//           Lists avatars/ and banners/ prefixes, copies each malformed key to
//           its clean equivalent, then deletes the old key.
//
// Part 2 — Prints SQL to strip the same suffix from users.avatar_url /
//           users.banner_url and audits other tables.
//
// Part 3 — Finds users whose avatar_url / banner_url still point to an
//           external CDN (Discord, Google …), downloads the image, uploads it
//           to R2, and updates the DB row.
//
// Run (dry run):  DRY_RUN=true npx tsx scripts/fixR2AvatarKeys.ts
// Run (live):     npx tsx scripts/fixR2AvatarKeys.ts

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import path from 'path'
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Configuration ─────────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === 'true'
const BUCKET  = process.env.CLOUDFLARE_R2_BUCKET_NAME!

if (!process.env.CLOUDFLARE_R2_ACCOUNT_ID || !process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || !BUCKET) {
  console.error('❌ Missing one or more required env vars:')
  console.error('   CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID,')
  console.error('   CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME')
  process.exit(1)
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SECRET_KEY')
  process.exit(1)
}

const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '').replace(/\/$/, '')

/** Service-role Supabase client — bypasses RLS. */
const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
)

// ── Lazy R2 client (mirrors lib/r2.ts) ───────────────────────────────────────

let _r2: S3Client | null = null

function getR2Client(): S3Client {
  if (!_r2) {
    _r2 = new S3Client({
      region:   'auto',
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    })
  }
  return _r2
}

// ── R2 helpers ────────────────────────────────────────────────────────────────

/** List ALL objects under a given prefix, handling ContinuationToken pagination. */
async function listAllObjects(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const res: ListObjectsV2CommandOutput = await getR2Client().send(
      new ListObjectsV2Command({
        Bucket:            BUCKET,
        Prefix:            prefix,
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  return keys
}

/**
 * Copy an R2 object to a new key then delete the original.
 * CopySource must be `bucket/url-encoded-key` per AWS SDK S3 spec.
 */
async function renameObject(malformedKey: string, cleanKey: string): Promise<void> {
  const copySource = `${BUCKET}/${encodeURIComponent(malformedKey)}`
  await getR2Client().send(new CopyObjectCommand({ Bucket: BUCKET, CopySource: copySource, Key: cleanKey }))
  await getR2Client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: malformedKey }))
}

/** Upload a Buffer to R2. */
async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  await getR2Client().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

/** Returns true if the URL is served from one of our own origins (R2 or Supabase Storage). */
function isOwnUrl(url: string): boolean {
  return url.includes('r2.dev') ||
         url.includes('r2.cloudflarestorage.com') ||
         url.includes('.supabase.co/storage')
}

/** Map Content-Type → file extension. */
function extFromContentType(ct: string): string {
  if (ct.includes('webp'))  return 'webp'
  if (ct.includes('png'))   return 'png'
  if (ct.includes('gif'))   return 'gif'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  // Fall back to whatever is in the original URL path
  return 'jpg'
}

// ── Part 1 — Fix malformed R2 keys ───────────────────────────────────────────

async function fixMalformedKeys(): Promise<number> {
  console.log('\n═══ Part 1 — Fix malformed R2 object keys ═══')
  let fixed = 0

  for (const prefix of ['avatars/', 'banners/']) {
    console.log(`\n── Listing objects under "${prefix}" …`)
    const keys      = await listAllObjects(prefix)
    const malformed = keys.filter(k => k.includes('?'))
    console.log(`   Total: ${keys.length}  |  Malformed (contain "?"): ${malformed.length}`)

    for (const key of malformed) {
      const cleanKey = key.split('?')[0]
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would rename:\n    FROM: ${key}\n    TO:   ${cleanKey}`)
      } else {
        await renameObject(key, cleanKey)
        console.log(`  ✅ Renamed:\n    FROM: ${key}\n    TO:   ${cleanKey}`)
      }
      fixed++
    }
  }

  console.log(`\n   ${DRY_RUN ? 'Would rename' : 'Renamed'}: ${fixed} object(s)`)
  return fixed
}

// ── Part 2 — SQL statements ───────────────────────────────────────────────────

function printSql(): void {
  console.log(`
═══ Part 2 — SQL to clean malformed URLs from the database ═══
Run the following in the Supabase SQL editor:

-- Strip ?t=... suffix from users.avatar_url
UPDATE users
SET avatar_url = split_part(avatar_url, '?', 1)
WHERE avatar_url LIKE '%r2.dev%?%';

-- Strip ?t=... suffix from users.banner_url
UPDATE users
SET banner_url = split_part(banner_url, '?', 1)
WHERE banner_url LIKE '%r2.dev%?%';

-- Audit other tables for the same pattern:
SELECT 'card_variant_images' AS tbl, COUNT(*) AS affected
FROM card_variant_images WHERE image_url LIKE '%r2.dev%?%'
UNION ALL
SELECT 'sets (logo_url)',   COUNT(*) FROM sets WHERE logo_url   LIKE '%r2.dev%?%'
UNION ALL
SELECT 'sets (symbol_url)', COUNT(*) FROM sets WHERE symbol_url LIKE '%r2.dev%?%'
UNION ALL
SELECT 'set_products',      COUNT(*) FROM set_products WHERE image_url LIKE '%r2.dev%?%';
`)
}

// ── Part 3 — Migrate external avatar / banner URLs to R2 ─────────────────────

interface UserRow {
  id:         string
  avatar_url: string | null
  banner_url: string | null
}

async function migrateExternalProfileImages(): Promise<number> {
  console.log('═══ Part 3 — Migrate external avatar/banner URLs to R2 ═══')

  // Fetch every user that has at least one URL not already on R2 / Supabase Storage
  const { data: users, error } = await supabase
    .from('users')
    .select('id, avatar_url, banner_url')

  if (error) {
    console.error('❌ Failed to query users table:', error.message)
    return 0
  }

  const candidates = (users as UserRow[]).filter(u =>
    (u.avatar_url && !isOwnUrl(u.avatar_url)) ||
    (u.banner_url && !isOwnUrl(u.banner_url))
  )

  console.log(`\n   Found ${candidates.length} user(s) with external avatar/banner URL(s)`)
  let migrated = 0

  for (const user of candidates) {
    for (const field of ['avatar_url', 'banner_url'] as const) {
      const externalUrl = user[field]
      if (!externalUrl || isOwnUrl(externalUrl)) continue

      // Derive R2 key prefix based on field
      const prefix = field === 'avatar_url' ? 'avatars' : 'banners'
      const suffix = field === 'banner_url' ? '-banner' : ''

      console.log(`\n  User ${user.id} — ${field}: ${externalUrl}`)

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would download & upload to R2 under ${prefix}/${user.id}/…`)
        migrated++
        continue
      }

      try {
        // Download the image
        const response = await fetch(externalUrl)
        if (!response.ok) {
          console.error(`  ❌ HTTP ${response.status} fetching ${externalUrl}`)
          continue
        }

        const contentType = response.headers.get('content-type') ?? 'image/jpeg'
        const ext         = extFromContentType(contentType)
        const r2Key       = `${prefix}/${user.id}/${user.id}${suffix}.${ext}`
        const buffer      = Buffer.from(await response.arrayBuffer())

        await uploadToR2(r2Key, buffer, contentType)

        const newUrl = `${R2_PUBLIC_URL}/${r2Key}`

        // Update the DB
        const { error: updateError } = await supabase
          .from('users')
          .update({ [field]: newUrl })
          .eq('id', user.id)

        if (updateError) {
          console.error(`  ❌ DB update failed for user ${user.id}:`, updateError.message)
          continue
        }

        console.log(`  ✅ Migrated to R2:\n     Key: ${r2Key}\n     URL: ${newUrl}`)
        migrated++
      } catch (err) {
        console.error(`  ❌ Error migrating ${field} for user ${user.id}:`, err)
      }
    }
  }

  console.log(`\n   ${DRY_RUN ? 'Would migrate' : 'Migrated'}: ${migrated} external image(s)`)
  return migrated
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔍 Scanning R2 bucket "${BUCKET}" …`)
  console.log(DRY_RUN ? '🟡 DRY RUN — no changes will be made' : '🔴 LIVE RUN — objects will be renamed/uploaded')

  const renamed  = await fixMalformedKeys()
  printSql()
  const migrated = await migrateExternalProfileImages()

  console.log('\n═══ Final Summary ═══')
  console.log(`   R2 keys renamed (malformed → clean): ${renamed}`)
  console.log(`   External images migrated to R2:      ${migrated}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
