# Card Modal Variant Controls + Browse Page Variant Dots

## Overview

Two related features:

1. **Card Details Modal (admin)** — expose Quick Add selection and variant dot visibility controls inline in the card modal (`CardGrid.tsx`), so admins don't need to visit the admin panel to configure per-card variant display.
2. **Browse Page Dots** — render variant color dots under each card image in `CardResults.tsx`, using the same data source as the set page.

---

## Current State

| Feature | Set Page (`CardGrid → CardTile`) | Browse Page (`CardResults`) |
|---|---|---|
| Variant dots shown | ✅ Yes | ❌ No |
| Quick Add indicator visible | ❌ No (used internally) | ❌ No |
| Quick Add settable in modal | ❌ No UI (only in `/admin/variants`) | — |
| Dot visibility settable in modal | ❌ No UI (only in `/admin/variants`) | — |

### Key mechanisms already in place

- **`cards.default_variant_id`** — FK → `variants.id`. Per-card quick-add override. Read by `CardGrid.tsx` (line ~1230) for the double-click behavior. Settable via `POST /api/card-variant-availability` body `{ defaultVariantId }`.
- **`card_variant_availability`** — join table (`card_id`, `variant_id`). Controls which global variant dots render for a card. Read by batch API (`/api/card-variant-availability?setId=`). Settable via same POST endpoint.
- **Admin modal edit popup** — already has `editForm.isQuickAdd` in state + sends it to `updateVariant()`, but **no UI field is rendered** for it.
- **`CardVariantEditor`** — full admin panel component already handles both default_variant_id selection and availability toggles, but only accessible from `/admin/variants`.

---

## Architecture

### No Database Changes Required

All the needed columns exist:
- `cards.default_variant_id` — per-card quick-add
- `variants.is_quick_add` — global quick-add fallback
- `card_variant_availability` — per-card dot visibility overrides

---

## Changes Required

### 1. `components/CardGrid.tsx` — Quick Add Indicator + Setter (admin)

**Goal:** Admins can see which variant is the quick-add for a card and change it without leaving the modal.

#### State additions
```ts
// Track per-card defaultVariantId locally (initially from card.default_variant_id)
const [modalDefaultVariantId, setModalDefaultVariantId] = useState<string | null>(null)
const [isSavingDefaultVariant, setIsSavingDefaultVariant] = useState(false)
```

#### UI changes — variant row (always visible to admin)
- Add a small **⚡** icon next to each variant row when that variant is the current quick-add
  - Resolution order (mirrors line ~1230): `modalDefaultVariantId ?? card.default_variant_id` → then `is_quick_add` flag → first in sort order
- The ⚡ icon is a **clickable button (admin only)**. Clicking it calls `handleSetQuickAdd(variantId)`.

#### New handler `handleSetQuickAdd(variantId)`
```ts
async function handleSetQuickAdd(variantId: string) {
  if (!selectedCard) return
  setIsSavingDefaultVariant(true)
  const res = await fetch('/api/card-variant-availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cardId: selectedCard.id,
      variantIds: currentModalVariantIds,   // preserve existing availability
      defaultVariantId: variantId,
    }),
  })
  if (res.ok) {
    setModalDefaultVariantId(variantId)
    // Also patch selectedCard in the cards array so CardTile picks it up
    setCards(prev => prev.map(c =>
      c.id === selectedCard.id ? { ...c, default_variant_id: variantId } : c
    ))
  }
  setIsSavingDefaultVariant(false)
}
```

