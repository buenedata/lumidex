-- ─────────────────────────────────────────────────────────────────────────────
-- migration_rewrite_supabase_image_urls_to_r2.sql
--
-- Rewrites every old Supabase Storage URL still present in image columns to the
-- equivalent Cloudflare R2 public URL.
--
-- Old format stored in DB:
--   https://ysvskytxewtlxpxeiskf.supabase.co/storage/v1/object/public/<path>
--   (may also have a trailing ?v=<timestamp> cache-buster that was mistakenly
--    persisted by an earlier version of the upload code)
--
-- New R2 format:
--   https://pub-5781f5d7c220456fb6732e5213993cc7.r2.dev/<path>
--
-- Strategy:
--   1. Replace the Supabase prefix with the R2 prefix.
--   2. Strip any trailing ?v=… / ?_t=… query string with REGEXP_REPLACE.
--
-- NOTE: This mapping works perfectly for cards/sets whose R2 file was stored
-- using the LEGACY key format (e.g. "card-images/me3-1.jpg") because the
-- path component after the bucket name is identical.  Cards that were later
-- re-uploaded with the UUID-keyed format ("card-images/me3-1-<uuid>.webp")
-- will end up with a URL that 404s on R2; those cards will appear as
-- "no image" in the admin grid and can be re-uploaded normally.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── cards.image ──────────────────────────────────────────────────────────────
UPDATE cards
SET image = REGEXP_REPLACE(
  REPLACE(
    image,
    'https://ysvskytxewtlxpxeiskf.supabase.co/storage/v1/object/public/',
    'https://pub-5781f5d7c220456fb6732e5213993cc7.r2.dev/'
  ),
  '\?.*$',   -- strip query string (?v=timestamp or ?_t=timestamp)
  ''
)
WHERE image LIKE '%ysvskytxewtlxpxeiskf.supabase.co/storage%';

-- ── sets.logo_url ─────────────────────────────────────────────────────────────
UPDATE sets
SET logo_url = REGEXP_REPLACE(
  REPLACE(
    logo_url,
    'https://ysvskytxewtlxpxeiskf.supabase.co/storage/v1/object/public/',
    'https://pub-5781f5d7c220456fb6732e5213993cc7.r2.dev/'
  ),
  '\?.*$',
  ''
)
WHERE logo_url LIKE '%ysvskytxewtlxpxeiskf.supabase.co/storage%';

-- ── sets.symbol_url ───────────────────────────────────────────────────────────
UPDATE sets
SET symbol_url = REGEXP_REPLACE(
  REPLACE(
    symbol_url,
    'https://ysvskytxewtlxpxeiskf.supabase.co/storage/v1/object/public/',
    'https://pub-5781f5d7c220456fb6732e5213993cc7.r2.dev/'
  ),
  '\?.*$',
  ''
)
WHERE symbol_url LIKE '%ysvskytxewtlxpxeiskf.supabase.co/storage%';

-- ── set_products.image_url ────────────────────────────────────────────────────
UPDATE set_products
SET image_url = REGEXP_REPLACE(
  REPLACE(
    image_url,
    'https://ysvskytxewtlxpxeiskf.supabase.co/storage/v1/object/public/',
    'https://pub-5781f5d7c220456fb6732e5213993cc7.r2.dev/'
  ),
  '\?.*$',
  ''
)
WHERE image_url LIKE '%ysvskytxewtlxpxeiskf.supabase.co/storage%';

-- ── card_variant_images.image_url (if column exists) ─────────────────────────
UPDATE card_variant_images
SET image_url = REGEXP_REPLACE(
  REPLACE(
    image_url,
    'https://ysvskytxewtlxpxeiskf.supabase.co/storage/v1/object/public/',
    'https://pub-5781f5d7c220456fb6732e5213993cc7.r2.dev/'
  ),
  '\?.*$',
  ''
)
WHERE image_url LIKE '%ysvskytxewtlxpxeiskf.supabase.co/storage%';

-- ── Verification queries (run after to confirm 0 rows remain) ─────────────────
-- SELECT COUNT(*) AS remaining_supabase_cards   FROM cards              WHERE image      LIKE '%ysvskytxewtlxpxeiskf.supabase.co%';
-- SELECT COUNT(*) AS remaining_supabase_logos   FROM sets               WHERE logo_url   LIKE '%ysvskytxewtlxpxeiskf.supabase.co%';
-- SELECT COUNT(*) AS remaining_supabase_symbols FROM sets               WHERE symbol_url LIKE '%ysvskytxewtlxpxeiskf.supabase.co%';
-- SELECT COUNT(*) AS remaining_supabase_products FROM set_products      WHERE image_url  LIKE '%ysvskytxewtlxpxeiskf.supabase.co%';
-- SELECT COUNT(*) AS remaining_supabase_variants FROM card_variant_images WHERE image_url LIKE '%ysvskytxewtlxpxeiskf.supabase.co%';
