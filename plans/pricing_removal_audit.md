# Lumidex Pricing Removal — Phase 1 Audit: Full Codebase Impact Map

**Audit Date:** 2026-08-13
**Scope:** Every TypeScript/TSX, SQL, JSON, locale, and config file in the repo.
**Purpose:** Identify and classify every pricing reference so Phase 2 can remove pricing safely without breaking non-pricing features.

---

## Architecture Overview (Current Pricing System)

The current pricing system has two tiers:

**Tier 1 — Live price lookup (TCGGO / CardMarket)**
- TCGGO RapidAPI (`cardmarket-api-tcg.p.rapidapi.com`) is called by the admin sync pipeline and the per-item `/api/prices/…` routes.
- Prices are cached in the `item_prices` DB table with a 24-hour TTL.
- A Vercel cron (`/api/cron/price-sync`) fires daily at 03:00 UTC and refreshes the most-overdue set.

**Tier 2 — Portfolio analytics (Pro only)**
- `lib/analytics.ts` computes daily portfolio snapshots from `item_prices × user_card_variants`.
- Snapshots land in `collection_value_snapshots`.
- Three Pro-only API routes serve portfolio history, collection analytics (top cards, rarity, performers), and snapshot upserts.

---

## 1. Pricing-Specific Files — Safe to Remove Entirely

> These files have **zero non-pricing purpose**. Delete them outright.

### 1a. API Routes

| File | What it does |
|------|--------------|
| [`app/api/admin/prices/sync-set/route.ts`](../app/api/admin/prices/sync-set/route.ts) | POST — bulk-syncs single/graded prices for one set via TCGGO episode endpoint. Exports `fetchEpisodeCards`, `buildPriceRows`, `batchUpsert` (re-used by sync-all-sets and cron). |
| [`app/api/admin/prices/sync-all-sets/route.ts`](../app/api/admin/prices/sync-all-sets/route.ts) | POST — iterates every set with a TCGGO episode ID, calls sync-set helpers sequentially. |
| [`app/api/admin/prices/sync-products/route.ts`](../app/api/admin/prices/sync-products/route.ts) | POST — syncs sealed-product prices from TCGGO for a given set; also back-fills `set_products.api_product_id`. |
| [`app/api/prices/[type]/[id]/route.ts`](../app/api/prices/%5Btype%5D/%5Bid%5D/route.ts) | GET — returns a single item price from the `item_prices` cache via `getItemPrice()`. |
| [`app/api/prices/card-variants/[tcggoId]/route.ts`](../app/api/prices/card-variants/%5BtcggoId%5D/route.ts) | GET — returns all singles + graded prices for one card keyed by variant. |
| [`app/api/prices/history/[cardId]/route.ts`](../app/api/prices/history/%5BcardId%5D/route.ts) | GET — returns price history points from `card_price_history` for the chart. |
| [`app/api/prices/refresh/route.ts`](../app/api/prices/refresh/route.ts) | POST — force-invalidates and re-fetches one item price. |
| [`app/api/prices/set-stats/[setId]/route.ts`](../app/api/prices/set-stats/%5BsetId%5D/route.ts) | GET — aggregates most-expensive card and total set value from `item_prices` for a set. |
| [`app/api/cron/price-sync/route.ts`](../app/api/cron/price-sync/route.ts) | GET — Vercel cron handler; refreshes the most-overdue set's prices once per invocation. |
| [`app/api/analytics/portfolio-history/route.ts`](../app/api/analytics/portfolio-history/route.ts) | GET (Pro) — returns `collection_value_snapshots` history for a date range; lazily creates today's snapshot. |
| [`app/api/analytics/portfolio-snapshot/route.ts`](../app/api/analytics/portfolio-snapshot/route.ts) | POST (Pro) — explicitly computes and upserts today's collection snapshot. |
| [`app/api/analytics/collection/route.ts`](../app/api/analytics/collection/route.ts) | GET (Pro) — returns top cards, rarity breakdown, value by set, best/worst price performers. |
| [`app/api/users/[id]/portfolio-value/route.ts`](../app/api/users/%5Bid%5D/portfolio-value/route.ts) | GET — returns price × quantity sum for all owned cards (regular + graded) in EUR. |
| [`app/api/users/[id]/most-expensive-card/route.ts`](../app/api/users/%5Bid%5D/most-expensive-card/route.ts) | GET — returns the single highest-priced card the user owns. |

### 1b. Admin UI Page

| File | What it does |
|------|--------------|
| [`app/admin/prices/page.tsx`](../app/admin/prices/page.tsx) | Admin page that hosts `PriceSyncTool` — the 3-section sync UI. |

