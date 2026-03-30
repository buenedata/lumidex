# Lumidex — Comprehensive Design Plan

> **Status:** Draft v1.0  
> **Stack:** Next.js 16 · TypeScript · Tailwind CSS v4 · Headless UI v2 · Supabase  
> **Principle:** Card art is the hero — the UI is the stage, not the show.

---

## 1. Design Identity & Brand

### Aesthetic Direction

Lumidex targets **premium collector** — the person who treats their binder like an investment portfolio. The visual language should feel like a fusion of:

- **Dark collector glass cabinet** — deep, rich backgrounds that make holographic card art sing
- **Finance / portfolio dashboard** — crisp data typography, clean stats, confident numbers
- **Modern gaming UI** — tight spacing, glowing accents, subtle motion

### Brand Differentiators vs. pkmn.gg

| Element | pkmn.gg | Lumidex |
|---|---|---|
| Accent colour | Golden yellow | Electric indigo-violet |
| Surface style | Flat dark | Glass morphism layers |
| Card hover | Subtle lift | Type-reactive glow (already implemented) |
| Stats display | Compact pills | Elegant stat strip |
| Sort controls | Yellow pill buttons | Indigo ghost pills with underline active state |

### Brand Personality

**Refined. Precise. Glowing.**  
Where pkmn.gg is utilitarian-functional, Lumidex is a collector experience — the difference between a spreadsheet and a gallery.

---

## 2. Color System

### CSS Custom Properties (replaces / expands `app/globals.css` `:root`)

```css
:root {
  /* ── Background layers ── */
  --bg-base:        #0a0a0f;   /* Near-black with a hint of indigo */
  --bg-surface:     #111118;   /* Card surfaces, panels */
  --bg-elevated:    #1a1a26;   /* Modals, dropdowns, hover surfaces */
  --bg-overlay:     rgba(10, 10, 15, 0.85); /* Backdrop blur overlays */

  /* ── Border system ── */
  --border-subtle:  #1e1e2e;   /* Hairline borders between sections */
  --border-default: #2a2a3d;   /* Card borders, input borders */
  --border-strong:  #3d3d56;   /* Active states, focused inputs */

  /* ── Text hierarchy ── */
  --text-primary:   #f0f0ff;   /* Slightly blue-white (not pure white) */
  --text-secondary: #9191b0;   /* Secondary labels */
  --text-muted:     #5a5a78;   /* Placeholder, disabled, metadata labels */
  --text-inverse:   #0a0a0f;   /* Text on bright accent backgrounds */

  /* ── Brand accent — Electric Indigo ── */
  --accent:         #6d5fff;   /* Primary brand: electric indigo-violet */
  --accent-hover:   #8577ff;   /* Lighter on interaction */
  --accent-muted:   #2d2651;   /* Subtle accent background tint */
  --accent-glow:    rgba(109, 95, 255, 0.25); /* Box-shadow glow colour */

  /* ── Semantic colours ── */
  --success:        #34d399;   /* Price text, "Have" badge: emerald green */
  --success-muted:  #0d3326;
  --warning:        #fbbf24;   /* Cautionary badges */
  --warning-muted:  #3a2d0a;
  --danger:         #f87171;   /* Error states */
  --danger-muted:   #3b0f0f;
  --info:           #60a5fa;   /* Informational */

  /* ── Progress / collection ── */
  --progress-track: #1e1e2e;
  --progress-fill:  linear-gradient(90deg, #6d5fff, #a78bfa);

  /* ── Variant button colours (card item quick-add) ── */
  --variant-normal:      #6b7280; /* gray-500 */
  --variant-reverse:     #3b82f6; /* blue-500 */
  --variant-holo:        #a855f7; /* purple-500 */
  --variant-pokeball:    #ef4444; /* red-500 */
  --variant-masterball:  #8b5cf6; /* violet-500 */
  --variant-special:     #f59e0b; /* amber-500 */
}
```

### Tailwind Integration (Tailwind v4 — `@theme` block)

In `app/globals.css`, after `@import "tailwindcss"`:

```css
@theme {
  --color-bg-base:       #0a0a0f;
  --color-bg-surface:    #111118;
  --color-bg-elevated:   #1a1a26;
  --color-accent:        #6d5fff;
  --color-accent-hover:  #8577ff;
  --color-accent-muted:  #2d2651;
  --color-success:       #34d399;
  --color-text-primary:  #f0f0ff;
  --color-text-secondary:#9191b0;
  --color-text-muted:    #5a5a78;
  --color-border:        #2a2a3d;
  --color-border-strong: #3d3d56;
}
```

