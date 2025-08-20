// Supabase Generated Types
// Generated from the complete database schema
// Project ID: xwlmuufqiscsdegiszyr
// Project URL: https://xwlmuufqiscsdegiszyr.supabase.co

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      cards: {
        Row: {
          id: string
          name: string
          set_id: string
          number: string
          rarity: string
          types: string[]
          hp: number | null
          image_small: string
          image_large: string
          cardmarket_url: string | null
          cardmarket_updated_at: string | null
          cardmarket_avg_sell_price: number | null
          cardmarket_low_price: number | null
          cardmarket_trend_price: number | null
          cardmarket_suggested_price: number | null
          cardmarket_german_pro_low: number | null
          cardmarket_low_price_ex_plus: number | null
          cardmarket_reverse_holo_sell: number | null
          cardmarket_reverse_holo_low: number | null
          cardmarket_reverse_holo_trend: number | null
          cardmarket_avg_1_day: number | null
          cardmarket_avg_7_days: number | null
          cardmarket_avg_30_days: number | null
          cardmarket_last_sync: string | null
          cardmarket_sync_status: string | null
          tcgplayer_price: number | null
          tcgplayer_url: string | null
          created_at: string | null
          updated_at: string | null
          tcgplayer_normal_available: boolean | null
          tcgplayer_holofoil_available: boolean | null
          tcgplayer_reverse_holo_available: boolean | null
          tcgplayer_1st_edition_available: boolean | null
          tcgplayer_last_sync: string | null
          tcgplayer_sync_status: string | null
          tcgplayer_1st_edition_normal_market: number | null
          tcgplayer_1st_edition_normal_low: number | null
          tcgplayer_1st_edition_normal_mid: number | null
          tcgplayer_1st_edition_normal_high: number | null
          tcgplayer_1st_edition_holofoil_market: number | null
          tcgplayer_1st_edition_holofoil_low: number | null
          tcgplayer_1st_edition_holofoil_mid: number | null
          tcgplayer_1st_edition_holofoil_high: number | null
        }
        Insert: {
          id: string
          name: string
          set_id: string
          number: string
          rarity: string
          types?: string[]
          hp?: number | null
          image_small: string
          image_large: string
          cardmarket_url?: string | null
          cardmarket_updated_at?: string | null
          cardmarket_avg_sell_price?: number | null
          cardmarket_low_price?: number | null
          cardmarket_trend_price?: number | null
          cardmarket_suggested_price?: number | null
          cardmarket_german_pro_low?: number | null
          cardmarket_low_price_ex_plus?: number | null
          cardmarket_reverse_holo_sell?: number | null
          cardmarket_reverse_holo_low?: number | null
          cardmarket_reverse_holo_trend?: number | null
          cardmarket_avg_1_day?: number | null
          cardmarket_avg_7_days?: number | null
          cardmarket_avg_30_days?: number | null
          cardmarket_last_sync?: string | null
          cardmarket_sync_status?: string | null
          tcgplayer_price?: number | null
          tcgplayer_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          tcgplayer_normal_available?: boolean | null
          tcgplayer_holofoil_available?: boolean | null
          tcgplayer_reverse_holo_available?: boolean | null
          tcgplayer_1st_edition_available?: boolean | null
          tcgplayer_last_sync?: string | null
          tcgplayer_sync_status?: string | null
          tcgplayer_1st_edition_normal_market?: number | null
          tcgplayer_1st_edition_normal_low?: number | null
          tcgplayer_1st_edition_normal_mid?: number | null
          tcgplayer_1st_edition_normal_high?: number | null
          tcgplayer_1st_edition_holofoil_market?: number | null
          tcgplayer_1st_edition_holofoil_low?: number | null
          tcgplayer_1st_edition_holofoil_mid?: number | null
          tcgplayer_1st_edition_holofoil_high?: number | null
        }
        Update: {
          id?: string
          name?: string
          set_id?: string
          number?: string
          rarity?: string
          types?: string[]
          hp?: number | null
          image_small?: string
          image_large?: string
          cardmarket_url?: string | null
          cardmarket_updated_at?: string | null
          cardmarket_avg_sell_price?: number | null
          cardmarket_low_price?: number | null
          cardmarket_trend_price?: number | null
          cardmarket_suggested_price?: number | null
          cardmarket_german_pro_low?: number | null
          cardmarket_low_price_ex_plus?: number | null
          cardmarket_reverse_holo_sell?: number | null
          cardmarket_reverse_holo_low?: number | null
          cardmarket_reverse_holo_trend?: number | null
          cardmarket_avg_1_day?: number | null
          cardmarket_avg_7_days?: number | null
          cardmarket_avg_30_days?: number | null
          cardmarket_last_sync?: string | null
          cardmarket_sync_status?: string | null
          tcgplayer_price?: number | null
          tcgplayer_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          tcgplayer_normal_available?: boolean | null
          tcgplayer_holofoil_available?: boolean | null
          tcgplayer_reverse_holo_available?: boolean | null
          tcgplayer_1st_edition_available?: boolean | null
          tcgplayer_last_sync?: string | null
          tcgplayer_sync_status?: string | null
          tcgplayer_1st_edition_normal_market?: number | null
          tcgplayer_1st_edition_normal_low?: number | null
          tcgplayer_1st_edition_normal_mid?: number | null
          tcgplayer_1st_edition_normal_high?: number | null
          tcgplayer_1st_edition_holofoil_market?: number | null
          tcgplayer_1st_edition_holofoil_low?: number | null
          tcgplayer_1st_edition_holofoil_mid?: number | null
          tcgplayer_1st_edition_holofoil_high?: number | null
        }
      }
      collection_stats: {
        Row: {
          id: string
          user_id: string
          set_id: string | null
          total_cards_in_set: number | null
          owned_cards: number
          completion_percentage: number | null
          total_value_eur: number
          total_value_usd: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          set_id?: string | null
          total_cards_in_set?: number | null
          owned_cards?: number
          completion_percentage?: number | null
          total_value_eur?: number
          total_value_usd?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          set_id?: string | null
          total_cards_in_set?: number | null
          owned_cards?: number
          completion_percentage?: number | null
          total_value_eur?: number
          total_value_usd?: number | null
          updated_at?: string | null
        }
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          addressee_id: string
          status: 'pending' | 'accepted' | 'declined' | 'blocked'
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          requester_id: string
          addressee_id: string
          status?: 'pending' | 'accepted' | 'declined' | 'blocked'
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          requester_id?: string
          addressee_id?: string
          status?: 'pending' | 'accepted' | 'declined' | 'blocked'
          created_at?: string | null
          updated_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          location: string | null
          privacy_level: 'public' | 'friends' | 'private'
          show_collection_value: boolean | null
          preferred_currency: string | null
          preferred_language: string | null
          created_at: string | null
          updated_at: string | null
          last_active: string | null
          favorite_set_id: string | null
          banner_url: string | null
          preferred_price_source: string | null
          setup_completed: boolean | null
          setup_completed_at: string | null
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          privacy_level?: 'public' | 'friends' | 'private'
          show_collection_value?: boolean | null
          preferred_currency?: string | null
          preferred_language?: string | null
          created_at?: string | null
          updated_at?: string | null
          last_active?: string | null
          favorite_set_id?: string | null
          banner_url?: string | null
          preferred_price_source?: string | null
          setup_completed?: boolean | null
          setup_completed_at?: string | null
        }
        Update: {
          id?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          privacy_level?: 'public' | 'friends' | 'private'
          show_collection_value?: boolean | null
          preferred_currency?: string | null
          preferred_language?: string | null
          created_at?: string | null
          updated_at?: string | null
          last_active?: string | null
          favorite_set_id?: string | null
          banner_url?: string | null
          preferred_price_source?: string | null
          setup_completed?: boolean | null
          setup_completed_at?: string | null
        }
      }
      price_history: {
        Row: {
          id: string
          card_id: string
          source: string
          price_type: string
          price: number
          currency: string
          recorded_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          card_id: string
          source: string
          price_type: string
          price: number
          currency?: string
          recorded_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          card_id?: string
          source?: string
          price_type?: string
          price?: number
          currency?: string
          recorded_at?: string | null
          created_at?: string | null
        }
      }
      sets: {
        Row: {
          id: string
          name: string
          series: string
          total_cards: number
          release_date: string
          symbol_url: string | null
          logo_url: string | null
          created_at: string | null
          updated_at: string | null
          background_url: string | null
        }
        Insert: {
          id: string
          name: string
          series: string
          total_cards: number
          release_date: string
          symbol_url?: string | null
          logo_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          background_url?: string | null
        }
        Update: {
          id?: string
          name?: string
          series?: string
          total_cards?: number
          release_date?: string
          symbol_url?: string | null
          logo_url?: string | null
          created_at?: string | null
          updated_at?: string | null
          background_url?: string | null
        }
      }
      trade_items: {
        Row: {
          id: string
          trade_id: string
          user_id: string
          card_id: string
          quantity: number
          condition: string
          is_foil: boolean | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          trade_id: string
          user_id: string
          card_id: string
          quantity?: number
          condition: string
          is_foil?: boolean | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          trade_id?: string
          user_id?: string
          card_id?: string
          quantity?: number
          condition?: string
          is_foil?: boolean | null
          notes?: string | null
          created_at?: string | null
        }
      }
      trades: {
        Row: {
          id: string
          initiator_id: string
          recipient_id: string
          status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
          initiator_message: string | null
          recipient_message: string | null
          created_at: string | null
          updated_at: string | null
          expires_at: string
          initiator_money_offer: number | null
          recipient_money_offer: number | null
          trade_method: string | null
          initiator_shipping_included: boolean | null
          recipient_shipping_included: boolean | null
          parent_trade_id: string | null
        }
        Insert: {
          id?: string
          initiator_id: string
          recipient_id: string
          status?: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
          initiator_message?: string | null
          recipient_message?: string | null
          created_at?: string | null
          updated_at?: string | null
          expires_at?: string
          initiator_money_offer?: number | null
          recipient_money_offer?: number | null
          trade_method?: string | null
          initiator_shipping_included?: boolean | null
          recipient_shipping_included?: boolean | null
          parent_trade_id?: string | null
        }
        Update: {
          id?: string
          initiator_id?: string
          recipient_id?: string
          status?: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
          initiator_message?: string | null
          recipient_message?: string | null
          created_at?: string | null
          updated_at?: string | null
          expires_at?: string
          initiator_money_offer?: number | null
          recipient_money_offer?: number | null
          trade_method?: string | null
          initiator_shipping_included?: boolean | null
          recipient_shipping_included?: boolean | null
          parent_trade_id?: string | null
        }
      }
      user_achievements: {
        Row: {
          id: string
          user_id: string
          achievement_type: string
          achievement_key: string
          unlocked_at: string | null
          progress: number | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          achievement_type: string
          achievement_key: string
          unlocked_at?: string | null
          progress?: number | null
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          achievement_type?: string
          achievement_key?: string
          unlocked_at?: string | null
          progress?: number | null
          metadata?: Json | null
          created_at?: string | null
        }
      }
      user_collections: {
        Row: {
          id: string
          user_id: string
          card_id: string
          quantity: number
          condition: 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged'
          is_foil: boolean | null
          acquired_date: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
          variant: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern' | '1st_edition'
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          quantity?: number
          condition?: 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged'
          is_foil?: boolean | null
          acquired_date?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          variant?: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern' | '1st_edition'
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          quantity?: number
          condition?: 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged'
          is_foil?: boolean | null
          acquired_date?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          variant?: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern' | '1st_edition'
        }
      },
      wishlist_lists: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          is_default: boolean
          is_public: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          is_default?: boolean
          is_public?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          is_default?: boolean
          is_public?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
      wishlists: {
        Row: {
          id: string
          user_id: string
          card_id: string
          priority: number
          max_price_eur: number | null
          condition_preference: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
          notes: string | null
          created_at: string | null
          updated_at: string | null
          wishlist_list_id: string
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          priority?: number
          max_price_eur?: number | null
          condition_preference?: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          wishlist_list_id: string
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          priority?: number
          max_price_eur?: number | null
          condition_preference?: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          wishlist_list_id?: string
        }
      }
    }
    Relationships: [
      {
        foreignKeyName: "cards_set_id_fkey"
        columns: ["set_id"]
        isOneToOne: false
        referencedRelation: "sets"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "user_collections_card_id_fkey"
        columns: ["card_id"]
        isOneToOne: false
        referencedRelation: "cards"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "user_collections_user_id_fkey"
        columns: ["user_id"]
        isOneToOne: false
        referencedRelation: "profiles"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "trade_items_card_id_fkey"
        columns: ["card_id"]
        isOneToOne: false
        referencedRelation: "cards"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "trade_items_trade_id_fkey"
        columns: ["trade_id"]
        isOneToOne: false
        referencedRelation: "trades"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "trade_items_user_id_fkey"
        columns: ["user_id"]
        isOneToOne: false
        referencedRelation: "profiles"
        referencedColumns: ["id"]
      }
    ]
  }
}


// Helper types for queries with relations
export type CardWithSet = Database['public']['Tables']['cards']['Row'] & {
  sets?: Database['public']['Tables']['sets']['Row']
}

export type UserCollectionWithCard = Database['public']['Tables']['user_collections']['Row'] & {
  cards?: CardWithSet
}

export type UserCollectionWithCardAndSet = Database['public']['Tables']['user_collections']['Row'] & {
  cards?: Database['public']['Tables']['cards']['Row'] & {
    sets?: Database['public']['Tables']['sets']['Row']
  }
}