#### Inside the edit popup (admin ✏️ panel)
Remove the hidden `isQuickAdd` from `editForm` (it's a global flag, not per-card). Instead add a **"Set as Quick Add for this card"** button that calls `handleSetQuickAdd`. This is less confusing than the global `is_quick_add` flag:

```
┌─ Edit Variant ─────────────────┐
│ Name       [___________]       │
│ Description[___________]       │
│ Sort order [___]               │
│ Color      ● ● ● ● ● ● ● ● ●  │
│                                │
│ [⚡ Set as Quick Add for card] │  ← new button, admin only
│                                │
│ [Save]  [Cancel]  [🗑]         │
└────────────────────────────────┘
```

When the variant IS already the quick-add, show instead: `[⚡ Current Quick Add]` (disabled, green tint).

---

### 2. `components/CardGrid.tsx` — Variant Dot Availability Panel (admin)

**Goal:** Admins can toggle which global variants are shown as dots for this card, without going to `/admin/variants`.

#### State additions
```ts
const [modalVariantAvailability, setModalVariantAvailability] = useState<{
  allGlobalVariants: Variant[]    // full global variant catalog
  selectedIds: Set<string>        // currently enabled IDs for this card
  hasOverrides: boolean
  isLoading: boolean
  isSaving: boolean
} | null>(null)
```

#### When the modal opens (existing `useEffect` that fetches variants)
After fetching the card's variants, also fetch:
```
GET /api/card-variant-availability?cardId=<id>
```
Populate `modalVariantAvailability` state.

#### Admin-only panel in the modal (below the variant list, above "Missing a variant?")
Only rendered when `isAdmin && modalVariantAvailability !== null`.

```
╔══ Variant Dot Display (Admin) ════════════════════════════╗
║ Controls which colored dots appear below this card on    ║
║ the set page and browse page.                             ║
║                                                           ║
║ ☑ Normal          ☑ Reverse Holo    ☑ Holo Rare          ║
║ ☐ Pokéball        ☐ Master Ball     ☐ Custom              ║
║                                                           ║
║ Status: ✦ Custom override active                         ║
║                                                           ║
║            [Save Display Config]  [Reset to Defaults]    ║
╚═══════════════════════════════════════════════════════════╝
```

Checkboxes map directly to `card_variant_availability` rows (same as the admin `CardVariantEditor`'s toggle section). Card-specific variants are always shown and listed separately (not toggleable here — deletion is via the existing delete flow in the variant row).

**Save handler** → POST `/api/card-variant-availability` with `{ cardId, variantIds: [...selectedIds] }`.

After save, update the `cardVariantDots` map so the tile dot buttons update immediately (same optimistic update pattern already used elsewhere in `CardGrid.tsx`).

---

### 3. `app/api/card-variant-availability/route.ts` — Accept `cardIds` param

**Goal:** Support batch-fetching variant configs for an arbitrary list of card IDs (needed by browse page).

Add a `cardIds` query parameter (comma-separated UUIDs):

```
GET /api/card-variant-availability?cardIds=uuid1,uuid2,...
```

Response shape: same as `setId` response:
```json
{ "byCard": { "<cardId>": { "variants": [...], "hasOverrides": bool, "cardSpecificVariants": [...] } } }
```

Implementation mirrors the existing `setId` branch but skips the "fetch cardIds from DB" step — the list is provided directly. Shared helper function can be extracted to avoid duplication.

---

### 4. `components/browse/types.ts` — Extend `CardSearchResult`

Add a `variants` field:

```ts
export interface CardSearchResult {
  id:                 string
  name:               string
  image_url:          string
  number:             string
  rarity:             string
  type:               string
  supertype:          string
  default_variant_id: string | null
  variants: {          // ← new
    id:          string
    name:        string
    color:       string
    short_label: string | null
    is_quick_add: boolean
    sort_order:  number
    card_id:     string | null  // null = global variant
  }[]
  set: {
    id:           string
    name:         string
    series:       string
    release_date: string
    logo_url:     string
  }
}
```

---

### 5. `app/api/cards/search/route.ts` — Include variant data

After fetching card rows, make a **secondary batch query** to get variant configs:

```ts
// After building `transformedCards`...
const cardIds = transformedCards.map(c => c.id)

// Fetch variant availability for all returned cards in one query
const { data: avaRows } = await supabase
  .from('card_variant_availability')
  .select('card_id, variants(id, name, color, short_label, is_quick_add, sort_order, card_id)')
  .in('card_id', cardIds)

// Also fetch any card-specific variants
const { data: specificRows } = await supabase
  .from('variants')
  .select('id, name, color, short_label, is_quick_add, sort_order, card_id')
  .in('card_id', cardIds)

// Build byCard map, attach to each transformed card
```

Cards with no `card_variant_availability` rows → return empty `variants: []` (client will show no dots, as expected for cards using rarity-defaults where no explicit override is set).

> **Note:** This makes 2 extra queries per search. Since search is already limited to 500 results and these are indexed joins, performance impact is minimal. The queries are NOT waterfalled (run in parallel via `Promise.all`).

---

### 6. `components/browse/CardResults.tsx` — Render variant dots

**Below the card image** (between `</Link>` and the card name section), add a row of color dots:

```tsx
{/* Variant dots */}
{card.variants.length > 0 && (
  <div className="flex gap-1 mt-1.5 flex-wrap px-0.5">
    {card.variants
      .sort((a, b) => a.sort_order - b.sort_order)
      .filter(v => v.card_id == null)  // global variants only (card-specific hidden in dots)
      .map(v => (
        <div
          key={v.id}
          title={v.name}
          className={`w-3 h-3 rounded-full shrink-0 ${COLOR_MAP[v.color] ?? 'bg-zinc-500'}`}
        />
      ))
    }
  </div>
)}
```

Dots are **display-only** (no click handler) on the browse page — same visual language as the dots on `CardTile`, but without collection interaction. Clicking the entire card tile still navigates to `/set/${card.set.id}?card=${card.id}`.

---

## Data Flow Diagram

```
Admin clicks ⚡ in card modal
        │
        ▼
POST /api/card-variant-availability
  { cardId, variantIds, defaultVariantId }
        │
        ├─► Updates card_variant_availability rows
        └─► Updates cards.default_variant_id
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
  Set Page CardTile       Browse CardResults
  (dot buttons +          (dot buttons,
   double-click QA)        display-only)
```

---

## File Change Summary

| File | Type of Change |
|------|---------------|
| `components/CardGrid.tsx` | Add ⚡ Quick Add icon + click handler; add Variant Dot availability panel (admin) |
| `app/api/card-variant-availability/route.ts` | Add `cardIds` batch param support |
| `components/browse/types.ts` | Add `variants[]` to `CardSearchResult` |
| `app/api/cards/search/route.ts` | Parallel-fetch variant data and attach to results |
| `components/browse/CardResults.tsx` | Render variant dot row below card image |

**No database migrations required.** All needed columns/tables already exist.

---

## Interaction Notes

- **Admin-only**: Both the ⚡ quick-add button and the Variant Dot Display panel are gated behind `isAdmin`.
- **No `isQuickAdd` field removed from global editForm**: It stays (it's used by `updateVariant` for global variant changes), but we clarify it as "global quick-add default" vs the new "Quick Add for this card" action.
- **Optimistic updates**: After setting quick-add or saving dot config, update `cardVariantDots` and the card's `default_variant_id` in the local React state immediately — same pattern as existing variant quantity changes in `CardGrid.tsx`.
- **Browse dots are display-only**: No collection state needed on browse page. Clicking elsewhere on the card tile links to the card modal as normal.