This lets you use utilities like `bg-bg-surface`, `text-accent`, `border-border` etc. directly in Tailwind classes.

---

## 3. Typography

### Font Stack

Add **Space Grotesk** (display / headings) alongside existing Inter (body).

```tsx
// app/layout.tsx
import { Inter, Space_Grotesk } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700']
})
```

- **Display / H1–H2:** Space Grotesk — feels techy, slightly wide, premium
- **Body / UI:** Inter — familiar, crisp, readable at small sizes
- **Monospace (card numbers, prices):** `font-mono` / system monospace — numbers align cleanly

### Type Scale (CSS custom properties)

```css
:root {
  --text-xs:   0.75rem;   /* 12px — card numbers, metadata labels */
  --text-sm:   0.8125rem; /* 13px — secondary body */
  --text-base: 0.9375rem; /* 15px — primary body (slightly larger than 14px) */
  --text-lg:   1.125rem;  /* 18px — section headings */
  --text-xl:   1.375rem;  /* 22px — page titles */
  --text-2xl:  1.75rem;   /* 28px — hero titles */
  --text-3xl:  2.25rem;   /* 36px — stat callouts */
}
```

---

## 4. Component-by-Component Design Plan

---

### 4a. Global / Root (`app/globals.css` + `app/layout.tsx`)

**Changes:**

1. **Body background:** Replace `#000000` with `var(--bg-base)` (`#0a0a0f`) — pure black is harsh; this deep indigo-black is easier on eyes while keeping cards vivid.

2. **Scrollbar styling** (webkit + standard):
```css
::-webkit-scrollbar       { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg-base); }
::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--accent); }
```

3. **Selection highlight:**
```css
::selection { background: var(--accent-muted); color: var(--text-primary); }
```

4. **Smooth scroll:**
```css
html { scroll-behavior: smooth; color-scheme: dark; }
```

5. **Font application:** Apply `--font-display` to headings via:
```css
h1, h2, h3 { font-family: var(--font-display), var(--font-inter), sans-serif; }
```

---

### 4b. Navbar (`components/Navbar.tsx`)

**Current issues:** Plain `bg-gray-900`, text-only links, no search, no visual hierarchy.

**Target:** Sticky glass navbar — blurs the content beneath, feels fixed in premium space.

**Layout (h-14, 3-zone):**
```
[ Logo wordmark ]  [ ──── Global Search bar ──── ]  [ Links · Avatar · Username ]
```

**Detailed changes:**

- **Container:** `sticky top-0 z-50` with `backdrop-blur-xl bg-bg-base/80 border-b border-border-subtle`
- **Logo:** "Lumidex" in Space Grotesk, font-bold. Add a small SVG icon (prism / gem shape) to the left. Accent colour `text-accent` on the gem, white on the wordmark.
- **Global search bar** (centre zone, ~360px wide):
  - Dark input: `bg-bg-elevated border border-border-default rounded-full px-4 py-1.5`
  - Magnifying glass icon on left (16px, `text-text-muted`)
  - Placeholder: "Search cards, sets…" in `text-text-muted`
  - On focus: `border-accent` with subtle `shadow-[0_0_0_3px_var(--accent-glow)]`
  - **Use Headless UI `Combobox`** for the search autocomplete dropdown
- **Right zone links:** Replace text links with icon + label pills:
  - Sets · Collection · Dashboard — ghost style, `text-text-secondary hover:text-text-primary`
  - Separator `|` with `text-border-strong`
  - Avatar: 28px circle with `ring-1 ring-border-strong` → on hover `ring-accent`
  - Username: `text-sm font-medium text-text-primary`
  - Admin link: small wrench icon only (no text), `text-text-muted hover:text-warning`
- **Sign In button:** Accent filled pill, not blue — use `bg-accent hover:bg-accent-hover`

---

### 4c. Sets Listing Page (`app/sets/page.tsx` + `components/SetCard.tsx`)

**Current issues:** Basic grid, sets page inlines card markup instead of using `SetCard`, no series grouping, no search.

#### Sets Page Layout

