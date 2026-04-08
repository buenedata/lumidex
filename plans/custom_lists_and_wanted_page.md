# Custom Lists & Wanted List Page — Implementation Plan

## Overview

Two interconnected features:

1. **Wanted List Page** — A dedicated `/wanted` page that displays all cards the user has starred (already tracked in `wanted_cards` table). The star icon in card modal gets a new dropdown UX.
2. **Custom Lists** — Users can create named lists (e.g. "Yuka Collection"), add cards to them from any card modal, and control public/private visibility per list.

---

## Architecture Diagram

```mermaid
graph TD
    CardModal[Card Modal Star Button] --> Dropdown[AddToListDropdown]
    Dropdown --> WantedToggle[Toggle Wanted List]
    Dropdown --> ListPicker[Choose a Custom List]
    ListPicker --> CreateNew[Create New List]
    ListPicker --> ExistingList[Add to Existing List]

    WantedToggle --> WantedAPI[/api/wanted-cards]
    ListPicker --> ListCardsAPI[/api/user-lists/listId/cards]
    CreateNew --> ListsAPI[/api/user-lists POST]

    WantedAPI --> WantedPage[/wanted page]
    ListsAPI --> ListsIndexPage[/lists page]
    ListCardsAPI --> ListDetailPage[/lists/listId page]
```

---

## Database Changes

### New Table: `user_card_lists`

```sql
CREATE TABLE public.user_card_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  is_public   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### New Table: `user_card_list_items`

```sql
CREATE TABLE public.user_card_list_items (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    uuid        NOT NULL REFERENCES public.user_card_lists(id) ON DELETE CASCADE,
  card_id    uuid        NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_card_list_items_list_card_key UNIQUE (list_id, card_id)
);
```

### New Column on `users`: `lists_public_by_default`

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lists_public_by_default boolean NOT NULL DEFAULT false;
```

This column drives the default `is_public` value when creating a new list, and is exposed in Settings and First Time Setup.

### RLS Policies

- **user_card_lists**: Owner can SELECT/INSERT/UPDATE/DELETE their own rows. Others can SELECT where `is_public = true`.
- **user_card_list_items**: Owner (via join to list) can INSERT/DELETE. Others can SELECT where list is public.

---

## API Routes

### `/api/user-lists` — List management

| Method | Description |
|--------|-------------|
| `GET`  | Returns all lists for the authenticated user (with card count per list) |
| `POST` | Creates a new list — body: `{ name, description?, is_public? }` |

### `/api/user-lists/[listId]` — Single list management

| Method   | Description |
|----------|-------------|
| `PATCH`  | Update list name, description, or is_public |
| `DELETE` | Delete the list (cascades items) |

### `/api/user-lists/[listId]/cards` — Cards in a list

| Method   | Description |
|----------|-------------|
| `GET`    | Returns full card data for all cards in the list |
| `POST`   | Add a card — body: `{ cardId }` |
| `DELETE` | Remove a card — body: `{ cardId }` |

### `/api/user-lists/card/[cardId]` — Lists containing a card

| Method | Description |
|--------|-------------|
| `GET`  | Returns all list IDs that contain the given cardId (for the authenticated user) |

This is used by the `AddToListDropdown` to show which lists already contain the currently open card (checkmark indicators).

---

## UI Components

### `AddToListDropdown` (new component)

**Location:** `components/lists/AddToListDropdown.tsx`

Replaces the direct `toggleWanted` call on the star button in `CardGrid`. When the star button is clicked, a popover/dropdown appears with:

```
★ Wanted List          [★ filled / ☆ empty toggle]
─────────────────────
My Lists
  ✓ Yuka Collection    [already in list — click to remove]
    Fire Types         [not in list — click to add]
─────────────────────
  + Create new list
  Manage lists →
```

- Clicking the **Wanted List row** toggles the existing `wanted_cards` behavior
- Clicking a **list row** adds/removes the card from that list (optimistic update)
- **+ Create new list** opens an inline input or a small modal to name the new list
- **Manage lists →** navigates to `/lists`

