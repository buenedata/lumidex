/**
 * Image Compression Utility
 *
 * Converts any image buffer (PNG, JPEG, WebP, GIF, etc.) to WebP format
 * at 82 % quality with a maximum width of 500 px (aspect ratio preserved).
 *
 * Used by every image upload route so all images are stored in Cloudflare R2
 * as compact WebP files rather than large raw PNGs / JPEGs.
 *
 * Expected savings vs raw card-image PNGs: ~85–90 % per file.
 */

import sharp from 'sharp'

/** Maximum output width in pixels.  Height is scaled proportionally. */
const MAX_WIDTH = 500

/** WebP encode quality (0–100).  82 is visually lossless for card images. */
const WEBP_QUALITY = 82

/**
 * Compress an image buffer to WebP.
 *
 * @param input  Raw image bytes (any format sharp understands)
 * @returns      Compressed WebP `Buffer` ready for Supabase `.upload()`
 */
export async function compressImageToWebP(input: ArrayBuffer | Buffer): Promise<Buffer> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)

  return sharp(buf)
    .resize({
      width: MAX_WIDTH,
      // Never upscale images that are already smaller than MAX_WIDTH
      withoutEnlargement: true,
      // Fit within the given width; height scales proportionally
      fit: 'inside',
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()
}

/** MIME type produced by `compressImageToWebP`. */
export const COMPRESSED_CONTENT_TYPE = 'image/webp' as const