### 1c. Components (exclusively pricing)

| File | What it does |
|------|--------------|
| [`components/PriceChart.tsx`](../components/PriceChart.tsx) | Recharts line chart of price history. Renders range tabs (7d–1y), Pro gate blur overlay, custom tooltip/legend. |
| [`components/admin/PriceSyncTool.tsx`](../components/admin/PriceSyncTool.tsx) | Admin sync UI — 3 independent sections: Sync Single Set, Sync All Sets, Sync Products. |
| [`components/analytics/AnalyticsSection.tsx`](../components/analytics/AnalyticsSection.tsx) | Wrapper that shows portfolio history chart + CollectionAnalytics tabs in the collection page. |
| [`components/analytics/AnalyticsProGateOverlay.tsx`](../components/analytics/AnalyticsProGateOverlay.tsx) | Blur + upgrade CTA overlay shown over analytics content for free users. |
| [`components/analytics/CollectionAnalytics.tsx`](../components/analytics/CollectionAnalytics.tsx) | Pro analytics dashboard: top cards, rarity breakdown, value by set, performers tabs. |
| [`components/analytics/PortfolioValueChart.tsx`](../components/analytics/PortfolioValueChart.tsx) | Recharts line chart of portfolio EUR value over time. |
| [`components/analytics/TopValuableCards.tsx`](../components/analytics/TopValuableCards.tsx) | Ranked list of most-valuable owned cards by EUR value. |
| [`components/analytics/RarityBreakdown.tsx`](../components/analytics/RarityBreakdown.tsx) | Horizontal bar chart of card count + EUR value grouped by rarity. |
| [`components/analytics/ValueBySet.tsx`](../components/analytics/ValueBySet.tsx) | Bar chart of total EUR value per set. |
| [`components/analytics/BestWorstPerformers.tsx`](../components/analytics/BestWorstPerformers.tsx) | Cards with the highest/lowest price % change in the last 30 days. |
| [`components/analytics/types.ts`](../components/analytics/types.ts) | TypeScript types for analytics API responses (TopCard, PortfolioHistoryPoint, PerformerCard, etc.). |

### 1d. Library Files

| File | What it does |
|------|--------------|
| [`lib/price_service.ts`](../lib/price_service.ts) | Core server-side price service — fetches from TCGGO API, caches in `item_prices`, handles graded price extraction. |
| [`lib/currency.ts`](../lib/currency.ts) | Client-safe currency conversion utilities — `formatPrice()`, `fmtCardPrice()`, `sumAndFormatPrices()`, exchange-rate constants. Used **only** by pricing UI. |
| [`lib/analytics.ts`](../lib/analytics.ts) | Portfolio analytics helpers — `computeCollectionSnapshot()`, `GRADED_VARIANT_KEY` map, all analytics interfaces. |

### 1e. Hooks

| File | What it does |
|------|--------------|
| [`hooks/useItemPrice.ts`](../hooks/useItemPrice.ts) | Client-side React hook — fetches a single item price from `/api/prices/{type}/{id}`. |

### 1f. Types

| File | What it does |
|------|--------------|
| [`types/pricing.ts`](../types/pricing.ts) | All pricing type definitions — `ItemType`, `ItemPriceRow`, `ItemPriceResult`, `TcggoCardResponse`, `TcggoProductResponse`, `TcggoGradedPricesMap`, etc. |

### 1g. Database Migration Files

> These files document the history of the DB schema. The live DB objects are what must be dropped (see Section 3). The migration `.sql` files themselves can be archived or deleted to avoid confusion.

