# Dashboard Redesign Plan — "Fresh, Welcoming & Fun"

> **Goal:** Transform the dashboard from a bare stats + sets list into an exciting, living hub that showcases the full future vision of Lumidex (Trade, Marketplace, News) while making existing collection data feel premium and engaging.

---

## Current Problems

| Issue | Detail |
|---|---|
| Flat welcome header | Plain text, no personality, no visual identity |
| Boring stat boxes | 4 plain numbers, no icons, no colour, no visual hierarchy |
| Abrupt empty state | Nothing to do except "Browse Sets" |
| No future vision | Nothing hints at trading, marketplace, news |
| No personalisation | No avatar, no trainer rank, no achievement callout |

---

## New Dashboard Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  HERO BANNER  (avatar + greeting + trainer rank + key stats)    │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  QUICK ACTIONS  (Browse Sets · My Collection · Find a Card · …  │
│                  Wanted List · Wanted Board)                     │
└─────────────────────────────────────────────────────────────────┘
┌──────────────────────────┬──────────────────────────────────────┐
│  STATS  (4 stat cards)   │  SPOTLIGHT  (most-complete set)      │
│                          │  + next milestone card               │
└──────────────────────────┴──────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  WANTED BOARD  (trade match cards — always visible)             │
│  - empty state with CTAs when no matches                        │
│  - top 3 matches + "View all →" link when matches exist         │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  NEWS STORIES                                                   │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  COMING SOON  (3-col teaser cards)                              │
│  Trade Hub · Marketplace · TCG News                             │
└─────────────────────────────────────────────────────────────────┘
```

> **Note:** "Your Sets" was removed from the dashboard — it is available on the Profile and Collection pages.

---

## Section Specifications

### 1. Hero Banner
**File:** `components/dashboard/DashboardHero.tsx`

- Full-width panel with a subtle radial gradient background using the accent colour
- Left side: user avatar (circular, with ring glow), display name, time-contextual greeting (*Good morning / afternoon / evening, [name]!*)
- Trainer Rank badge derived from `totalCards`:
  - 0 → "New Trainer 🌱"
  - 1–99 → "Rising Trainer ⚡"
  - 100–499 → "Veteran Trainer 🔥"
  - 500–999 → "Elite Trainer 💎"
  - 1000+ → "Master Trainer 🏆"
- Inline stat chips (small pills): **[N] Cards · [N] Sets · [N]% avg completion**
- CTA button: "View My Profile" → `/profile/[userId]`
- Background: `bg-elevated` with a subtle `radial-gradient` from `accent-dim` at top-right

### 2. Stats Strip (redesigned)
**Stays in `app/dashboard/page.tsx` inline or extracted to `components/dashboard/DashboardStats.tsx`**

Replace the plain boxes with icon-backed stat cards:

| Stat | Icon | Colour | Value source |
|---|---|---|---|
| Cards Owned | 🃏 card stack SVG | `text-accent` | `userCardCountBySet` sum |
| Sets Tracked | 📦 box SVG | `text-accent` | `userSets.length` |
| Avg Completion | 🎯 target SVG | green `text-price` when ≥50% | computed per-set average |
| Sets Available | 🌐 globe SVG | `text-muted` | `pokemonSets.size` |

Each card gets a coloured left-border accent stripe (4 px) and a faint icon watermark.

### 3. Quick Actions Bar
**File:** `components/dashboard/QuickActions.tsx`

Horizontal scrollable row of action pills with icon + label:

- 🔍 **Find a Card** → `/browse`
- 📦 **Browse Sets** → `/sets`
- 🗂️ **My Collection** → `/collection`
- 👤 **My Profile** → `/profile/[userId]`
- ✨ **Add Cards** → opens the AddSet modal or `/sets`

Styled as `bg-surface border border-subtle rounded-xl` pills, hover triggers `bg-elevated` + accent border. Horizontally scrollable on mobile.

### 4. Your Sets (enhanced)
**Existing grid kept, add enhancements in-place**

- Section header gets a "Most Active" sort pill and "+ Add Set" button
- If a set was added in the last 7 days, show a `NEW` badge chip on the SetCard
- The set card already has a progress bar; add a small **completion ring** (SVG circle) overlaid on the logo area at `size=32px` showing `percentage` fill

### 5. Spotlight Panel (sidebar / below stats)
**File:** `components/dashboard/CollectionSpotlight.tsx`

Shows the **single most-complete set** the user is tracking:
- Set logo (large, centered)
- Set name + completion % as a prominent number
- "X cards to go" subline
- "Continue collecting →" CTA linking to `/set/[id]`
- Glows with accent shadow
- Falls back gracefully when user has no sets (shows "Start your first set")

### 6. Coming Soon Feature Teasers
**File:** `components/dashboard/ComingSoonFeatures.tsx`

Three equal-width cards in a responsive grid (1 col mobile, 3 col desktop):

#### Trade Hub 🔄
- **Headline:** "Trade with Friends"
- **Copy:** "List your duplicates, browse what your friends have, and make trades directly on Lumidex."
- **Badge:** `COMING SOON` in amber
- **Icon/Illustration:** Two arrows forming a circle (SVG inline)
- **Accent:** `border-amber-500/30` with `bg-amber-500/5` tint

#### Marketplace 🏪
- **Headline:** "Buy & Sell Cards"
- **Copy:** "A dedicated marketplace to buy, sell and price-check any Pokémon card in your local currency."
- **Badge:** `COMING SOON` in emerald
- **Icon/Illustration:** Price tag or storefront SVG
- **Accent:** `border-price/30` with `bg-price/5` tint

#### TCG News 📰
- **Headline:** "Pokémon TCG News"
- **Copy:** "Set reveals, tournament results, new products — all curated in one place for trainers."
- **Badge:** `COMING SOON` in sky-blue
- **Icon/Illustration:** Newspaper / RSS feed SVG
- **Accent:** `border-blue-500/30` with `bg-blue-500/5` tint

Each card has:
- Top: large emoji/SVG illustration area (`h-24`) with a faint radial glow
- Middle: headline (bold) + body copy (small, muted)
- Bottom: `COMING SOON` badge pill (outline style)
- Cursor: pointer — each card links to its own placeholder page
- Subtle shimmer animation on the badge (CSS `animate-pulse`)
- Hover: `border-[colour]/60` + `shadow-[glow]` lift effect

### Placeholder Pages (one per feature)

Each placeholder page lives at its own route and shares a common `ComingSoonPage` layout:

| Feature | Route |
|---|---|
| Trade Hub | `/trade` |
| Marketplace | `/marketplace` |
| TCG News | `/news` |

**Page anatomy** (same for all three):
- Navbar visible (standard)
- Hero area: large feature icon (SVG, `h-20 w-20`), feature name (h1), tagline
- Body copy: 2–3 sentences about what the feature will do, written engagingly
- Visual: a faint decorative illustration or repeated icon pattern in the background
- CTA: "Back to Dashboard" button + a greyed-out "Notify Me" button (UI only, not wired)
- Footer: "More features coming to Lumidex — stay tuned 🚀"
- Colour accent matches the teaser card (amber for Trade, green for Marketplace, blue for News)

### 7. Empty State (when no sets tracked)
When user has 0 sets, replace the current plain message with:
- Hero banner still shows (personalised)
- Quick Actions still shows
- Large centred empty card: illustration + "Your adventure begins here" heading + "Add your first Pokémon set to start tracking your collection" copy + big "Browse Sets" CTA
- Coming Soon teasers still show below (excites new users about what's coming)

---

## New File Structure

```
components/
  dashboard/
    DashboardHero.tsx        ← new
    DashboardStats.tsx       ← extracted from page
    QuickActions.tsx         ← new
    CollectionSpotlight.tsx  ← new
    ComingSoonFeatures.tsx   ← new
app/
  dashboard/
    page.tsx                 ← refactored to use the above
```

---

## Visual Design Notes

- **No new colours** — stay within the existing palette (`accent #6d5fff`, `price #34d399`, existing grays)
- **Amber** for Trade teaser: use Tailwind's `amber-400/amber-500` (one-off, inline, not a global token)
- **Sky-blue** for News teaser: use Tailwind's `sky-400` (one-off, inline)
- All new components use `Space Grotesk` for headings (already loaded)
- Animations: only `transition-all duration-200` and `animate-pulse` — no heavy Framer Motion needed

---

## Implementation Order

1. Create `components/dashboard/` directory structure
2. Build `DashboardHero.tsx` (reads `useAuthStore` for user + profile)
3. Build `DashboardStats.tsx` (extracted + enhanced from current page)
4. Build `QuickActions.tsx`
5. Build `ComingSoonFeatures.tsx`
6. Build `CollectionSpotlight.tsx`
7. Refactor `app/dashboard/page.tsx` to compose all components
8. Update skeleton loading state to match new layout
9. Verify empty state still works elegantly with new layout
