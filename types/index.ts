// Database types
export type PriceSource = 'tcgplayer' | 'cardmarket'
export type PortfolioVisibility = 'public' | 'friends_only' | 'private'

/**
 * How the user intends to complete a set.
 *  normal          – one of each card
 *  masterset       – all variants of every card
 *  grandmasterset  – all variants including promo cards (rarity = 'Promo')
 */
export type CollectionGoal = 'normal' | 'masterset' | 'grandmasterset'

export const COLLECTION_GOAL_LABELS: Record<CollectionGoal, string> = {
  normal:         'Normal Set',
  masterset:      'Masterset',
  grandmasterset: 'Grandmaster Set',
}

export const COLLECTION_GOAL_DESCRIPTIONS: Record<CollectionGoal, string> = {
  normal:         'One of each card',
  masterset:      'All variants of every card',
  grandmasterset: 'All variants including promos',
}

export interface User {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  location?: string | null;
  setup_completed?: boolean;
  preferred_language?: string;
  preferred_currency?: string;
  price_source?: PriceSource;
  grey_out_unowned?: boolean;
  profile_private?: boolean;
  show_portfolio_value?: PortfolioVisibility;
  lists_public_by_default?: boolean;
  /** Social / marketplace profile links (optional) */
  social_cardmarket?: string | null;
  social_instagram?: string | null;
  social_facebook?: string | null;
  created_at: string;
}

// ── Custom Lists ───────────────────────────────────────────────────────────────

/** A user-created named list of cards (e.g. "Yuka Collection"). */
export interface UserCardList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  /** Computed: number of cards in this list (returned by GET /api/user-lists). */
  card_count?: number;
  /** Computed: first few card image URLs for preview thumbnails. */
  preview_images?: (string | null)[];
  created_at: string;
  updated_at: string;
}

/** A single card entry inside a custom list. */
export interface UserCardListItem {
  id: string;
  list_id: string;
  card_id: string;
  added_at: string;
}

export interface UserSet {
  id: string;
  user_id: string;
  set_id: string;
  collection_goal: CollectionGoal;
  created_at: string;
}