| File | Notes |
|------|-------|
| [`database/migration_item_prices.sql`](../database/migration_item_prices.sql) | Creates `item_prices` table (active in DB). |
| [`database/migration_card_price_history.sql`](../database/migration_card_price_history.sql) | Creates `card_price_history` table (active in DB). |
| [`database/migration_extend_price_history.sql`](../database/migration_extend_price_history.sql) | Adds `is_graded`, `grade`, `grading_company` columns to `card_price_history`. |
| [`database/migration_collection_value_snapshots.sql`](../database/migration_collection_value_snapshots.sql) | Creates `collection_value_snapshots` table (active in DB). |
| [`database/migration_set_prices_last_synced.sql`](../database/migration_set_prices_last_synced.sql) | Adds `sets.prices_last_synced_at` column. |
| [`database/migration_add_cm_trend_prices.sql`](../database/migration_add_cm_trend_prices.sql) | Adds `item_prices.cm_30d_avg_eur` and `item_prices.cm_7d_avg_eur` columns. |
| [`database/migration_card_prices.sql`](../database/migration_card_prices.sql) | Created old `card_prices` table (already torn down in DB by teardown migration). |
| [`database/migration_card_graded_prices.sql`](../database/migration_card_graded_prices.sql) | Created old `card_graded_prices` table (already torn down). |
| [`database/migration_price_points.sql`](../database/migration_price_points.sql) | Created old `price_points` table (already torn down). |
| [`database/migration_add_cm_cosmos_holo.sql`](../database/migration_add_cm_cosmos_holo.sql) | Added `card_prices.cm_cosmos_holo` column (table already torn down). |
| [`database/migration_add_cm_reverse_holo.sql`](../database/migration_add_cm_reverse_holo.sql) | Added `card_prices.cm_reverse_holo` and `cm_url` columns (table already torn down). |
| [`database/migration_pricing_teardown.sql`](../database/migration_pricing_teardown.sql) | Previously ran teardown of legacy pricing tables/columns — documentation only. |
| [`database/migration_pricing_schema_cleanup.sql`](../database/migration_pricing_schema_cleanup.sql) | Dropped dead columns from `card_prices`, added dedup indexes — documentation only. |
| [`database/migration_ebay_oauth_tokens.sql`](../database/migration_ebay_oauth_tokens.sql) | Created `ebay_oauth_tokens` (already torn down). |
| [`database/migration_ebay_webhooks.sql`](../database/migration_ebay_webhooks.sql) | Created `ebay_webhooks` (already torn down). |

### 1h. Plans

| File | Notes |
|------|-------|
| [`plans/tcggo_pricing_architecture.md`](tcggo_pricing_architecture.md) | Architecture plan for the current TCGGO pricing system — no longer needed. Archive or delete. |

---

## 2. Shared Files with Pricing References — Needs Surgical Editing

> These files have **significant non-pricing functionality** that must be preserved. Only the listed items should be removed.

### 2.1 [`components/CardGrid.tsx`](../components/CardGrid.tsx)

Heavy pricing surface — the card detail modal has an entire "Price" tab.

**Remove:**
- `import { fmtCardPrice } from '@/lib/currency'`
- `import type { PriceChartRange } from '@/components/PriceChart'`
- `const PriceChart = dynamic(() => import('@/components/PriceChart'), { ssr: false })`
- `function toPriceVariant(lumidexVariant: string): string { … }` (maps variant keys for `item_prices`)
- `'price'` from the `ModalTab = 'card' | 'price' | 'friends'` union
- `currency?: string` prop from `CardGridProps`
- `effectiveCurrency` computed variable
- All modal price state: `modalVariantPrices`, `modalVariantPricesLoading`, `modalPriceCurrency`, `modalGradedPrices`, `modalPriceHistory`, `modalPriceHistoryLoading`, `modalPriceRange`
- The entire `useEffect` that fetches `/api/prices/card-variants/…` and `/api/prices/history/…`
- "Price" tab button inside the modal tab strip
- The entire `{modalTab === 'price' && (…)}` JSX block (current prices table, PriceChart, graded prices section)
- The "CardMarket price for this variant" `<span>` inside the variants list within the card tab

**Keep:** Card display, variant management, add/remove to collection, Friends tab, Wanted logic, quick-add dots, set tracking, all modal content outside the price tab, CardImage, admin controls.

---

### 2.2 [`components/CardTile.tsx`](../components/CardTile.tsx)

Shows a price badge on every card tile in browse/set views.

**Remove:**
- `import { useItemPrice } from '@/hooks/useItemPrice'`
- `import { fmtCardPrice } from '@/lib/currency'`
- `cardPricesUSD?: Record<string, number>` prop
- `effectiveCurrency: string` prop
- `const { price: cmPrice, loading: cmLoading } = useItemPrice(…)` call
- The price badge `{card.tcggo_id != null && (<div>…price display…</div>)}` block

**Keep:** Card image, card name, rarity, owned indicators, quick-add variant dots, tile structure, `isPartiallyOwned` display.

---

### 2.3 [`components/SetPageCards.tsx`](../components/SetPageCards.tsx)

Displays set-level price stats (Most Expensive / Set Value) above the card grid.

**Remove:**
- `import { fmtCardPrice } from '@/lib/currency'`
- `currency?: string` prop
- `statMostExpensive`, `statSetValue` state variables
- `useEffect` that fetches `/api/prices/set-stats/${setId}`
- `effectiveCurrency` computed variable
- "Most Expensive" and "Set Value" stat cards from the stats strip
- `currency={effectiveCurrency}` prop passed to `<CardGrid>`

**Keep:** Card grid, tab system (All/Owned/Missing/Duplicates), variants legend, filter/sort controls, progress tracking, set metadata strip (Series, Total Cards, Set Complete stats).

