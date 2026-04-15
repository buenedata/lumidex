// ── Shared types for the Browse page components ───────────────────────────────

export type SearchMode = 'cards' | 'artists' | 'products'

export interface CardSearchResult {
  id:                 string
  name:               string
  image_url:          string
  number:             string
  rarity:             string
  type:               string
  supertype:          string
  default_variant_id: string | null
  /** Variant dots to display below the card image (from card_variant_availability overrides).
   *  Empty array = no explicit override configured for this card. */
  variants: {
    id:           string
    name:         string
    color:        string
    short_label:  string | null
    is_quick_add: boolean
    sort_order:   number
    card_id:      string | null
  }[]
  set: {
    id:           string
    name:         string
    series:       string
    release_date: string
    logo_url:     string
  }
}

export interface ArtistResult {
  name:          string
  card_count:    number
  sample_images: string[]
}

/** Lightweight product shape used throughout the Browse page (client-safe). */
export interface BrowseProduct {
  id:           string
  set_id:       string
  set_name:     string
  series:       string
  name:         string
  product_type: string | null
  image_url:    string | null
  tcgp_market:  number | null
}

export interface DiscoverySet {
  id:           string
  name:         string
  series:       string | null
  logo_url:     string | null
  release_date: string | null
  total:        number | null
}

export interface DiscoveryData {
  featuredArtists: ArtistResult[]
  recentSets:      DiscoverySet[]
}

export interface ActiveFilters {
  type:      string
  rarity:    string
  supertype: string
}
