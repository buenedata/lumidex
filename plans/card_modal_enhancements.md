# Card Modal Enhancements Plan

## Overview

Enhancing the card details modal in `components/CardGrid.tsx` with:
1. **Price pill** — multi-variant line chart replacing the plain text list
2. **Trade pill** — new tab, placeholder UI for upcoming trading system
3. **Artist section** — artist name + "See more from this artist" below card image
4. **Wanted star** — star icon in modal header to add card to wanted list
5. **Friends pill** — new tab showing friends who own the card, with variant breakdown

---

## Current Modal Structure (CardGrid.tsx)

- `ModalTab = 'card' | 'price'`
- Left: `CardGlareImage` (389×543 px, holographic tilt)
- Right: header (name, set, number, close button) → tab bar → tab content
- Card tab: variant rows with quantity controls + "Missing a variant?" button + Other versions grid
- Price tab: plain text list of TCGPlayer/CardMarket/Graded prices

---

## Architecture Decisions

### 1. New Database Tables

#### `card_price_history`
Populated each time the admin price sync runs — one row per card per variant per sync date.
Variant key stored as text (`normal`, `reverse_holo`, `holo`, `1st_edition`).

```sql
CREATE TABLE public.card_price_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  variant_key text NOT NULL,   -- 'normal' | 'reverse_holo' | 'holo' | '1st_edition'
  price_usd   numeric(10,2) NOT NULL,
  source      text NOT NULL DEFAULT 'tcgplayer',  -- 'tcgplayer' | 'cardmarket'
  recorded_at timestamptz NOT NULL DEFAULT now()
);
```

The price sync route (`app/api/prices/sync/route.ts`) will INSERT a new history row for each non-null variant price on every sync. Queries for charts use a `recorded_at >= now() - interval` filter.

#### `wanted_cards`
One row per user-card pair. No quantity — binary wanted/not-wanted.

```sql
CREATE TABLE public.wanted_cards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  card_id    uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id)
);
```

#### `friendships`
Symmetric friendship model (both directions stored or single row with status).

```sql
CREATE TABLE public.friendships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending'  -- 'pending' | 'accepted' | 'declined' | 'blocked'
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);
```

### 2. New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/prices/history/[cardId]` | GET | Fetch variant price history rows for a card. Query params: `range` = `30d` / `3m` / `6m` / `1y` |
| `/api/wanted-cards` | GET | Returns current user's wanted card IDs |
| `/api/wanted-cards` | POST | Add a card to wanted list `{ cardId }` |
| `/api/wanted-cards` | DELETE | Remove a card from wanted list `{ cardId }` |
| `/api/friends/card/[cardId]` | GET | Returns accepted friends who own this card, with per-variant quantities |

### 3. New Component: `components/PriceChart.tsx`

A `'use client'` component wrapping recharts `LineChart`.

**Props:**
```ts
interface PriceChartProps {
  history: PriceHistoryPoint[]  // { date: string; variant: string; priceUsd: number }[]
  currency: string
  isLoading: boolean
}
```

**Features:**
- Time range tabs: 30 Days / 3 Months / 6 Months / 1 Year
- One line per variant, using Lumidex variant colors:
  - Normal → `#10b981` (green)
  - Reverse Holo → `#3b82f6` (blue)
  - Holo Rare → `#8b5cf6` (purple)
  - 1st Edition → `#f59e0b` (amber)
- Responsive container fills available width
- Custom tooltip showing date + variant + price
- Legend in top-right with variant color dots
- Y-axis uses `formatPrice(value, currency)`
- Grid lines use `border-subtle` color scheme
- Empty state: message + "Pricing history is on its way — check back soon 📊"

**Dynamic import** in CardGrid to avoid SSR issues:
```ts
const PriceChart = dynamic(() => import('@/components/PriceChart'), { ssr: false })
```

### 4. CardGrid.tsx Changes

#### Tab Type Extension
```ts
type ModalTab = 'card' | 'price' | 'trade' | 'friends'
```

#### Artist Section
Placed **below** `CardGlareImage` in the left column:
```
[ Card image with glare ]
─────────────────────────
🎨 GIDORA
See more cards from this artist →
```
- Artist name pulled from `selectedCard.artist`
- Link goes to `/browse?artist=<encoded-name>`
- Only shown if `selectedCard.artist` is non-null

#### Star (Wanted) Icon
Positioned in the modal **header row**, to the left of the close `✕` button:
- `★` (filled, gold) when in wanted list
- `☆` (outline) when not in wanted list
- Only visible to authenticated users
- Clicking calls `POST /api/wanted-cards` or `DELETE /api/wanted-cards`
- Optimistic UI: toggle immediately, revert on error

