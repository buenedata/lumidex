# Multi-Game Support Architecture Plan
## Lumidex: Expanding from Pokémon TCG to a Multi-Property Collector Platform

**Created:** 2026-08-13  
**Status:** Ready for implementation review  
**First new property:** Moomin (2025 Panini — The Wonderful World of Moomin)

---

## 0. Codebase Analysis Summary

Before designing anything, a full audit of the current Pokémon-specific assumptions was performed. The findings are the basis for every decision in this plan.

### What is genuinely game-agnostic today

These systems reference card/variant UUIDs directly and require **no structural changes** to support Moomin:

| System | Reason it's already generic |
|---|---|
| `user_card_variants` table | Stores `(user_id, card_id, variant_id, quantity)` — UUID FKs only |
| `user_cards` table | Same — UUID FK on `card_id` |
| `wanted_cards` table | `(user_id, card_id)` — UUID FK only |
| `trade_proposals` / `trade_proposal_items` | References `card_id` UUID |
| `user_card_lists` / `user_card_list_items` | References `card_id` UUID |
| `user_graded_cards` | References `card_id` and `variant_id` UUIDs |
| `friendships` | Purely user-to-user |
| `user_sets` | References `set_id` text — inherits game once sets.game exists |
| `lib/achievements.ts` | Counts `totalCards`, `completedSets`, etc. — no game filter |
| `card_variant_availability` | UUID-keyed override table — game-agnostic |
| `card_variant_images` | UUID-keyed — game-agnostic |
| RLS policies | Role-based, not game-based |
| Image storage (Cloudflare R2) | Flat key namespace — already works for any game |

### What is Pokémon-specific and must change

| Location | What is hardcoded |
|---|---|
| `database/schema.sql` — `sets` table | No `game` column; all sets implicitly Pokémon |
| `database/schema.sql` — `variants` seed | `pokeball`, `masterball` variants seeded globally |
| `lib/variants.ts` — `VariantType` union | `"pokeball" \| "masterball"` are Pokémon brand names |
| `lib/variants.ts` — `DEFAULT_VARIANTS` | Pokéball, Master Ball descriptions baked in |
| `lib/variants.ts` — `getAvailableVariantIds()` | Rarity rules: EX/V cards, secret rares, holo logic — Pokémon only |
| `lib/variantServer.ts` — `_batchFetchVariantStructure()` | Calls `getAvailableVariantIds()` without game context |
| `lib/utils.ts` — `PokemonType`, `typeGlowColors` | Full Pokémon element type system for card glow effect |
| `lib/utils.ts` — `getPokemonTypeForSet()` | Keyword map: "charizard", "pikachu", "aquapolis" etc. |
| `lib/utils.ts` — `getPokemonTypeForCard()` | Maps "Lightning" → electric, "Metal" → steel, etc. |
| `components/SetsPageClient.tsx` — `KNOWN_SERIES_ORDER` | All 20+ Pokémon TCG series names hardcoded |
| `components/SetsPageClient.tsx` — language toggle | Only `'en' \| 'ja'` — Pokémon-specific dual-language model |
| `lib/store.ts` | `pokemonSets`, `pokemonCards`, `fetchPokemonSets()`, `fetchPokemonCards()` |
| `types/index.ts` | `PokemonSet`, `PokemonCard` interface names |
| `lib/db.ts` | `DbSet` has no `game` field; `DbCard` has `api_id`/`tcggo_id` (Pokémon API IDs) |
| `app/sets/page.tsx` | `npm run import:pokemon` hint in empty state |
| `locales/en.ts` / `locales/nb.ts` | "Pokémon TCG" in footer, browse subtitle, news subtitle |
| `app/admin/card-data-import` | Scrapes pkmn.gg / pokemontcg.io — Pokémon-only |
| `lib/imageUpload.ts` | `PokemonCard` type import; `/pokemon_card_backside.png` fallback |
| `components/CardTile.tsx` etc. | `/pokemon_card_backside.png` fallback image used in ~15 files |
| `package.json` `import:pokemon` script | Named for Pokémon |
| `lib/achievements.ts` | Achievement name `'Living Pokédex'` (display only) |
| `data/stories.ts` | All stories are Pokémon content (CMS data, not architecture) |

---

## 1. Architectural Decision: `game` Column on `sets` Table

### Decision

Add a `game text NOT NULL DEFAULT 'pokemon'` column to the `sets` table.

Do **not** create a separate `games` table yet.

### Rationale

The full dependency chain is:

```
sets.game  →  sets.set_id  →  cards.set_id  →  (card_id UUID across all user tables)
```

Because `cards` inherit their set via `set_id`, and all user collection tables reference `card_id` (a UUID), adding `game` to `sets` alone is sufficient to:

