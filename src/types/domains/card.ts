// Card domain types - consolidates Pokemon cards, sets, pricing, and variants

import { BaseEntity, Currency, PriceRangeFilter, BaseFilter, SortConfig } from '../core/common'

/**
 * Pokemon set information
 */
export interface PokemonSet extends BaseEntity {
  name: string
  series: string
  total_cards: number
  release_date: string
  symbol_url?: string
  logo_url?: string
  background_url?: string
}

/**
 * Card rarity types
 */
export type CardRarity = 
  | 'Common' 
  | 'Uncommon' 
  | 'Rare' 
  | 'Rare Holo' 
  | 'Rare Holo EX' 
  | 'Rare Holo GX' 
  | 'Rare Holo V' 
  | 'Rare Holo VMAX' 
  | 'Rare Secret' 
  | 'Rare Rainbow' 
  | 'Promo'

/**
 * Pokemon types
 */
export type PokemonType = 
  | 'Grass' 
  | 'Fire' 
  | 'Water' 
  | 'Lightning' 
  | 'Psychic' 
  | 'Fighting' 
  | 'Darkness' 
  | 'Metal' 
  | 'Fairy' 
  | 'Dragon' 
  | 'Colorless'

/**
 * Card variants available for collection
 */
export type CardVariant = 
  | 'normal' 
  | 'holo' 
  | 'reverse_holo' 
  | 'pokeball_pattern' 
  | 'masterball_pattern' 
  | '1st_edition'

/**
 * Card condition for trading and collection
 */
export type CardCondition = 
  | 'mint' 
  | 'near_mint' 
  | 'lightly_played' 
  | 'moderately_played' 
  | 'heavily_played' 
  | 'damaged'

/**
 * Price source providers
 */
export type PriceSource = 'CardMarket' | 'TCGPlayer'

/**
 * CardMarket pricing data structure
 */
export interface CardMarketPricing {
  url?: string
  updated_at?: string
  last_sync?: string
  sync_status?: 'success' | 'failed' | 'partial'
  
  // Current pricing
  avg_sell_price?: number
  low_price?: number
  trend_price?: number
  suggested_price?: number
  german_pro_low?: number
  low_price_ex_plus?: number
  
  // Reverse holo pricing
  reverse_holo_sell?: number
  reverse_holo_low?: number
  reverse_holo_trend?: number
  
  // Historical averages
  avg_1_day?: number
  avg_7_days?: number
  avg_30_days?: number
}

/**
 * TCGPlayer pricing data structure
 */
export interface TCGPlayerPricing {
  url?: string
  last_sync?: string
  sync_status?: 'success' | 'failed' | 'partial'
  
  // Variant availability
  normal_available?: boolean
  holofoil_available?: boolean
  reverse_holo_available?: boolean
  first_edition_available?: boolean
  
  // Legacy pricing
  price?: number
  
  // 1st Edition pricing
  first_edition_normal_market?: number
  first_edition_normal_low?: number
  first_edition_normal_mid?: number
  first_edition_normal_high?: number
  first_edition_holofoil_market?: number
  first_edition_holofoil_low?: number
  first_edition_holofoil_mid?: number
  first_edition_holofoil_high?: number
}

/**
 * Core Pokemon card entity
 */
export interface PokemonCard extends BaseEntity {
  name: string
  set_id: string
  number: string
  rarity: CardRarity
  types: PokemonType[]
  hp?: number
  
  // Images
  image_small: string
  image_large: string
  
  // Pricing data (structured)
  cardmarket: CardMarketPricing
  tcgplayer: TCGPlayerPricing
  
  // Legacy flat pricing properties (for backwards compatibility)
  cardmarket_url?: string
  cardmarket_updated_at?: string
  cardmarket_last_sync?: string
  cardmarket_sync_status?: 'success' | 'failed' | 'partial'
  cardmarket_avg_sell_price?: number
  cardmarket_low_price?: number
  cardmarket_trend_price?: number
  cardmarket_suggested_price?: number
  cardmarket_german_pro_low?: number
  cardmarket_low_price_ex_plus?: number
  cardmarket_reverse_holo_sell?: number
  cardmarket_reverse_holo_low?: number
  cardmarket_reverse_holo_trend?: number
  cardmarket_avg_1_day?: number
  cardmarket_avg_7_days?: number
  cardmarket_avg_30_days?: number
  
  tcgplayer_url?: string
  tcgplayer_last_sync?: string
  tcgplayer_sync_status?: 'success' | 'failed' | 'partial'
  tcgplayer_price?: number
  tcgplayer_normal_available?: boolean
  tcgplayer_holofoil_available?: boolean
  tcgplayer_reverse_holo_available?: boolean
  tcgplayer_1st_edition_available?: boolean
  tcgplayer_1st_edition_normal_market?: number
  tcgplayer_1st_edition_normal_low?: number
  tcgplayer_1st_edition_normal_mid?: number
  tcgplayer_1st_edition_normal_high?: number
  tcgplayer_1st_edition_holofoil_market?: number
  tcgplayer_1st_edition_holofoil_low?: number
  tcgplayer_1st_edition_holofoil_mid?: number
  tcgplayer_1st_edition_holofoil_high?: number
  