```
[ Page title "Browse Sets" ]  [ Search input "Filter by name..." ]
[ Series group tabs — use Headless UI Tab.Group ]
[ Set grid ]
```

**Series grouping tabs:**
- Use `@headlessui/react` `Tab.Group` / `Tab.List` / `Tab.Panel`
- Tab style: underline active indicator in `bg-accent`, inactive `text-text-muted`
- Tabs: "All" | "Scarlet & Violet" | "Sword & Shield" | "Sun & Moon" | "XY" | "Black & White" | etc.

**Grid:** `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4`

#### SetCard Redesign

**Visual structure:**
```
┌─────────────────────────────┐
│  [blurred art backdrop]      │  ← set.logo_url blurred + darkened as bg
│  [set logo — centred]        │
│  h-32 total image zone       │
├─────────────────────────────┤
│  Set Name (Space Grotesk sm) │
│  Series  ·  N cards          │
│  [progress bar if owned]     │
└─────────────────────────────┘
```

**Detailed styles:**
- Container: `bg-bg-surface rounded-xl border border-border-subtle overflow-hidden transition-all duration-200 hover:border-accent hover:shadow-[0_0_20px_var(--accent-glow)] group`
- Image zone background: blurred `set.logo_url` at 10% opacity as pseudo-element OR inline style `background-image: url(...); filter: blur(20px); opacity: 0.15`
- Set logo: `object-contain p-3` max-h-20
- Name: `text-sm font-semibold font-display text-text-primary group-hover:text-accent transition-colors`
- Series: `text-xs text-text-muted`
- Card count: `text-xs text-text-secondary font-mono`
- Progress bar track: `bg-progress-track h-1 rounded-full mt-2`
- Progress fill: gradient `from-accent to-violet-400`
- Progress label: `text-xs text-text-muted mt-1` e.g. "47/295 · 16%"

---

### 4d. Set Detail Page (`app/set/[id]/page.tsx`) — Most Important

This is the primary view users will spend the most time on.

#### Hero / Banner Area

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [blurred card art mosaic or set symbol — full width background layer]   │
│  [darken overlay: bg-gradient-to-b from-transparent to-bg-base]          │
│                                                                           │
│  ┌──────────┐  Set Name (text-2xl font-display)     [●●●●●●●●●●] 16%    │
│  │ Set Logo │  Series (text-sm text-text-secondary)  47 / 295 Collected  │
│  │   120px  │  Released: Jan 2024                   [████░░░░░░░░] bar   │
│  └──────────┘                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Max-height ~200px, `relative overflow-hidden`
- Background: first 4–8 card images tiled + `blur-2xl opacity-20` as a decorative layer — OR just the set logo blurred. For now, use the set logo as the bg asset.
- Overlay: `absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/70 to-transparent`
- Content sits in `relative z-10 px-6 pb-6 pt-8 flex items-end gap-6`
- **Logo block:** `relative w-36 h-20 flex-shrink-0` — existing Image component, no change
- **Set info block:** flex-1
  - Set name: `text-2xl font-bold font-display text-text-primary`
  - Series: `text-sm text-text-secondary mt-0.5`
  - Release date: `text-xs text-text-muted mt-1`
- **Progress block:** `ml-auto text-right`
  - Fraction: `text-lg font-mono font-semibold text-text-primary` + `text-text-muted text-sm`
  - Percentage: `text-accent text-2xl font-bold font-display`
  - Bar: `w-48 h-2 bg-progress-track rounded-full mt-2` with gradient fill

#### Metadata Stats Strip

Below the hero, a horizontal strip of key stats:

```
┌──────────┬───────────┬───────────┬───────────┬──────────────┐
│  Series  │  Released │   Cards   │ Most Exp. │  Set Value   │
│  SV Base │  Mar 2023 │    258    │ $189.00   │  $1,240.00   │
└──────────┴───────────┴───────────┴───────────┴──────────────┘
```

- Container: `border-y border-border-subtle bg-bg-surface/50 backdrop-blur-sm px-6 py-3 flex gap-8 overflow-x-auto`
- Each stat: `flex flex-col`
  - Label: `text-xs text-text-muted uppercase tracking-wider font-medium`
  - Value: `text-sm font-semibold text-text-primary font-mono mt-0.5`
  - Price values: `text-success` colour
- Dividers: `border-r border-border-subtle` between stats

#### Filter / Sort Controls Bar

