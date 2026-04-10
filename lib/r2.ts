import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

/**
 * Lazily-initialised S3-compatible client pointed at Cloudflare R2.
 *
 * The singleton is created on first use so that process.env.* values are read
 * AFTER dotenv (or Next.js runtime) has populated them — not at module-import time.
 * This prevents "No value provided for input HTTP label: Bucket" errors when the
 * migration script loads dotenv after the import statements are hoisted.
 */
let _r2: S3Client | null = null

function getR2Client(): S3Client {
  if (!_r2) {
    _r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    })
  }
  return _r2
}

/**
 * Upload a buffer to R2.
 * @param key         Object key, e.g. "set-images/sv9pt5-logo.webp"
 * @param body        File content as Buffer or ArrayBuffer
 * @param contentType MIME type, e.g. "image/webp"
 */
export async function uploadToR2(
  key: string,
  body: Buffer | ArrayBuffer,
  contentType: string,
): Promise<void> {
  await getR2Client().send(new PutObjectCommand({
    Bucket:      process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key:         key,
    Body:        Buffer.isBuffer(body) ? body : Buffer.from(body),
    ContentType: contentType,
  }))
}

/**
 * Delete an object from R2 (used when re-uploading / replacing).
 */
export async function deleteFromR2(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key:    key,
  }))
}

/**
 * Build the public CDN URL for an R2 object key.
 */
export function getR2Url(key: string): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, '')
  return `${base}/${key}`
}