- Filter `/sets` by game
- Filter `/cards` by game (via join)
- Filter user collection by game (via join chain)
- Drive game-specific variant rules
- Drive game-specific UI (series ordering, language toggles)

A separate `games` table can be introduced later if needed (e.g., for per-game configuration like display name, logo, slug validation). For now, the `game` text column is the right tradeoff between simplicity and extensibility.

### Valid values (enforced by app, not DB constraint initially)

| Value | Property |
|---|---|
| `'pokemon'` | Pokémon TCG |
| `'moomin'` | Moomin (Panini 2025) |

A `CHECK` constraint can be added later once the list stabilises.

---

## 2. Architectural Decision: Scoping Variants by Game

### Current state

The `variants` table stores a global catalog. The default seeded rows (`normal`, `reverse`, `holo`, `pokeball`, `masterball`) have `card_id = NULL` meaning they apply to every card. The application's `getAvailableVariantIds()` then filters them by Pokémon rarity rules.

### Decision

Add a `game text` column (nullable) to the `variants` table:

- `NULL` = truly global (applies to all games — e.g., `normal`)
- `'pokemon'` = Pokémon-only variants (e.g., `pokeball`, `masterball`)
- `'moomin'` = Moomin-only variants

Update the variant seed data:
- `normal` → `game = NULL` (universal)
- `reverse` → `game = 'pokemon'`
- `holo` → `game = 'pokemon'`
- `pokeball` → `game = 'pokemon'`
- `masterball` → `game = 'pokemon'`

For Moomin, seed only what is actually documented for the 2025 Panini set. Based on known characteristics of Panini sticker/card sets, start with:
- `normal` (inherited from global) — standard base cards
- `foil` (game='moomin', if confirmed in source data) — foil parallel versions

**Do not invent Moomin variants.** Only add variants once the checklist confirms they exist.

### Variant resolution in `batchFetchVariantStructure()`

The server-side batch resolver must become game-aware:

```
1. Fetch card's set → get set.game
2. Fetch global variants: WHERE game IS NULL OR game = {set.game}
3. Apply game-specific rarity fallback rules
```

This means:
- For Pokémon cards: existing rarity rules continue unchanged
- For Moomin cards: new simple rule (all cards get `normal` + any confirmed game-specific variants)

---

## 3. Moomin Data Research

### Source Discrepancy

Two sources list different card counts for "The Wonderful World of Moomin" (Panini 2025):

| Source | Count | Notes |
|---|---|---|
| Trading Card Database | 202 cards | Main set only |
| LastSticker | 212 cards | Likely includes extras |

The 10-card discrepancy (212 − 202 = 10) likely represents one of:

1. **Limited Edition parallel/foil variants** counted as separate cards (e.g., 10 LE foil versions of selected base cards)
2. **Insert cards** (special themed cards separate from the numbered main set)
3. **Promotional cards** distributed separately from retail
4. **Two distinct products** sold together in some markets (a main set + a smaller LE set)

### Recommended Pre-Import Research Steps

Before any import:

1. Obtain the LastSticker checklist for the 212-card version and identify which numbers 203–212 represent
2. Cross-reference with Trading Card Database (202-card list) to identify what is missing
3. Check Panini's official product page or press release for the set structure
4. Determine whether the 10 extra entries are:
   - Part of the same numbered set (1–212)
   - A separately numbered LE or insert subset
   - Foil/parallel variants of base set cards (which should be `variants`, not separate `cards`)

### Recommended Set Structure (pending research)

```
Game: moomin

Set A: "The Wonderful World of Moomin"
  set_id: moomin-wwm-2025
  setTotal: 202 (or confirmed main set count)
  series: "The Wonderful World of Moomin"
  release_date: 2025

Set B (if confirmed as separate product):
  "The Wonderful World of Moomin — Limited Edition"
  set_id: moomin-wwm-2025-le
  setTotal: 10 (or confirmed LE count)
  series: "The Wonderful World of Moomin"
```

If the 10 extra entries are foil variants of base set cards, they become variant rows under the existing 202 cards — not a second set.

### Card Fields for Moomin

The existing `cards` table supports Moomin well. Map Moomin data to the schema:

| Moomin concept | DB column |
|---|---|
| Card number (1, 2, ... 202) | `number` |
| Character name (e.g., "Moomintroll") | `name` |
| Card rarity / tier | `rarity` |
| Card image | `image` |
| Artist / illustrator | `artist` |
| — | `type` (Pokémon element type — leave `NULL` for Moomin) |
| — | `supertype` (Pokémon/Trainer/Energy — leave `NULL` for Moomin) |
| — | `hp` (leave `NULL` for Moomin) |
| — | `api_id`, `tcggo_id` (Pokémon API IDs — leave `NULL` for Moomin) |

