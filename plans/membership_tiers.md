# Lumidex Membership Tiers

> **Status:** Approved design — ready for implementation  
> **Decision date:** April 2026  
> **Tiers:** Free ("Lumidex") + Paid ("Lumidex Pro")

---

## Design Principle: Snapshot vs. History

The governing rule across the entire tier split is elegant and consistent:

> **Free users get the present. Pro users get the past and the future.**

| Dimension | Free | Pro |
|---|---|---|
| Card prices | Today's price | 7-day + 14/30/90/365-day history chart |
| Portfolio value | Today's total € value | Historical growth chart + trend |
| Collection data | Tracking + current state | Export (CSV/JSON) |
| Price alerts | — | Notify when price crosses threshold |

This makes the upgrade story immediately intuitive: *"You can see what your collection is worth today. Upgrade to see where it's been — and get alerted when prices move."*

---

## Free Tier — "Lumidex"

Everything a collector needs to get started and build a real collection tracker. Competes directly against pkmn.gg's free offering and wins on depth.

### ✅ Collection Tracking
- Track unlimited cards across all sets and variants (Normal, Reverse Holo, Holo, etc.)
- All 3 Collection Goals: Normal Set, Masterset, Grandmaster Set
- Binder Calculator — pages needed per goal
- Wanted list (1 built-in, always free)
- Up to **2 custom named lists** (e.g. "Yuka's Collection", "Birthday Wishlist")

### ✅ Price Data
- Today's current price per card/variant (TCGPlayer + CardMarket)
- **7-day price history** chart — a teaser that demonstrates the value of longer history
- Today's total portfolio value (sum of owned cards × current prices)

### ✅ Browse & Discovery
- Browse all sets, cards, and artists
- Search with typeahead autocomplete
- Set completion stats and progress

### ✅ Social & Profile
- Public profile with avatar + banner
- Friends system (add, accept, outgoing requests)
- Trade proposals with friends
- Activity feed / last activity section

### ✅ Achievements
- All **36 achievements** across all 7 categories — achievements are a retention tool and must never be gated

