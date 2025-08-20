// Supabase Generated Types
// Replace this file with generated types from Supabase
// 
// To generate types:
// 1. Run: npx supabase gen types typescript --project-id xwlmuufqiscsdegiszyr > src/types/supabase.ts
// 2. Or copy from Supabase Dashboard → Settings → API → Generated types
//
// Project ID: xwlmuufqiscsdegiszyr
// Project URL: https://xwlmuufqiscsdegiszyr.supabase.co

export interface Database {
  public: {
    Tables: {
      user_collections: {
        Row: {
          id: string
          user_id: string
          card_id: string
          variant: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern' | '1st_edition'
          quantity: number
          condition: string
          is_foil: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          variant?: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern' | '1st_edition'
          quantity?: number
          condition?: string
          is_foil?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          variant?: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern' | '1st_edition'
          quantity?: number
          condition?: string
          is_foil?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      // Add other tables as needed...
    }
  }
}