```
[ 🔍 Name or Number... ]  [ Sort: Number ▾ Name ▾ Rarity ▾ Price ▾ ]  [ ···Grid | Table | Binder ]
```

- Container: `px-6 py-3 flex items-center gap-3 border-b border-border-subtle`
- **Search input:** `bg-bg-elevated border border-border-default rounded-lg px-3 py-1.5 text-sm w-64 text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20`
- **Sort pills:** Ghost buttons with icon — `text-sm text-text-secondary hover:text-text-primary border border-transparent hover:border-border-default rounded-md px-2.5 py-1 flex items-center gap-1`
  - Active sort: `border-accent text-accent bg-accent-muted`
  - Up/down arrow icon: `↑↓` or use heroicons `ChevronUpDownIcon` (16px)
- **View mode toggle:** Far right, 3 icon buttons (Grid / Table / Binder)
  - Each: `w-8 h-8 rounded flex items-center justify-center`
  - Active: `bg-accent-muted text-accent`
  - Inactive: `text-text-muted hover:text-text-primary hover:bg-bg-elevated`

#### Collection Filter Tabs — Headless UI

Use `@headlessui/react` `Tab.Group`:

```tsx
<Tab.Group>
  <Tab.List className="flex border-b border-border-subtle px-6">
    {['All', 'Have (47)', 'Need (248)', 'Dupes (2)'].map(tab => (
      <Tab key={tab} className={({ selected }) =>
        cn(
          'px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors',
          selected
            ? 'border-accent text-accent'
            : 'border-transparent text-text-muted hover:text-text-secondary'
        )
      }>
        {tab}
      </Tab>
    ))}
  </Tab.List>
  <Tab.Panels>...</Tab.Panels>
</Tab.Group>
```

#### Variant Filter Dropdown — Headless UI

Right-aligned, uses `@headlessui/react` `Menu`:
- Trigger: ghost button "Filter by Variants ▾"
- Dropdown panel: `bg-bg-elevated border border-border-default rounded-xl shadow-2xl p-2 min-w-48`
- Each item: checkboxes for Normal / Reverse Holo / Holo Rare etc.

---

### 4e. Card Item (`components/CardItem.tsx`)

**Current state:** Already has type-glow on hover — keep this as a signature Lumidex feature.

**Enhancements:**

#### Card Container

```tsx
<div
  className="group relative bg-bg-surface rounded-xl overflow-hidden 
             border border-border-subtle
             transition-all duration-300 ease-out
             hover:-translate-y-1 hover:shadow-2xl"
  style={{
    boxShadow: isHovered
      ? `0 0 0 1px ${glowColor}40, 0 8px 32px ${glowColor}30, 0 0 0 0 transparent`
      : '0 0 0 1px transparent',
  }}
>
```

- Add `hover:-translate-y-1` for a lift effect (3D card pick-up feel)
- Add `duration-300 ease-out` for smooth easing

#### Card Image Zone

```
┌────────────────────────────┐
│                            │
│     [Card Image]           │  aspect-[3/4]
│                            │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← variant buttons overlay at bottom
└────────────────────────────┘
```

- Image zone: `aspect-[3/4] relative bg-bg-elevated`
- **Owned indicator overlay:** If any variant has quantity > 0:
  - Small checkmark badge `absolute top-2 right-2 w-5 h-5 rounded-full bg-success/90 flex items-center justify-center`
  - `text-[10px] font-bold text-white` → "✓"

#### Variant Buttons

Move variant buttons to an **overlay strip at the bottom of the image**, not below it:

```
┌────────────────────────────┐
│                            │
│         Card Art           │
│                            │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ [N][R][H]  ← overlay strip │
└────────────────────────────┘
│ Charizard ex               │
│ #006 · ★ · $89.99         │
└────────────────────────────┘
```

- Strip: `absolute bottom-0 inset-x-0 flex gap-1 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`
- Variant button: `flex-1 h-7 rounded text-[10px] font-bold border border-white/10`
  - When quantity = 0: `bg-white/10 text-white/40`
  - When quantity > 0: full colour + quantity display + `text-white`
  - Updating state: `opacity-50 cursor-wait`

#### Card Dimensions (Canonical Pixel Sizes)

| Context | Width | Height | Notes |
|---|---|---|---|
| Grid card item | 251px | 350px | Fixed pixel size — `w-[251px] h-[350px]` on the card container |
| Modal / detail view | 389px | 543px | Enlarged display when a card is selected/expanded |

