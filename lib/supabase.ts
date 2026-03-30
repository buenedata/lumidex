import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabasePublishableKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variable')
}

/**
 * Browser-side Supabase client. Uses @supabase/ssr's createBrowserClient which
 * stores auth sessions in cookies (not localStorage), making them accessible to
 * Server Actions and Server Components via the cookie-aware server client.
 */
export const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey)

// Server-side admin client with service role key — bypasses RLS.
// Does not need cookie-based auth since it uses the service role key directly.
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : (createClient(supabaseUrl, supabasePublishableKey) as ReturnType<typeof createClient>)

// Database types
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          avatar_url?: string
          role: string
          created_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          avatar_url?: string
          role?: string
          created_at?: string
        }
      }
      sets: {
        Row: {
          set_id: string
          name: string
          series: string | null
          setTotal: number | null       // cards excl. secret rares
          setComplete: number | null    // cards incl. secret rares
          release_date: string | null
          created_at: string
        }
        Insert: {
          set_id: string
          name: string
          series?: string | null
          setTotal?: number | null
          setComplete?: number | null
          release_date?: string | null
          created_at?: string
        }
        Update: {
          set_id?: string
          name?: string
          series?: string | null
          setTotal?: number | null
          setComplete?: number | null
          release_date?: string | null
          created_at?: string
        }
      }
      cards: {
        Row: {
          id: string
          set_id: string | null
          name: string | null
          number: string | null
          rarity: string | null
          image: string | null
          created_at: string
        }
        Insert: {
          id: string
          set_id?: string | null
          name?: string | null
          number?: string | null
          rarity?: string | null
          image?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          set_id?: string | null
          name?: string | null
          number?: string | null
          rarity?: string | null
          image?: string | null
          created_at?: string
        }
      }
      variants: {
        Row: {
          id: string
          name: string
          key: string
          card_id: string | null
          description: string | null
          color: string
          short_label: string | null
          is_quick_add: boolean
          sort_order: number
          is_official: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          key: string
          card_id?: string | null
          description?: string | null
          color?: string
          short_label?: string | null
          is_quick_add?: boolean
          sort_order?: number
          is_official?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          key?: string
          card_id?: string | null
          description?: string | null
          color?: string
          short_label?: string | null
          is_quick_add?: boolean
          sort_order?: number
          is_official?: boolean
          created_by?: string | null
          created_at?: string
        }
      }
      user_card_variants: {
        Row: {
          id: string
          user_id: string | null
          card_id: string | null
          variant_id: string | null
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          card_id?: string | null
          variant_id?: string | null
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          card_id?: string | null
          variant_id?: string | null
          quantity?: number
          created_at?: string
          updated_at?: string
        }
      }
      variant_suggestions: {
        Row: {
          id: string
          name: string | null
          key: string | null
          card_id: string | null
          description: string | null
          status: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name?: string | null
          key?: string | null
          card_id?: string | null
          description?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          key?: string | null
          card_id?: string | null
          description?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
        }
      }
      user_sets: {
        Row: {
          id: string
          user_id: string
          set_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          set_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          set_id?: string
          created_at?: string
        }
      }
      user_cards: {
        Row: {
          id: string
          user_id: string
          card_id: string
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
      }
      achievements: {
        Row: {
          id: string
          name: string
          description: string
          icon: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          icon: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          icon?: string
          created_at?: string
        }
      }
      user_achievements: {
        Row: {
          id: string
          user_id: string
          achievement_id: string
          unlocked_at: string
        }
        Insert: {
          id?: string
          user_id: string
          achievement_id: string
          unlocked_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          achievement_id?: string
          unlocked_at?: string
        }
      }
    }
  }
}