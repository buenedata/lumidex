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
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          location: string | null
          favorite_set_id: string | null
          privacy_level: 'public' | 'friends' | 'private'
          show_collection_value: boolean
          preferred_currency: string
          preferred_language: string
          created_at: string
          updated_at: string
          last_active: string | null
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          favorite_set_id?: string | null
          privacy_level?: 'public' | 'friends' | 'private'
          show_collection_value?: boolean
          preferred_currency?: string
          preferred_language?: string
          created_at?: string
          updated_at?: string
          last_active?: string | null
        }
        Update: {
          id?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          favorite_set_id?: string | null
          privacy_level?: 'public' | 'friends' | 'private'
          show_collection_value?: boolean
          preferred_currency?: string
          preferred_language?: string
          created_at?: string
          updated_at?: string
          last_active?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_favorite_set_id_fkey"
            columns: ["favorite_set_id"]
            referencedRelation: "sets"
            referencedColumns: ["id"]
          }
        ]
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          series: string
          total_cards: number
          release_date: string
          symbol_url?: string | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          series?: string
          total_cards?: number
          release_date?: string
          symbol_url?: string | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          cardmarket_sync_status: 'success' | 'failed' | 'partial' | null
          tcgplayer_price: number | null
          tcgplayer_url: string | null
          tcgplayer_normal_available: boolean | null
          tcgplayer_holofoil_available: boolean | null
          tcgplayer_reverse_holo_available: boolean | null
          tcgplayer_1st_edition_available: boolean | null
          tcgplayer_last_sync: string | null
          tcgplayer_sync_status: 'success' | 'failed' | 'partial' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          set_id: string
          number: string
          rarity: string
          types: string[]
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
          cardmarket_sync_status?: 'success' | 'failed' | 'partial' | null
          tcgplayer_price?: number | null
          tcgplayer_url?: string | null
          tcgplayer_normal_available?: boolean | null
          tcgplayer_holofoil_available?: boolean | null
          tcgplayer_reverse_holo_available?: boolean | null
          tcgplayer_1st_edition_available?: boolean | null
          tcgplayer_last_sync?: string | null
          tcgplayer_sync_status?: 'success' | 'failed' | 'partial' | null
          created_at?: string
          updated_at?: string
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
          cardmarket_sync_status?: 'success' | 'failed' | 'partial' | null
          tcgplayer_price?: number | null
          tcgplayer_url?: string | null
          tcgplayer_normal_available?: boolean | null
          tcgplayer_holofoil_available?: boolean | null
          tcgplayer_reverse_holo_available?: boolean | null
          tcgplayer_1st_edition_available?: boolean | null
          tcgplayer_last_sync?: string | null
          tcgplayer_sync_status?: 'success' | 'failed' | 'partial' | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_set_id_fkey"
            columns: ["set_id"]
            referencedRelation: "sets"
            referencedColumns: ["id"]
          }
        ]
      }
      user_collections: {
        Row: {
          id: string
          user_id: string
          card_id: string
          quantity: number
          condition: 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged'
          is_foil: boolean
          variant: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern'
          acquired_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          quantity?: number
          condition?: 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged'
          is_foil?: boolean
          variant?: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern'
          acquired_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          quantity?: number
          condition?: 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged'
          is_foil?: boolean
          variant?: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern'
          acquired_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_collections_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_collections_card_id_fkey"
            columns: ["card_id"]
            referencedRelation: "cards"
            referencedColumns: ["id"]
          }
        ]
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          addressee_id: string
          status: 'pending' | 'accepted' | 'blocked'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          addressee_id: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          addressee_id?: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      trades: {
        Row: {
          id: string
          initiator_id: string
          recipient_id: string
          status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
          initiator_message: string | null
          recipient_message: string | null
          created_at: string
          updated_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          initiator_id: string
          recipient_id: string
          status?: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
          initiator_message?: string | null
          recipient_message?: string | null
          created_at?: string
          updated_at?: string
          expires_at: string
        }
        Update: {
          id?: string
          initiator_id?: string
          recipient_id?: string
          status?: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
          initiator_message?: string | null
          recipient_message?: string | null
          created_at?: string
          updated_at?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_initiator_id_fkey"
            columns: ["initiator_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_recipient_id_fkey"
            columns: ["recipient_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      trade_items: {
        Row: {
          id: string
          trade_id: string
          user_id: string
          card_id: string
          quantity: number
          condition: string
          is_foil: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          trade_id: string
          user_id: string
          card_id: string
          quantity?: number
          condition: string
          is_foil?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          trade_id?: string
          user_id?: string
          card_id?: string
          quantity?: number
          condition?: string
          is_foil?: boolean
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_items_trade_id_fkey"
            columns: ["trade_id"]
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_items_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_items_card_id_fkey"
            columns: ["card_id"]
            referencedRelation: "cards"
            referencedColumns: ["id"]
          }
        ]
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          priority?: number
          max_price_eur?: number | null
          condition_preference?: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          priority?: number
          max_price_eur?: number | null
          condition_preference?: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_card_id_fkey"
            columns: ["card_id"]
            referencedRelation: "cards"
            referencedColumns: ["id"]
          }
        ]
      }
      user_achievements: {
        Row: {
          id: string
          user_id: string
          achievement_type: string
          achievement_data: Json
          unlocked_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          achievement_type: string
          achievement_data?: Json
          unlocked_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          achievement_type?: string
          achievement_data?: Json
          unlocked_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          set_id?: string | null
          total_cards_in_set?: number | null
          owned_cards: number
          completion_percentage?: number | null
          total_value_eur: number
          total_value_usd?: number | null
          updated_at?: string
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_stats_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_stats_set_id_fkey"
            columns: ["set_id"]
            referencedRelation: "sets"
            referencedColumns: ["id"]
          }
        ]
      }
      price_history: {
        Row: {
          id: string
          card_id: string
          date: string
          cardmarket_avg_sell_price: number | null
          cardmarket_low_price: number | null
          cardmarket_trend_price: number | null
          cardmarket_suggested_price: number | null
          cardmarket_reverse_holo_sell: number | null
          cardmarket_reverse_holo_low: number | null
          cardmarket_reverse_holo_trend: number | null
          tcgplayer_price: number | null
          tcgplayer_normal_market: number | null
          tcgplayer_normal_low: number | null
          tcgplayer_normal_mid: number | null
          tcgplayer_normal_high: number | null
          tcgplayer_holofoil_market: number | null
          tcgplayer_holofoil_low: number | null
          tcgplayer_holofoil_mid: number | null
          tcgplayer_holofoil_high: number | null
          tcgplayer_reverse_holo_market: number | null
          tcgplayer_reverse_holo_low: number | null
          tcgplayer_reverse_holo_mid: number | null
          tcgplayer_reverse_holo_high: number | null
          tcgplayer_1st_edition_normal_market: number | null
          tcgplayer_1st_edition_normal_low: number | null
          tcgplayer_1st_edition_normal_mid: number | null
          tcgplayer_1st_edition_normal_high: number | null
          tcgplayer_1st_edition_holofoil_market: number | null
          tcgplayer_1st_edition_holofoil_low: number | null
          tcgplayer_1st_edition_holofoil_mid: number | null
          tcgplayer_1st_edition_holofoil_high: number | null
          data_source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          card_id: string
          date: string
          cardmarket_avg_sell_price?: number | null
          cardmarket_low_price?: number | null
          cardmarket_trend_price?: number | null
          cardmarket_suggested_price?: number | null
          cardmarket_reverse_holo_sell?: number | null
          cardmarket_reverse_holo_low?: number | null
          cardmarket_reverse_holo_trend?: number | null
          tcgplayer_price?: number | null
          tcgplayer_normal_market?: number | null
          tcgplayer_normal_low?: number | null
          tcgplayer_normal_mid?: number | null
          tcgplayer_normal_high?: number | null
          tcgplayer_holofoil_market?: number | null
          tcgplayer_holofoil_low?: number | null
          tcgplayer_holofoil_mid?: number | null
          tcgplayer_holofoil_high?: number | null
          tcgplayer_reverse_holo_market?: number | null
          tcgplayer_reverse_holo_low?: number | null
          tcgplayer_reverse_holo_mid?: number | null
          tcgplayer_reverse_holo_high?: number | null
          tcgplayer_1st_edition_normal_market?: number | null
          tcgplayer_1st_edition_normal_low?: number | null
          tcgplayer_1st_edition_normal_mid?: number | null
          tcgplayer_1st_edition_normal_high?: number | null
          tcgplayer_1st_edition_holofoil_market?: number | null
          tcgplayer_1st_edition_holofoil_low?: number | null
          tcgplayer_1st_edition_holofoil_mid?: number | null
          tcgplayer_1st_edition_holofoil_high?: number | null
          data_source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          card_id?: string
          date?: string
          cardmarket_avg_sell_price?: number | null
          cardmarket_low_price?: number | null
          cardmarket_trend_price?: number | null
          cardmarket_suggested_price?: number | null
          cardmarket_reverse_holo_sell?: number | null
          cardmarket_reverse_holo_low?: number | null
          cardmarket_reverse_holo_trend?: number | null
          tcgplayer_price?: number | null
          tcgplayer_normal_market?: number | null
          tcgplayer_normal_low?: number | null
          tcgplayer_normal_mid?: number | null
          tcgplayer_normal_high?: number | null
          tcgplayer_holofoil_market?: number | null
          tcgplayer_holofoil_low?: number | null
          tcgplayer_holofoil_mid?: number | null
          tcgplayer_holofoil_high?: number | null
          tcgplayer_reverse_holo_market?: number | null
          tcgplayer_reverse_holo_low?: number | null
          tcgplayer_reverse_holo_mid?: number | null
          tcgplayer_reverse_holo_high?: number | null
          tcgplayer_1st_edition_normal_market?: number | null
          tcgplayer_1st_edition_normal_low?: number | null
          tcgplayer_1st_edition_normal_mid?: number | null
          tcgplayer_1st_edition_normal_high?: number | null
          tcgplayer_1st_edition_holofoil_market?: number | null
          tcgplayer_1st_edition_holofoil_low?: number | null
          tcgplayer_1st_edition_holofoil_mid?: number | null
          tcgplayer_1st_edition_holofoil_high?: number | null
          data_source?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_card_id_fkey"
            columns: ["card_id"]
            referencedRelation: "cards"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}