---

### 2.4 [`components/dashboard/CollectionSpotlight.tsx`](../components/dashboard/CollectionSpotlight.tsx)

Dashboard widget that shows most expensive card owned + collection value.

**Remove:**
- `import { fmtCardPrice } from '@/lib/currency'`
- `MostExpensiveInfo` interface
- `mostExpensiveInfo`, `collectionValueEur`, `pricesLoaded` state
- `useEffect` that fans out `/api/prices/set-stats/…` calls + `/api/users/…/most-expensive-card` call
- Most expensive card display section
- Collection value display section
- `spotlight_loading`, `spotlight_no_price`, `spotlight_across_sets` i18n key usages

**Keep:** Set tracking section, set progress rings, the tracked-sets list, completion badges.

---

### 2.5 [`components/ProductCard.tsx`](../components/ProductCard.tsx)

Sealed product card — shows a price fetched via `useItemPrice`.

**Remove:**
- `import { useItemPrice } from '@/hooks/useItemPrice'`
- `import { fmtCardPrice } from '@/lib/currency'`
- `userCurrency` and `profile` reads (if used only for currency)
- `const { price, loading: priceLoading } = useItemPrice(product.api_product_id, 'product', 'normal')`
- Price display block `{priceLoading ? … : price !== null ? … : null}`

**Keep:** Product image, product name, product type badge, owned counter (+/− controls), sealed product collection tracking.

---

### 2.6 [`components/trade/TradeProposalCard.tsx`](../components/trade/TradeProposalCard.tsx)

Shows market price of each card in a trade proposal (fetched live from `item_prices`).

**Remove:**
- `import { fmtCardPrice } from '@/lib/currency'`
- `cardPrice` state + the `useEffect` that fetches `/api/prices/card-variants/${card.tcggo_id}`
- "Market price" display row inside `CardDetailTile`

**Keep:** Proposal status badge, card identity (image, name, set), cash amount display block (`currency_code` is a trade prop, not card price), accept/decline buttons, proposer/receiver item lists.

---

### 2.7 [`components/trade/FriendCardPickerModal.tsx`](../components/trade/FriendCardPickerModal.tsx)

Friend card picker for trades — shows prices and sorts by them.

**Remove:**
- `price_eur: number | null` and `price_usd: number | null` from `FriendCard` interface
- `EUR_TO_USD` constant
- `fmtEur()`, `cardPrice()`, `toEur()` helper functions
- Price display in `FriendCardTile`
- `sort` state options `'price-desc'` and `'price-asc'` (keep only `'set'`)
- Price-sorted flat list (`sortedFlat`) and its rendering block
- `remainingEur` calculation and the "balance" suggestion section
- `unpricedCount` variable and "N cards without price data" note
- Sort button labels `'💰 Price ↓'` and `'💰 Price ↑'`

**Keep:** Card search, set-based group layout, card selection checkboxes, the modal's overall structure.

---

### 2.8 [`app/collection/page.tsx`](../app/collection/page.tsx)

User's collection page — shows collection value and hosts the Pro analytics section.

**Remove:**
- `import { fmtCardPrice } from '@/lib/currency'`
- `import AnalyticsSection from '@/components/analytics/AnalyticsSection'`
- `collectionValue` state variable
- `useEffect` that fetches `/api/users/${user.id}/portfolio-value`
- Collection value display card (`<span className="text-price">`)
- `<AnalyticsSection … />` render

**Keep:** Sets list, set progress rings, search/filter, onboarding modal, user sets tracking.

---

### 2.9 [`app/profile/[id]/page.tsx`](../app/profile/%5Bid%5D/page.tsx)

Public user profile — shows a Portfolio Value stat.

**Remove:**
- `import { fmtCardPrice } from '@/lib/currency'`
- `portfolioValue` state
- `fetch('/api/users/${userId}/portfolio-value')` call + `.then()` handler
- Portfolio Value stat card in the profile stats row

**Keep:** Profile display (avatar, bio, location, social links), friend management, settings modal, set tracking section, achievement display, graded card collection section.

---

### 2.10 [`app/set/[id]/page.tsx`](../app/set/%5Bid%5D/page.tsx)

Set detail page — fetches `preferred_currency` for price display.

**Remove:**
- `currency: string` from `AuthPrefs` interface and its default `'USD'`
- `.select('preferred_currency')` from the `users` DB query inside `getAuthPrefs()`
- `currency: profileResult.data?.preferred_currency ?? 'USD'` assignment
- `currency={currency}` prop passed to `<SetPageCards>`