These match the **canonical Pokémon card ratio (2.5 × 3.5 inches)** scaled to comfortable screen sizes. The `CardImage` component and its container should use these exact pixel dimensions rather than percentage/aspect-ratio approaches:

```tsx
// Grid card — fixed size (replaces aspect-[3/4] with percentage widths)
<div className="w-[251px] h-[350px] relative flex-shrink-0">
  <Image src={...} fill className="object-contain" sizes="251px" />
</div>

// Modal / expanded card view
<div className="w-[389px] h-[543px] relative flex-shrink-0">
  <Image src={...} fill className="object-contain" sizes="389px" />
</div>
```

> **Grid layout implication:** Replace the current `aspect-[3/4]` approach with `w-[251px]` fixed containers. The card grid should use `grid-cols-[repeat(auto-fill,minmax(251px,1fr))]` so columns snap to multiples of 251px and cards never get stretched or squished.

#### Holographic Shimmer / Glare Overlay (Modal Card Image)

When a card is displayed in the modal at 389×543px, overlay a dynamic radial-gradient glare layer on top of the card image to simulate holographic foil. This layer tracks mouse position within the card bounds.

**Static implementation (default glow position):**

```tsx
{/* Holographic glare overlay — sits above the card image, pointer-events-none */}
<div
  className="absolute inset-0 pointer-events-none z-10 transform-gpu"
  style={{
    borderRadius: 'inherit',
    overflow: 'hidden',
    opacity: 1,
    background: `radial-gradient(
      circle at ${glareX}% ${glareY}%,
      rgba(255, 255, 255, 0.18) 0%,
      rgba(255, 255, 255, 0.06) 30%,
      rgba(255, 255, 255, 0) 65%
    )`,
  }}
/>
```

**Dynamic (mouse-tracking) implementation:**

```tsx
// Track mouse position relative to the card container
const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 })

const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * 100
  const y = ((e.clientY - rect.top) / rect.height) * 100
  setGlare({ x, y, opacity: 1 })
}

const handleMouseLeave = () => {
  setGlare(prev => ({ ...prev, opacity: 0 }))
}
```

**Overlay style using mouse position:**
```tsx
style={{
  borderRadius: 'inherit',
  overflow: 'hidden',
  transition: 'opacity 300ms ease',
  opacity: glare.opacity,
  background: `radial-gradient(
    circle at ${glare.x}% ${glare.y}%,
    rgba(255, 255, 255, 0.22) 0%,
    rgba(255, 255, 255, 0.08) 35%,
    rgba(255, 255, 255, 0) 65%
  )`,
}}
```

> **Note:** The original snippet from the user — `radial-gradient(circle at 87.63% 90.31%, rgba(255,255,255,0) 5%, rgba(255,255,255,0) 40%)` — uses `rgba(255,255,255,0)` throughout (invisible), meaning it's set at a neutral/idle state. The live effect is achieved by updating these stop colours dynamically on mouse move. The gradient should go from a subtle white highlight (centre) to fully transparent at the edges.

> **Apply only in:** Modal / detail view (`w-[389px] h-[543px]`). Do **not** apply to grid card items — it would be too noisy at small size.

#### Card Info Strip (below image)

```
│ Charizard ex    │
│ #006  ·  ★ · $89.99 │
```

- Card name: `text-sm font-medium font-display text-text-primary truncate px-2.5 pt-2`
- Meta row: `flex items-center justify-between px-2.5 pb-2.5 mt-0.5`
  - Card number: `text-xs font-mono text-text-muted`
  - Rarity symbol: `text-xs text-text-secondary`
  - Price: `text-xs font-mono font-semibold text-success`

---

### 4f. UI Primitives

#### `components/ui/Button.tsx`

New variants:

```ts
const variants = {
  primary:  'bg-accent hover:bg-accent-hover text-white shadow-sm hover:shadow-[0_0_12px_var(--accent-glow)]',
  secondary:'bg-bg-elevated hover:bg-bg-elevated/80 border border-border-default hover:border-border-strong text-text-primary',
  ghost:    'hover:bg-bg-elevated text-text-secondary hover:text-text-primary border border-transparent',
  danger:   'bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30',
  success:  'bg-success/10 hover:bg-success/20 text-success border border-success/30',
}
```

