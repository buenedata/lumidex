// Source identifiers
export type PriceSource = 'tcgplayer' | 'cardmarket' | 'ebay';

// Valid variant keys — must match variants.key in DB
export type VariantKey = 'normal' | 'reverse' | 'holo' | 'pokeball' | 'masterball';

export const VALID_VARIANT_KEYS: VariantKey[] = ['normal', 'reverse', 'holo', 'pokeball', 'masterball'];

// A single raw price data point before normalization
export interface RawPricePoint {
  cardId: string;          // DB uuid
  source: PriceSource;
  variantKey: VariantKey | null;    // null if unmappable
  price: number;
  currency: string;        // 'USD' | 'EUR'
  condition?: string;
  isGraded: boolean;
  grade?: number | null;
  gradingCompany?: string | null;
}

// A normalized price point (always USD)
export interface NormalizedPricePoint extends RawPricePoint {
  priceUsd: number;        // Always USD
}

// Card data needed for search
export interface CardSearchData {
  id: string;             // DB uuid
  name: string;
  set_id: string;
  number: string;
  api_id?: string | null;
  /** Rarity string from the DB (e.g. 'Common', 'Uncommon', 'Rare Holo'). Used to skip
   *  eBay graded searches for low-value cards that are never graded in practice. */
  rarity?: string | null;
}

// Result from pokemonApiService
export interface PokemonApiPriceResult {
  cardId: string;
  points: RawPricePoint[];
  /** Direct URL to the card's CardMarket product page, if present in the API response */
  cmUrl?: string | null;
}

// Result from ebayService
export interface EbayPriceResult {
  cardId: string;
  average: number;
  median: number;
  currency: 'USD';
  variantKey: VariantKey | null;
  sampleSize: number;
  isGraded: false;
}

// Grading companies supported for eBay last-sold price fetching
export type GradingCompany = 'PSA' | 'CGC' | 'ACE';

// Result from ebayGradedService
export interface EbayGradedResult {
  cardId: string;
  gradingCompany: GradingCompany;
  grade: number;
  average: number;
  median: number;
  currency: 'USD';
  variantKey: VariantKey | null;
  sampleSize: number;
}

// Aggregated values to write to card_prices (ONLY these columns)
export interface CardPriceUpdate {
  cardId: string;
  tcgp_normal?: number | null;
  tcgp_reverse_holo?: number | null;
  tcgp_holo?: number | null;
  tcgp_1st_edition?: number | null;
  tcgp_market?: number | null;
  tcgp_psa10?: number | null;
  tcgp_psa9?: number | null;
  cm_avg_sell?: number | null;
  cm_low?: number | null;
  cm_trend?: number | null;
  cm_avg_30d?: number | null;
  /** CardMarket avg sell price for the reverse holo variant (EUR) */
  cm_reverse_holo?: number | null;
  /** CardMarket avg sell price for the Cosmos Holo variant (EUR) — manually set; not auto-fetched */
  cm_cosmos_holo?: number | null;
  /** Direct URL to this card on CardMarket */
  cm_url?: string | null;
}