**Keep:** Set data fetching, card data fetching, variant structure fetching, goal/progress tracking, `userId` resolution.

---

### 2.11 [`app/browse/page.tsx`](../app/browse/page.tsx)

Browse page — fetches `preferred_currency` and passes it to BrowseClient.

**Remove:**
- `let currency: string = 'USD'` variable
- `.select('preferred_currency')` query inside the user-preferences block
- `currency={currency}` prop on `<BrowseClient>` (and corresponding prop in `BrowseClient`)

**Keep:** Browse data fetching (cards, products, artists, discovery data), auth check.

---

### 2.12 [`components/browse/BrowseClient.tsx`](../components/browse/BrowseClient.tsx)

**Remove:**
- `currency: string` prop from `BrowseClientProps`
- `currency,` destructuring
- `currency` passed to `<CardGrid>`

**Keep:** All browse UI — typeahead, filters, results, tabs.

---

### 2.13 [`components/browse/BrowseTypeahead.tsx`](../components/browse/BrowseTypeahead.tsx)

Typeahead shows a TCGPlayer market price for products.

**Remove:**
- `{p.tcgp_market != null && (<span className="text-price">${p.tcgp_market.toFixed(2)}</span>)}`

**Keep:** All typeahead search logic, card/product/artist result rendering.

---

### 2.14 [`app/admin/page.tsx`](../app/admin/page.tsx)

Admin dashboard — has a "Price Data Sync" menu card.

**Remove:** The `{ href: '/admin/prices', icon: '💰', title: 'Price Data Sync', … }` entry from the admin menu cards array.

**Keep:** All other admin sections (cards, images, stories, subscriptions, etc.).

---

### 2.15 [`app/faq/page.tsx`](../app/faq/page.tsx)

FAQ — contains an entire "Prices" section and pricing references scattered through other sections.

**Remove/Edit:**
- Free plan feature list items: "Today's card prices from CardMarket & TCGPlayer", "7-day price history per card variant", "Today's total portfolio value"
- Pro feature list items: "14/30/90/365-day price history charts", "Portfolio value over time", "Price alerts", "Priority price sync", "Advanced collection analytics", "Collection export (includes prices)"
- Entire `{ section: 'Prices', items: […] }` FAQ section
- Pricing references in collection-value and graded-card FAQ answers

**Keep:** All non-pricing FAQ sections (general, sets, cards, trading, social, privacy).

---

### 2.16 [`app/upgrade/page.tsx`](../app/upgrade/page.tsx)

Upgrade page — lists pricing as Pro feature highlights.

**Remove/Edit:**
- Free plan items: "Today's card prices (TCGPlayer + CardMarket)", "7-day price history chart", "Today's total portfolio value"
- `PRO_FEATURES` entries: price history, portfolio value over time, price alerts, priority price sync
- FAQ question "Why is price history a Pro feature?"

**Keep:** Upgrade page structure, Stripe checkout integration, graded cards feature, other Pro benefits.

---

### 2.17 [`app/upgrade/success/page.tsx`](../app/upgrade/success/page.tsx)

**Remove/Edit:** "📈 Full price history charts (up to 1 year)", "💰 Portfolio value over time", "🔔 Price alerts" from the Pro features confirmation list.

**Keep:** Success page structure, other Pro feature confirmations.

---

### 2.18 [`components/upgrade/UpgradeModal.tsx`](../components/upgrade/UpgradeModal.tsx)

**Remove/Edit:**
- `'14/30/90/365-day price history charts'` from `PRO_FEATURES`
- `'Portfolio value over time'` from `PRO_FEATURES`
- `'Price alerts when cards move'` from `PRO_FEATURES`

**Keep:** Modal structure, Stripe checkout, graded cards and other features.

---

### 2.19 [`types/index.ts`](../types/index.ts)

Contains the `PriceHistoryPoint` interface used by `CardGrid` and `PriceChart`.

**Remove:**
- `PriceHistoryPoint` interface (lines 147–156)

**Keep:** All other types — `User` (including `preferred_currency` field), `PokemonCard` (including `tcggo_id` — see Section 4), `UserGradedCard`, `Variant`, `PokemonSet`, etc.

---

### 2.20 [`components/profile/SettingsForm.tsx`](../components/profile/SettingsForm.tsx)

Settings form — has two disabled "coming soon" pricing sections.

**Remove:**
- The disabled `settings_price_source` section (price source preference — never activated)
- The disabled `settings_portfolio_visibility` section (portfolio visibility — never activated)

**Keep:** `preferred_currency` dropdown (still needed for trade proposal cash currency), language preference, display preferences, privacy settings, social links.

---