The nullable Pokémon-specific columns (`type`, `supertype`, `hp`, `api_id`, `tcggo_id`) do not need to be removed. They simply remain `NULL` for Moomin cards, which is correct behaviour.

---

## 4. Phase Breakdown

### Phase 1 — Database Migration (Foundation)

**Goal:** Add game context to the database without breaking anything.

#### Migration 1: `migration_add_game_to_sets.sql`

```sql
-- Add game column to sets with 'pokemon' as the default
ALTER TABLE public.sets
  ADD COLUMN IF NOT EXISTS game text NOT NULL DEFAULT 'pokemon';

-- Index for efficient filtering by game
CREATE INDEX IF NOT EXISTS sets_game_idx ON public.sets(game);

-- No existing data needs updating — DEFAULT 'pokemon' covers all existing rows
```

#### Migration 2: `migration_add_game_to_variants.sql`

```sql
-- Add game column to variants (NULL = applies to all games)
ALTER TABLE public.variants
  ADD COLUMN IF NOT EXISTS game text;

-- Index for game-scoped variant queries
CREATE INDEX IF NOT EXISTS variants_game_idx ON public.variants(game);

-- Scope existing Pokémon-specific variants
UPDATE public.variants SET game = 'pokemon'
  WHERE key IN ('reverse', 'holo', 'pokeball', 'masterball')
  AND card_id IS NULL;

-- 'normal' stays NULL (universal)
-- 'custom' stays NULL (universal)

-- Seed Moomin-specific variants (add foil only if confirmed by source data)
INSERT INTO public.variants (name, key, color, is_quick_add, sort_order, is_official, game)
  VALUES ('Normal', 'normal', 'green', true, 1, true, NULL)  -- already exists, skip
ON CONFLICT (key) DO NOTHING;

-- Placeholder — only add once source data confirms foil exists:
-- INSERT INTO public.variants (name, key, color, is_quick_add, sort_order, is_official, game)
--   VALUES ('Foil', 'moomin-foil', 'blue', true, 2, true, 'moomin')
-- ON CONFLICT (key) DO NOTHING;
```

#### Migration 3: `migration_seed_moomin_sets.sql`

Insert the confirmed Moomin set(s) once the checklist research is complete:

```sql
INSERT INTO public.sets (set_id, name, series, "setTotal", "setComplete", release_date, game)
VALUES (
  'moomin-wwm-2025',
  'The Wonderful World of Moomin',
  'The Wonderful World of Moomin',
  202,  -- confirm from source data
  202,  -- confirm: 212 if all variants counted as cards, else 202
  '2025-01-01',  -- confirm exact date
  'moomin'
) ON CONFLICT (set_id) DO NOTHING;
```

#### Schema update: `database/schema.sql`

Add the `game` column documentation to the reference schema file.

---

### Phase 2 — Backend API Layer

**Goal:** All data-fetching helpers and API routes become game-aware.

#### 2.1 Update `DbSet` type in `lib/db.ts`

```typescript
export interface DbSet {
  id: string
  name: string
  series: string | null
  total: number | null
  setComplete: number | null
  release_date: string | null
  logo_url: string | null
  symbol_url: string | null
  created_at: string
  language: string | null
  game: string  // NEW — 'pokemon' | 'moomin' | ...
}
```

#### 2.2 Update `getSets()` in `lib/db.ts`

Add optional `game` parameter and update the SELECT to include the `game` column:

```typescript
export const getSets = unstable_cache(
  async (game?: string): Promise<DbSet[]> => {
    let query = supabase
      .from('sets')
      .select('id:set_id, name, series, total:setTotal, setComplete, release_date, logo_url, symbol_url, created_at, language, game')
      .order('release_date', { ascending: false })
      .limit(2000)

    if (game) query = query.eq('game', game)
    // ...
  },
  ['db:getSets'],
  { revalidate: 300, tags: ['sets'] },
)
```

Note: The cache key must incorporate the `game` argument to avoid cache collisions.

#### 2.3 Update `/api/sets` route

Add `?game=` query parameter support:

```typescript
// GET /api/sets?game=moomin
const game = request.nextUrl.searchParams.get('game') ?? undefined
const sets = await getSets(game)
```

#### 2.4 Update `/api/cards/search` route

Add `?game=` filter via join on `sets.game`:

```sql
-- Join cards → sets to filter by game
SELECT cards.* FROM cards
JOIN sets ON cards.set_id = sets.set_id
WHERE sets.game = $game
  AND cards.name ILIKE $query
```