The star icon in the modal header fills yellow (★) if the card is in the wanted list OR in any custom list.

### `ListsManageModal` (new component)

**Location:** `components/lists/ListsManageModal.tsx`

Simple modal for managing lists (accessible from the dropdown "Manage lists →" or the `/lists` page):
- Edit list name / description / visibility toggle
- Delete list (with confirmation)

---

## Pages

### `/wanted` — Wanted List Page

**Location:** `app/wanted/page.tsx`

- Requires authentication (redirect to `/login` if not)
- Fetches all `wanted_cards` for the user and joins to card data
- Displays cards using `CardGrid` (the same component used on set pages)
- Supports sorting (by name, number, set) and search within the list
- Shows "Your wanted list is empty" empty state with CTA to browse cards

### `/lists` — Custom Lists Index

**Location:** `app/lists/page.tsx`

- Requires authentication
- Shows all user-created lists as cards with:
  - List name
  - Card count
  - Public/Private badge (🌐 / 🔒)
  - Preview thumbnails of first 3–4 cards
- "Create new list" button at the top
- Each card links to `/lists/[listId]`

### `/lists/[listId]` — List Detail Page

**Location:** `app/lists/[listId]/page.tsx`

- Works for both owner and public viewers (if list is public)
- Owner sees Edit/Delete controls
- Displays cards using `CardGrid`
- Shows list name, description, visibility badge, card count, and owner's display name (for public view)

---

## Settings Changes

### `SettingsForm` — New field

Add to `SettingsValues` interface and `defaultSettings`:

```ts
lists_public_by_default: boolean  // default: false
```

Add a toggle in the **Privacy** section of `SettingsForm` (under `profile_private`):

> **Default list visibility**
> New lists you create are Public / Private by default

### `SettingsModal` — Save new field

Include `lists_public_by_default` in the `PATCH` body sent to `/api/update-profile`.

### `FirstTimeSetupModal` — Privacy step

Add the same **Default list visibility** toggle to Step 2 (Privacy), after the existing Profile Private and Portfolio Value toggles.

---

## Navbar Changes

Add two new nav links for authenticated users:
- **Wanted** → `/wanted`
- **Lists** → `/lists`

These can sit alongside the existing Dashboard, Collection, Sets links.

---

## Updated Types (`types/index.ts`)

```ts
export interface UserCardList {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  card_count?: number
  created_at: string
  updated_at: string
}

export interface UserCardListItem {
  id: string
  list_id: string
  card_id: string
  added_at: string
}
```

Also add `lists_public_by_default?: boolean` to the `User` interface.

---

## File Checklist

| File | Action |
|------|--------|
| `database/migration_user_card_lists.sql` | New — tables + RLS |
| `database/migration_lists_public_by_default.sql` | New — users column |
| `database/schema.sql` | Update to include new tables + column |
| `types/index.ts` | Add `UserCardList`, `UserCardListItem`, update `User` + `SettingsValues` |
| `app/api/user-lists/route.ts` | New — GET/POST lists |
| `app/api/user-lists/[listId]/route.ts` | New — PATCH/DELETE list |
| `app/api/user-lists/[listId]/cards/route.ts` | New — GET/POST/DELETE list cards |
| `app/api/user-lists/card/[cardId]/route.ts` | New — GET lists containing card |
| `app/wanted/page.tsx` | New — Wanted List page |
| `app/lists/page.tsx` | New — Lists index page |
| `app/lists/[listId]/page.tsx` | New — List detail page |
| `components/lists/AddToListDropdown.tsx` | New — star button dropdown |
| `components/lists/ListsManageModal.tsx` | New — create/edit/delete lists |
| `components/CardGrid.tsx` | Update star button section (lines ~1192–1205) |
| `components/profile/SettingsForm.tsx` | Add `lists_public_by_default` field + toggle |
| `components/profile/SettingsModal.tsx` | Include field in save payload |
| `components/profile/FirstTimeSetupModal.tsx` | Add toggle to Privacy step |
| `components/Navbar.tsx` | Add Wanted + Lists nav links |
