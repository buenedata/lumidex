import { create } from 'zustand'
import { type User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { checkAndUnlockAchievements } from './achievements'
import type { PokemonSet, PokemonCard, UserCard, UserSet } from '@/types'

interface AuthState {
  user: User | null
  profile: any | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: any) => void
  setLoading: (loading: boolean) => void
}

interface CollectionState {
  userSets: UserSet[]
  userCards: Map<string, UserCard>
  /** Number of distinct owned cards per set — populated by fetchUserCards via RPC. */
  userCardCountBySet: Map<string, number>
  pokemonSets: Map<string, PokemonSet>
  pokemonCards: Map<string, PokemonCard[]>
  
  // Actions
  addUserSet: (setId: string) => Promise<void>
  removeUserSet: (setId: string) => Promise<void>
  updateCardQuantity: (cardId: string, quantity: number, variants?: { normal?: number; reverse?: number; holo?: number }) => Promise<void>
  fetchUserSets: () => Promise<void>
  fetchUserCards: (setId?: string) => Promise<void>
  fetchPokemonSets: () => Promise<void>
  fetchPokemonCards: (setId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading })
}))

export const useCollectionStore = create<CollectionState>((set, get) => ({
  userSets: [],
  userCards: new Map(),
  userCardCountBySet: new Map(),
  pokemonSets: new Map(),
  pokemonCards: new Map(),

  addUserSet: async (setId: string) => {
    const { user } = useAuthStore.getState()
    if (!user) return

    const { error } = await supabase
      .from('user_sets')
      .insert([{ user_id: user.id, set_id: setId }])

    if (!error) {
      await get().fetchUserSets()
    }
  },

  removeUserSet: async (setId: string) => {
    const { user } = useAuthStore.getState()
    if (!user) return

    const { error } = await supabase
      .from('user_sets')
      .delete()
      .eq('user_id', user.id)
      .eq('set_id', setId)

    if (!error) {
      await get().fetchUserSets()
    }
  },

  updateCardQuantity: async (cardId: string, quantity: number, variants?: { normal?: number; reverse?: number; holo?: number }) => {
    const { user } = useAuthStore.getState()
    if (!user) {
      console.error('No user found for updateCardQuantity')
      return
    }

    const currentCards = new Map(get().userCards)

    if (quantity === 0) {
      // Delete the row so user_cards never has orphan records with quantity 0
      const { error } = await supabase
        .from('user_cards')
        .delete()
        .eq('user_id', user.id)
        .eq('card_id', cardId)

      if (error) {
        console.error('Database error deleting user card:', error)
        return
      }

      currentCards.delete(cardId)
      set({ userCards: currentCards })

      // Check for achievements that may need to be revoked after card removal
      checkAndUnlockAchievements(user.id).catch(console.error)
      return
    }

    const { data, error } = await supabase
      .from('user_cards')
      .upsert([{
        user_id: user.id,
        card_id: cardId,
        quantity: quantity
      }], {
        onConflict: 'user_id,card_id'
      })
      .select()

    if (error) {
      console.error('Database error:', error)
      return
    }

    // Highest per-variant quantity — used by the Duplicates filter (maxVariantQty >= 2).
    const maxVariantQty = variants
      ? Math.max(variants.normal ?? 0, variants.reverse ?? 0, variants.holo ?? 0)
      : quantity   // no breakdown provided → treat total as proxy

    // Total extra copies — sum of max(0, qty−1) for each variant with qty >= 2.
    // Used for the Duplicates badge count in SetPageCards.
    const extraCopies = (qty: number) => Math.max(0, qty - 1)
    const duplicateCount = variants
      ? extraCopies(variants.normal ?? 0) + extraCopies(variants.reverse ?? 0) + extraCopies(variants.holo ?? 0)
      : Math.max(0, quantity - 1)

    // Update local state
    currentCards.set(cardId, {
      id: '',
      user_id: user.id,
      card_id: cardId,
      quantity,
      maxVariantQty,
      duplicateCount,
    })
    set({ userCards: currentCards })

    // Check for new achievements
    checkAndUnlockAchievements(user.id).catch(console.error)
  },

  fetchUserSets: async () => {
    const { user } = useAuthStore.getState()
    if (!user) return

    const { data, error } = await supabase
      .from('user_sets')
      .select('*')
      .eq('user_id', user.id)

    if (data && !error) {
      set({ userSets: data })
    }
  },

  fetchUserCards: async (_setId?: string) => {
    const { user } = useAuthStore.getState()
    if (!user) return

    // Read from user_card_variants (new source of truth) and aggregate
    // total quantities per card. The legacy user_cards table can diverge
    // from user_card_variants when variants are removed without going
    // through the legacy update path, so we no longer rely on it here.
    const { data, error } = await supabase
      .from('user_card_variants')
      .select('card_id, quantity')
      .eq('user_id', user.id)
      .gt('quantity', 0)

    // Fetch per-set owned card counts via the RPC (one row per set,
    // far cheaper than joining every variant row in JS).
    const { data: setCounts, error: setCountError } = await supabase
      .rpc('get_user_card_counts_by_set', { p_user_id: user.id })

    if (data && !error) {
      const cardMap = new Map<string, { id: string; user_id: string; card_id: string; quantity: number; maxVariantQty: number; duplicateCount: number }>()
      data.forEach(variant => {
        // Each row is one (card_id, variant_id) pair.
        // Extra copies for this variant = max(0, qty − 1)
        const extraCopies = Math.max(0, variant.quantity - 1)
        const existing = cardMap.get(variant.card_id)
        if (existing) {
          existing.quantity      += variant.quantity
          existing.duplicateCount += extraCopies
          if (variant.quantity > existing.maxVariantQty) {
            existing.maxVariantQty = variant.quantity
          }
        } else {
          cardMap.set(variant.card_id, {
            id: '',
            user_id: user.id,
            card_id: variant.card_id,
            quantity: variant.quantity,
            maxVariantQty: variant.quantity,
            duplicateCount: extraCopies,
          })
        }
      })

      const countBySet = new Map<string, number>()
      if (setCounts && !setCountError) {
        setCounts.forEach((row: { set_id: string; card_count: number }) => {
          countBySet.set(row.set_id, Number(row.card_count))
        })
      } else if (setCountError) {
        console.error('Error fetching user card counts by set:', setCountError)
      }

      set({ userCards: cardMap, userCardCountBySet: countBySet })
    }
  },

  fetchPokemonSets: async () => {
    try {
      const response = await fetch('/api/sets')
      if (response.ok) {
        const { sets } = await response.json()
        const setsMap = new Map()
        sets.forEach((set: PokemonSet) => setsMap.set(set.id, set))
        set({ pokemonSets: setsMap })
      }
    } catch (error) {
      console.error('Error fetching Pokemon sets:', error)
    }
  },

  fetchPokemonCards: async (setId: string) => {
    try {
      const response = await fetch(`/api/cards?setId=${setId}`)
      if (response.ok) {
        const { cards } = await response.json()
        const currentCards = new Map(get().pokemonCards)
        currentCards.set(setId, cards)

        // Keep at most 5 sets in memory at any time.  JavaScript Maps preserve
        // insertion order, so the first key is always the oldest entry.
        // Without this cap the Map grows indefinitely as users browse sets,
        // holding every card array in the heap for the entire session.
        const MAX_CACHED_SETS = 5
        if (currentCards.size > MAX_CACHED_SETS) {
          const oldestKey = currentCards.keys().next().value as string
          currentCards.delete(oldestKey)
        }

        set({ pokemonCards: currentCards })
      }
    } catch (error) {
      console.error('Error fetching Pokemon cards:', error)
    }
  }
}))

// Initialize auth state
supabase.auth.onAuthStateChange((event, session) => {
  const { setUser, setProfile, setLoading } = useAuthStore.getState()

  if (session?.user) {
    setUser(session.user)

    // TOKEN_REFRESHED fires every time the tab regains focus — we must NOT
    // re-fetch collection data in that case or every tab-switch causes a
    // full page re-render.  Only load data on the initial sign-in events.
    const isInitialLoad =
      event === 'SIGNED_IN' || event === 'INITIAL_SESSION'

    if (isInitialLoad) {
      // Fetch user profile — keep isLoading=true until the profile is
      // resolved so that role-based guards never see
      // (isLoading=false, profile=null).
      Promise.resolve(
        supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
      )
        .then(({ data }) => {
          if (data) setProfile(data)
        })
        .finally(() => {
          setLoading(false)
        })

      // Initialize collection data
      const { fetchUserSets, fetchUserCards } = useCollectionStore.getState()
      fetchUserSets()
      fetchUserCards()
    } else {
      // For TOKEN_REFRESHED / USER_UPDATED we only need to park the new
      // user object; isLoading is already false at this point.
      setLoading(false)
    }
  } else {
    setUser(null)
    setProfile(null)
    setLoading(false)
  }
})