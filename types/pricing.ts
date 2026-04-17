// ─────────────────────────────────────────────────────────────────────────────
// types/pricing.ts
// Type definitions for the unified item-price system (singles, graded, products)
// backed by the TCGGO API and the item_prices DB table.
// ─────────────────────────────────────────────────────────────────────────────

// Item types supported
export type ItemType = 'single' | 'graded' | 'product';

// Variant types
// For singles: 'normal' | 'reverse_holo'
// For graded: grade keys — 'psa10' | 'psa9' | 'psa8' | 'bgs10pristine' | 'bgs10' | 'bgs9' | 'bgs8' | 'cgc10' | 'cgc9' | 'cgc8'
// For products: 'normal'
export type GradeVariant =
  | 'psa10' | 'psa9' | 'psa8'
  | 'bgs10pristine' | 'bgs10' | 'bgs9' | 'bgs8'
  | 'cgc10' | 'cgc9' | 'cgc8';

export type CardVariant = 'normal' | 'reverse_holo';
export type ItemVariant = CardVariant | GradeVariant;

// The canonical return type from getItemPrice()
export interface ItemPriceResult {
  price: number | null;
  currency: string;
  updated_at: string; // ISO timestamp
}

// Row shape in the item_prices table
export interface ItemPriceRow {
  id: string;
  item_id: string;
  item_type: ItemType;
  variant: string;
  price: number | null;
  currency: string;
  source: 'tcggo' | 'cardmarket';
  updated_at: string;
}

// TCGGO API response shape (partial — only price-relevant fields)
export interface TcggoCardPrices {
  cardmarket?: {
    currency: string;
    lowest_near_mint?: number | null;
    graded?: TcggoGradedPricesMap | TcggoGradedPricesMap[];
  };
  tcg_player?: {
    currency: string;
    market_price?: number | null;
  };
}

export interface TcggoGradedPricesMap {
  psa?: { psa10?: number; psa9?: number; psa8?: number };
  bgs?: { bgs10pristine?: number; bgs10?: number; bgs9?: number; bgs8?: number };
  cgc?: { cgc10?: number; cgc9?: number; cgc8?: number };
}

export interface TcggoProductPrices {
  cardmarket?: {
    currency: string;
    lowest?: number | null;
  };
}

export interface TcggoCardResponse {
  id: number;
  type: 'singles';
  prices: TcggoCardPrices;
  links?: { cardmarket?: string };
}

export interface TcggoProductResponse {
  id: number;
  prices: TcggoProductPrices;
  links?: { cardmarket?: string };
}
