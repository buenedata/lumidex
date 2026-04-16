-- ============================================================
-- PRICING TEARDOWN MIGRATION
-- Removes all legacy pricing tables, columns, and indexes.
-- Part of the pricing system reset (Phase 1) before rebuilding
-- with TCGGO API.
-- Safe to run multiple times (all statements use IF EXISTS).
-- ============================================================
--
-- WHAT IS REMOVED:
--   Tables:   card_graded_prices, card_price_history, card_prices,
--             price_points, ebay_oauth_tokens, ebay_webhooks
--   Columns:  set_products.{tcgp_market, tcgp_low, tcgp_high, tcgp_url,
--               cm_avg_sell, cm_trend, cm_url, fetched_at}
--             sets.prices_last_synced_at
--             users.price_source
--             users.show_portfolio_value
--   Indexes:  idx_sets_prices_last_synced_at
--
-- WHAT IS KEPT (with reasoning):
--   set_products               — table kept; used by admin product image
--                                management (ProductImageGrid, ProductImageUploadModal).
--                                Only the price-bearing columns are removed.
--   set_products.image_url     — admin product image store; not pricing.
--   set_products.api_product_id, name, product_type, id, set_id, updated_at
--                              — structural identity / image-management columns.
--   cards.tcggo_id             — stable identifier for the NEW TCGGO pricing
--                                system; required for post-reset price lookups.
--   cards_tcggo_id_idx         — supports new TCGGO price lookup queries.
--   cards.api_id               — pokemontcg.io unique card identifier; used
--                                by admin card import tooling (CardDataImport,
--                                BulkImageImport). NOT a pure pricing field.
--   cards_api_id_idx           — kept because cards.api_id is kept.
--   users.preferred_currency   — used by trade proposals for currency selection
--                                (trade_proposals.currency_code); unrelated to pricing.
--   sets.api_set_id            — tcggo.com episode ID needed for post-reset
--                                TCGGO price sync; not removed.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1 — DROP PURE PRICING TABLES
-- Order: child tables first, then parent-level pricing tables.
-- All have ON DELETE CASCADE on their card_id FK so order
-- between siblings does not matter, but we drop in the
-- logical dependency chain anyway for clarity.
-- ────────────────────────────────────────────────────────────

-- card_graded_prices
--   eBay last-sold graded prices (PSA/CGC/ACE) per card+grade.
--   100% pricing data; no other purpose.
DROP TABLE IF EXISTS public.card_graded_prices CASCADE;

-- card_price_history
--   Time-series price records used by the price chart component.
--   100% pricing data; no other purpose.
DROP TABLE IF EXISTS public.card_price_history CASCADE;

-- card_prices
--   Latest TCGPlayer + CardMarket prices per card (one row per card).
--   100% pricing data; no other purpose.
--   Dropping this also drops the handle_updated_at_card_prices trigger
--   automatically (trigger is bound to the table).
DROP TABLE IF EXISTS public.card_prices CASCADE;

-- price_points
--   Granular price observations from TCGPlayer, CardMarket, and eBay.
--   The intended "new source of truth" that was never fully adopted.
--   100% pricing data; no other purpose.
DROP TABLE IF EXISTS public.price_points CASCADE;

-- ebay_oauth_tokens
--   Single-row cache for the eBay Application (Client Credentials) OAuth token.
--   Exists solely to avoid redundant token-fetch round-trips in the eBay
--   pricing pipeline. With pricing removed this table has no purpose.
DROP TABLE IF EXISTS public.ebay_oauth_tokens CASCADE;

-- ebay_webhooks
--   Raw eBay notification payload log (Marketplace Account Deletion events
--   and pricing notification subscriptions). No purpose post-pricing teardown.
DROP TABLE IF EXISTS public.ebay_webhooks CASCADE;


-- ────────────────────────────────────────────────────────────
-- SECTION 2 — STRIP PRICE COLUMNS FROM set_products
--
-- set_products is NOT dropped because it serves as the admin
-- sealed-product image catalog (image_url) alongside the
-- ProductImageGrid and ProductImageUploadModal admin components.
-- user_sealed_products references products by product_id (text)
-- which conceptually links here, so the table must remain.
--
-- All price-bearing and price-fetch-metadata columns are dropped.
-- Kept columns: id, set_id, api_product_id, name, product_type,
--               image_url, updated_at.
-- ────────────────────────────────────────────────────────────

-- TCGPlayer price columns
ALTER TABLE public.set_products DROP COLUMN IF EXISTS tcgp_market;
ALTER TABLE public.set_products DROP COLUMN IF EXISTS tcgp_low;
ALTER TABLE public.set_products DROP COLUMN IF EXISTS tcgp_high;
ALTER TABLE public.set_products DROP COLUMN IF EXISTS tcgp_url;

