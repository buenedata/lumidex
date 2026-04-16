# tcggo RapidAPI Research Report

**API Host:** `cardmarket-api-tcg.p.rapidapi.com`  
**RapidAPI Provider:** tcggo ([tcggo.com](https://www.tcggo.com))  
**Researched:** 2026-04-16  
**Method:** Full OpenAPI spec (`api-1.json`) analysis + live HTTP probing + user clarifications

---

## ⚠️ Correction to Previous Research

> **CRITICAL ERROR IN PRIOR VERSION:** The `graded` field was described as "always `[]`" (always empty). **This is INCORRECT.**

The `api-1.json` OpenAPI specification clearly shows that `prices.cardmarket.graded` is **populated with PSA/BGS/CGC prices for valuable cards**. It is an empty array `[]` for common/low-value cards, but becomes an **object with grade sub-objects** for cards that have grading market data.

**This is a polymorphic field:**
- **Low-value / common cards:** `"graded": []` (empty array)
- **Valuable / graded-market cards:** `"graded": { "psa": { "psa10": 345, "psa9": 110, ... }, "bgs": { ... }, "cgc": { ... } }` (object)

**Practical implication:** Graded card prices (PSA, BGS, CGC) **ARE available from tcggo for valuable cards**, in EUR (CardMarket-sourced graded prices). This reduces reliance on eBay scraping for CM-graded prices on those cards. eBay data remains valuable for cross-market comparison and for cards below tcggo's threshold.

---

## 1. Endpoint Inventory

All 27 endpoints defined in the official OpenAPI spec (`api-1.json`), supplemented by live HTTP verification.

### Inventory Group (requires separate Inventory API Key — not the RapidAPI key)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/inventories` | List user inventories (paginated, basic portfolio tracking) |
| `GET` | `/inventories/{id}` | Get inventory detail (items + financial summary) |
| `GET` | `/inventories/{id}/stats` | Inventory stats + chart data (daily/weekly/monthly changes) |
| `POST` | `/inventories/{id}/items` | Add card/product to inventory (`item_id`, `count`, `price`, `language`) |
| `PUT` | `/inventories/{inventoryId}/items/{itemId}` | Update inventory item (count/price/language) |
| `DELETE` | `/inventories/{inventoryId}/items/{itemId}` | Remove item from inventory |

### Cards Group (uses `x-rapidapi-key`)

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/{game}/cards/recognize` | ✅ Spec-defined | Recognize card by OCR text (`?text=...`) |
| `GET` | `/{game}/cards/search` | ✅ Spec-defined | Search cards (see params below) |
| `GET` | `/{game}/cards/check-cardmarket-url` | ✅ Spec-defined | Check if a CardMarket URL maps to a card in this game |
| `GET` | `/{game}/cards` | ✅ Live confirmed | List all cards (same filters as search, plus `per_page` up to 100 when `episode_id` set) |
| `GET` | `/{game}/artists/{artistId}/cards` | ✅ Spec-defined | List cards by artist (paginated, `sort` param) |
| `GET` | `/{game}/episodes/{episodeId}/cards` | ✅ Live confirmed | List cards by episode (paginated, `per_page` up to 100, `sort`) |
| `GET` | `/{game}/cards/{cardId}` | ✅ Live confirmed | Get single card detail (adds `flavor_text`, `abilities`, `attacks` over list) |

**Search/filter params shared across card endpoints:** `ids`, `tcgids`, `cardmarket_ids`, `tcgplayer_ids`, `name`, `search`, `tcgid`, `cardmarket_id`, `tcgplayer_id`, `card_number`, `episode_id`, `artist_id`, `sort`, `page`

### Products Group

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/{game}/products/search` | ✅ Spec-defined | Search products (`ids`, `cardmarket_id`, `cardmarket_ids`, `tcgplayer_id`, `tcgplayer_ids`, `search`, `sort`, `page`) |
| `GET` | `/{game}/products` | ✅ Spec-defined | List all products |
| `GET` | `/{game}/episodes/{episodeId}/products` | ✅ Spec-defined | List products by episode |
| `GET` | `/{game}/products/{productId}` | ✅ Spec-defined | Get product detail |

### Episodes Group

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/{game}/episodes/search` | ✅ Spec-defined | Search episodes |
| `GET` | `/{game}/episodes` | ✅ Live confirmed | List all episodes (175 total as of April 2026) |
| `GET` | `/{game}/episodes/{episodeId}` | ⚠️ Defined in spec, may not be live | Get single episode detail — **returned 404 in live probing; defined in spec, monitor for availability** |

### Artists Group

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/{game}/artists/search` | ✅ Spec-defined | Search artists |
| `GET` | `/{game}/artists` | ✅ Spec-defined | List all artists |
| `GET` | `/{game}/artists/{artistId}` | ✅ Spec-defined | Get artist detail |

### History Prices Group

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/{game}/history-prices` | ✅ **CURRENT** (not deprecated) | Get history by `?id=`, `?cardmarket_id=`, or `?tcgid=` |
| `GET` | `/{game}/cards/{itemId}/history-prices` | ⚠️ **DEPRECATED** | Same functionality, path-based card ID |
| `GET` | `/{game}/products/{itemId}/history-prices` | ⚠️ **DEPRECATED** | Product history prices, path-based |

### Health

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/pokemon/healthcheck` | ✅ Spec-defined | Health check |

---

## 2. Endpoint Details and Full Response Schemas

### 2.1 `GET /pokemon/episodes`

List all Pokémon episodes (= sets) in the API, newest first.

**URL:** `https://cardmarket-api-tcg.p.rapidapi.com/pokemon/episodes?page=1&per_page=20`

**Query Parameters:**

| Param | Required | Type | Notes |
|-------|----------|------|-------|
| `page` | No | int | Default 1 |
| `per_page` | No | int | Default 20 |
| `series_id` | No | int | ⚠️ **IGNORED** — does not filter |

**Response Schema:**
```json
{
  "data": [
    {
      "id": 399,
      "name": "Perfect Order",
      "slug": "perfect-order",
      "released_at": "2026-03-27",
      "logo": "https://images.tcggo.com/tcggo/storage/32311/Pokemon_TCG_Mega_Evolution—Perfect_Order_Logo.png",
      "code": "POR",
      "cards_total": 124,
      "cards_printed_total": 88,
      "prices": {
        "cardmarket": { "total": 751.43, "currency": "EUR" },
        "tcgplayer": { "total": 809.66, "currency": "EUR" }
      },
      "game": { "name": "Pokémon", "slug": "pokemon" },
      "series": { "id": 17, "name": "Mega Evolution", "slug": "mega-evolution" }
    }
  ],
  "paging": { "current": 1, "total": 9, "per_page": 20 },
  "results": 175
}
```

**Notes:**
- **175 total episodes** as of April 2026, across 9 pages
- `cards_total` includes all card slots (including alt arts, secret rares)
- `cards_printed_total` is the count of physically distinct printed cards (always ≤ `cards_total`)
- `prices.total` is the sum of all card prices in the episode — useful for set-value estimates
- Single-episode detail endpoint (`/{game}/episodes/{episodeId}`) is defined in spec but returned 404 in live tests

---

### 2.2 `GET /pokemon/episodes/{id}/cards`

All cards for a specific episode, paginated.

**URL:** `https://cardmarket-api-tcg.p.rapidapi.com/pokemon/episodes/399/cards?page=1&per_page=20`

**Query Parameters:**

| Param | Required | Type | Notes |
|-------|----------|------|-------|
| `page` | No | int | Default 1 |
| `per_page` | No | int | Default 20, spec allows up to 100 when `episode_id` is scoped |
| `sort` | No | string | Sort order |
| `type` | No | string | ⚠️ **IGNORED** — `reverse_holo` etc. have no effect |
| `rarity` | No | string | ⚠️ **IGNORED** — does not filter |

**Response Schema:**
```json
{
  "data": [
    {
      "id": 31799,
      "name": "Spinarak",
      "name_numbered": "Spinarak 1",
      "slug": "spinarak",
      "type": "singles",
      "card_number": 1,
      "hp": 60,
      "rarity": "Common",
      "supertype": null,
      "tcgid": "POR-1",
      "cardmarket_id": 877413,
      "tcgplayer_id": 684397,
      "prices": {
        "cardmarket": {
          "currency": "EUR",
          "lowest_near_mint": 0.02,
          "lowest_near_mint_EU_only": 0.02,
          "lowest_near_mint_DE": 0.02,
          "lowest_near_mint_DE_EU_only": 0.02,
          "lowest_near_mint_FR": 0.02,
          "lowest_near_mint_FR_EU_only": 0.02,
          "lowest_near_mint_ES": 0.02,
          "lowest_near_mint_ES_EU_only": 0.02,
          "lowest_near_mint_IT": 0.02,
          "lowest_near_mint_IT_EU_only": 0.02,
          "30d_average": 0.03,
          "7d_average": 0.02,
          "graded": []
        },
        "tcg_player": {
          "currency": "EUR",
          "market_price": 0.06
        }
      },
      "episode": { "id": 399, "name": "Perfect Order", "slug": "perfect-order", "released_at": "2026-03-27", "logo": "...", "code": "POR", "cards_total": 124, "cards_printed_total": 88, "prices": { "..." }, "game": { "..." }, "series": { "..." } },
      "artist": null,
      "image": "https://images.tcggo.com/tcggo/storage/32187/spinarak.webp",
      "tcggo_url": "https://www.tcggo.com/pokemon/perfect-order/spinarak",
      "links": {
        "cardmarket": "https://www.tcggo.com/external/cm/31799",
        "tcgplayer": "https://www.tcggo.com/external/tcgplayer/31799"
      }
    }
  ],
  "paging": { "current": 1, "total": 7, "per_page": 20 },
  "results": 124
}
```

**For a valuable card (e.g., Pikachu ex Hyper Rare), the `graded` field would instead look like:**
```json
"graded": {
  "psa": {
    "psa10": 345,
    "psa9": 110
  },
  "bgs": {
    "bgs9": 62
  },
  "cgc": {
    "cgc10": 900
  }
}
```

**This endpoint is functionally equivalent to `/pokemon/cards?episode_id={id}`.**

---

### 2.3 `GET /pokemon/cards`

Global card listing across all episodes. Supports several working filters.

**URL:** `https://cardmarket-api-tcg.p.rapidapi.com/pokemon/cards?episode_id=399&page=1&per_page=20`

**Query Parameters:**

| Param | Required | Type | Works? | Notes |
|-------|----------|------|--------|-------|
| `page` | No | int | ✅ | Default 1 |
| `per_page` | No | int | ✅ | |
| `episode_id` | No | int | ✅ | Filters to episode; returns same data as `/episodes/{id}/cards` |
| `name` | No | string | ✅ | **Fuzzy** search — `name=Pikachu` returns 177 matches |
| `tcgid` | No | string | ✅ | **Exact match** — `tcgid=sv4pt5-200` returns 1 result |
| `cardmarket_id` | No | int | ✅ | **Exact match** — returns the one card with that CM product ID |
| `ids` | No | string | ✅ | Comma-separated tcggo IDs |
| `tcgids` | No | string | ✅ | Comma-separated pokemontcg.io IDs |
| `cardmarket_ids` | No | string | ✅ | Comma-separated CardMarket IDs |
| `tcgplayer_ids` | No | string | ✅ | Comma-separated TCGPlayer IDs |
| `card_number` | No | string | ✅ | Filter by card number |
| `artist_id` | No | int | ✅ | Filter by artist |
| `sort` | No | string | ✅ | Sort order |
| `type` | No | string | ❌ | **IGNORED** |
| `rarity` | No | string | ❌ | **IGNORED** |
| `slug` | No | string | ❌ | **IGNORED** — returns all 20,238 cards |

**Total cards in database: 20,238**

**Response schema:** Same as `/pokemon/episodes/{id}/cards` above, with `results: 20238` when unfiltered.

**Key feature: `tcgid` lookup** — this lets you pass a pokemontcg.io card ID and get back the exact tcggo card entry, including `cardmarket_id`, prices, and the tcggo internal `id`. This is the most reliable way to cross-reference the two data sources.

---

### 2.4 `GET /pokemon/cards/{id}`

Single card detail by tcggo internal ID. Returns a few extra fields vs the listing.

**URL:** `https://cardmarket-api-tcg.p.rapidapi.com/pokemon/cards/31799`

**Response Schema (additional fields over listing):**
```json
{
  "data": {
    "id": 31799,
    "name": "Spinarak",
    "...(all listing fields)...",
    "flavor_text": null,
    "abilities": null,
    "attacks": null,
    "cardmarket_id": 877413,
    "tcgplayer_id": 684397
  }
}
```

> **Note:** `cardmarket_id` and `tcgplayer_id` appear at the top level of the `data` object in the single-card response, but are nested inside each object in the listing responses. Both locations have the same values.

---

### 2.5 `GET /pokemon/history-prices` ✅ CURRENT (not deprecated)

Historical daily price snapshots for a single card. **Use this endpoint** — the path-based variants are deprecated.

**URL:** `https://cardmarket-api-tcg.p.rapidapi.com/pokemon/history-prices?id=31799&date_from=2024-01-01&date_to=2026-04-15&page=1`

**Query Parameters:**

| Param | Required | Type | Notes |
|-------|----------|------|-------|
| `id` | One of these is required | int | tcggo internal card ID |
| `cardmarket_id` | One of these is required | int | CardMarket product ID |
| `tcgid` | One of these is required | string | pokemontcg.io card ID |
| `date_from` | Yes | string | `YYYY-MM-DD` |
| `date_to` | Yes | string | `YYYY-MM-DD` |
| `page` | No | int | Default 1, **30 entries per page (fixed)** |
| `sort` | No | string | `asc` or `desc` |
| `lang` | No | string | `en`, `de`, `fr`, `es`, `it` — selects which country's `cm_low` is returned |

**Response Schema:**
```json
{
  "data": {
    "2026-04-14": {
      "cm_low": 0.02,
      "tcg_player_market": 0.06
    },
    "2026-01-21": {
      "cm_low": 0.02,
      "tcg_player_market": 0.04
    }
  },
  "paging": { "current": 1, "total": 8, "per_page": 30 },
  "results": 219
}
```

> **Note on history fields:** The new `/{game}/history-prices` endpoint returns `cm_low` and `tcg_player_market`. Use the `?lang=de/fr/es/it` parameter to retrieve per-country `cm_low` in separate calls. The deprecated `/{game}/cards/{itemId}/history-prices` route previously returned per-country `cm_low_de/cm_low_fr/cm_low_es/cm_low_it` as inline fields — those live-researched fields were from the deprecated endpoint only.

**Critical observations about history data:**
- The response is a **date-keyed object** (not an array) — keys are `YYYY-MM-DD` strings, newest first by default
- `per_page` is hard-coded to **30** — cannot be changed; paginate with `page=2`, `page=3`, etc.
- Data goes back to approximately when tcggo started tracking the set (roughly its release date)
- A Paldean Fates card (released Jan 2024) has **219 data points** across 8 pages — ~2 years of history
- **Data frequency is irregular** — could be daily during volatile periods, or sparse (weeks apart) when stable
- **This is normal-variant (non-reverse-holo) prices only**

**Currently used in [`tcggoHistoryService.ts`](services/pricing/tcggoHistoryService.ts):** Only `cm_low` and `tcg_player_market`. Per-language `cm_low` (via `?lang=` param) is **not currently captured**.

---

## 3. Complete Card Price Field Reference

Every card in the API (current snapshot) exposes these `prices` fields:

### CardMarket fields (`prices.cardmarket`) — Cards

| Field | Type | Description | Currently used? |
|-------|------|-------------|-----------------|
| `currency` | string | Always `"EUR"` | — |
| `lowest_near_mint` | float | Global lowest NM price (all sellers) | ✅ → `cm_low` |
| `lowest_near_mint_EU_only` | float | Lowest NM from EU sellers only | ❌ |
| `lowest_near_mint_DE` | float | Lowest NM from German sellers | ❌ |
| `lowest_near_mint_DE_EU_only` | float | Lowest NM from German, EU-only sellers | ❌ |
| `lowest_near_mint_FR` | float | Lowest NM from French sellers | ❌ |
| `lowest_near_mint_FR_EU_only` | float | Lowest NM from French, EU-only sellers | ❌ |
| `lowest_near_mint_ES` | float | Lowest NM from Spanish sellers | ❌ |
| `lowest_near_mint_ES_EU_only` | float | Lowest NM from Spanish, EU-only sellers | ❌ |
| `lowest_near_mint_IT` | float | Lowest NM from Italian sellers | ❌ |
| `lowest_near_mint_IT_EU_only` | float | Lowest NM from Italian, EU-only sellers | ❌ |
| `30d_average` | float | 30-day average sell price | ✅ → `cm_avg_30d` |
| `7d_average` | float | 7-day average sell price | ✅ → `cm_avg_sell` |
| `graded` | **array OR object** | `[]` for low-value cards; **object with PSA/BGS/CGC sub-objects for valuable cards** | ❌ **not yet extracted** |

### CardMarket `graded` sub-fields (when populated — object, not array)

| Field path | Type | Description | Currently used? |
|-----------|------|-------------|-----------------|
| `graded.psa.psa10` | float | PSA 10 Gem Mint price (EUR) | ❌ |
| `graded.psa.psa9` | float | PSA 9 Mint price (EUR) | ❌ |
| `graded.psa.psa8` | float | PSA 8 Near Mint–Mint price (EUR) | ❌ |
| `graded.bgs.bgs10pristine` | float | BGS 10 Pristine price (EUR) | ❌ |
| `graded.bgs.bgs10` | float | BGS 10 price (EUR) | ❌ |
| `graded.bgs.bgs9` | float | BGS 9 price (EUR) | ❌ |
| `graded.bgs.bgs8` | float | BGS 8 price (EUR) | ❌ |
| `graded.cgc.cgc10` | float | CGC 10 price (EUR) | ❌ |
| `graded.cgc.cgc9` | float | CGC 9 price (EUR) | ❌ |
| `graded.cgc.cgc8` | float | CGC 8 price (EUR) | ❌ |

> Not all sub-grades are present on every card. Only grades with active market data are included. The structure is always nested: `graded.{grader}.{grade}`.

**Real examples from `api-1.json`:**
- Pikachu ex (sv8pt5-179, Hyper Rare, ~€38): `psa.psa10=345`, `psa.psa9=110`, `bgs.bgs9=62`, `cgc.cgc10=900`
- Pikachu ex (sv8-238, SIR, ~€245): `psa.psa10=319`, `psa.psa9=315`, `cgc.cgc10=550`
- Pikachu (swsh12pt5-160, Secret Rare, ~€36): `psa.psa10=99`, `psa.psa9=69`, `psa.psa8=75`, `bgs.bgs10pristine=399`, `bgs.bgs10=175`, `bgs.bgs9=69`
- Pikachu with Grey Felt Hat (promo, ~€539): `psa.psa10=598`, `psa.psa9=665`, `psa.psa8=550`, `bgs.bgs10=869`, `bgs.bgs9=750`, `bgs.bgs8=549`
- Common "Pikachu" cards: `"graded": []` (empty array)

### TCGPlayer fields (`prices.tcg_player`) — Cards

| Field | Type | Description | Currently used? |
|-------|------|-------------|-----------------|
| `currency` | string | `"EUR"` — **misleading! Values are actually USD** | — |
| `market_price` | float | TCGPlayer market price in USD | ✅ → `tcgp_market` |
| `mid_price` | float | TCGPlayer mid price — **only on older sets** (≤Paldean Fates era); absent on new sets | ❌ |

### CardMarket fields (`prices.cardmarket`) — Products (different schema!)

| Field | Type | Description |
|-------|------|-------------|
| `lowest` | float | Global lowest listing price |
| `lowest_EU_only` | float | EU sellers only |
| `lowest_DE` / `lowest_FR` / `lowest_ES` / `lowest_IT` | float | Per-country lowest |
| `lowest_DE_EU_only` etc. | float | Per-country EU-only |
| `30d_average` | float | 30-day average |
| `7d_average` | float | 7-day average |
| ❌ `graded` | — | Products have **NO graded field** |

### History endpoint fields (per date key)

| Field | Type | Description | Currently used? |
|-------|------|-------------|-----------------|
| `cm_low` | float | CardMarket global/lang-scoped lowest NM | ✅ |
| `tcg_player_market` | float | TCGPlayer market price (USD) | ✅ |

> Use `?lang=de/fr/es/it` to retrieve per-country history in separate calls. Each call returns `cm_low` scoped to that country.

---

## 4. CardMarket Product ID Availability

### What the API provides

- **`cardmarket_id` (integer):** The CardMarket product ID for the **normal (non-reverse-holo) variant** of each card. This is always present.
- **`links.cardmarket`:** `https://www.tcggo.com/external/cm/{tcggoId}` — a tcggo-hosted redirect to the CardMarket product page. (Note: this URL blocks bots via Cloudflare 403; not follow-able programmatically.)

### What this means for Lumidex

The `cardmarket_id` values are **direct CardMarket product identifiers** — the same integers used in CardMarket's own API and URLs. In CardMarket's data model:

- Each card **variant** (normal, reverse holo, holo, 1st edition) is a **separate product** with its own product ID
- tcggo only provides the `cardmarket_id` for the **primary (normal) printing**
- **Reverse holo, holo, and cosmos holo CardMarket product IDs are NOT in this API**

### How to construct a CardMarket product URL

Given `cardmarket_id: 877413`, the CardMarket product page URL follows the pattern:
```
https://www.cardmarket.com/en/Pokemon/Products/Singles/{set-name}/{card-name}?productId=877413
```
However, since tcggo provides the redirect link and the `cardmarket_id`, you can also use CardMarket's own API with the ID directly.

---

## 5. Variant Pricing — Current State

### There are NO reverse holo or holo variants in this API (confirmed)

Every test confirms this:

1. **`type` field** — all 20,238 cards have `"type": "singles"`. There is no `"reverse_holo"`, `"holo"`, or any other type value observed.
2. **Filter `type=reverse_holo`** — completely ignored; returns all cards regardless
3. **Filter `rarity=Reverse+Holo`** — completely ignored; returns all cards regardless
4. **Episode card count** — Perfect Order has `cards_total: 124` and the API returns exactly 124 cards, one per card number. If reverse holos were separate entries, we'd expect 88 + 88 = 176 entries (88 printed cards × 2 variants)
5. **Same for Paldean Fates** — `cards_total: 245` with 245 entries, one per slot number (91 printed + special art cards). No reverse holo duplicates.

### Planned features (confirmed by developer — NOT YET IMPLEMENTED)

The following features are on the tcggo development roadmap but are **not available in the current API**:

| Feature | Status |
|---------|--------|
| Reverse holo prices | 🗓️ Planned — not yet implemented |
| Holo variant prices | 🗓️ Planned — not yet implemented |
| Japanese card prices | 🗓️ Planned — not yet implemented |
| Master Ball variant prices | 🗓️ Planned — not yet implemented |

When these are implemented, tcggo will likely add separate card entries or variant sub-objects. Monitor the API changelog.

### What the API prices represent

All CardMarket prices in this API are for the **normal (non-holo, non-reverse) variant** of each card. This is typically the cheapest and most liquid product on CardMarket for common/uncommon cards.

For rare/special cards (Illustration Rare, Special Art Rare, etc.) there is often only one printing (no reverse holo exists for those), so the price is correct regardless.

**The gap:** For cards numbered ≤ `cards_printed_total` (e.g., cards 1–88 in Perfect Order), a reverse holo variant exists on CardMarket as a separate product with a different `cardmarket_id` — but that ID is not available from this API.

---

## 6. Key Observations and Quirks

### `tcgid` cross-reference with pokemontcg.io
The `tcgid` field uses pokemontcg.io's card ID format:
- Modern sets: `POR-1`, `ASC-42`, `PAF-200` (set code + card number)
- Older sets: `sv4pt5-1` (pokemontcg.io internal format)

This makes `/pokemon/cards?tcgid={pokemontcg-id}` a reliable bridge between the two data sources. Given a pokemontcg.io card, you can look up the tcggo entry (and its `cardmarket_id`) in a single API call.

### `graded` — polymorphic field (corrected)
The `graded` field is **`[]` for low-value cards** and a **nested object for cards with CM grading market data**. The threshold for when graded data appears is not explicitly documented, but from examples, cards above roughly €30 NM value start to have graded data. All grades (PSA, BGS, CGC) may not be present simultaneously — only those with active listings.

### TCGPlayer prices on new international sets
Sets from the "Mega Evolution" series (id=17, e.g., Perfect Order, Ascended Heroes) show `tcg_player.market_price` but `tcgplayer.total: 0` at the episode level for most of them. Individual card `market_price` values are present but may not be meaningful for Japan/international sets not sold through TCGPlayer.

### `mid_price` is set-era dependent
The `tcg_player.mid_price` field is present for Paldean Fates-era cards and earlier but absent for new sets (Perfect Order). This suggests the API stopped capturing it or TCGPlayer stopped providing it.

### `artist` field
`artist` is populated for older sets (Paldean Fates era and prior) but is `null` for the newest sets (Perfect Order, Ascended Heroes). This is a data lag issue on tcggo's side.

### `supertype` population
`supertype` ("Pokémon", "Trainer", "Energy") is populated for older sets but is `null` for the newest sets — same data lag.

### History format change between deprecated and current endpoint
The deprecated `/{game}/cards/{itemId}/history-prices` returned inline per-country fields (`cm_low_de`, `cm_low_fr`, etc.). The current `/{game}/history-prices` instead uses `?lang=` parameter to switch which country's data is returned. Migration note: if previously storing per-country history from the deprecated endpoint, refactor to call the current endpoint multiple times with different `lang` params.

### Episode ID is not sequential/guessable
Episode IDs are not consecutive integers — Perfect Order is 399, Ascended Heroes is 396, Phantasmal Flames is 231. Gaps are common. Always use `/pokemon/episodes` to discover valid IDs.

### Duplicate episodes in the list
Observed `id: 10` and `id: 347` both named "Stellar Crown", same release date, same code "SCR" — id 347 has all-zero prices. This appears to be a data integrity issue in tcggo's database. When matching DB sets to episode IDs, prefer the entry with non-zero prices.

---

## 7. API Rate Limits & Pagination Behavior

| Endpoint | Default `per_page` | Max `per_page` | Paginated? |
|----------|--------------------|----------------|------------|
| `/pokemon/episodes` | 20 | 20 | ✅ `page` param |
| `/pokemon/episodes/{id}/cards` | 20 | 100 (spec) | ✅ `page` param |
| `/pokemon/cards` | 20 | 100 (with `episode_id`) | ✅ `page` param |
| `/pokemon/history-prices` | **30 (fixed)** | **30 (fixed)** | ✅ `page` param |

For the history endpoint specifically, `per_page` appears fixed at 30 — you cannot change it. To fetch all history you must paginate page-by-page until `paging.current === paging.total`.

---

## 8. Recommendations for Pricing Redesign

### 8.1 Use tcggo as the primary CardMarket price source

**For sets with an `api_set_id` mapped** (i.e., a tcggo episode ID stored in `sets.api_set_id`):
- Use `/pokemon/episodes/{api_set_id}/cards` to bulk-fetch all current prices for the set
- This gives CM `lowest_near_mint`, `7d_average`, `30d_average` for every card's **normal variant**
- Map cards by `card_number` (integer, no leading zeros) to Lumidex card records

**For individual card lookup** (cross-reference or fallback):
- Use `/pokemon/cards?tcgid={pokemontcg-id}` for exact lookup by pokemontcg.io ID — no fuzzy matching needed
- Use `/pokemon/cards?cardmarket_id={id}` if you have a CardMarket product ID to validate

### 8.2 Store `cardmarket_id` from tcggo on card records

The `cardmarket_id` field is a direct link to the **normal-variant CardMarket product**. This should be stored in the Lumidex DB (e.g., `cards.cardmarket_id` or in variant records) for:
- Deep-linking to CardMarket product pages
- Future CardMarket API integration if reverse holo IDs can also be acquired
- Validating that a card is correctly matched

This ID is currently extracted in [`parseCards()`](services/pricing/tcggoCardService.ts:153) as `cardmarketId` but may not be fully persisted.

### 8.3 Extract graded prices from tcggo (new recommendation)

Now that `prices.cardmarket.graded` is confirmed to be populated for valuable cards, [`tcggoCardService.ts`](services/pricing/tcggoCardService.ts) should be updated to:
1. Check if `graded` is an object (not an empty array)
2. Extract all available grade sub-fields (PSA/BGS/CGC)
3. Store them in `card_graded_prices` table

This reduces reliance on eBay scraping for CardMarket-sourced graded prices. tcggo graded prices are in **EUR** (CardMarket data), while eBay prices are USD-denominated — both sets of data are valuable and complementary.

### 8.4 Exploit the per-country CM price fields

The API provides **10 CardMarket price fields per card** (5 countries × normal/EU-only). The current service only uses `lowest_near_mint`, `7d_average`, and `30d_average`. Consider also storing/displaying:
- `lowest_near_mint_EU_only` — excludes non-EU sellers; often more relevant for European buyers
- Per-country lowest prices for user-facing "cheapest near you" features

### 8.5 Expand history capture

The current [`tcggoHistoryService.ts`](services/pricing/tcggoHistoryService.ts) only extracts `cm_low` and `tcg_player_market` from history. The API also provides per-language `cm_low` via `?lang=de/fr/es/it`. Consider adding these to the `price_history` schema for per-country trend charts by calling the endpoint multiple times with different `lang` params.

Also: history requires explicit date range + pagination. To capture full historical backfill for a card, you need to paginate all `paging.total` pages.

### 8.6 Reverse holo pricing — use pokemontcg.io or a separate source

**tcggo cannot supply reverse holo prices.** For cards 1–`cards_printed_total` in a set, a reverse holo variant exists on CardMarket. The options for sourcing reverse holo `cardmarket_id`s are:

1. **pokemontcg.io** — for Scarlet & Violet era sets, `pokemontcgapi.cardmarket.prices.reverseHoloLow` / `reverseHoloSell` / `reverseHoloTrend` may be present in the `cardmarket` prices object on the card data
2. **CardMarket API** (direct, paid) — supports searching products by set + card name + version
3. **Manual mapping** — admin-entered `cm_reverse_holo_id` per card (the current `migration_add_cm_reverse_holo.sql` approach)

**Recommendation:** Continue using pokemontcg.io as the source for reverse holo CardMarket prices where available (it scrapes CM's price data). tcggo fills the gap for newly released sets that pokemontcg.io hasn't updated yet — but only for normal variant prices. When tcggo implements reverse holo prices (planned), this strategy should be revisited.

### 8.7 tcggo vs pokemontcg.io — suggested division of responsibility

| Data need | Preferred source |
|-----------|-----------------|
| Normal variant CM prices (new sets, ≤2 weeks old) | **tcggo** `/pokemon/episodes/{id}/cards` |
| Normal variant CM prices (established sets) | **pokemontcg.io** cardmarket prices |
| Reverse holo CM prices | **pokemontcg.io** reverseHolo prices (tcggo: planned, not yet available) |
| TCGPlayer market price | **pokemontcg.io** tcgplayer prices (more reliable; tcggo has gaps on international sets) |
| CardMarket product ID (`cardmarket_id`) | **tcggo** (very reliable, always present) |
| pokemontcg.io card ID | **pokemontcg.io** directly |
| Cross-reference tcggo ↔ pokemontcg.io | `tcgid` field on tcggo cards |
| Historical price trends | **tcggo** `/pokemon/history-prices` (longest history) |
| Graded CM prices (EUR, PSA/BGS/CGC) | **tcggo** `prices.cardmarket.graded` for valuable cards; supplement with **eBay** for broader coverage |

---

## 9. API Gaps Summary

| Gap | Impact | Mitigation |
|-----|--------|------------|
| No reverse holo prices | Cannot price reverse holo variant from tcggo | Use pokemontcg.io or manual CardMarket IDs — tcggo has this **planned** |
| No holo/cosmos holo prices | Cannot distinguish holo-only products | Same as above — tcggo has this **planned** |
| No Japanese card prices | Cannot price Japanese variant printings | tcggo has this **planned**; no current source |
| No Master Ball variant prices | Cannot price Master Ball promo variants | tcggo has this **planned**; no current source |
| `graded[]` is empty on common cards | No graded prices for low-value cards | tcggo graded data available for valuable cards; supplement with eBay for lower-value graded cards |
| History `?lang=` requires multiple API calls | Per-country history means N calls per card | Accept cost; call per language if needed |
| `/{game}/episodes/{id}` may not be live | Cannot fetch single episode via spec'd path | Use `/pokemon/episodes?per_page=200` + client filter |
| `type`/`rarity` filters on `/pokemon/cards` ignored | Cannot filter to reverse holo cards | Not fixable from API side |
| `artist`/`supertype` null on newest sets | Cannot display artist for newest cards | Data lag; will be filled in by tcggo eventually |
| TCGPlayer prices absent/zero on international sets | Inaccurate TCGP market prices for Japan-locale sets | Ignore TCGPlayer data for Mega Evolution series |
| Duplicate episode entries (e.g., Stellar Crown id=10 and id=347) | Potential wrong episode match | Prefer entry with non-zero price total when deduplicating |
| CardMarket link redirects blocked for bots | Cannot programmatically follow `links.cardmarket` | Use `cardmarket_id` directly with CM's URL pattern |

---

## 10. Appendix — Rarity Values Observed

From Perfect Order (POR) and Paldean Fates (PAF):
- `Common`
- `Uncommon`
- `Rare`
- `Double Rare`
- `Shiny Rare`
- `Special Art Rare`
- `SECRET RARE`

> No "Reverse Holo" rarity values were observed in any episode. This confirms reverse holos are not represented as separate card entries.

---

## 11. Fields Required to Support Graded Prices from tcggo

To extract graded card prices from `prices.cardmarket.graded`, [`tcggoCardService.ts`](services/pricing/tcggoCardService.ts) needs to be updated. The following field mappings define what to extract and where to store it:

| Field path in API response | Maps to DB column | Action needed |
|---------------------------|-------------------|---------------|
| `prices.cardmarket.graded.psa.psa10` | `card_graded_prices.psa_10` or similar | Add extraction to [`tcggoCardService.ts`](services/pricing/tcggoCardService.ts) |
| `prices.cardmarket.graded.psa.psa9` | `card_graded_prices.psa_9` | Add extraction |
| `prices.cardmarket.graded.psa.psa8` | `card_graded_prices.psa_8` | Add extraction |
| `prices.cardmarket.graded.bgs.bgs10pristine` | `card_graded_prices.bgs_10_pristine` | Add extraction |
| `prices.cardmarket.graded.bgs.bgs10` | `card_graded_prices.bgs_10` | Add extraction |
| `prices.cardmarket.graded.bgs.bgs9` | `card_graded_prices.bgs_9` | Add extraction |
| `prices.cardmarket.graded.bgs.bgs8` | `card_graded_prices.bgs_8` | Add extraction |
| `prices.cardmarket.graded.cgc.cgc10` | `card_graded_prices.cgc_10` | Add extraction |
| `prices.cardmarket.graded.cgc.cgc9` | `card_graded_prices.cgc_9` | Add extraction |
| `prices.cardmarket.graded.cgc.cgc8` | `card_graded_prices.cgc_8` | Add extraction |

**Implementation notes:**
- Check `typeof graded === 'object' && !Array.isArray(graded)` before attempting to read sub-fields
- All values are in **EUR** (CardMarket-sourced)
- Store a `source: 'tcggo_cm'` marker to distinguish from eBay-sourced graded prices (`source: 'ebay'`)
- Not all sub-grades will be present; use optional chaining: `graded?.psa?.psa10 ?? null`
- A DB upsert strategy should prefer the tcggo EUR value for the `cardmarket` price column, and maintain the eBay USD value separately for comparison/fallback

---

## Live Test: Reverse Holo & Graded Prices

**Tested:** 2026-04-16
**Method:** Live HTTP calls to `https://cardmarket-api-tcg.p.rapidapi.com` using RapidAPI key
**Test sets:** Pokémon 151 (episode id=16, code=MEW) and Paldean Fates (episode id=14, code=PAF)

---

### L1. CardMarket Product Architecture (Clarified)

A key correction to prior assumptions about CardMarket's data model:

> **CardMarket does NOT create separate products for "normal" vs "holo"** — they are treated as the **same product** on CardMarket's platform.

The three CM variant pricing tiers for a Scarlet & Violet-era card are:

| Variant | CardMarket product | Accessible via |
|---------|--------------------|----------------|
| **Normal / Holo** | Single shared product | `cardmarket_id` (the ID tcggo provides) |
| **Reverse Holo** | Same product page | `?isReverseHolo=Y` added to the CM product URL |
| **Card-specific variants** (e.g., 1st edition, promo stamp) | Separate product with own ID | Different `cardmarket_id` |

**Implication for Lumidex:** The `cardmarket_id` tcggo returns is NOT just the "normal" variant ID — it is the ID for the normal/holo product that *also* surfaces reverse holo prices when queried with `?isReverseHolo=Y`. tcggo currently exposes only the normal/holo price; it does not invoke the `?isReverseHolo=Y` query.

---

### L2. Test: Beedrill #15, Pokémon 151 (sv3pt5-15, tcggo id=2528)

Chosen because Beedrill #15 from 151 **has both a holo and a reverse holo variant** on CardMarket.

**Command:** `GET /pokemon/cards?tcgid=sv3pt5-15`

**Full response fields returned:**
```json
{
  "id": 2528, "name": "Beedrill", "name_numbered": "Beedrill 15",
  "type": "singles", "card_number": 15, "rarity": "rare",
  "cardmarket_id": 733610, "tcgplayer_id": 502564,
  "prices": {
    "cardmarket": {
      "currency": "EUR",
      "lowest_near_mint": 0.02, "lowest_near_mint_EU_only": 0.02,
      "lowest_near_mint_DE": 0.02, "lowest_near_mint_DE_EU_only": 0.02,
      "lowest_near_mint_FR": 0.02, "lowest_near_mint_FR_EU_only": 0.02,
      "lowest_near_mint_ES": 0.04, "lowest_near_mint_ES_EU_only": 0.04,
      "lowest_near_mint_IT": 0.02, "lowest_near_mint_IT_EU_only": 0.02,
      "30d_average": 0.18, "7d_average": 0.17,
      "graded": []
    },
    "tcg_player": { "currency": "EUR", "market_price": 0.22, "mid_price": 0.21 }
  },
  "links": { "cardmarket": "https://www.tcggo.com/external/cm/2528", "tcgplayer": "..." }
}
```

**Key observations:**
- **ONE entry only** — no separate entry for reverse holo despite the card having a reverse variant on CM
- `"type": "singles"` — no reverse holo type value
- `"graded": []` — empty, as expected for a ~€0.02 card
- **No `cm_url` field** — only a tcggo-hosted redirect link (`links.cardmarket`)
- **No reverse holo price field** of any kind (`lowest_near_mint_reverse_holo`, `reverse_holo_low`, etc.)
- `cardmarket_id: 733610` is the shared normal/holo CM product ID

---

### L3. Test: Single Card Detail `/pokemon/cards/2528`

**Command:** `GET /pokemon/cards/2528`

Extra fields over listing response:
- `"flavor_text": "May appear in a swarm..."` — populated from pokemontcg.io
- `"abilities": null`
- `"attacks": null`

Price schema is **identical** to the listing response. No additional reverse holo or variant price fields appear in the detail endpoint.

---

### L4. Test: `type=reverse_holo` Parameter — Pokémon 151 (episode 16)

**Command:** `GET /pokemon/episodes/16/cards?type=reverse_holo&per_page=3`

**Result:** `results=207` — **completely ignored**. Returns all 207 cards in the set, all with `"type": "singles"`. The parameter has zero effect on filtering.

---

### L5. Test: `is_reverse_holo=true` Parameter — Pokémon 151 (episode 16)

**Command:** `GET /pokemon/episodes/16/cards?is_reverse_holo=true&per_page=3`

**Result:** `results=207` — **completely ignored**. Identical behaviour to `type=reverse_holo`. No parameter name tested causes the API to return reverse holo data.

---

### L6. Test: Graded Prices — Mew ex #151 (sv3pt5-151)

**Command:** `GET /pokemon/cards?tcgid=sv3pt5-151`

Mew ex is the namesake card of the 151 set (~€5–7 NM). Graded prices returned:

```json
"graded": {
  "psa": { "psa10": 60, "psa9": 59 }
}
```

**Confirmed:** Graded price data IS populated for valuable cards from the 151 set. Only PSA grades present (no BGS/CGC data for this card). Prices are in **EUR** (CardMarket-sourced).

---

### L7. Test: Graded Prices — PAF Charizard ex SIR (sv4pt5-234)

**Command:** `GET /pokemon/cards?tcgid=sv4pt5-234`

Full result:
```json
{
  "id": 2212, "rarity": "Special Illustration Rare",
  "cardmarket_id": 751781, "type": "singles",
  "prices": {
    "cardmarket": {
      "lowest_near_mint": 194, "lowest_near_mint_EU_only": 195,
      "lowest_near_mint_DE": 195, "lowest_near_mint_DE_EU_only": 195,
      "lowest_near_mint_FR": 199, "lowest_near_mint_FR_EU_only": 199,
      "lowest_near_mint_ES": 199, "lowest_near_mint_ES_EU_only": 199,
      "lowest_near_mint_IT": 154.99, "lowest_near_mint_IT_EU_only": 154.99,
      "30d_average": 222.46, "7d_average": 220.62,
      "graded": {
        "psa": { "psa10": 800, "psa9": 225 },
        "bgs": { "bgs9": 265, "bgs8": 245 },
        "cgc": { "cgc10": 499 }
      }
    },
    "tcg_player": { "currency": "EUR", "market_price": 220.74, "mid_price": 276.06 }
  }
}
```

**Confirmed:** All three graders (PSA, BGS, CGC) are present for this high-value card. Notable:
- PSA grades present: `psa10=800, psa9=225`
- BGS grades present: `bgs9=265, bgs8=245` — note **no `bgs10` or `bgs10pristine`** for this card
- CGC grades present: `cgc10=499`
- The SIR rarity card has **no reverse holo** (full art cards never do) — graded data confirmed independently of variant questions

---

### L8. Summary of Live Test Findings

#### Reverse Holo Prices

| Test | Result |
|------|--------|
| `api-1.json` contains any `reverse_holo` / `cm_url` / `isReverseHolo` field | ❌ **0 occurrences** — not documented anywhere in the spec |
| `/pokemon/cards?tcgid=sv3pt5-15` (Beedrill, has reverse holo on CM) | ❌ ONE entry only, no reverse holo price field |
| `/pokemon/cards/{id}` detail endpoint | ❌ No extra reverse holo fields over listing |
| `type=reverse_holo` filter on episode | ❌ **Completely ignored** — returns all 207 results |
| `is_reverse_holo=true` filter on episode | ❌ **Completely ignored** — returns all 207 results |
| Any `cm_url` field in response | ❌ Not present; only `links.cardmarket` (tcggo redirect, bot-blocked) |

**Conclusion: Reverse holo prices are definitively NOT available from the tcggo API.** No field, parameter, or endpoint exposes them. This confirms the existing research note that reverse holo pricing is "planned, not yet implemented."

#### Graded Prices (Confirmed Live)

| Card | NM Price | Graded data |
|------|----------|-------------|
| Beedrill #15 from 151 (~€0.02) | €0.02 | `[]` — empty, as expected |
| Mew ex #151 from 151 (~€7) | €5.00 | `psa.psa10=60, psa9=59` ✅ |
| Charizard ex SIR from PAF (~€194) | €194 | `psa.psa10=800, psa9=225`, `bgs.bgs9=265, bgs8=245`, `cgc.cgc10=499` ✅ |

**Conclusion:** Graded prices are live and accurate. All three grading companies (PSA, BGS, CGC) may be present. Not all grade levels appear for every card — only grades with active CM market data are included. Threshold for populated graded data appears to be roughly €5+ NM value.

---

### L9. Reverse Holo — Actionable Path Forward

Given the confirmed CardMarket product architecture:

1. **`cardmarket_id` from tcggo = the normal/holo CM product ID**, which is the *same* product that exposes reverse holo prices via `?isReverseHolo=Y` on CardMarket's platform.

2. **Deriving reverse holo prices** does not require a separate product ID — it requires querying the CardMarket price guide for the same product with the reverse holo flag:
   ```
   CardMarket price guide URL (normal/holo):
   https://www.cardmarket.com/en/Pokemon/Products/Singles/{set}/{card}?productId={cardmarket_id}
   
   Reverse holo price URL:
   https://www.cardmarket.com/en/Pokemon/Products/Singles/{set}/{card}?productId={cardmarket_id}&isReverseHolo=Y
   ```

3. **tcggo currently only scrapes the normal/holo price** for each product. When they implement reverse holo pricing (planned), they would logically surface it as an additional field on the same card entry — most likely as `prices.cardmarket.lowest_near_mint_reverse_holo` or a nested `reverse_holo` sub-object alongside `graded`.

4. **Immediate workaround** (no tcggo changes needed): since the `cardmarket_id` is already stored/recoverable, a dedicated CardMarket scraper/API call using that ID + `?isReverseHolo=Y` could supply reverse holo prices. This does not depend on tcggo.
