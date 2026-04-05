# Achievements Expansion Plan

## Overview

Expand from 10 → 36 achievements, covering all collector levels from beginner (1 card) to elite (25,000+ cards). Achievements span 7 categories: Collection Size, Unique Cards, Sets Tracked, Set Completion, Duplicates, Wanted List, Sealed Products, Social, and Profile.

---

## New `UserStats` Fields Required

The `UserStats` interface in [`lib/achievements.ts`](../lib/achievements.ts:12) must be extended:

```ts
interface UserStats {
  // EXISTING
  totalCards: number       // sum of all quantities
  totalSets: number        // rows in user_sets
  completedSets: number    // sets where owned >= setComplete/setTotal
  friendCount: number      // accepted friendships

  // NEW
  uniqueCardCount: number  // COUNT(DISTINCT card_id) in user_card_variants
  duplicateCount: number   // SUM(MAX(0, quantity-1)) across all variants
  wantedCount: number      // COUNT(*) in wanted_cards
  sealedProductCount: number // COUNT(*) in user_sealed_products
  hasAvatar: boolean       // avatar_url IS NOT NULL in users table
  hasCompletedSetup: boolean // setup_completed = true in users table
}
```

### Queries to Add in `getUserStats()`

| Field | Query |
|---|---|
| `uniqueCardCount` | `SELECT COUNT(DISTINCT card_id) FROM user_card_variants WHERE user_id = $1` |
| `duplicateCount` | Sum of `quantity - 1` for all rows where `quantity > 1` in `user_card_variants` |
| `wantedCount` | `SELECT COUNT(*) FROM wanted_cards WHERE user_id = $1` |
| `sealedProductCount` | `SELECT COUNT(*) FROM user_sealed_products WHERE user_id = $1` |
| `hasAvatar` | Fetch `avatar_url` from `users` WHERE `id = $1`, check non-null |
| `hasCompletedSetup` | Fetch `setup_completed` from `users` WHERE `id = $1` |

For `duplicateCount`, re-use the already-fetched `variantsData` (which has `quantity`) to compute inline — no extra DB call needed.

For `hasAvatar` and `hasCompletedSetup`, add a single `users` fetch alongside the other queries using `Promise.all`.

---

## Full Achievement List (36 total)

### ✅ Existing (10) — no changes

| Name | Condition | Icon |
|---|---|---|
| First Steps | totalCards ≥ 1 | 🎯 |
| Collector | totalSets ≥ 1 | 📦 |
| Century Club | totalCards ≥ 100 | 💯 |
| Enthusiast | totalCards ≥ 500 | ⭐ |
| Diamond Collector | totalCards ≥ 1,000 | 💎 |
| Completionist | completedSets ≥ 1 | 🏆 |
| Master Collector | completedSets ≥ 5 | 👑 |
| Legend | completedSets ≥ 10 | 🌟 |
| Friend Finder | friendCount ≥ 1 | 🤝 |
| Social Butterfly | friendCount ≥ 5 | 🦋 |

---

### 🆕 Collection Size — Total Quantity (4 new)

Extends the existing totalCards ladder for serious/elite collectors.

| Name | Condition | Icon | Description |
|---|---|---|---|
| Elite Collector | totalCards ≥ 2,500 | 🏅 | Amass a collection of 2,500 cards |
| Master Vault | totalCards ≥ 5,000 | 🗝️ | Unlock the vault with 5,000 cards |
| Legendary Hoard | totalCards ≥ 10,000 | ⚡ | Reach a legendary 10,000 cards |
| Card Emperor | totalCards ≥ 25,000 | 👸 | Rule the collection with 25,000 cards |

---

### 🆕 Unique Cards (4 new)

Rewards breadth of collection over pure quantity — counts distinct `card_id`s regardless of variant quantity.

| Name | Condition | Icon | Description |
|---|---|---|---|
| Card Hunter | uniqueCardCount ≥ 10 | 🔍 | Discover 10 unique cards |
| Dedicated Collector | uniqueCardCount ≥ 250 | 📚 | Own 250 different cards |
| Thousand Faces | uniqueCardCount ≥ 1,000 | 🃏 | Own 1,000 different cards |
| Card Archivist | uniqueCardCount ≥ 5,000 | 🗄️ | Catalogue 5,000 unique cards |

---

### 🆕 Sets Tracked (4 new)

Rewards users who actively track their progress across many sets.

| Name | Condition | Icon | Description |
|---|---|---|---|
| Set Explorer | totalSets ≥ 5 | 🧭 | Track 5 different sets |
| Set Hoarder | totalSets ≥ 15 | 📋 | Track 15 different sets |
| Set Chronicler | totalSets ≥ 30 | 📜 | Track 30 different sets |
| Set Archivist | totalSets ≥ 50 | 🏛️ | Track 50 different sets |

