# Browse Page Redesign — "Fun, Fast & Discoverable"

> **Goal:** Transform `/browse` from a bare server-side search-results dump into a rich, interactive discovery hub where users can instantly search cards, find artists, and explore products — with a beautiful landing state when no query is active.

---

## Current Problems

| Issue | Detail |
|---|---|
| No landing experience | Empty state just says "No search query specified" with a back link |
| Search-only entry via navbar | Users must know to type in the top-bar and hit Enter — no in-page search bar |
| No filter controls | Can only search by name or artist (set via URL param) — no type, rarity, set, or supertype filters |
| Confusing results UI | Results are rendered via `SetPageCards` which shows "Owned / Missing / Duplicates" tabs — meaningless on a browse page |
| No product search | Products are entirely separate at `/products` — browse doesn't surface them |
| No artist discovery | Artist search only works if you know to type `?artist=...` |
| Non-shareable searches | No way to link someone to a filtered search |
| Results page has no search bar | Modifying a search requires going back to the navbar |

---

## New Browse Page Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  HERO  (full-width, gradient bg)                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  "Find any card, artist or product"                     │   │
│  │  [ 🔍  Search...                                    ]   │   │
│  │  [ Cards ] [ Artists ] [ Products ]  ← mode tabs       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

── When no query ────────────────────────────────────────────────
┌────────────────────────┬────────────────────────────────────────┐
│  POPULAR SEARCHES       │  FEATURED ARTISTS                     │
│  Pikachu · Charizard   │  Mitsuhiro Arita  [3 card thumbs]     │
│  Mewtwo · Eeevee · ... │  Ken Sugimori     [3 card thumbs]     │
└────────────────────────┴────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  RECENT SETS  (3–4 set logo cards linking to /set/[id])        │
└─────────────────────────────────────────────────────────────────┘

── When query is active (Cards mode) ────────────────────────────
┌─────────────────────────────────────────────────────────────────┐
│  FILTER BAR  [Type ▾] [Rarity ▾] [Supertype ▾] [Set ▾]        │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  RESULTS HEADER   "42 cards for "pikachu" across 8 sets"       │
├─────────────────────────────────────────────────────────────────┤
│  CARD GRID  (image + name + set name + rarity badge)           │
│  (grouped by set — newest first, collapsible)                  │
└─────────────────────────────────────────────────────────────────┘

── When query is active (Artists mode) ──────────────────────────
┌─────────────────────────────────────────────────────────────────┐
│  ARTIST CARDS GRID                                             │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ [img] [img] [img]│  │ [img] [img] [img]│                   │
│  │ Mitsuhiro Arita  │  │ Ken Sugimori     │                   │
│  │ 847 cards        │  │ 214 cards        │                   │
│  └──────────────────┘  └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘

── When query is active (Products mode) ─────────────────────────
┌─────────────────────────────────────────────────────────────────┐
│  PRODUCT CARDS  (subset of ProductCard component)              │
│  Shows matching sealed products with type badge + price        │
└─────────────────────────────────────────────────────────────────┘
```

---

## URL / State Design

All search state lives in URL params so results are shareable and deep-linkable:

| Param | Values | Notes |
|---|---|---|
| `q` | string | The search query (replaces old `name` param) |
| `mode` | `cards` \| `artists` \| `products` | Default: `cards` |
| `type` | `Fire`, `Water`, etc. | Cards mode only |
| `rarity` | `Common`, `Rare`, etc. | Cards mode only |
| `supertype` | `Pokémon`, `Trainer`, `Energy` | Cards mode only |

The page is a **hybrid** component:
- `app/browse/page.tsx` is a **Server Component** — reads URL params, pre-fetches initial results server-side (for SSR/SEO and fast first paint)
- `components/browse/BrowseClient.tsx` is a **Client Component** — handles the interactive search bar, filters, and live results updates via `useRouter` + URL mutations (no full page reload for filter changes using `router.replace`)

---

## Component Plan

### New Files

#### `components/browse/BrowseClient.tsx`
The top-level client shell. Reads URL params via `useSearchParams`, manages local state for the search input (debounced), and composes all sub-components. Pushes updated URL params on query/filter change.

#### `components/browse/BrowseHero.tsx`
- Full-width gradient banner (matches dashboard `DashboardHero` visual style)
- Large search input (autofocused) with magnifier icon
- Mode tabs below: **Cards · Artists · Products** (pill-style, accent underline on active)
- Subtle radial accent glow background pattern (reuses `bg-elevated` + `radial-gradient`)
- Manages **two separate states**:
  - `inputValue` — live text as the user types (drives typeahead, 200ms debounce)
  - `committedQuery` — the URL `?q=` param (drives the full results grid, set on Enter or suggestion click)
- Renders `<BrowseTypeahead>` as an absolutely-positioned overlay below the input
- Marks input as `role="combobox"` with `aria-expanded` / `aria-autocomplete="list"` for accessibility

#### `components/browse/BrowseTypeahead.tsx`
Dropdown overlay that appears below the search bar when `inputValue.length >= 2`.

**Content per mode:**

| Mode | Suggestions shown |
|---|---|
| Cards | Up to 6 cards: mini image thumbnail, name, set name, number |
| Artists | Up to 5 artists: name, card count |
| Products | Up to 5 products: name, type badge, price |
| No mode yet | Mixed: 3 cards + 2 artists + 2 products in labelled sections |

**Key interactions:**
- `↑` / `↓` arrow keys cycle the highlighted suggestion
- `Enter` on a highlighted suggestion → navigate directly to that card/artist/product
- `Enter` with no highlight (or click "See all") → commit query to URL → show full results grid
- `Escape` or click-outside → close dropdown without committing
- Loading state: 3-row skeleton list while the API call is in-flight
- "No suggestions" state: friendly "No results for `{query}`" message

**API calls made by typeahead:**
- Cards: `GET /api/cards/search?q={inputValue}&limit=6` (200ms debounce)
- Artists: `GET /api/artists/search?q={inputValue}&limit=5` (200ms debounce)
- Products: client-side filter of pre-loaded product data (no extra HTTP call)

**Visual styling:**
- `absolute` below input, `z-50`, `w-full`, `rounded-xl`, `bg-elevated`, `border border-subtle`, `shadow-2xl`
- Each suggested row: `flex items-center gap-3 px-4 py-2.5 hover:bg-surface cursor-pointer`
- Highlighted row: `bg-accent/10 text-accent`
- Section labels (mixed mode): `text-xs text-muted uppercase tracking-wider px-4 pt-3 pb-1`
- Footer "See all" row: `border-t border-subtle text-accent text-sm px-4 py-2.5`

#### `components/browse/BrowseFilters.tsx`
- Shown only in `cards` mode when a query is active
- Horizontal scrollable chip row on mobile, flex-wrap on desktop
- Chips: **Type** (dropdown), **Rarity** (dropdown), **Supertype** (Pokémon / Trainer / Energy toggles)
- Active filters show as removable chips with an `×` button
- "Clear all" link appears when any filter is active

#### `components/browse/CardResults.tsx`
- Replaces the `SetPageCards` usage in the current browse page
- Groups results by set (newest first), with a collapsible set header showing set logo + name + count
- Each card: image thumbnail, name, number, rarity badge, set name
- Card click → opens the existing card modal (same as set page)
- "No results" state: friendly message + "Try: Pikachu, Charizard, Rayquaza" suggestions

#### `components/browse/ArtistResults.tsx`
- Grid of artist cards
- Each artist card: 3 sample card thumbnails (first 3 from results), artist name, total card count
- Clicking an artist card → sets `?mode=artists&q=[artist name]` which triggers a full artist cards view
- Clicking "See all cards →" on an expanded artist → navigates to `/browse?q=[name]&mode=artists`

#### `components/browse/ProductResults.tsx`
- Lightweight product search results
- Reuses the existing `ProductCard` component
- "Browse all products →" link to `/products`

#### `components/browse/BrowseDiscovery.tsx`
- Shown when no query is active (landing state)
- **Popular searches**: horizontal pill row of common card names (static, hardcoded)
- **Featured artists**: 3–4 artist cards (server-fetched — top artists by card count)
- **Recent sets**: 3–4 `SetCard`-style tiles of the newest sets (server-fetched)

---

## API Changes

### New: `GET /api/artists/search`

**Query params:** `q` (required), `limit` (default 20)

**Logic:**
```sql
SELECT artist, COUNT(*) as card_count,
       array_agg(image ORDER BY random() LIMIT 3) as sample_images