  // Relations (populated when needed)
  set?: PokemonSet
}

/**
 * Card with variant-specific data for collection display
 */
export interface CardWithVariants extends PokemonCard {
  availableVariants: CardVariant[]
  collectionData?: CardCollectionData
  wishlistData?: CardWishlistData
}

/**
 * Collection data for a specific card and user
 */
export interface CardCollectionData {
  cardId: string
  userId: string
  
  // Variant quantities
  normal: number
  holo: number
  reverseHolo: number
  pokeballPattern: number
  masterballPattern: number
  firstEdition: number
  
  // Totals
  totalQuantity: number
  
  // Metadata
  dateAdded: string
  lastUpdated: string
}

/**
 * Wishlist data for a specific card and user
 */
export interface CardWishlistData {
  cardId: string
  userId: string
  priority: 1 | 2 | 3 | 4 | 5
  maxPrice?: number
  currency: Currency
  conditionPreference: CardCondition | 'any'
  notes?: string
  listId: string
  listName: string
  dateAdded: string
}

/**
 * Price display information for UI
 */
export interface CardPriceDisplay {
  price: number | null
  currency: Currency
  source: PriceSource | 'unavailable'
  variant?: CardVariant
  condition?: CardCondition
  updated?: string
  confidence?: 'high' | 'medium' | 'low'
}

/**
 * Historical price point
 */
export interface CardPriceHistoryPoint {
  date: string
  price: number
  currency: Currency
  source: PriceSource
  priceType: string
}

/**
 * Card filters for searching and browsing
 */
export interface CardFilters extends BaseFilter, PriceRangeFilter {
  setId?: string
  series?: string
  rarity?: CardRarity[]
  types?: PokemonType[]
  owned?: boolean
  wanted?: boolean
  variants?: CardVariant[]
  conditions?: CardCondition[]
  hasPrice?: boolean
  priceSource?: PriceSource
}

/**
 * Card sort options
 */
export type CardSortField = 
  | 'name' 
  | 'number' 
  | 'rarity' 
  | 'price' 
  | 'release_date' 
  | 'value' 
  | 'quantity'
  | 'date_added'

/**
 * Card list response for browsing
 */
export interface CardListItem {
  id: string
  name: string
  number: string
  rarity: CardRarity
  image_small: string
  set: Pick<PokemonSet, 'id' | 'name' | 'symbol_url'>
  price: CardPriceDisplay
  isOwned: boolean
  isWanted: boolean
  ownedQuantity?: number
}

/**
 * Detailed card information for modal/page view
 */
export interface CardDetails extends PokemonCard {
  set: PokemonSet
  priceHistory: CardPriceHistoryPoint[]
  marketAnalysis: CardMarketAnalysis
  collectionInfo?: CardCollectionInfo
  tradingInfo?: CardTradingInfo
}

/**
 * Market analysis for a card
 */
export interface CardMarketAnalysis {
  trend: 'up' | 'down' | 'stable'
  volatility: 'low' | 'medium' | 'high'
  liquidity: 'low' | 'medium' | 'high'
  recommendation: 'buy' | 'sell' | 'hold' | 'unknown'
  confidence: number
  factors: string[]
}

/**
 * Collection info for a specific card
 */
export interface CardCollectionInfo {
  variants: CardCollectionVariant[]
  totalValue: number
  firstAcquired?: string
  lastAcquired?: string
  averageCondition: CardCondition
  notes?: string
}

/**
 * Collection variant details
 */
export interface CardCollectionVariant {
  variant: CardVariant
  condition: CardCondition
  quantity: number
  acquiredDate?: string
  value: number
  notes?: string
}

/**
 * Trading information for a card
 */
export interface CardTradingInfo {
  availableForTrade: boolean
  friendsWhoHave: TradingFriend[]
  friendsWhoWant: TradingFriend[]
  recentTrades: RecentCardTrade[]
  marketValue: number
  tradeValue: number
}

/**
 * Friend trading information
 */
export interface TradingFriend {
  userId: string
  username: string
  displayName?: string
  avatarUrl?: string
  quantity?: number
  condition?: CardCondition
  variant?: CardVariant
  lastActive?: string
}

/**
 * Recent trade involving this card
 */
export interface RecentCardTrade {
  tradeId: string
  date: string
  fromUser: string
  toUser: string
  quantity: number
  condition: CardCondition
  variant: CardVariant
  value?: number
}

/**
 * Bulk card operations
 */
export interface BulkCardOperation {
  cardIds: string[]
  operation: 'add_to_collection' | 'remove_from_collection' | 'add_to_wishlist' | 'remove_from_wishlist'
  options?: {
    variant?: CardVariant
    condition?: CardCondition
    quantity?: number
    listId?: string
  }
}

/**
 * Card import/export format
 */
export interface CardImportData {
  cardId?: string
  name: string
  setName: string
  number: string
  variant?: CardVariant
  condition?: CardCondition
  quantity: number
  notes?: string
}

/**
 * Set completion statistics
 */
export interface SetCompletion {
  setId: string
  setName: string
  totalCards: number
  ownedCards: number
  ownedUnique: number
  completionPercentage: number
  missingCards: string[]
  duplicateCards: string[]
  setValue: number
}