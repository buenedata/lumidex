// ─────────────────────────────────────────────────────────────────────────────
// components/analytics/types.ts
//
// Shared TypeScript interfaces for the Pro Analytics UI layer.
// These are the component-layer types (snake_case) used by the analytics
// components. CollectionAnalytics.tsx maps the camelCase API responses to
// these types before passing them to child components.
// ─────────────────────────────────────────────────────────────────────────────

export interface TopCard {
  card_id: string
  card_name: string
  set_name: string
  /** Rarity string (e.g. "Double Rare", "Common") used as variant label */
  variant_type: string
  image_url: string | null
  /** Total EUR value (price × quantity) */
  value_eur: number
  quantity: number
}

export interface RarityBucket {
  rarity: string
  card_count: number
  total_value_eur: number
}

export interface SetValueEntry {
  set_id: string
  set_name: string
  total_value_eur: number
  card_count: number
}

export interface PerformerCard {
  card_id: string
  card_name: string
  variant_type: string
  image_url: string | null
  price_change_eur: number
  price_change_pct: number
}

export interface PortfolioHistoryPoint {
  /** ISO date string "YYYY-MM-DD" */
  date: string
  total_value_eur: number
  card_count: number
}

export interface CollectionAnalyticsData {
  top_cards: TopCard[]
  rarity_breakdown: RarityBucket[]
  value_by_set: SetValueEntry[]
  best_performers: PerformerCard[]
  worst_performers: PerformerCard[]
}