-- CardMarket price columns
ALTER TABLE public.set_products DROP COLUMN IF EXISTS cm_avg_sell;
ALTER TABLE public.set_products DROP COLUMN IF EXISTS cm_trend;
ALTER TABLE public.set_products DROP COLUMN IF EXISTS cm_url;

-- fetched_at: timestamp recording when prices were last fetched.
-- Pure pricing metadata; safe to drop now that price columns are gone.
-- updated_at is retained as a general row-modification audit timestamp.
ALTER TABLE public.set_products DROP COLUMN IF EXISTS fetched_at;


-- ────────────────────────────────────────────────────────────
-- SECTION 3 — DROP PRICE-RELATED COLUMNS FROM OTHER TABLES
-- ────────────────────────────────────────────────────────────

-- sets.prices_last_synced_at
--   Tracks when a set's card prices were last updated by the cron job.
--   Added in migration_set_prices_last_synced.sql solely for price
--   sync scheduling. No longer needed.
ALTER TABLE public.sets DROP COLUMN IF EXISTS prices_last_synced_at;

-- users.price_source
--   User preference for which pricing provider to display
--   ('tcgplayer' | 'cardmarket'). Pricing sources are being removed.
--   The check constraint is dropped automatically with the column.
ALTER TABLE public.users DROP COLUMN IF EXISTS price_source;

-- users.show_portfolio_value
--   Controls visibility of the user's portfolio value
--   ('public' | 'friends_only' | 'private'). Portfolio value was
--   computed from card prices, which are being removed.
--   The check constraint is dropped automatically with the column.
ALTER TABLE public.users DROP COLUMN IF EXISTS show_portfolio_value;

-- NOTE: users.preferred_currency is NOT dropped.
--   It is used by trade proposals: trade_proposals.currency_code
--   lets proposers pick a cash-adjustment currency that defaults from
--   this column. It is a UI preference, not a pricing field.

-- NOTE: cards.api_id is NOT dropped.
--   Although it was added by migration_card_prices.sql to enable
--   price-matching by pokemontcg.io card ID (e.g. "sv1-25"), the
--   same identifier is used by admin card import tooling
--   (CardDataImport, BulkImageImport) to match API cards to DB cards.
--   Dropping it would break the import pipeline.

-- NOTE: cards.tcggo_id is NOT dropped.
--   This is the stable identifier for the NEW TCGGO pricing system
--   and is required for post-reset price lookups via the TCGGO API.

-- NOTE: sets.api_set_id is NOT dropped.
--   The tcggo.com episode ID; needed to trigger TCGGO set-level
--   price syncs in the rebuilt pricing system.


-- ────────────────────────────────────────────────────────────
-- SECTION 4 — DROP PRICING-RELATED INDEXES
-- ────────────────────────────────────────────────────────────

-- idx_sets_prices_last_synced_at
--   Created by migration_set_prices_last_synced.sql specifically to
--   support "which sets are due for a price update?" queries.
--   The underlying column (prices_last_synced_at) is being dropped
--   in Section 3; PostgreSQL will error if the index is not dropped
--   first (or drop it implicitly via CASCADE on the column drop).
--   We make it explicit here for documentation clarity.
DROP INDEX IF EXISTS public.idx_sets_prices_last_synced_at;

-- NOTE: cards_tcggo_id_idx is NOT dropped.
--   Supports TCGGO price lookup queries in the rebuilt pricing system.

-- NOTE: cards_api_id_idx is NOT dropped.
--   The underlying cards.api_id column is retained (see Section 3 note).
--   The index is needed for efficient admin import matching.

-- Indexes on the dropped tables (card_graded_prices, card_price_history,
-- card_prices, price_points, ebay_oauth_tokens, ebay_webhooks) are all
-- dropped automatically via DROP TABLE … CASCADE above. They are not
-- listed individually here to avoid redundancy.


-- ────────────────────────────────────────────────────────────
-- SECTION 5 — DB FUNCTIONS / RPCs
-- ────────────────────────────────────────────────────────────
-- No pricing-specific Postgres functions were found in the schema.
-- All functions defined in schema.sql are general utilities:
--   is_admin(), is_admin_by_user_id(), is_admin_or_owner()
--   get_set_image_stats(), get_user_card_counts_by_set()
--   increment_user_card_variant(), handle_updated_at()
--   handle_new_confirmed_user()
-- None of these are price-computation or price-sync functions.
-- Therefore no functions are dropped in this migration.


-- ────────────────────────────────────────────────────────────
-- END OF PRICING TEARDOWN MIGRATION
-- ────────────────────────────────────────────────────────────