### 2.21 [`locales/en.ts`](../locales/en.ts) and [`locales/nb.ts`](../locales/nb.ts)

**Remove from both files:**
- `analytics_section_title`, `analytics_portfolio_over_time`, `analytics_portfolio_error`, `analytics_load_error`, `analytics_tooltip_value`, `analytics_tooltip_cards`, `analytics_tab_*`, `analytics_no_price_data`, `analytics_no_data`, `analytics_no_portfolio`, `analytics_not_enough_data`, `analytics_this_period`
- `spotlight_no_price`, `spotlight_loading` (used only by CollectionSpotlight price section)
- `settings_price_source`, `settings_price_source_soon`, `settings_portfolio_visibility`
- `profile_portfolio_value`
- `settings_upgrade_cta` (mentions price history): edit the text to not reference pricing
- `feature_marketplace_desc` (mentions price-check): edit text

**Keep:** `settings_preferred_currency` (trade proposals use it), `spotlight_sets_complete`, `spotlight_across_sets`, and all non-pricing locale keys.

---

### 2.22 [`vercel.json`](../vercel.json)

**Remove:** The entire `crons` array entry for `/api/cron/price-sync`. After removal, `vercel.json` will either be empty `{}` or the file can be deleted if no other Vercel configuration is needed.

---

### 2.23 [`components/admin/ProductImageGrid.tsx`](../components/admin/ProductImageGrid.tsx)

**Remove:** The sentence `"No products found for this set. Prices may not have been synced yet."` → replace with `"No products found for this set."`.

**Keep:** All product image management functionality.

---

---

## 3. Database Objects — Pricing-Specific (Safe to Remove)

> These DB objects have **no foreign key dependants outside the pricing system** and no non-pricing purpose.

### 3a. Tables to DROP

```sql
DROP TABLE IF EXISTS public.item_prices CASCADE;
DROP TABLE IF EXISTS public.card_price_history CASCADE;
DROP TABLE IF EXISTS public.collection_value_snapshots CASCADE;
```

| Table | Columns | Active Usage |
|-------|---------|--------------|
| `public.item_prices` | `id, item_id, item_type, variant, price, currency, source, updated_at, cm_30d_avg_eur, cm_7d_avg_eur` | All price API routes, analytics, portfolio-value, most-expensive-card |
| `public.card_price_history` | `id, card_id, variant_key, price_usd, source, recorded_at, is_graded, grade, grading_company` | `/api/prices/history/[cardId]`, Pro analytics performers |
| `public.collection_value_snapshots` | `id, user_id, snapshot_date, total_value_eur, card_count, set_count, created_at` | Portfolio history/snapshot analytics routes |

> **Note on CASCADE:** `card_price_history` has `card_id uuid REFERENCES public.cards(id) ON DELETE CASCADE`. `collection_value_snapshots` has `user_id uuid REFERENCES public.users(id) ON DELETE CASCADE`. Dropping with `CASCADE` is safe.

### 3b. Columns to DROP from Shared Tables

```sql
ALTER TABLE public.sets DROP COLUMN IF EXISTS prices_last_synced_at;
```

| Column | Table | Used by |
|--------|-------|---------|
| `prices_last_synced_at` | `sets` | Cron scheduler (`/api/cron/price-sync`) only — orders sets by sync staleness |

**Index to drop separately** (already dropped by column DROP but explicit for clarity):
```sql
DROP INDEX IF EXISTS public.idx_sets_prices_last_synced_at;
```

### 3c. All Indexes on Dropped Tables (auto-dropped by CASCADE, listed for documentation)

| Index | Table | Purpose |
|-------|-------|---------|
| `idx_item_prices_lookup` | `item_prices` | Primary (item_id, item_type, variant) lookup |
| `idx_item_prices_updated_at` | `item_prices` | TTL freshness check |
| `item_prices_item_id_idx` | `item_prices` | Single-column item_id lookup |
| `item_prices_item_type_idx` | `item_prices` | Filter by type |
| `item_prices_updated_at_idx` | `item_prices` | Freshness ordering |
| `cph_card_id_recorded_idx` | `card_price_history` | Card + date range lookup |
| `cph_card_variant_idx` | `card_price_history` | Card + variant + date |
| `cph_source_idx` | `card_price_history` | Source filter |
| `cvs_user_date_idx` | `collection_value_snapshots` | User + date range lookup |

### 3d. RLS Policies (auto-dropped with their tables)