#### 2.5 Update `getCardsBySet()` — no change needed

The function already takes `setId` as input. Game filtering happens at the sets layer.

#### 2.6 Game constants file

Create `lib/games.ts`:

```typescript
export const GAMES = {
  pokemon: {
    slug: 'pokemon',
    name: 'Pokémon TCG',
    shortName: 'Pokémon',
    cardBackImage: '/pokemon_card_backside.png',
  },
  moomin: {
    slug: 'moomin',
    name: 'Moomin',
    shortName: 'Moomin',
    cardBackImage: '/moomin_card_backside.png',  // create this asset
  },
} as const

export type GameSlug = keyof typeof GAMES

export function getCardBack(game: string): string {
  return GAMES[game as GameSlug]?.cardBackImage ?? '/pokemon_card_backside.png'
}
```

This replaces the 15+ hardcoded `/pokemon_card_backside.png` references with `getCardBack(card.game)`.

---

### Phase 3 — Variant System Refactoring

**Goal:** `getAvailableVariantIds()` and the server-side batch resolver become game-aware. Pokémon rarity rules are unchanged.

#### 3.1 Game-aware variant resolution strategy

Create a strategy pattern in `lib/variants.ts`:

```typescript
/**
 * Returns variant IDs applicable to a card based on its game.
 * Pokémon uses rarity-based rules.
 * Moomin uses a simple flat rule (all cards → normal; foil if confirmed).
 */
export function getAvailableVariantIdsForGame(
  game: string,
  card: { number: string; name?: string; rarity?: string },
  setTotal: number,
  allVariants: Variant[],
): string[] {
  switch (game) {
    case 'pokemon':
      return getAvailableVariantIds(card, setTotal, allVariants)
    case 'moomin':
      return getMoominVariantIds(allVariants)
    default:
      // Unknown game: fall back to just 'normal'
      return allVariants.filter(v => v.key === 'normal').map(v => v.id)
  }
}

function getMoominVariantIds(allVariants: Variant[]): string[] {
  // Moomin cards get 'normal' only (add 'moomin-foil' once confirmed)
  return allVariants
    .filter(v => v.key === 'normal' || v.key === 'moomin-foil')
    .map(v => v.id)
}
```

#### 3.2 Update `lib/variantServer.ts`

The `_batchFetchVariantStructure()` function must:
1. Fetch `sets.game` for the card set (already fetches set data for `setTotal`)
2. Pass `game` into the variant resolution strategy
3. Only fetch variants where `game IS NULL OR game = {set.game}`

The fetch of `cards.sets!inner(setTotal)` becomes `cards.sets!inner(setTotal, game)`.

#### 3.3 Update `VariantType` union

Remove Pokémon brand names from the union type. The `VariantType` union was only used in the legacy path — replace with the `key: string` approach already used by the DB-first variant system:

```typescript
// Keep for legacy backward compatibility only
export type VariantType = "normal" | "reverse" | "holo" | "pokeball" | "masterball" | "custom"
```

No immediate rename needed — this is a type alias used internally, not in the database.

---

### Phase 4 — Frontend UI Changes

**Goal:** Users can browse, filter by game, and collect Moomin cards. Pokémon is unchanged.

#### 4.1 Game selector on `/sets` page

Add a game selector as the top-level filter in `SetsPageClient`:

```
[ Pokémon TCG ]  [ Moomin ]
```

When "Pokémon TCG" is selected:
- Show the existing language toggle (EN / JA)
- Show the existing `KNOWN_SERIES_ORDER` series pills
- Behavior unchanged from today

When "Moomin" is selected:
- Hide the language toggle (Moomin has no dual-language variant)
- Show Moomin series pills (initially: "The Wonderful World of Moomin")
- `KNOWN_SERIES_ORDER` does not apply

Store the selected game in `localStorage` key `lumidex_selected_game` (default: `'pokemon'`).

#### 4.2 Move `KNOWN_SERIES_ORDER` into a game config

```typescript
// In lib/games.ts or SetsPageClient.tsx
const POKEMON_SERIES_ORDER: Record<string, number> = {
  'Base Set': 100,
  // ... existing entries unchanged
  'Scarlet & Violet': 220,
}

export function getSeriesOrder(game: string): Record<string, number> {
  if (game === 'pokemon') return POKEMON_SERIES_ORDER
  return {}  // Other games: sort by date only
}
```

#### 4.3 Zustand store updates in `lib/store.ts`

The store currently has `pokemonSets: Map<string, PokemonSet>` and `pokemonCards: Map<string, PokemonCard[]>`. These should evolve to a game-keyed structure:

```typescript
// Phase 4 approach: keep pokemonSets for backward compat, add a generic tcgSets
tcgSets: Map<string, TcgSet>   // all games combined, or game-keyed
// OR: use a game-keyed outer map:
setsByGame: Map<string, Map<string, TcgSet>>  // game → setId → set
```

**Recommended minimal approach** (avoids breaking all consumers):
- Keep `pokemonSets` and `fetchPokemonSets()` working identically
- Add `fetchSetsByGame(game: string)` that returns sets filtered by game
- Migrate consumers gradually across Phase 4 and 5

#### 4.4 Type renaming (non-breaking)

Add type aliases in `types/index.ts` so the rename is additive not destructive:

```typescript
// Rename PokemonSet → TcgSet, keep alias for backward compat
export interface TcgSet {
  id: string
  name: string
  series: string | null
  total: number | null
  setComplete?: number | null
  release_date: string | null
  logo_url?: string | null
  symbol_url?: string | null
  created_at: string
  game: string  // NEW
  user_card_count?: number
}

// Backward compat alias — remove after all consumers are updated
export type PokemonSet = TcgSet

// Rename PokemonCard → TcgCard
export interface TcgCard {
  // ... same fields as PokemonCard today
  // api_id and tcggo_id remain (nullable, Pokémon-specific, just unused for Moomin)
}

export type PokemonCard = TcgCard  // backward compat alias
```

#### 4.5 Card glow system for Moomin

`lib/utils.ts` exports `getPokemonTypeForSet()` which drives the visual glow effect on set cards. For Moomin, this function should return a neutral/Moomin-appropriate color:

```typescript
export function getCardGlowForSet(set: TcgSet): string {
  if (set.game === 'moomin') {
    // Moomin uses a warm teal/mint palette consistent with Moomin branding
    return 'rgba(94, 197, 180, 0.65)'
  }
  // Pokémon: existing keyword-based logic unchanged
  const type = getPokemonTypeForSet(set)
  return typeGlowColors[type]
}
```

#### 4.6 Card back image

Create a Moomin-appropriate card back image (or use a generic Lumidex card back). Place at `public/moomin_card_backside.png`. Update `getCardBack()` in `lib/games.ts` to return the correct fallback per game.

#### 4.7 Navigation / collection pages

On `/collection`, `/dashboard`, and `/profile/[id]` pages, the set list is currently driven by `pokemonSets`. After Phase 4 this should display sets from all games, with an optional game filter:

```
My Collection

All  |  Pokémon  |  Moomin
─────────────────────────────
[Set cards from filtered game]
```

The filter state lives in component state or URL params (`?game=moomin`).

#### 4.8 i18n / locale strings

Update `locales/en.ts` and `locales/nb.ts`:

| Key | Old | New |
|---|---|---|
| `footer_brand_description` | "...Pokémon TCG collection..." | "...trading card collection..." |
| `browse_subheadline` | "Search the complete Pokémon TCG catalogue" | "Search the complete card catalogue" |
| `news_subtitle` | "...Pokémon TCG world." | "...trading card world." |
| `footer_disclaimer` | "Not affiliated with Nintendo, The Pokémon Company..." | "Not affiliated with Nintendo, The Pokémon Company, Moomin Characters Ltd., or any card game publishers." |

---

### Phase 5 — Admin Import Tooling for Moomin

**Goal:** Admins can import Moomin card data without using the Pokémon-specific pkmn.gg scraper.

#### 5.1 New admin page: Generic Card Import

Add `/admin/card-import` (alongside the existing `/admin/card-data-import` which remains for Pokémon).

The new page provides:
1. **Game selector** — choose the target game (`pokemon` or `moomin`)
2. **Set selector** — choose which set to import into
3. **CSV/JSON upload** — paste or upload the card checklist

For Moomin specifically, accept CSV with columns:
```
number, name, rarity, artist, image_url
```

The import process:
1. Parse and validate the CSV
2. Deduplicate against existing cards in the set (`ON CONFLICT (set_id, number) DO NOTHING` or update)
3. Download and compress images to R2 (reusing existing `downloadAndStoreCardImage()`)
4. Report results: inserted / skipped / errors

This is **idempotent** — safe to re-run. Existing cards are skipped; only new/updated cards are written.

#### 5.2 New API route: `POST /api/admin/import-cards`

```typescript
// Body: { game: string, setId: string, cards: CardRow[] }
// Returns: { inserted: number, skipped: number, errors: string[] }
```

This route is called by both the new generic admin UI and can be used by future scripts.

#### 5.3 Existing Pokémon admin tools — no changes

The `/admin/card-data-import` page (pkmn.gg scraper) remains unchanged and Pokémon-specific. It is already clearly labeled for Pokémon use.