---

### 🆕 Set Completion (2 new)

Extends the existing completedSets ladder for the most dedicated completionists.

| Name | Condition | Icon | Description |
|---|---|---|---|
| Set Perfectionist | completedSets ≥ 25 | 🎖️ | Complete 25 sets |
| Living Pokédex | completedSets ≥ 50 | 🌈 | Complete 50 sets |

---

### 🆕 Duplicates (2 new)

Rewards collectors building trade stock — `duplicateCount` = sum of `(quantity - 1)` for all variants where `quantity > 1`.

| Name | Condition | Icon | Description |
|---|---|---|---|
| Double Trouble | duplicateCount ≥ 50 | 🔄 | Accumulate 50 duplicate cards |
| Trade Ready | duplicateCount ≥ 200 | 💼 | Stock up 200 duplicate cards ready to trade |

---

### 🆕 Wanted List (3 new)

| Name | Condition | Icon | Description |
|---|---|---|---|
| Wishful Thinking | wantedCount ≥ 1 | 🌠 | Add your first card to the wanted list |
| On the Hunt | wantedCount ≥ 25 | 🔭 | Track 25 cards on your wanted list |
| Obsessive Collector | wantedCount ≥ 100 | 📌 | Hunt down 100 wanted cards |

---

### 🆕 Sealed Products (3 new)

| Name | Condition | Icon | Description |
|---|---|---|---|
| Sealed Ambitions | sealedProductCount ≥ 1 | 🎴 | Add your first sealed product |
| Box Hoarder | sealedProductCount ≥ 10 | 🎁 | Collect 10 sealed products |
| Sealed Vault | sealedProductCount ≥ 50 | 🔐 | Build a sealed vault of 50 products |

---

### 🆕 Social (2 new)

Extends the existing social ladder.

| Name | Condition | Icon | Description |
|---|---|---|---|
| Network Builder | friendCount ≥ 10 | 🌐 | Connect with 10 friends |
| Community Pillar | friendCount ≥ 25 | 🏘️ | Build a network of 25 friends |

---

### 🆕 Profile (2 new)

These use the `hasAvatar` and `hasCompletedSetup` booleans.

| Name | Condition | Icon | Description |
|---|---|---|---|
| Picture Perfect | hasAvatar = true | 📸 | Upload a profile avatar |
| Identity | hasCompletedSetup = true | 🪪 | Complete your profile setup |

---

## Files to Change

### 1. [`lib/achievements.ts`](../lib/achievements.ts)

- **Extend `UserStats`** interface with 6 new fields
- **Extend `getUserStats()`**: add queries for `uniqueCardCount`, `wantedCount`, `sealedProductCount`, and user profile fields. Compute `duplicateCount` inline from existing `variantsData`
- **Add 26 new entries** to `achievementChecks[]`

### 2. New file: `database/migration_seed_achievements_v2.sql`

- `INSERT ... ON CONFLICT (name) DO NOTHING` for all 26 new achievements
- Safe to re-run

### 3. No changes needed to:
- [`types/index.ts`](../types/index.ts) — `Achievement` type is already correct
- [`components/AchievementBadge.tsx`](../components/AchievementBadge.tsx) — renders any achievement
- [`database/schema.sql`](../database/schema.sql) — table structure is already correct
- The `checkAndUnlockAchievements` function logic itself — it already iterates all checks dynamically

---

## Where Achievements Are Triggered

`checkAndUnlockAchievements(userId)` should already be called everywhere relevant. The new stats (wanted, sealed, avatar, setup) are all pulled fresh on each call so no new call sites are needed — the check will naturally fire next time any event triggers the existing function. However, ideally also call it:

- After saving wanted cards (`app/api/wanted-cards/route.ts` POST handler)
- After adding a sealed product (`app/api/user-sealed-products/route.ts` POST handler)
- After completing profile setup (`components/profile/FirstTimeSetupModal.tsx` submit handler)
- After uploading avatar (`components/profile/AvatarUpload.tsx` upload success handler)

These are **optional enhancements** — achievements will still eventually unlock on the next profile load, but calling it immediately gives instant feedback.

---

## Achievement Count Summary

| Category | Before | After |
|---|---|---|
| Collection Size (quantity) | 4 | 8 |
| Unique Cards | 0 | 4 |
| Sets Tracked | 1 | 5 |
| Set Completion | 3 | 5 |
| Duplicates | 0 | 2 |
| Wanted List | 0 | 3 |
| Sealed Products | 0 | 3 |
| Social | 2 | 4 |
| Profile | 0 | 2 |
| **Total** | **10** | **36** |