### ✅ Dashboard
- Collection stats overview
- News section
- Quick actions
- Wanted board (own cards vs. friends' spares)

---

## Pro Tier — "Lumidex Pro"

Built for the investment-minded collector. Every Pro feature either saves money (price alerts, export), reveals insight (history, analytics), or tracks the serious stuff (graded, sealed).

**Price:**
- **€4.99 / month**
- **€39.99 / year** *(save 33% — effectively €3.33/month)*

> Norwegian VAT (25%) is included in the displayed price. No surprise fees.

### 💎 Price History — Expanded Charts
- 14-day, 30-day, 90-day, and 1-year price history per card variant
- Both TCGPlayer and CardMarket time series
- Visual chart with trend indicator (up/down % over period)
- Free tier sees 7-day; on the chart, longer ranges are visible but blurred with an inline "Upgrade to unlock" prompt

### 💎 Portfolio Value Over Time
- Historical portfolio value chart — see how your total collection value has grown (or dipped)
- Growth trend vs. last 30/90 days
- Per-set value breakdowns over time
- Free tier sees today's snapshot value only — the chart renders but locked behind a Pro prompt

### 💎 Price Alerts
- Set a price threshold per card/variant: "Notify me when Charizard ex drops below €50"
- Delivered via in-app notification + optional email
- Up to 10 active alerts per user (to manage infrastructure cost)

### 💎 Graded Cards Tracking
- Track PSA, Beckett, CGC, TAG, and ACE graded copies
- Company-specific grade labels (GEM-MT 10, Black Label 10, Pristine 10, etc.)
- Graded card values fed from graded price data
- Graded cards count separately from raw card collection
- Visible on public profile (if profile is public)

### 💎 Sealed Products Tracking
- Track booster packs, ETBs, booster boxes, tins, collections
- Current sealed product prices from price data
- Sealed inventory visible on profile and dashboard

### 💎 Unlimited Custom Lists
- Create unlimited named lists (free = 2 + built-in Wanted)
- Share lists publicly or keep private
- List shareable via link

### 💎 Collection Export
- Export full collection as CSV or JSON
- Includes card name, set, variant, quantity, current price, total value
- Graded card export when applicable
- Sealed products export when applicable

### 💎 Advanced Collection Analytics
- Top 10 most valuable cards in your collection
- Rarity breakdown chart (by count and by value)
- Collection value by set, ranked
- "Most gained" and "most lost" cards over last 30 days

### 💎 Pro Profile Badge
- Glowing 💎 Pro crown/gem badge on public profile
- Subtle "Lumidex Pro" indicator on post/trade activity
- Pro users receive early access to new features

### 💎 Priority Price Sync
- Pro users' price data refreshed more frequently (e.g. 2× daily vs. once daily for free)
- Earlier access to new set price data

---

## Tier Comparison Table

| Feature | Free | Pro |
|---|:---:|:---:|
| Collection tracking (unlimited) | ✅ | ✅ |
| All variants (Normal, Reverse, Holo, etc.) | ✅ | ✅ |
| Collection Goals (Normal, Masterset, Grandmaster) | ✅ | ✅ |
| Binder Calculator | ✅ | ✅ |
| Wanted list | ✅ | ✅ |
| Custom lists | 2 | ∞ |
| Today's card prices | ✅ | ✅ |
| 7-day price history | ✅ | ✅ |
| 14/30/90/365-day price history | ❌ | ✅ |
| Today's portfolio value | ✅ | ✅ |
| Portfolio value over time | ❌ | ✅ |
| Price alerts | ❌ | ✅ |
| Graded cards tracking | ❌ | ✅ |
| Sealed products tracking | ❌ | ✅ |
| Collection export (CSV/JSON) | ❌ | ✅ |
| Advanced collection analytics | ❌ | ✅ |
| Browse & discovery | ✅ | ✅ |
| Public profile | ✅ | ✅ |
| Friends + social | ✅ | ✅ |
| Trade proposals | ✅ | ✅ |
| All 36 achievements | ✅ | ✅ |
| Pro profile badge | ❌ | ✅ |
| Priority price sync | ❌ | ✅ |
| **Price** | **Free** | **€4.99/mo or €39.99/yr** |

---

## Upgrade Prompts — UX Design

Upgrade prompts should feel like natural discovery, not aggressive paywalls. The pattern:

1. **Blurred/greyed content with inline unlock button** — price history chart renders but is blurred past day 7, with a `💎 Unlock with Pro` button overlaid on the blurred portion
2. **Feature teaser modals** — clicking "Export Collection" as a free user opens a brief Pro modal showing what they'd get
3. **Dashboard callout** — a non-intrusive Pro card in the dashboard showing 1-2 Pro features with a soft CTA ("See your collection's growth story →")
4. **Never block existing free features** — a user who was free and then some feature gets re-categorised always keeps access to what they had

---

## Implementation Notes

### Database: `user_subscriptions` table

```sql
CREATE TABLE public.user_subscriptions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  tier            text        NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  billing_period  text        CHECK (billing_period IN ('monthly', 'annual')),
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  stripe_customer_id    text,
  stripe_subscription_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### Gate enforcement

A `lib/subscription.ts` helper should expose:

```ts
// Server-side
async function getUserTier(userId: string): Promise<'free' | 'pro'>
async function requirePro(userId: string): Promise<void>  // throws if not Pro

// Client-side (from Zustand store or context)
useIsPro(): boolean
```

Feature gates are implemented at three layers:
1. **API routes** — `requirePro()` check before returning gated data
2. **Server components** — tier passed as prop, renders either full or teaser UI
3. **RLS policies** — price history rows beyond 7 days filtered at DB level for free tier reads

### Stripe Integration

- Monthly: one price ID for €4.99/month
- Annual: one price ID for €39.99/year
- Webhook handler updates `user_subscriptions` on `customer.subscription.updated` / `deleted`
- Grace period: 3 days after failed payment before downgrading

### Custom List Enforcement

The `user_card_lists` table uses a DB constraint + API-level check:

```ts
// In POST /api/user-lists
const tier = await getUserTier(userId)
if (tier === 'free') {
  const count = await countUserLists(userId)
  if (count >= 2) throw new Error('Free tier limit: 2 custom lists. Upgrade to Pro for unlimited.')
}
```

---

## Upgrade Page Copy (Draft)

**Headline:** *Your collection deserves more than a snapshot.*

**Sub:** Track where your cards have been, where they're going, and know the moment prices move.

**CTA:** Get Lumidex Pro — €4.99/month

**Trust signals:**
- Cancel any time
- All your free data stays forever, even if you cancel
- One-click upgrade, no credit card churning

---

## Competitive Positioning

| Tool | Price | Collection Tracking | Price History | Graded Tracking |
|---|---|---|---|---|
| pkmn.gg | Free | ✅ | Limited | ❌ |
| TCGPlayer | Free / ~$8/mo Pro | ❌ (marketplace only) | ✅ | ❌ |
| Cardfolio | ~€6/mo | ✅ | ✅ | ❌ |
| **Lumidex Free** | **Free** | **✅** | **7 days** | **❌** |
| **Lumidex Pro** | **€4.99/mo** | **✅** | **1 year** | **✅ PSA+BGS+CGC+TAG+ACE** |

**Lumidex Pro wins on:** most complete graded card support in the market, cleanest portfolio value tracking, and the only tool purpose-built for the "collector-as-investor" mindset at a fair price.
