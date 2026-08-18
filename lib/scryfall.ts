/**
 * Scryfall API Client
 * Typed, server-side-only helpers for fetching MTG card data from Scryfall.
 * https://scryfall.com/docs/api
 *
 * Rate limit: Scryfall asks for ≤10 req/s; we enforce 100ms between requests.
 * No API key required.
 */

const SCRYFALL_BASE = 'https://api.scryfall.com'

/** Minimum delay between Scryfall requests (ms) to stay well under rate limit. */
const REQUEST_DELAY_MS = 100

/** Set types included in Phase 1 of the MTG integration. */
export const MTG_IMPORTED_SET_TYPES = ['expansion', 'core', 'masters'] as const
export type MtgImportedSetType = (typeof MTG_IMPORTED_SET_TYPES)[number]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScryfallSet {
  object: 'set'
  id: string
  code: string
  name: string
  set_type: string
  released_at: string | null
  card_count: number
  digital: boolean
  icon_svg_uri: string
  scryfall_uri: string
}

export interface ScryfallCardFace {
  object: 'card_face'
  name: string
  type_line?: string
  image_uris?: ScryfallImageUris
}

export interface ScryfallImageUris {
  small: string
  normal: string
  large: string
  png: string
  art_crop: string
  border_crop: string
}

export interface ScryfallCard {
  object: 'card'
  id: string
  name: string
  set: string
  collector_number: string
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus'
  artist: string | null
  type_line: string | null
  /** Present on single-faced cards; null on DFCs (use card_faces instead). */
  image_uris?: ScryfallImageUris
  /** Present on double-faced cards. */
  card_faces?: ScryfallCardFace[]
  /** e.g. ["nonfoil", "foil"] or ["nonfoil", "foil", "etched"] */
  finishes: string[]
  lang: string
  digital: boolean
}

interface ScryfallList<T> {
  object: 'list'
  total_cards?: number
  has_more: boolean
  next_page?: string
  data: T[]
}

export interface ScryfallBulkDataEntry {
  object: 'bulk_data'
  id: string
  type: string
  name: string
  description: string
  download_uri: string
  updated_at: string
  size: number
  content_type: string
  content_encoding: string
}

/** A Scryfall set enriched for the admin import UI. */
export interface ScryfallSetListing extends ScryfallSet {
  series: string
  already_imported: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sleep for `ms` milliseconds. Use between Scryfall requests. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Resolve the display image URL for a card.
 * For double-faced cards (DFCs), `image_uris` is null at the root level;
 * the front-face image lives in `card_faces[0].image_uris`.
 */
export function getCardImageUrl(card: ScryfallCard): string | null {
  if (card.image_uris?.normal) return card.image_uris.normal
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal
  return null
}

/**
 * Normalise a Scryfall rarity string to Title Case.
 * e.g. "mythic" → "Mythic Rare", "common" → "Common"
 */
export function normaliseRarity(raw: string): string {
  switch (raw.toLowerCase()) {
    case 'common':   return 'Common'
    case 'uncommon': return 'Uncommon'
    case 'rare':     return 'Rare'
    case 'mythic':   return 'Mythic Rare'
    case 'special':  return 'Special'
    case 'bonus':    return 'Bonus'
    default:         return raw.charAt(0).toUpperCase() + raw.slice(1)
  }
}

/**
 * Derive the Lumidex `series` label from a Scryfall set_type.
 * Only expansion, core, and masters are in Phase 1 scope.
 */
export function deriveSetSeries(setType: string): string {
  switch (setType) {
    case 'expansion':
    case 'core':
      return 'Standard Sets'
    case 'masters':
      return 'Masters Sets'
    default:
      return 'Supplemental'
  }
}

/**
 * Determine whether a set_type is in the Phase 1 import scope.
 */
export function isImportableSetType(setType: string): setType is MtgImportedSetType {
  return (MTG_IMPORTED_SET_TYPES as readonly string[]).includes(setType)
}

// ── API fetchers ──────────────────────────────────────────────────────────────

/**
 * Fetch all MTG sets from Scryfall and filter to importable types
 * (expansion, core, masters), sorted newest → oldest.
 */
export async function fetchScryfallSets(): Promise<ScryfallSet[]> {
  const res = await fetch(`${SCRYFALL_BASE}/sets`, {
    headers: { 'User-Agent': 'Lumidex/1.0 (collector platform)' },
    next: { revalidate: 3600 }, // cache for 1 hour in Next.js
  })

  if (!res.ok) {
    throw new Error(`Scryfall /sets failed: ${res.status} ${res.statusText}`)
  }

  const body: ScryfallList<ScryfallSet> = await res.json()

  return body.data
    .filter(
      (s) =>
        isImportableSetType(s.set_type) &&
        !s.digital &&               // exclude MTGO-only digital sets
        s.released_at !== null,     // exclude unreleased sets
    )
    .sort((a, b) => {
      // Newest first
      const dateA = a.released_at ?? ''
      const dateB = b.released_at ?? ''
      return dateB.localeCompare(dateA)
    })
}

/**
 * Fetch a single Scryfall set by its code (e.g. "dsk").
 */
export async function fetchScryfallSet(code: string): Promise<ScryfallSet> {
  const res = await fetch(`${SCRYFALL_BASE}/sets/${code.toLowerCase()}`, {
    headers: { 'User-Agent': 'Lumidex/1.0 (collector platform)' },
  })

  if (!res.ok) {
    throw new Error(`Scryfall /sets/${code} failed: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

/**
 * Fetch all cards for an MTG set using Scryfall's paginated search.
 * Respects the 100ms delay between requests.
 *
 * @param code   Scryfall set code, e.g. "dsk"
 * @param onPage Optional callback called after each page with running total.
 */
export async function fetchScryfallSetCards(
  code: string,
  onPage?: (fetched: number, total: number) => void,
): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = []
  // English cards only, ordered by collector number, unique prints
  let url: string | null =
    `${SCRYFALL_BASE}/cards/search?q=set:${code.toLowerCase()}+lang:en&order=collector_number&unique=prints`

  while (url) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Lumidex/1.0 (collector platform)' },
    })

    if (res.status === 404) break // set exists but has 0 searchable cards

    if (!res.ok) {
      throw new Error(`Scryfall /cards/search failed for set ${code}: ${res.status} ${res.statusText}`)
    }

    const page: ScryfallList<ScryfallCard> = await res.json()

    // Filter out digital-only cards (MTGO / Arena exclusive)
    const physical = page.data.filter((c) => !c.digital)
    cards.push(...physical)

    if (onPage) {
      onPage(cards.length, page.total_cards ?? cards.length)
    }

    url = page.has_more && page.next_page ? page.next_page : null

    if (url) await sleep(REQUEST_DELAY_MS)
  }

  return cards
}

/**
 * Fetch the Scryfall bulk-data catalogue and return the download URL
 * for the "default_cards" dump (all English cards, ~100 MB JSON).
 * Used by the CLI import script for efficient one-shot imports.
 */
export async function fetchScryfallBulkDataUrl(): Promise<string> {
  const res = await fetch(`${SCRYFALL_BASE}/bulk-data`, {
    headers: { 'User-Agent': 'Lumidex/1.0 (collector platform)' },
  })

  if (!res.ok) {
    throw new Error(`Scryfall /bulk-data failed: ${res.status} ${res.statusText}`)
  }

  const body: ScryfallList<ScryfallBulkDataEntry> = await res.json()
  const entry = body.data.find((e) => e.type === 'default_cards')

  if (!entry) {
    throw new Error('Could not find "default_cards" entry in Scryfall bulk-data catalogue')
  }

  return entry.download_uri
}