The admin hub at `/admin` gains a new entry:

```typescript
{
  href: '/admin/card-import',
  icon: '📋',
  title: 'Generic Card Import',
  description: 'Import card data via CSV/JSON for any game (Moomin, etc.). Idempotent — safe to re-run.',
  badge: 'Import',
}
```

---

### Phase 6 — Search and Browse Updates

**Goal:** Search and browse work across all games with appropriate filtering.

#### 6.1 `/api/cards/search` route

Add optional `?game=` param:

```typescript
// Join cards → sets to filter by game
const game = searchParams.get('game')
// Add .eq('sets.game', game) when game is specified
```

#### 6.2 Browse page (`/browse`)

The browse page at `app/browse/page.tsx` and `components/browse/BrowseClient.tsx` should gain a game filter (defaulting to `pokemon` for backward compat). A game selector pill appears at the top:

```
[ All games ]  [ Pokémon ]  [ Moomin ]
```

Results show game identity (a small badge or icon per card result).

#### 6.3 Artists page

`/artists` currently queries all cards. Consider whether artist attribution is meaningful for Moomin (it is — Panini cards have illustrators). No change required to the data model; Moomin cards with `artist` values will automatically appear.

---

### Phase 7 — Code Cleanup (Housekeeping)

These are non-functional cleanup tasks that improve long-term maintainability. Can be done last, or incrementally.

| Task | File(s) |
|---|---|
| Rename `pokemonSets` → `tcgSets` in Zustand store | `lib/store.ts` |
| Rename `fetchPokemonSets()` → `fetchSets()` with game param | `lib/store.ts` |
| Replace all `/pokemon_card_backside.png` literals with `getCardBack(game)` | 15 components |
| Update `lib/utils.ts` function names: `getPokemonTypeForSet` → `getCardGlowType` (or keep + add wrapper) | `lib/utils.ts` |
| Update `achievement` name `'Living Pokédex'` to `'Set Legend'` or similar (DB seed) | `database/migration_seed_achievements_v2.sql` |
| Remove `pokemontcgsdk` package if unused by non-admin routes | `package.json` |
| Rename `package.json` script `import:pokemon` → `import:pokemon-sets` or similar | `package.json` |

---

## 5. Migration Strategy for Existing Pokémon Data

All existing Pokémon data is **zero-risk** in this migration:

| Concern | Resolution |
|---|---|
| Existing `sets` rows | `game DEFAULT 'pokemon'` — all get `game = 'pokemon'` automatically |
| Existing `cards` rows | Unchanged — inherit game via set |
| Existing `variants` rows | `game` column added; seed script scopes Pokémon-specific ones to `game='pokemon'`; `normal` stays `NULL` (global) |
| Existing `user_card_variants` | Unchanged — UUID FKs already game-agnostic |
| Existing achievements | Unchanged — count-based, not game-filtered |
| Existing user_sets | Unchanged — set_id text FK; game inherited when queried |
| Existing wanted_cards | Unchanged |
| Existing trade_proposals | Unchanged |
| Cache invalidation | `getSets()` cache key includes `game` param; existing `db:getSets` cache key (no game param) continues to work |

**There is no rollback risk for Pokémon data.** Adding a column with a default, and adding a new table row, are both additive operations.

---

## 6. Database Schema Changes Summary

```sql
-- sets table:
ALTER TABLE public.sets ADD COLUMN game text NOT NULL DEFAULT 'pokemon';
CREATE INDEX sets_game_idx ON public.sets(game);

-- variants table:
ALTER TABLE public.variants ADD COLUMN game text;
CREATE INDEX variants_game_idx ON public.variants(game);
UPDATE public.variants SET game = 'pokemon'
  WHERE key IN ('reverse', 'holo', 'pokeball', 'masterball') AND card_id IS NULL;
```

Schema additions to `database/schema.sql`:
```sql
-- sets: add game column
game         text        not null default 'pokemon',

-- variants: add game column
game         text,           -- NULL = all games, 'pokemon'/'moomin' = game-specific
```

---

## 7. File-by-File Change Summary

### New files

| File | Purpose |
|---|---|
| `database/migration_add_game_to_sets.sql` | Adds `game` column to `sets` |
| `database/migration_add_game_to_variants.sql` | Adds `game` column to `variants`, rescopes seeds |
| `database/migration_seed_moomin_sets.sql` | Seeds Moomin set(s) after checklist confirmed |
| `database/migration_seed_moomin_cards.sql` | Seeds Moomin cards (generated from import) |
| `lib/games.ts` | `GAMES` config, `getCardBack()`, `GameSlug` type |
| `app/admin/card-import/page.tsx` | Generic card import admin UI |
| `app/api/admin/import-cards/route.ts` | Generic card import API route |
| `public/moomin_card_backside.png` | Moomin card back image asset |

