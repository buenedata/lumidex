import { create } from 'zustand'
import { type User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { checkAndUnlockAchievements } from './achievements'
import type { PokemonSet, PokemonCard, UserCard, UserSet } from '@/types'
// Import from the client-safe constants file — NOT from lib/subscription (server-only)
import type { UserTier } from './tierLimits'

interface AuthState {
  user: User | null
  profile: any | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: any) => void
  setLoading: (loading: boolean) => void
}

// ─── Subscription store ───────────────────────────────────────────────────────

interface SubscriptionState {
  /** Current user tier. Defaults to 'free' until fetchSubscription() resolves. */
  tier: UserTier
  /** True while the initial subscription fetch is in-flight. */
  isSubscriptionLoading: boolean
  /** Fetch (or re-fetch) the authenticated user's tier from user_subscriptions. */
  fetchSubscription: () => Promise<void>
  /** Reset to free tier — called on sign-out. */
  resetSubscription: () => void
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  tier: 'free',
  isSubscriptionLoading: true,

  fetchSubscription: async () => {
    const { user } = useAuthStore.getState()
    if (!user) {
      set({ tier: 'free', isSubscriptionLoading: false })
      return
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('[subscription] fetchSubscription error:', error)
      // Fail-safe: never accidentally block the user — default to free
      set({ tier: 'free', isSubscriptionLoading: false })
      return
    }

    set({
      tier: ((data?.tier as UserTier) ?? 'free'),
      isSubscriptionLoading: false,
    })
  },

  resetSubscription: () => set({ tier: 'free', isSubscriptionLoading: false }),
}))

interface CollectionState {
  userSets: UserSet[]
  userCards: Map<string, UserCard>
  /** Number of distinct owned cards per set — populated by fetchUserCards via RPC. */
  userCardCountBySet: Map<string, number>
  /**
   * Total count of distinct (card_id, variant_id) rows owned with quantity > 0.
   * Each variant type is counted once regardless of how many duplicate copies exist.
   */
  totalCardVariantCount: number
  /**
   * DB-aggregated SUM of all quantity values across every user_card_variants row.
   * Computed server-side via get_user_collection_stats RPC to avoid PostgREST's
   * default max_rows cap (1 000) truncating large collections.
   */
  cardsOwned: number
  /**
   * DB-aggregated COUNT of distinct card_id values the user owns (quantity > 0).
   * One card always counts as 1 regardless of how many variants or copies are tracked.
   * Computed server-side via get_user_collection_stats RPC.
   */
  distinctCardsOwned: number
  tcgSets: Map<string, PokemonSet>
  /** @deprecated Use tcgSets instead */
  pokemonSets: Map<string, PokemonSet>
  pokemonCards: Map<string, PokemonCard[]>
  /** True while a fetchTcgSets request is in-flight — prevents duplicate concurrent calls. */
  isFetchingSets: boolean

  // Actions
  addUserSet: (setId: string) => Promise<void>
  removeUserSet: (setId: string) => Promise<void>
  updateCardQuantity: (cardId: string, quantity: number, variants?: { normal?: number; reverse?: number; holo?: number }) => Promise<void>
  fetchUserSets: () => Promise<void>
  fetchUserCards: (setId?: string) => Promise<void>
  fetchTcgSets: (game?: string) => Promise<void>
  /** @deprecated Use fetchTcgSets instead */
  fetchPokemonSets: (game?: string) => Promise<void>
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
  totalCardVariantCount: 0,
  cardsOwned: 0,
  distinctCardsOwned: 0,
  tcgSets: new Map(),
  pokemonSets: new Map(), // @deprecated alias for tcgSets — kept for backward compatibility
  pokemonCards: new Map(),
  isFetchingSets: false,

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
      .select('id, user_id, set_id, collection_goal, created_at')
      .eq('user_id', user.id)

