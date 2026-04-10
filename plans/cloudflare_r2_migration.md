# Cloudflare R2 Image Storage Migration

## Root Cause

**Supabase free-tier egress exceeded: 5.836 / 5 GB (117%).** Grace period ends **29 Apr 2026**. After that, all storage requests return HTTP 402.

The 402 only surfaces after removing `unoptimized` from `<Image>` because:
- **With `unoptimized`**: browser fetches Supabase URL → hits Supabase CDN → counted as *Cached Egress* (1.9/5 GB, 38% - fine)
- **Without `unoptimized`**: Next.js `/_next/image` server fetches Supabase origin → bypasses CDN → counted as *raw Egress* (5.8/5 GB, 117% - 402)

The `remotePatterns` in `next.config.js` is **correctly configured** and is NOT the problem.

---

## Target Architecture

```
Upload:  Admin → POST /api/upload-* → lib/r2.ts → Cloudflare R2 bucket
Serve:   Browser → /_next/image → Cloudflare R2 CDN (FREE egress) → cached 1h
```

**Cloudflare R2 egress is free** when served via Cloudflare CDN (the `r2.dev` subdomain or a custom domain). Next.js `/_next/image` can fetch from R2 CDN at zero cost — `unoptimized` can stay removed permanently.

---

## Phase 0 — Immediate stopgap (deploy today, before grace period ends)

Add a custom Next.js `loaderFile` that bypasses `/_next/image` entirely. The browser fetches directly from Supabase CDN (Cached Egress, still within quota). This takes ~5 minutes and unbreaks images while the full R2 migration is implemented.

### Files changed

**Create `lib/imageLoader.ts`**
```typescript
'use client'

/**
 * Custom Next.js image loader (stopgap while images are on Supabase).
 *
 * Returning `src` unchanged makes the browser fetch the image directly
 * from Supabase CDN (Cached Egress, which is within quota) instead of
 * via Next.js's /_next/image server fetcher (which hits raw Egress and
 * triggers HTTP 402 when the free-tier quota is exceeded).
 *
 * Remove this file and the loaderFile entry in next.config.js once all
 * images have been migrated to Cloudflare R2.
 */
export default function imageLoader({
  src,
}: {
  src: string
  width: number
  quality?: number
}) {
  return src
}
```

**Edit `next.config.js`** — add one line inside the `images` block:
```js
images: {
  loaderFile: './lib/imageLoader.ts',   // ← ADD THIS LINE
  minimumCacheTTL: 3600,
  ...
}
```

---

## Phase 1 — Cloudflare R2 setup (manual, ~15 min)

1. Log in to Cloudflare dashboard → **R2 Object Storage** → **Create bucket**
   - Bucket name: `lumidex-images`
   - Region: automatic (Cloudflare picks closest)
2. **Settings → Public access** → Enable public development URL
   - Note the public URL: `https://pub-XXXXXXXXXXXXXXXXXXXX.r2.dev`
   - Optionally add a custom domain later (e.g. `images.lumidex.no`)
3. **Manage R2 API Tokens** → Create token
   - Permissions: Object Read & Write on `lumidex-images`
   - Note: **Access Key ID** and **Secret Access Key**
4. Note your **Account ID** (top-right of Cloudflare dashboard)

### Environment variables to add

In `.env.local` (dev) and Vercel project settings (prod):

```
# Cloudflare R2
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFLARE_R2_BUCKET_NAME=lumidex-images

# Public CDN base URL for the R2 bucket (no trailing slash)
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-XXXXXXXXXXXXXXXXXXXX.r2.dev
```

---

## Phase 2 — Code implementation

### New dependency

```bash
npm install @aws-sdk/client-s3
```

R2 exposes an S3-compatible API — no Cloudflare-specific SDK needed.

---

### New file: `lib/r2.ts`

R2 client, upload helper, and URL generator used by all API routes.

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const accountId  = process.env.CLOUDFLARE_R2_ACCOUNT_ID!
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME!

/**
 * S3-compatible client pointed at Cloudflare R2.
 * Used only server-side (API routes / scripts).
 */
export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