### Modified files

| File | Change |
|---|---|
| `database/schema.sql` | Document new columns |
| `lib/db.ts` | Add `game` to `DbSet`; `getSets(game?)` param |
| `lib/variants.ts` | Add `getAvailableVariantIdsForGame()` strategy |
| `lib/variantServer.ts` | Pass game to variant resolution; filter variants by game |
| `lib/utils.ts` | Add `getCardGlowForSet()` wrapper; keep existing functions |
| `lib/store.ts` | Add game-aware set fetching; keep `pokemonSets` working |
| `types/index.ts` | Add `TcgSet`, `TcgCard`; keep `PokemonSet`/`PokemonCard` as aliases |
| `components/SetsPageClient.tsx` | Add game selector; extract series order to game config |
| `app/sets/page.tsx` | Pass game filter to `getSets()` |
| `app/api/sets/route.ts` | Support `?game=` param |
| `app/api/cards/search/route.ts` | Support `?game=` param |
| `locales/en.ts` | Generalize Pokémon-specific strings |
| `locales/nb.ts` | Generalize Pokémon-specific strings |
| `app/admin/page.tsx` | Add Generic Card Import to tool list |

---

## 8. Architecture Diagram

```
Lumidex Multi-Game Architecture
════════════════════════════════

                    ┌─────────────────────────────────┐
                    │           SUPABASE DB             │
                    │                                   │
                    │  games (future, optional)         │
                    │                                   │
                    │  sets                             │
                    │    set_id  ← text PK              │
                    │    game    ← 'pokemon'|'moomin'   │
                    │    name, series, language, ...    │
                    │         │                         │
                    │  cards   │                        │
                    │    id ← UUID PK                   │
                    │    set_id ← FK → sets.set_id      │
                    │    name, number, rarity, image    │
                    │    type, supertype, hp (Pkm only) │
                    │         │                         │
                    │  variants│                        │
                    │    id ← UUID PK                   │
                    │    game   ← NULL|'pokemon'|...    │
                    │    key, name, color               │
                    │         │                         │
                    │  user_card_variants               │
                    │    user_id, card_id, variant_id   │
                    │    quantity ← game-agnostic       │
                    └─────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
       ┌──────▼──────┐                 ┌──────▼──────┐
       │  POKÉMON TCG │                 │    MOOMIN    │
       │  (existing)  │                 │   (new)      │
       │              │                 │              │
       │  /sets?game= │                 │  /sets?game= │
       │   pokemon    │                 │   moomin     │
       │              │                 │              │
       │  Variants:   │                 │  Variants:   │
       │  normal      │                 │  normal      │
       │  reverse     │                 │  foil (TBD)  │
       │  holo        │                 │              │
       │  pokeball    │                 │  Rarity      │
       │  masterball  │                 │  rules:      │
       │              │                 │  all → normal│
       │  Rarity      │                 │              │
       │  rules:      │                 │  Series      │
       │  EX/V→holo   │                 │  order:      │
       │  secret rare │                 │  date-only   │
       │  holo rarity │                 │              │
       └──────────────┘                 └─────────────┘
```

---

## 9. Systems That Need No Changes

The following systems work correctly for Moomin without any modification:

| System | Why no change needed |
|---|---|
| **Wanted Board** | References `card_id` UUID — game-agnostic |
| **Trading** | References `card_id` UUID — Moomin cards are automatically tradeable |
| **Custom Lists** | References `card_id` UUID — Moomin cards can be added to lists |
| **Graded Cards** | References `card_id` UUID — Moomin cards can be graded |
| **Achievements** | Count-based thresholds — cross-game by design |
| **Set Progress / Completion** | Uses `setTotal`/`setComplete` from the `sets` row — game-agnostic |
| **RLS Policies** | Role and user-ID based — no game filtering needed |
| **Image Storage (R2)** | Flat key namespace — same upload pipeline |
| **Friendships** | User-to-user only |
| **Subscriptions / Pro tier** | User-level — not game-specific |
| **Stories / CMS** | Content table — Moomin stories can be added when ready |

---

## 10. Testing Checklist

### Pokémon regression tests (must pass after every phase)

- [ ] `/sets` loads all Pokémon sets in correct series order
- [ ] `/set/[id]` loads cards for a Pokémon set
- [ ] Variant dots appear correctly (normal/reverse/holo per rarity)
- [ ] Collection add/remove works
- [ ] Set completion percentage is correct
- [ ] Wanted board cards display
- [ ] Search returns Pokémon cards
- [ ] Admin card data import (pkmn.gg scraper) still works