    if (data && !error) {
      set({ userSets: data })
    }
  },

  fetchUserCards: async (_setId?: string) => {
    const { user } = useAuthStore.getState()
    if (!user) return

    // Fire all three reads in parallel for speed.
    //
    // 1. Raw variant rows — used to build the local card map for set-level UI.
    //    .limit(10000) is a best-effort guard; PostgREST's server-side max_rows
    //    may still cap this at 1 000 on some projects, which is why totals for
    //    dashboard stats come from the aggregate RPC instead (see #3 below).
    //
    // 2. Per-set card counts via RPC — powers set-completion progress rings.
    //
    // 3. Aggregate stats RPC — returns SUM(quantity) and COUNT(DISTINCT card_id)
    //    in a single row, bypassing the row-count cap entirely.
    const [
      { data, error },
      { data: setCounts, error: setCountError },
      { data: statsData, error: statsError },
      { data: gradedData, error: gradedError },
    ] = await Promise.all([
      supabase
        .from('user_card_variants')
        .select('card_id, quantity')
        .eq('user_id', user.id)
        .gt('quantity', 0)
        .limit(10000),
      supabase.rpc('get_user_card_counts_by_set', { p_user_id: user.id }),
      supabase.rpc('get_user_collection_stats',   { p_user_id: user.id }),
      // Also fetch graded cards so graded-only entries (no user_card_variants rows)
      // are visible in the store and show as owned in the UI.
      supabase
        .from('user_graded_cards')
        .select('card_id, quantity')
        .eq('user_id', user.id)
        .gt('quantity', 0),
    ])

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

      // ── Merge graded-card quantities ─────────────────────────────────────────
      // Graded-only cards (no user_card_variants rows) are otherwise absent from
      // the Map and invisible to all "owned / Have" logic in CardGrid.
      // For each card_id in user_graded_cards, sum the quantities and either add
      // them to an existing variant-based entry or create a new entry.
      if (gradedData && !gradedError) {
        gradedData.forEach((graded: { card_id: string; quantity: number }) => {
          const extraGraded = Math.max(0, graded.quantity - 1)
          const existing = cardMap.get(graded.card_id)
          if (existing) {
            existing.quantity      += graded.quantity
            existing.duplicateCount += extraGraded
            if (graded.quantity > existing.maxVariantQty) {
              existing.maxVariantQty = graded.quantity
            }
          } else {
            cardMap.set(graded.card_id, {
              id:             '',
              user_id:        user.id,
              card_id:        graded.card_id,
              quantity:       graded.quantity,
              maxVariantQty:  graded.quantity,
              duplicateCount: extraGraded,
            })
          }
        })
      } else if (gradedError) {
        console.error('[fetchUserCards] graded cards fetch error:', gradedError)
      }

      const countBySet = new Map<string, number>()
      if (setCounts && !setCountError) {
        setCounts.forEach((row: { set_id: string; card_count: number }) => {
          countBySet.set(row.set_id, Number(row.card_count))
        })
      } else if (setCountError) {
        console.error('Error fetching user card counts by set:', setCountError)
      }

      // Aggregate stats from the server-side RPC (accurate, no row-cap risk)
      const stats = statsData?.[0]
      const cardsOwned      = stats ? Number(stats.total_quantity) : 0
      const distinctCardsOwned = stats ? Number(stats.distinct_cards) : 0
      if (statsError) {
        console.error('Error fetching collection stats:', statsError)
      }

      set({
        userCards: cardMap,
        userCardCountBySet: countBySet,
        totalCardVariantCount: data.length,
        cardsOwned,
        distinctCardsOwned,
      })
    }
  },

  fetchTcgSets: async (game?: string) => {
    // Skip if data is already loaded or a fetch is already in-flight.
    // Note: when a game filter is supplied we always fetch (different subset).
    if (!game && get().tcgSets.size > 0) return
    if (get().isFetchingSets) return
    set({ isFetchingSets: true })
    try {
      const url = game ? `/api/sets?game=${encodeURIComponent(game)}` : '/api/sets'
      const response = await fetch(url)
      if (response.ok) {
        const { sets } = await response.json()
        const setsMap = new Map()
        sets.forEach((s: PokemonSet) => setsMap.set(s.id, s))
        // Keep pokemonSets in sync as deprecated alias
        set({ tcgSets: setsMap, pokemonSets: setsMap })
      }
    } catch (error) {
      console.error('Error fetching TCG sets:', error)
    } finally {
      set({ isFetchingSets: false })
    }
  },

  /** @deprecated Use fetchTcgSets instead */
  fetchPokemonSets: async (game?: string) => {
    return get().fetchTcgSets(game)
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

      // Fetch subscription tier (Pro / free) — runs in parallel with above
      useSubscriptionStore.getState().fetchSubscription()
    } else {
      // For TOKEN_REFRESHED / USER_UPDATED we only need to park the new
      // user object; isLoading is already false at this point.
      setLoading(false)
    }
  } else {
    setUser(null)
    setProfile(null)
    setLoading(false)
    useSubscriptionStore.getState().resetSubscription()
  }
})