#### Redesigned Price Tab
Structure:
```
[ Time range tabs: 30 Days | 3 Months | 6 Months | 1 Year ]

[ PriceChart — line chart with variant lines ]

[ Current prices table ]
  Normal          $0.88
  Reverse Holo    $1.02
  Holo Rare       –

[ Source: TCGPlayer | CardMarket ]
[ Last synced: March 31, 2026 ]
```

When no history data exists:
```
[ 📊 icon ]
Price history is on its way.
We'll start recording it on the next sync — check back soon.

[ Current prices still shown if available ]
```

#### Trade Tab
Placeholder content:
```
🔄 Trading Coming Soon
Trade your duplicates with other Lumidex collectors.
[ We're building this feature — stay tuned! ]
```

#### Friends Tab
When user is authenticated and has accepted friends:
```
┌─────────────────────────────────────────┐
│ 🧑 trainerRed          Normal ×2        │
│ 🧑 mistyWave           Reverse Holo ×1  │
└─────────────────────────────────────────┘
```
Each row: avatar thumbnail, username, variant badges with counts.

When no friends own the card:
```
None of your friends have this card yet.
```

When not authenticated:
```
Sign in to see which friends have this card.
```

When friendships table is empty / no friends:
```
You haven't added any friends yet.
Find friends to trade with!
```

---

## File Change Summary

| File | Change Type | Notes |
|------|------------|-------|
| `database/migration_card_price_history.sql` | NEW | price history table + RLS + index |
| `database/migration_wanted_cards.sql` | NEW | wanted_cards table + RLS |
| `database/migration_friendships.sql` | NEW | friendships table + RLS |
| `app/api/prices/history/[cardId]/route.ts` | NEW | GET price history |
| `app/api/prices/sync/route.ts` | MODIFY | insert into card_price_history on sync |
| `app/api/wanted-cards/route.ts` | NEW | GET / POST / DELETE wanted cards |
| `app/api/friends/card/[cardId]/route.ts` | NEW | GET friends-who-own-card |
| `components/PriceChart.tsx` | NEW | recharts line chart component |
| `components/CardGrid.tsx` | MODIFY | all modal enhancements |
| `types/index.ts` | MODIFY | add PriceHistoryPoint type, confirm artist on PokemonCard |
| `package.json` | MODIFY | add recharts dependency |

---

## Data Flow Diagram

```
Admin runs price sync
        │
        ▼
app/api/prices/sync
  ├─ upserts card_prices (snapshot)
  └─ inserts card_price_history rows (one per variant per sync)
        │
        ▼
User opens card modal → clicks Price tab
        │
        ▼
CardGrid fetches /api/prices/card/[cardId]   (snapshot, existing)
CardGrid fetches /api/prices/history/[cardId] (new)
        │
        ▼
PriceChart renders lines from history
Current prices table renders from snapshot
```

```
User opens modal → clicks star icon
        │
        ├─ POST /api/wanted-cards { cardId }
        │         ├─ upserts wanted_cards row
        │         └─ returns { isWanted: true }
        │
        └─ DELETE /api/wanted-cards { cardId }
                  ├─ deletes wanted_cards row
                  └─ returns { isWanted: false }
```

```
User opens Friends tab
        │
        ▼
GET /api/friends/card/[cardId]
  1. Find accepted friendships for auth user
  2. For each friend: query user_card_variants JOIN variants
  3. Return [ { userId, username, avatarUrl, variants: [{name, quantity}] } ]
        │
        ▼
Friends tab renders user rows with variant badges
```

---

## Dependencies to Install

```json
"recharts": "^2.13.0"
```

recharts is the standard choice for React charting — well-maintained, tree-shakeable, SSR-compatible with dynamic import, and TypeScript-typed.

---

## Notes on Variant Color Mapping for Chart

The chart line colors mirror the existing Lumidex variant system:

| Variant | DB color key | Chart hex |
|---------|-------------|-----------|
| Normal | green | `#10b981` |
| Reverse Holo | blue | `#3b82f6` |
| Holo Rare | purple | `#8b5cf6` |
| 1st Edition | yellow/amber | `#f59e0b` |

---

## Implementation Order

1. Run DB migrations (price_history → wanted_cards → friendships)
2. Install recharts
3. Create API routes (history, wanted, friends)
4. Update price sync route
5. Create PriceChart component
6. Update CardGrid.tsx (tabs, artist, star, chart, trade, friends)