| Policy | Table |
|--------|-------|
| `item_prices: public read` | `item_prices` |
| `item_prices: service_role write` | `item_prices` |
| `item_prices_public_read` | `item_prices` (schema.sql version) |
| `item_prices_admin_write` | `item_prices` (schema.sql version) |
| `card_price_history_public_read` | `card_price_history` |
| `card_price_history_admin_insert` | `card_price_history` |
| `card_price_history_admin_delete` | `card_price_history` |
| `Users can read own snapshots` | `collection_value_snapshots` |
| `Service role manages snapshots` | `collection_value_snapshots` |

---

## 4. Database Objects — Uncertain / Shared

> These objects have pricing-sounding names or were created for pricing, but may be shared or referenced by non-pricing code. **Do NOT remove without further investigation.**

| Object | Type | Why Uncertain | Decision |
|--------|------|---------------|----------|
| `cards.tcggo_id` | Column (integer) | Added for TCGGO price lookups. The `migration_pricing_teardown.sql` **explicitly preserved it** as "required for post-reset price lookups." No non-pricing code reads it except for price display. However, it has no FK dependencies and is purely an identifier. | **Flag for Phase 3 review.** Removing it requires verifying no admin import pipeline writes it. |
| `cards_tcggo_id_idx` | Index | Supports `cards.tcggo_id` lookups | Remove only if `tcggo_id` column is also removed. |
| `sets.api_set_id` | Column (text) | TCGGO episode ID for price syncing. Preserved by teardown migration. No FK. No non-pricing code reads it. | **Flag for Phase 3 review.** Safe to drop after all sync code is removed, but do it in a separate migration. |
| `users.preferred_currency` | Column (text) | Also used by trade proposals — `trade_proposals.currency_code` defaults from this field, and the trade page lets users pick a cash currency. The `FriendCardPickerModal` and `TradeProposalCard` both reference it. | **DO NOT REMOVE.** Keep permanently — it serves a non-pricing function. |
| `set_products.api_product_id` | Column (text) | TCGGO product ID for price sync back-fill. However, it is also the `UNIQUE` constraint key for the product catalog (`set_products_api_product_id_key`) and prevents duplicate catalog entries. | **DO NOT REMOVE.** Structural catalog identity, not purely pricing. |
| `cards.api_id` | Column (text) | Added by `migration_card_prices.sql` for pokemontcg.io price matching. The teardown migration explicitly kept it because admin card import tooling (`CardDataImport`, `BulkImageImport`) uses it to match API cards to DB cards. | **DO NOT REMOVE.** Non-pricing admin import purpose. |

---

## 5. Environment Variables

### Remove

| Variable | File | Why |
|----------|------|-----|
| `RAPIDAPI_KEY` | `.env.local` | API key for `cardmarket-api-tcg.p.rapidapi.com` (TCGGO). Only used by `lib/price_service.ts` and the admin sync routes. |
| `CRON_SECRET` | `.env.local` | Authenticates the `/api/cron/price-sync` endpoint. Once that route is removed there is nothing to authenticate. |

### Keep

| Variable | Why |
|----------|-----|
| `STRIPE_MONTHLY_PRICE_ID` | Stripe subscription price ID (not card pricing). |
| `STRIPE_ANNUAL_PRICE_ID` | Stripe subscription price ID (not card pricing). |
| `NEXT_PUBLIC_SUPABASE_URL` | Database connection. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Database connection. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB access. |
| All other env vars | Not pricing-related. |

---

## 6. Dependencies

### Remove from `package.json`

| Package | Current version | Why removable |
|---------|----------------|---------------|
| `recharts` | `^3.8.1` | Used **exclusively** by pricing/analytics charts: `PriceChart.tsx`, `PortfolioValueChart.tsx`, `ValueBySet.tsx`, `RarityBreakdown.tsx`. No non-pricing component imports it. |

### Keep (despite pricing-sounding names)

| Package | Why |
|---------|-----|
| `stripe` | Stripe subscription billing (not card pricing). |
| `pokemontcgsdk` | Admin card import from pokemontcg.io API (not pricing). |
| `cheerio` | Loaded as a dependency but no active non-pricing or pricing code uses it directly in the active codebase. Safe to remove independently, but not pricing-specific. |

---

## 7. Cron / Background Jobs

| Job | Location | Schedule | What it does |
|-----|----------|----------|--------------|
| `price-sync` | `vercel.json` → `/api/cron/price-sync` | `0 3 * * *` (03:00 UTC daily) | Picks the most-overdue set, fetches its card list from TCGGO, upserts into `item_prices`, stamps `prices_last_synced_at`. |

**Action required:**
1. Remove the cron entry from `vercel.json` (or delete the file if it is the only entry — currently it is).
2. Cancel/delete the corresponding cron-job.org or Vercel cron configuration in the project dashboard.
3. Remove `CRON_SECRET` from Vercel environment variables.