/**
 * Upload a buffer to R2.
 * @param key   Object key, e.g. "set-images/sv9pt5-logo.webp"
 * @param body  File content as Buffer or ArrayBuffer
 * @param contentType  MIME type, e.g. "image/webp"
 */
export async function uploadToR2(
  key: string,
  body: Buffer | ArrayBuffer,
  contentType: string,
): Promise<void> {
  await r2.send(new PutObjectCommand({
    Bucket:      bucketName,
    Key:         key,
    Body:        Buffer.isBuffer(body) ? body : Buffer.from(body),
    ContentType: contentType,
  }))
}

/**
 * Delete an object from R2 (used when re-uploading / replacing).
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
}

/**
 * Build the public CDN URL for an R2 object key.
 * Uses NEXT_PUBLIC_R2_PUBLIC_URL which resolves to either the r2.dev
 * development URL or a custom domain once configured.
 */
export function getR2Url(key: string): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, '')
  return `${base}/${key}`
}
```

---

### Updated `next.config.js`

Replace the Supabase `remotePatterns` entry with the R2 hostname. Keep the stopgap `loaderFile` until migration is complete, then remove it.

```js
// Extract R2 public hostname for next/image remotePatterns
let r2Hostname = '*.r2.dev' // fallback
if (process.env.NEXT_PUBLIC_R2_PUBLIC_URL) {
  try {
    r2Hostname = new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname
  } catch { /* malformed — leave wildcard fallback */ }
}

