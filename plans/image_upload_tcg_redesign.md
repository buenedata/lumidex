# Image Upload Tool — TCG-Aware Redesign

## Goal

Redo the admin image upload tool so it works across all TCGs by gating every
upload flow behind a 3-step wizard:

1. **Choose TCG** (game picker)
2. **Choose a set** (filtered to the chosen TCG)
3. **Choose upload type** — Set Image *or* Card Image

Image compression and R2 upload behaviour stays unchanged.

---

## Current State

| Component | Problem |
|---|---|
| `SetSelector` | Fetches `/api/sets` — no game filter, shows ALL sets |
| `SetImageGrid` | Fetches `/api/sets` — no game filter |
| `SetSymbolGrid` | Fetches `/api/sets` — no game filter |
| `image-upload/page.tsx` | Separate tabs for Card Images and Set Images, no TCG context |

The `/api/sets` route already supports `?game=` filtering — the API is ready.

---

## New User Flow (unified wizard)

```
Step 1 ─ Choose TCG
  ┌──────────────┐  ┌──────────────┐
  │  🟡 Pokémon  │  │  🌊 Moomin   │  ← from GAMES registry
  └──────────────┘  └──────────────┘

Step 2 ─ Choose a set  [← Back]
  SetSelector filtered by selected game (?game=pokemon)
  Shows image-coverage status badges (✅ ⚠️ ❌)

Step 3 ─ Choose upload type  [← Back]
  ┌───────────────────┐  ┌───────────────────┐
  │  🗂️ Set Image     │  │  🖼️ Card Images   │
  │  Upload the set   │  │  Upload individual │
  │  logo/banner      │  │  card images       │
  └───────────────────┘  └───────────────────┘

After type selection ─ Upload UI (inline, no new page)
  Set Image  → SetImageGrid  + SetImageUploadModal
  Card Image → CardImageGrid + BulkImageImport + CardImageUploadModal
```

Breadcrumb trail shown at the top of step 2+: `Pokémon → Base Set → Card Images`

---

## Component Changes

### 1. `components/admin/SetSelector.tsx` — add `game` prop

```ts
interface Props {
  // ... existing props ...
  /** Optional TCG filter — passed as ?game= to /api/sets */
  game?: string
}
```

In the `useEffect`, build the fetch URL:
```ts
const url = game ? `/api/sets?game=${encodeURIComponent(game)}` : '/api/sets'
const setsRes = await fetch(url)
```

Add `game` to the `useEffect` dependency array so re-fetching happens when
the game changes.

---

### 2. `components/admin/SetImageGrid.tsx` — add `game` prop

Same change pattern as `SetSelector`:
```ts
interface Props {
  // ... existing props ...
  game?: string
}
```
Build the fetch URL with `?game=` when provided. Add `game` to deps.

---

### 3. `components/admin/SetSymbolGrid.tsx` — add `game` prop

Same pattern.

---

### 4. New `components/admin/GamePicker.tsx`

A small presentational component that reads `GAMES` from `lib/games.ts` and
renders a card for each TCG.

```tsx
interface Props {
  selectedGame: GameSlug | null
  onGameSelect: (slug: GameSlug) => void
}
```

Each card shows:
- TCG logo image (`game.logoUrl`)
- Display name (`game.displayName`)
- Short description (`game.description`)
- Highlighted border when selected

---

### 5. New `components/admin/ImageUploadWizard.tsx`

A self-contained component that manages the full 3-step wizard state and
renders the appropriate upload UI after step 3.

**State managed internally:**
```ts
step: 1 | 2 | 3 | 'card-upload' | 'set-upload'
selectedGame: GameSlug | null
selectedSetId: string | null
selectedSetName: string | null
imageType: 'set' | 'card' | null

// Upload UI state (moved from CardImagesTab / SetImagesTab):
selectedCard: CardGridItem | null
cardList: CardGridItem[]
cardModalOpen: boolean
cardGridRefreshKey: number
imageOverrides: Record<string, string>

selectedSet: SetGridItem | null
setList: SetGridItem[]
setModalOpen: boolean
setGridRefreshKey: number
```

**Step rendering:**
- Step 1 → `<GamePicker />`
- Step 2 → `<SetSelector game={selectedGame} showImageStatus />`
- Step 3 → Two option cards (Set Image / Card Image)
- `'set-upload'` → `<SetImageGrid game={selectedGame} />` + `<SetImageUploadModal />`
- `'card-upload'` → `<CardImageGrid />` + `<BulkImageImport />` + `<CardImageUploadModal />`

**Back navigation:** Each step has a breadcrumb / back button that resets to
the previous step. Going back from step 2 clears `selectedSetId`. Going back
from step 3 clears `imageType`.

---

### 6. `app/admin/image-upload/page.tsx` — update tabs

**Updated `TABS` array:**
```ts
const TABS = [
  { id: 'images',          label: 'Card & Set Images', icon: '🖼️' },  // NEW unified
  { id: 'set-symbols',     label: 'Set Symbols',       icon: '🔷' },
  { id: 'product-images',  label: 'Product Images',    icon: '📦' },
  { id: 'source-images',   label: 'Source Images',     icon: '🔗' },
] as const
```

The old `card-images` and `set-images` tabs are **removed** and replaced by the
single `images` tab which renders `<ImageUploadWizard />`.

---

### 7. `SetSymbolsTab` and `ProductImagesTab` — add game picker step

Both tabs currently use `SetSelector` / `SetSymbolGrid` to filter by set.
They should also gain a game picker as their first step so set lists are
pre-filtered by TCG.

**Pattern for both:**
```
Step 1: GamePicker
Step 2: SetSelector/SetSymbolGrid filtered by game
Step 3: Existing upload grid + modal
```

This can be achieved by adding local `selectedGame` state to each tab
component and passing it as the `game` prop to the set selector.

---

## Data Flow Diagram

```
ImageUploadWizard
  │
  ├─ Step 1: GamePicker
  │     GAMES registry → renders TCG cards
  │     onGameSelect → sets selectedGame
  │
  ├─ Step 2: SetSelector [game={selectedGame}]
  │     /api/sets?game={game} → filtered set list
  │     onSetSelect → sets selectedSetId / selectedSetName
  │
  ├─ Step 3: Type picker (Set Image | Card Image)
  │     sets imageType
  │
  ├─ set-upload branch
  │     SetImageGrid [game={selectedGame}]
  │       /api/sets?game={game}
  │     SetImageUploadModal
  │       /api/upload-set-image → R2 upload
  │
  └─ card-upload branch
        CardImageGrid [setId={selectedSetId}]
          /api/admin/cards/{setId}
        BulkImageImport [setId={selectedSetId}]
        CardImageUploadModal
          /api/upload-card-image → R2 upload
```

---

## Files Changed / Created

| File | Change |
|---|---|
| `components/admin/SetSelector.tsx` | Add optional `game` prop |
| `components/admin/SetImageGrid.tsx` | Add optional `game` prop |
| `components/admin/SetSymbolGrid.tsx` | Add optional `game` prop |
| `components/admin/GamePicker.tsx` | **New** — TCG selection cards |
| `components/admin/ImageUploadWizard.tsx` | **New** — 3-step wizard |
| `app/admin/image-upload/page.tsx` | Replace 2 tabs with wizard; add game step to Symbols + Products tabs |

No API routes or database changes are required.
