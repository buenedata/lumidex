// Database Types
export interface Profile {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  banner_url?: string
  bio?: string
  location?: string
  favorite_set_id?: string
  privacy_level: 'public' | 'friends' | 'private'
  show_collection_value: boolean
  preferred_currency: string
  preferred_language: string
  preferred_price_source?: string
  setup_completed?: boolean
  setup_completed_at?: string
  created_at: string
  updated_at: string
  last_active?: string
}

export interface Set {
  id: string
  name: string
  series: string
  total_cards: number
  release_date: string
  symbol_url?: string
  logo_url?: string
  created_at: string
  updated_at: string
}

export interface Card {
  id: string
  name: string
  set_id: string
  number: string
  rarity: string
  types: string[]
  hp?: number
  image_small: string
  image_large: string
  
  // CardMarket pricing (EUR)
  cardmarket_url?: string
  cardmarket_updated_at?: string
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
  cardmarket_last_sync?: string
  cardmarket_sync_status?: 'success' | 'failed' | 'partial'
  
  // Legacy TCGPlayer data (optional)
  tcgplayer_price?: number
  tcgplayer_url?: string
  
  // TCGPlayer variant availability (for determining which variants exist)
  tcgplayer_normal_available?: boolean
  tcgplayer_holofoil_available?: boolean
  tcgplayer_reverse_holo_available?: boolean
  tcgplayer_1st_edition_available?: boolean
  tcgplayer_last_sync?: string
  tcgplayer_sync_status?: 'success' | 'failed' | 'partial'
  
  // TCGPlayer 1st Edition pricing (USD)
  tcgplayer_1st_edition_normal_market?: number
  tcgplayer_1st_edition_normal_low?: number
  tcgplayer_1st_edition_normal_mid?: number
  tcgplayer_1st_edition_normal_high?: number
  tcgplayer_1st_edition_holofoil_market?: number
  tcgplayer_1st_edition_holofoil_low?: number
  tcgplayer_1st_edition_holofoil_mid?: number
  tcgplayer_1st_edition_holofoil_high?: number
  
  created_at: string
  updated_at: string
  
  // Relations
  set?: Set
}

export interface UserCollection {
  id: string
  user_id: string
  card_id: string
  quantity: number
  condition: 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged'
  is_foil: boolean
  acquired_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  
  // Relations
  card?: Card
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
  updated_at: string
  
  // Relations
  requester?: Profile
  addressee?: Profile
}

export interface Trade {
  id: string
  initiator_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
  initiator_message?: string
  recipient_message?: string
  created_at: string
  updated_at: string
  expires_at: string
  
  // Relations
  initiator?: Profile
  recipient?: Profile
  trade_items?: TradeItem[]
}

export interface TradeItem {
  id: string
  trade_id: string
  user_id: string
  card_id: string
  quantity: number
  condition: string
  is_foil: boolean
  notes?: string
  created_at: string
  
  // Relations
  card?: Card
  user?: Profile
}

export interface Wishlist {
  id: string
  user_id: string
  card_id: string
  priority: 1 | 2 | 3 | 4 | 5
  max_price_eur?: number
  condition_preference: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
  notes?: string
  created_at: string
  updated_at: string
  
  // Relations
  card?: Card
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_type: string
  achievement_data: Record<string, any>
  unlocked_at: string
  created_at: string
}

export interface CollectionStats {
  id: string
  user_id: string
  set_id?: string
  total_cards_in_set?: number
  owned_cards: number
  completion_percentage?: number
  total_value_eur: number
  total_value_usd?: number
  updated_at: string
}

// API Response Types
export interface PokemonTCGApiResponse<T> {
  data: T
  page?: number
  pageSize?: number
  count?: number
  totalCount?: number
}

export interface CardMarketPricing {
  url: string
  updatedAt: string
  prices: {
    averageSellPrice?: number
    lowPrice?: number
    trendPrice?: number
    germanProLow?: number
    suggestedPrice?: number
    reverseHoloSell?: number
    reverseHoloLow?: number
    reverseHoloTrend?: number
    lowPriceExPlus?: number
    avg1?: number
    avg7?: number
    avg30?: number
  }
}

// UI Component Types
export interface Achievement {
  type: string
  icon: string
  title: string
  description: string
  unlocked?: boolean
  unlockedAt?: string
}

export interface CollectionMatch {
  id: string
  user_id: string
  friend_id: string
  card_id: string
  match_type: 'friend_has_wanted' | 'user_has_friend_wants'
  created_at: string
  
  // Relations
  card?: Card
  friend?: Profile
}

export interface PriceDisplay {
  price: number | null
  currency: string
  source: 'CardMarket' | 'TCGPlayer' | 'unavailable'
  updated?: string
}

// Form Types
export interface LoginForm {
  email: string
  password: string
}

export interface RegisterForm {
  email: string
  password: string
  username: string
  display_name?: string
}

export interface ProfileForm {
  username: string
  display_name?: string
  bio?: string
  location?: string
  favorite_set_id?: string
  privacy_level: 'public' | 'friends' | 'private'
  show_collection_value: boolean
  preferred_currency: string
  preferred_language: string
}

export interface TradeForm {
  recipient_id: string
  message?: string
  offered_cards: {
    card_id: string
    quantity: number
    condition: string
    is_foil: boolean
    notes?: string
  }[]
  requested_cards: {
    card_id: string
    quantity: number
    condition: string
    is_foil: boolean
    notes?: string
  }[]
}

// Filter and Search Types
export interface CardFilters {
  search?: string
  set_id?: string
  rarity?: string[]
  types?: string[]
  price_min?: number
  price_max?: number
  owned?: boolean
  wanted?: boolean
}

export interface SortOption {
  field: string
  direction: 'asc' | 'desc'
  label: string
}

// Error Types
export interface ApiError {
  message: string
  code?: string
  details?: Record<string, any>
}

// Utility Types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
}