export interface UserCard {
  id: string;
  user_id: string;
  card_id: string;
  quantity: number;
  /** Highest quantity of any single variant for this card. Used for duplicate detection. */
  maxVariantQty?: number;
  /**
   * Total number of extra copies across all variants — sum of max(0, qty−1) for each variant
   * with qty ≥ 2. Used for the Duplicates tab badge in SetPageCards.
   * e.g. Normal×2 + Reverse×2  →  duplicateCount = 2
   */
  duplicateCount?: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

// Database types (DB-first architecture)
export interface PokemonSet {
  id: string;
  name: string;
  series: string | null;
  total: number | null;
  setComplete?: number | null;
  release_date: string | null;
  logo_url?: string | null;
  symbol_url?: string | null;
  created_at: string;
  // Computed fields
  user_card_count?: number;
}

export interface PokemonCard {
  id: string;
  set_id: string;
  name: string | null;
  number: string | null;
  rarity: string | null;
  type: string | null; // Pokemon element type e.g. "Grass", "Fire", "Water"
  image: string | null; // New single image field
  artist?: string | null; // Illustrator credit, e.g. "GIDORA" (optional — not all routes fetch it)
  /** FK → variants.id — which variant is added when the card tile is double-clicked */
  default_variant_id?: string | null;
  created_at: string;
  // Legacy compatibility fields (deprecated after migration)
  image_small?: string | null;
  image_large?: string | null;
  image_url?: string; // Computed fallback for backward compatibility
  /** Set display name — only populated on the browse/search page where cards span multiple sets */
  set_name?: string | null;
  /** Set logo URL — only populated on the browse/search page */
  set_logo_url?: string | null;
}

/** A single data point in the price history chart. */
export interface PriceHistoryPoint {
  /** Variant key from card_price_history.variant_key */
  variantKey: 'normal' | 'reverse_holo' | 'holo' | '1st_edition' | string;
  /** Price in USD */
  priceUsd: number;
  /** ISO timestamp when this price was recorded */
  recordedAt: string;
}

/** Friend who owns a card — returned by /api/friends/card/[cardId] */
export interface FriendCardOwner {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  variants: { variantName: string; quantity: number }[];
}

// UI types
export interface SetProgress {
  owned_cards: number;
  total_cards: number;
  percentage: number;
}

export interface CardVariant {
  normal: number;
  reverse: number;
  holo: number;
}

// Variant system types
export interface Variant {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: 'green' | 'blue' | 'purple' | 'red' | 'pink' | 'yellow' | 'gray' | 'orange' | 'teal';
  short_label: string | null;
  is_quick_add: boolean;
  sort_order: number;
  is_official: boolean;
  created_by: string | null;
  created_at: string;
  // Card-specific variant: null/undefined means global variant
  card_id?: string | null;
  /** Per-card variant image URL (from card_variant_images table). Populated by /api/variants. */
  variant_image_url?: string | null;
}

export interface UserCardVariant {
  id: string;
  user_id: string;
  card_id: string;
  variant_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface VariantSuggestion {
  id: string;
  card_id: string;
  name: string;
  key: string;
  description: string | null;
  created_by: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  // Joined via FK: variant_suggestions.created_by → users.id
  users: { username: string } | null;
}

// Extended types for UI
export interface VariantWithQuantity extends Variant {
  quantity: number;
}

export interface QuickAddVariant {
  id: string;
  name: string;
  color: 'green' | 'blue' | 'purple' | 'red' | 'pink' | 'yellow' | 'gray' | 'orange' | 'teal';
  short_label: string | null;
  quantity: number;
  sort_order: number;
  /** Set when the variant is scoped to a specific card (card-specific variant). */
  card_id?: string | null;
  /** When true, double-clicking the card image adds this variant. Only one variant per card should have this set. */
  is_quick_add?: boolean;
  /** Per-card variant image URL (from card_variant_images table). Used for the hover image swap in the modal. */
  variant_image_url?: string | null;
}

// Color mapping for UI
export const VARIANT_COLORS = {
  green:  '🟢',
  blue:   '🔵',
  purple: '🟣',
  red:    '🔴',
  pink:   '🌸',
  yellow: '🟡',
  gray:   '⚪',
  orange: '🟠',
  teal:   '🩵',
} as const;

export const VARIANT_COLOR_CLASSES = {
  green:  'bg-green-500 hover:bg-green-600',
  blue:   'bg-blue-500 hover:bg-blue-600',
  purple: 'bg-purple-500 hover:bg-purple-600',
  red:    'bg-red-500 hover:bg-red-600',
  pink:   'bg-pink-500 hover:bg-pink-600',
  yellow: 'bg-yellow-500 hover:bg-yellow-600',
  gray:   'bg-gray-500 hover:bg-gray-600',
  orange: 'bg-orange-500 hover:bg-orange-600',
  teal:   'bg-teal-500 hover:bg-teal-600',
} as const;

// ── Graded Cards ──────────────────────────────────────────────────────────────

export const GRADING_COMPANIES = ['PSA', 'BECKETT', 'CGC', 'TAG', 'ACE'] as const
export type GradingCompany = typeof GRADING_COMPANIES[number]

/**
 * Per-company grade labels in ascending order (worst → best).
 * Grade is stored as the exact label string in the DB, so spelling
 * and casing here must never change after data has been written.
 */
export const GRADES_BY_COMPANY: Record<GradingCompany, string[]> = {
  PSA: [
    'VG-EX 4',
    'EX 5',
    'EX-MT 6',
    'NM 7',
    'NM+ 7.5',
    'NM-MT 8',
    'NM-MT+ 8.5',
    'MINT 9',
    'GEM-MT 10',
  ],
  BECKETT: [
    'EX-MT+ 6.5',
    'Near Mint 7',
    'Near Mint+ 7.5',
    'NM-MT 8',
    'NM-MT+ 8.5',
    'Mint 9',
    'Gem Mint 9.5',
    'Pristine 10',
    'Black Label 10',
  ],
  CGC: [
    'Ex/MT+ 6.5',
    'NM 7',
    'NM+ 7.5',
    'NM/Mint 8',
    'NM/Mint+ 8.5',
    'Mint 9',
    'Mint+ 9.5',
    'Gem Mint 10',
    'Pristine 10',
  ],
  TAG: [
    'EX MT 6',
    'EX MT+ 6.5',
    'NM 7',
    'NM+ 7.5',
    'NM MT 8',
    'NM MT+ 8.5',
    'MINT 9',
    'Pristine 10',
    'GEM MINT 10',
  ],
  ACE: [
    'FAIR 2',
    'GOOD 3',
    'VG 4',
    'EX 5',
    'EX-MT 6',
    'NM 7',
    'NM-MT 8',
    'MINT 9',
    'GEM MINT 10',
  ],
}

/** A single graded card entry in a user's collection. */
export interface UserGradedCard {
  id: string
  user_id: string
  card_id: string
  variant_id: string | null
  grading_company: GradingCompany
  grade: string
  quantity: number
  created_at: string
  updated_at: string
}