const nextConfig = {
  images: {
    loaderFile: './lib/imageLoader.ts', // REMOVE after migration
    minimumCacheTTL: 3600,
    deviceSizes: [640, 1080, 1920],
    imageSizes: [64, 128, 256],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pokemontcg.io', pathname: '/**' },
      { protocol: 'https', hostname: 'images.scrydex.com',   pathname: '/**' },
      {
        // Cloudflare R2 CDN — free egress, no 402
        protocol: 'https',
        hostname: r2Hostname,
        pathname: '/**',
      },
      // Keep Supabase pattern during transition so old URLs still work
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  ...
}
```

---

### Upload routes to update (7 routes)

Each route follows the same pattern change:
1. Replace `supabaseAdmin.storage.from(bucket).upload(...)` with `uploadToR2(key, buffer, contentType)`
2. Replace `supabaseAdmin.storage.from(bucket).getPublicUrl(filename)` with `getR2Url(key)`
3. Keep `compressImageToWebP` unchanged — still compress before upload

| Route | Supabase bucket | R2 key prefix |
|-------|----------------|---------------|
| `app/api/upload-set-image/route.ts` | `set-images` | `set-images/` |
| `app/api/upload-set-symbol/route.ts` | `set-symbols` | `set-symbols/` |
| `app/api/upload-card-image/route.ts` | `card-images` | `card-images/` |
| `app/api/upload-product-image/route.ts` | `product-images` | `product-images/` |
| `app/api/upload-avatar/route.ts` | `avatars` | `avatars/` |
| `app/api/upload-banner/route.ts` | `banners` | `banners/` |
| `app/api/upload-variant-image/route.ts` | `card-variant-images` | `card-variant-images/` |

---

### Update `lib/imageLoader.ts` (post-migration)

Once all images are on R2, the loader can either:
- Be **deleted** along with the `loaderFile` config entry (Next.js will use its default `/_next/image` optimizer, which now fetches from R2 CDN — free egress)
- Or be **kept** but return a Cloudflare Image Resizing URL for transforms (optional enhancement)

---

### Admin recompress tool

`components/admin/RecompressImages.tsx` submits the existing image filename back through the upload route. Since the upload routes will use R2 after Phase 2, this will automatically recompress to R2. No changes needed.

The "empty bucket" feature in `app/admin/recompress/page.tsx` talks directly to Supabase. After migration, update it to call a new `DELETE /api/admin/r2-object` endpoint or use the R2 SDK directly from a server action.

---

## Phase 3 — Migration script

**New file: `scripts/migrateImagesToR2.ts`**

Reads every Supabase-hosted URL from the database, downloads the file via the Supabase public URL, uploads to R2, and updates the database record.

### Tables & columns to migrate

| Table | Column | Notes |
|---|---|---|
| `sets` | `logo_url` | filter rows where value contains `supabase.co` |
| `sets` | `symbol_url` | same |
| `cards` | `image` | can be thousands of rows |
| `set_products` | `image_url` | |
| `users` | `avatar_url` | |
| `users` | `banner_url` | confirm column name in schema |

### Script outline

```typescript
// scripts/migrateImagesToR2.ts
// Run with: npx tsx scripts/migrateImagesToR2.ts

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { uploadToR2, getR2Url } from '../lib/r2'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

/**
 * Convert a Supabase Storage public URL to its R2 key equivalent.
 * e.g. ".../storage/v1/object/public/set-images/sv9pt5-logo.webp"
 *   → "set-images/sv9pt5-logo.webp"
 */
function supabaseUrlToR2Key(url: string): string {
  const match = url.match(/\/object\/public\/(.+)$/)
  if (!match) throw new Error(`Cannot extract key from: ${url}`)
  return match[1]
}

async function migrateUrl(supabaseUrl: string): Promise<string> {
  const key = supabaseUrlToR2Key(supabaseUrl)
  
  // Download from Supabase CDN
  const res = await fetch(supabaseUrl)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${supabaseUrl}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') ?? 'image/webp'
  
  // Upload to R2
  await uploadToR2(key, buffer, contentType)
  return getR2Url(key)
}

async function migrateSets() { /* ... */ }
async function migrateCards() { /* ... batched in 100s ... */ }
async function migrateProducts() { /* ... */ }
async function migrateUsers() { /* ... */ }

async function main() {
  console.log('Starting Supabase → R2 migration…')
  await migrateSets()
  await migrateCards()
  await migrateProducts()
  await migrateUsers()
  console.log('Migration complete.')
}

main().catch(console.error)
```

Key behaviours:
- **Skip rows** where `logo_url` is null or already points to `r2.dev`
- **Re-try on transient failures** with exponential backoff
- **Batch cards** in groups of 100 to avoid memory pressure
- **Dry-run flag** (`DRY_RUN=true`) that logs changes without writing
- **Idempotent** — safe to rerun; it checks if the R2 object already exists before uploading

---

## Phase 4 — Post-migration cleanup

1. Remove `loaderFile: './lib/imageLoader.ts'` from `next.config.js`
2. Delete `lib/imageLoader.ts`
3. Remove the Supabase `remotePatterns` entry from `next.config.js`
4. Delete Supabase storage buckets from the dashboard to free quota
5. Remove Supabase egress-related env vars if they're no longer needed

---

## Summary of all file changes

### New files
| File | Purpose |
|------|---------|
| `lib/imageLoader.ts` | Phase 0 stopgap loader (deleted after migration) |
| `lib/r2.ts` | R2 client, upload helper, URL generator |
| `scripts/migrateImagesToR2.ts` | One-time migration script |

### Modified files
| File | Change |
|------|--------|
| `next.config.js` | Add `loaderFile`, add R2 `remotePattern`, keep Supabase pattern during transition |
| `package.json` | Add `@aws-sdk/client-s3` |
| `app/api/upload-set-image/route.ts` | Use `uploadToR2` + `getR2Url` |
| `app/api/upload-set-symbol/route.ts` | Use `uploadToR2` + `getR2Url` |
| `app/api/upload-card-image/route.ts` | Use `uploadToR2` + `getR2Url` |
| `app/api/upload-product-image/route.ts` | Use `uploadToR2` + `getR2Url` |
| `app/api/upload-avatar/route.ts` | Use `uploadToR2` + `getR2Url` |
| `app/api/upload-banner/route.ts` | Use `uploadToR2` + `getR2Url` |
| `app/api/upload-variant-image/route.ts` | Use `uploadToR2` + `getR2Url` |

### Unchanged files
`components/SetCard.tsx` — no `unoptimized` prop required; images just work via R2 CDN.

---

## Cost comparison

| | Supabase Free | Cloudflare R2 |
|---|---|---|
| Storage | 1 GB | 10 GB free, then $0.015/GB |
| Egress | 5 GB / month | **Free via CDN** |
| Write ops | — | 1M free, then $4.50/M |
| Read ops | — | 10M free, then $0.36/M |
| 402 risk | Yes (currently blown) | None |