Focus ring: `focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base`

#### `components/ui/Input.tsx`

Updated `input-base` class:
```css
.input-base {
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 0.5rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: border-color 150ms, box-shadow 150ms;
  outline: none;
}

.input-base::placeholder { color: var(--text-muted); }

.input-base:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
```

#### `components/ui/Card.tsx`

New `.card-base`:
```css
.card-base {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 0.875rem;
  transition: border-color 200ms, box-shadow 200ms;
}

.card-base:hover {
  border-color: var(--border-strong);
}

.card-glass {
  background: rgba(17, 17, 24, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-default);
}
```

#### `components/ui/Tabs.tsx` — New Component (Headless UI)

Create a reusable Tabs wrapper using `@headlessui/react`:

```tsx
// components/ui/Tabs.tsx
// Exports: LumidexTabs, LumidexTab, LumidexTabPanels, LumidexTabPanel
// Style: underline tabs, accent active, muted inactive
// Use for: Set Detail page collection filter, Sets page series filter
```

---

## 5. Animation & Interaction Design

### Hover States

| Element | Hover Effect |
|---|---|
| SetCard | `border-accent`, `shadow-[0_0_20px_var(--accent-glow)]`, no scale |
| CardItem | `translateY(-4px)`, type-reactive glow, variant strip reveals |
| NavLink | `text-text-primary` colour shift, 150ms ease |
| Button primary | Glow shadow pulse, no scale |
| Tab | Underline slides via `transition-colors` |

> **Note:** Avoid `hover:scale` on SetCard and heavy elements — it causes layout shift. Keep scale only on small elements (variant buttons: `hover:scale-110`).

### Transitions

```css
/* Standard durations */
--dur-fast:   100ms;  /* Immediate feedback: button press */
--dur-base:   200ms;  /* General hover transitions */
--dur-slow:   300ms;  /* Card lift, modal open */
--dur-xslow:  500ms;  /* Progress bar fill animation on mount */

/* Standard easing */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);  /* Spring-like, premium feel */
```

Apply system-wide:
```css
* { transition-timing-function: var(--ease-out); }
```

### Loading States

- **Skeleton screens** instead of spinners for card grids:
  - `animate-pulse bg-bg-elevated rounded-xl`
  - Card skeleton: aspect-[3/4] block
  - Text skeleton: `h-3 bg-bg-elevated rounded w-3/4`
- **Progress bar shimmer** on collection stats loading
- **Card image loading:** The existing `CardImage` component should show bg-bg-elevated until loaded, then fade in with `transition-opacity duration-300`

### Page Transitions