---

## 8. Plans Files Referencing Pricing

| File | Status |
|------|--------|
| [`plans/tcggo_pricing_architecture.md`](tcggo_pricing_architecture.md) | 100% pricing — architecture doc for the TCGGO integration. Archive or delete. |
| [`plans/pro_analytics.md`](pro_analytics.md) | Mostly pricing/analytics Pro features spec. Archive or delete after Phase 2. |
| [`plans/graded_cards.md`](graded_cards.md) | Graded card collection tracking (non-pricing: the `user_graded_cards` table and grading UI are NOT pricing). Review but likely keep. |

---

## 9. Summary Counts

| Category | Count |
|----------|-------|
| **Code files to remove entirely** | **31** |
| — API routes | 14 |
| — Admin page | 1 |
| — Components | 11 |
| — Lib files | 3 |
| — Hooks | 1 |
| — Type files | 1 |
| **Database migration files to archive/remove** | **16** |
| **Code files needing surgical edits** | **23** |
| **Database tables safe to DROP** | **3** |
| **Database columns safe to DROP** | **2** (`sets.prices_last_synced_at`, and optionally `sets.api_set_id` in Phase 3) |
| **Database objects uncertain / shared — do not touch** | **4** (`cards.tcggo_id`, `sets.api_set_id`, `users.preferred_currency`, `set_products.api_product_id`) |
| **Environment variables to remove** | **2** (`RAPIDAPI_KEY`, `CRON_SECRET`) |
| **npm dependencies to remove** | **1** (`recharts`) |
| **Cron jobs to cancel** | **1** (Vercel daily price-sync) |

---

## 10. Recommended Removal Order

The following order minimises mid-PR build failures:

```
Phase A — Delete pure pricing files (no dependants remain after Phase B)
  1. All API routes under app/api/prices/, app/api/admin/prices/, app/api/cron/, app/api/analytics/, app/api/users/[id]/portfolio-value, app/api/users/[id]/most-expensive-card
  2. lib/price_service.ts, lib/currency.ts, lib/analytics.ts, hooks/useItemPrice.ts, types/pricing.ts
  3. All analytics components (components/analytics/*), PriceChart.tsx, PriceSyncTool.tsx, app/admin/prices/page.tsx

Phase B — Surgical edits to shared files (removes all import references to Phase A files)
  4. components/CardGrid.tsx       — remove price tab, price state, currency prop
  5. components/CardTile.tsx       — remove price badge
  6. components/SetPageCards.tsx   — remove set-stats fetch + price stat cards
  7. components/dashboard/CollectionSpotlight.tsx — remove price sections
  8. components/ProductCard.tsx    — remove price display
  9. components/trade/TradeProposalCard.tsx — remove market price
  10. components/trade/FriendCardPickerModal.tsx — remove price sorting/display
  11. app/collection/page.tsx      — remove analytics section + collection value
  12. app/profile/[id]/page.tsx    — remove portfolio value
  13. app/set/[id]/page.tsx        — remove currency prop threading
  14. app/browse/page.tsx + BrowseClient.tsx — remove currency prop
  15. components/browse/BrowseTypeahead.tsx — remove tcgp_market display
  16. types/index.ts               — remove PriceHistoryPoint
  17. locales/en.ts + locales/nb.ts — remove pricing locale keys
  18. components/profile/SettingsForm.tsx — remove disabled price-source sections
  19. app/admin/page.tsx           — remove Price Sync menu card
  20. app/faq/page.tsx, app/upgrade/page.tsx, app/upgrade/success/page.tsx, components/upgrade/UpgradeModal.tsx — edit feature lists
  21. vercel.json                  — remove/empty cron entry
  22. components/admin/ProductImageGrid.tsx — edit stale text
  23. package.json                 — remove recharts

Phase C — Database (run after Phase B is deployed)
  24. DROP TABLE public.item_prices CASCADE;
  25. DROP TABLE public.card_price_history CASCADE;
  26. DROP TABLE public.collection_value_snapshots CASCADE;
  27. ALTER TABLE public.sets DROP COLUMN IF EXISTS prices_last_synced_at;
  28. DROP INDEX IF EXISTS public.idx_sets_prices_last_synced_at;

Phase D — Environment cleanup
  29. Remove RAPIDAPI_KEY from Vercel env vars
  30. Remove CRON_SECRET from Vercel env vars
  31. Cancel cron-job.org / Vercel cron for /api/cron/price-sync

Phase E — Optional Phase 3 review
  32. Evaluate cards.tcggo_id and sets.api_set_id for removal
```

---

*End of Pricing Removal Audit — Phase 1*