### Moomin tests (after Phase 5 complete)

- [ ] Moomin set appears in `/sets?game=moomin`
- [ ] Moomin cards load in `/set/moomin-wwm-2025`
- [ ] Card images load (or fallback to Moomin card back)
- [ ] Collection quantities work (add/remove)
- [ ] Set completion shows correct progress (e.g., 0/202)
- [ ] Moomin cards appear in search results
- [ ] Game selector on `/sets` shows "Moomin" option
- [ ] Language toggle is hidden when viewing Moomin sets
- [ ] Moomin cards can be added to wanted list
- [ ] Moomin cards can be added to custom lists
- [ ] Moomin cards can be included in trade proposals

### Shared systems

- [ ] Authentication works
- [ ] RLS allows normal user operations
- [ ] Admin tools work
- [ ] Cache invalidation works after import

---

## 11. Remaining Limitations After This Plan

The following Pokémon-specific assumptions will remain after implementing all phases. They are documented here but not necessarily required to fix immediately:

| Remaining assumption | Impact | Priority |
|---|---|---|
| `type`, `supertype`, `hp`, `subtypes` columns in `cards` table | Pokémon-specific but nullable — no Moomin impact | Low |
| `api_id`, `tcggo_id` columns in `cards` table | Pokémon API identifiers — unused for Moomin | Low |
| `CardBulkVariantEditor` in admin — `typeFilter` is `'pokemon' \| 'trainer'` | Pokémon-specific type filter in admin variant editor | Low |
| `CollectionOnboardingModal` mentions "Reverse Holo, Cosmos Holo" | Pokémon variant names in onboarding — mild confusion for Moomin users | Medium |
| `achievement` name `'Living Pokédex'` | Display name only — rename in a future migration | Low |
| `user_graded_cards` — grading companies: PSA, BECKETT, CGC, TAG, ACE | Primarily relevant for Pokémon; Moomin cards can technically be graded but this is uncommon | Low |
| Artist bio API (`/api/artists/[name]/bio`) returns Pokémon TCG-focused text | AI-generated bio references Pokémon TCG — needs prompt update for Moomin artists | Medium |

---

## 12. Recommended Next Steps (Post-Implementation)

After implementing all phases above, these are the highest-value follow-on improvements:

1. **Moomin card page UX** — The existing card modal is heavily informed by Pokémon conventions (rarity display, element type glow). A game-aware card detail view that suppresses irrelevant Pokémon fields for Moomin cards would improve the user experience.

2. **Game-level landing pages** — `/pokemon` and `/moomin` dedicated pages with game-specific branding, set listing, and intro copy. Currently everything goes through `/sets?game=`.

3. **Games table** — If a third property is added (e.g., Disney Lorcana, One Piece), the `game` text column becomes harder to manage. A proper `games` table with `slug`, `display_name`, `logo_url`, `card_back_image_url` would be the right next step.

4. **Game filter in collection/dashboard** — Users with cards from multiple games need clear segmentation in their collection view, not just the sets browse page.

5. **Moomin-specific set completion rules** — If the Panini 2025 set has numbered parallels that count toward a "masterset" goal, the `collection_goal` system (`normal`/`masterset`/`grandmasterset`) may need Moomin-specific threshold definitions.

6. **Onboarding modal generalisation** — Update the `CollectionOnboardingModal` to not reference "Reverse Holo, Cosmos Holo" by name. Make it describe the concept of variants generically.

---

## 13. Key Architectural Decisions Summary

| Decision | Chosen approach | Rejected alternative | Reason |
|---|---|---|---|
| Game discrimination | `game` column on `sets` | Separate `games` table | YAGNI — simpler, avoids unnecessary joins for the 2-game case |
| Variant scoping | `game` column on `variants` | Separate variant tables per game | Single catalog with game filter is simpler and keeps all variant queries consistent |
| Variant rules engine | Strategy function per game slug | Class hierarchy / plugin system | Overkill for 2 games; simple switch statement is readable and debuggable |
| Type naming | Additive aliases (`TcgSet = PokemonSet`) | Big-bang rename | Zero risk to existing 100+ consumers; gradual migration possible |
| URL structure for game filtering | `?game=moomin` query param | `/moomin/sets` route segment | No routing changes, fully backward compatible, easily extensible |
| Moomin import | New generic CSV/JSON admin tool | Extend pkmn.gg scraper | Moomin has no external API; a scraper would be fragile and Pokémon-specific |
| Card back image | Per-game `getCardBack(game)` function | Single global `/card_backside.png` | Correct fallback per game without changing 15+ call sites immediately |