- Next.js App Router: apply `animate-fade-in` to main content areas using:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in { animation: fadeIn 250ms var(--ease-out) both; }
```

---

## 6. Implementation Notes

### Integration with Tailwind v4

Tailwind v4 uses `@import "tailwindcss"` (already in place) and the `@theme {}` block for custom tokens. No `tailwind.config.js` needed.

Add to `app/globals.css`:
```css
@theme {
  --color-accent:     #6d5fff;
  --color-bg-base:    #0a0a0f;
  --color-bg-surface: #111118;
  /* ... full list from Section 2 */

  --font-display: 'Space Grotesk';

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### New Dependencies Required

| Package | Purpose | Install |
|---|---|---|
| `@heroicons/react` | Icon set (search, grid, table, chevrons) | `npm i @heroicons/react` |

> **No other new dependencies needed.** `@headlessui/react` is already installed (v2.2.9). `Space Grotesk` via `next/font/google` — no install required.

### Component Priority Order

Implement in this order for maximum visual impact with minimum rework:

1. **`app/globals.css`** — New CSS custom properties + @theme block + scrollbar + fonts *(foundation for everything else)*
2. **`app/layout.tsx`** — Add Space Grotesk font variable *(unlocks font system)*
3. **`components/ui/Button.tsx`** — Updated variants *(used everywhere)*
4. **`components/ui/Input.tsx`** / `.input-base` *(used everywhere)*
5. **`components/Navbar.tsx`** — Glass navbar + search *(first impression)*
6. **`components/SetCard.tsx`** — Glass card with blurred bg + progress *(sets page)*
7. **`app/sets/page.tsx`** — Headless UI Tab series filter + grid *(sets page)*
8. **`app/set/[id]/page.tsx`** — Hero, stats strip, filter controls, Headless UI tabs *(core experience)*
9. **`components/CardItem.tsx`** — Overlay variant strip + info row *(card grid)*
10. **`components/ui/Tabs.tsx`** — Reusable Headless UI Tabs wrapper *(shared)*

### Headless UI Usage Map

| Component | Headless UI Primitive |
|---|---|
| Global search autocomplete | `Combobox` |
| Set detail collection filter | `TabGroup` / `Tab` / `TabPanels` |
| Sets page series filter | `TabGroup` / `Tab` / `TabPanels` |
| Variant filter dropdown | `Menu` / `MenuItem` |
| View mode toggle | `RadioGroup` / `RadioGroupOption` |
| Any modal (variant modal etc.) | `Dialog` (already in `ui/Modal.tsx`) |

### Key Visual Recipes

#### Glass Card Surface
```css
background: rgba(17, 17, 24, 0.75);
backdrop-filter: blur(12px) saturate(150%);
border: 1px solid rgba(42, 42, 61, 0.8);
```

#### Accent Glow Shadow
```css
box-shadow: 0 0 0 1px rgba(109, 95, 255, 0.3),
            0 4px 24px rgba(109, 95, 255, 0.15);
```

#### Gradient Progress Bar Fill
```css
background: linear-gradient(90deg, #6d5fff 0%, #a78bfa 100%);
```

#### Subtle Text Gradient (for hero stat numbers)
```css
background: linear-gradient(135deg, #f0f0ff 30%, #a78bfa 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

---

## 7. Component Wireframes (ASCII)

### Navbar
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ◈ Lumidex   [  🔍 Search cards, sets...              ]  Sets · Collection │
│             [                                         ]  · 🔧 · ⬤ Ash   │
└──────────────────────────────────────────────────────────────────────────┘
              ↑ backdrop-blur, 56px tall
```

### Set Detail Hero
```
┌──────────────────────────────────────────────────────────────────────────┐
│████████████████ blurred logo bg ████████████████████████████████████████│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ gradient overlay ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│                                                                          │
│  [SET LOGO     ]  Scarlet & Violet                   ████░░░░░░░ 16%    │
│  [   140×80    ]  Scarlet & Violet Series            47 / 295 Collected │
│                   Released: Mar 31, 2023                                 │
└──────────────────────────────────────────────────────────────────────────┘
│ Series       │ Released     │ Cards    │ Most Exp.  │ Set Value       │
│ Scarlet & V. │ Mar 2023     │ 258      │ $189.00    │ $1,240.00       │
└──────────────────────────────────────────────────────────────────────────┘
│ [🔍 Name or #...]  [Number ↕] [Name ↕] [Rarity ↕] [Price ↕]  [⊞][☰][▦] │
├─────────────────────────────────────────────────────────────────────────┤
│ All    Have (47)    Need (248)    Dupes (2)                     Variants ▾│
└──────────────────────────────────────────────────────────────────────────┘
```

### Card Item
```
┌──────────────────────┐
│                      │
│                      │
│    [  Card Art  ]    │
│                      │
│                      │
│░░░░░░░░░░░░░░░░░░░░░│ ← hover reveal: variant strip
│[N:2][R:1][H  ]       │
├──────────────────────┤
│ Charizard ex         │
│ #006    ★★★   $89.99│
└──────────────────────┘
              ↑ type-glow on hover (existing behaviour)
```

### SetCard
```
┌─────────────────────┐
│  [blurred logo bg]  │ ← h-28, overflow hidden
│  [   Set Logo   ]   │ object-contain
│                     │
├─────────────────────┤
│ Scarlet & Violet    │ text-sm font-display
│ Scarlet & Violet · 258 cards    │
│ ████░░░░░░ 16%     │ if owned
└─────────────────────┘
```

---

## 8. Colour Reference Card

```
■ #0a0a0f  bg-base        ■ #6d5fff  accent
■ #111118  bg-surface     ■ #8577ff  accent-hover
■ #1a1a26  bg-elevated    ■ #2d2651  accent-muted
■ #1e1e2e  border-subtle  ■ #34d399  success (prices)
■ #2a2a3d  border-default ■ #9191b0  text-secondary
■ #3d3d56  border-strong  ■ #5a5a78  text-muted
■ #f0f0ff  text-primary   ■ #fbbf24  warning
```

---

*End of Lumidex Design Plan v1.0*