FROM cards
WHERE artist ILIKE '%{q}%'
  AND image IS NOT NULL
GROUP BY artist
ORDER BY card_count DESC
LIMIT 20
```

**Response:**
```json
{
  "artists": [
    {
      "name": "Mitsuhiro Arita",
      "card_count": 847,
      "sample_images": ["url1", "url2", "url3"]
    }
  ]
}
```

**File:** `app/api/artists/search/route.ts`

### Enhanced: `GET /api/cards/search`

Add optional filter params to the existing endpoint:
- `type` — filter by `cards.type`
- `rarity` — filter by `cards.rarity`
- `supertype` — filter by `cards.supertype`
- `limit` — configurable (default 100, max 500 for browse)

---

## Modified Files

### `app/browse/page.tsx`
- Keep as a **Server Component** for initial SSR
- Fetch initial results based on URL params (cards or artists)
- For empty state: fetch 4 newest sets + top 4 artists (by card count) for discovery content
- Pass everything to `<BrowseClient>` as props
- Remove the `searchCardsByArtist` / `searchCards` logic (move into API routes or the client)

---

## Design Details

### Visual Style (matches existing design system)
- Background: `var(--color-bg-base)` (`#0a0a0f`)
- Hero panel: `bg-elevated` + radial accent glow (same pattern as `DashboardHero`)
- Search input: styled like the navbar search but **large** (`h-12`, `text-base`, `rounded-xl`)
- Mode tabs: pill buttons with `bg-accent/15 text-accent` on active, `text-muted` on inactive
- Filter chips: `bg-elevated border border-subtle rounded-full px-3 py-1 text-sm`
- Active filter chip: `bg-accent/15 border-accent/50 text-accent`
- Card results grouped under set headers with set logo image
- Artist cards: `bg-elevated rounded-2xl` with a 3-image collage header

### Animations / Interactions
- Search input: debounce 300ms before triggering URL update
- Results: fade-in on mount (`opacity-0 → opacity-100 transition-opacity`)
- Loading state: skeleton cards (3-column grid of grey `rounded-xl` blocks)
- Filter chips: smooth `scale-95 → scale-100` on toggle

---

## Mermaid — Component Flow

```mermaid
graph TD
    A[app/browse/page.tsx - Server Component] -->|SSR initial data| B[BrowseClient.tsx - Client Component]
    B --> C[BrowseHero - search bar + mode tabs]
    B --> D{Query active?}
    D -->|No| E[BrowseDiscovery - popular searches + artists + recent sets]
    D -->|Yes - cards mode| F[BrowseFilters] --> G[CardResults]
    D -->|Yes - artists mode| H[ArtistResults]
    D -->|Yes - products mode| I[ProductResults]
    C -->|URL param update| B
    F -->|URL param update| B
    G -->|card click| J[Card Modal - existing]
    H -->|artist click| B
    I -->|product click| K[/products page]
```

---

## File Summary

| File | Action | Notes |
|---|---|---|
| `app/browse/page.tsx` | **Modify** | Thin server wrapper; passes SSR data to BrowseClient |
| `components/browse/BrowseClient.tsx` | **Create** | Client shell with URL state management |
| `components/browse/BrowseHero.tsx` | **Create** | Big search bar + mode tabs; owns inputValue vs committedQuery split |
| `components/browse/BrowseTypeahead.tsx` | **Create** | Dropdown suggestion overlay; keyboard navigable; mixed/per-mode results |
| `components/browse/BrowseFilters.tsx` | **Create** | Type / rarity / supertype filter chips |
| `components/browse/CardResults.tsx` | **Create** | Card grid grouped by set (replaces SetPageCards use) |
| `components/browse/ArtistResults.tsx` | **Create** | Artist cards with sample thumbnails |
| `components/browse/ProductResults.tsx` | **Create** | Sealed product search results |
| `components/browse/BrowseDiscovery.tsx` | **Create** | Landing state — popular + artists + recent sets |
| `app/api/artists/search/route.ts` | **Create** | New API: search artists by name with sample images + card count |
| `app/api/cards/search/route.ts` | **Modify** | Add `type`, `rarity`, `supertype` filter params + configurable `limit` |
