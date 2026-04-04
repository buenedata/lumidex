'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { PokemonCard, UserCard, VariantWithQuantity, QuickAddVariant, VARIANT_COLOR_CLASSES, CollectionGoal, PriceHistoryPoint, FriendCardOwner, PriceSource } from '@/types'
import { useCollectionStore, useAuthStore } from '@/lib/store'
import Modal from '@/components/ui/Modal'
import VariantSuggestionModal from '@/components/VariantSuggestionModal'
import { formatPrice, EUR_TO_USD } from '@/lib/pricing'
import type { PriceChartRange } from '@/components/PriceChart'
import { updateVariant, deleteVariant } from '@/app/admin/variants/actions'

// Recharts has SSR issues — load only on client
const PriceChart = dynamic(() => import('@/components/PriceChart'), { ssr: false })

// ── Price row shape returned by /api/prices/card/[cardId] ─────────────────────
interface CardPriceRow {
  tcgp_normal:       number | null
  tcgp_reverse_holo: number | null
  tcgp_holo:         number | null
  tcgp_1st_edition:  number | null
  tcgp_market:       number | null
  tcgp_psa10:        number | null
  tcgp_psa9:         number | null
  tcgp_bgs95:        number | null
  tcgp_bgs9:         number | null
  tcgp_cgc10:        number | null
  cm_avg_sell:       number | null
  cm_low:            number | null
  cm_trend:          number | null
  cm_avg_30d:        number | null
  tcgp_updated_at:   string | null
  cm_updated_at:     string | null
  fetched_at:        string
}

type ModalTab = 'card' | 'price' | 'trade' | 'friends'

type SortBy    = 'number' | 'name' | 'price'
type FilterTab = 'all' | 'owned' | 'missing' | 'duplicates'

interface RelatedCard {
  id: string
  name: string | null
  number: string | null
  rarity: string | null
  image: string | null
  set_id: string | null
  setName: string | null
  setLogoUrl: string | null
}

interface CardGridProps {
  cards: PokemonCard[]
  userCards: Map<string, UserCard>
  filter?: FilterTab
  sortBy?: SortBy
  userId?: string
  setTotal: number
  setName?: string
  setComplete?: number
  /** If set, auto-opens the card modal for this card ID on mount (from ?card= URL param) */
  initialCardId?: string
  /**
   * How the user wants to complete the set.
   *  normal          – any variant owned → card is "Have"
   *  masterset       – ALL loaded quick-add variants must have qty > 0
   *  grandmasterset  – same as masterset (promo cards included via full card list)
   */
  collectionGoal?: CollectionGoal
  /** Mock price map (cardId → USD). Supplied by SetPageCards. */
  cardPricesUSD?: Record<string, number>
  /** User's preferred currency code, e.g. 'USD', 'NOK'. */
  currency?: string
  /** User's preferred price source — drives which source label is shown. */
  priceSource?: PriceSource
  /** Called once the batch variant fetch completes with the deduplicated legend variants. */
  onVariantsLegendChange?: (variants: QuickAddVariant[]) => void
  /**
   * When true, cards are never greyed out regardless of the user's grey_out_unowned setting.
   * Used on the browse/search page where collection status should not affect card appearance.
   */
  disableGreyOut?: boolean
}

// ── Standalone component — zero React state, RAF-gated DOM writes for buttery 3D tilt ──
function CardGlareImage({ src, alt }: { src: string | null | undefined; alt?: string }) {
  const cardRef  = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)
  const rafRef   = useRef<number | null>(null)

  // Cancel any pending RAF when unmounted
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !glareRef.current) return
    // Capture before RAF (synthetic events are pooled)
    const clientX = e.clientX
    const clientY = e.clientY
    const rect    = e.currentTarget.getBoundingClientRect()

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!cardRef.current || !glareRef.current) return
      const x = (clientX - rect.left) / rect.width   // 0 → 1
      const y = (clientY - rect.top)  / rect.height  // 0 → 1

      const rotateY =  (x - 0.5) * 20   // −10 … +10 deg
      const rotateX = -(y - 0.5) * 15   // +7.5 … −7.5 deg

      // No transition while tracking — card follows cursor at native frame rate
      cardRef.current.style.transition = 'none'
      cardRef.current.style.transform  =
        `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`

      glareRef.current.style.opacity    = '1'
      glareRef.current.style.background =
        `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0) 65%)`
    })
  }

  const handleMouseLeave = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (!cardRef.current || !glareRef.current) return
    // Spring back to flat with premium easing
    cardRef.current.style.transition = 'transform 600ms cubic-bezier(0.16,1,0.3,1)'
    cardRef.current.style.transform  = 'perspective(800px) rotateX(0deg) rotateY(0deg)'
    glareRef.current.style.opacity   = '0'
  }

  return (
    // Padding gives rotated corners room to breathe without clipping into the right panel
    <div
      style={{ padding: 20, flexShrink: 0 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        className="w-[389px] h-[543px] bg-elevated rounded-xl overflow-hidden relative cursor-crosshair"
        style={{ willChange: 'transform' }}
        // NOTE: no transformStyle:'preserve-3d' — we only tilt the card surface itself,
        //       not its children, so the tilt stays visually contained.
      >
        <img
          src={src || '/pokemon_card_backside.png'}
          alt={alt ?? 'Pokemon card'}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            const t = e.currentTarget
            if (!t.src.endsWith('/pokemon_card_backside.png')) {
              t.src = '/pokemon_card_backside.png'
            }
          }}
        />
        {/* Holographic glare overlay */}
        <div
          ref={glareRef}
          className="absolute inset-0 pointer-events-none z-10 transform-gpu"
          style={{ borderRadius: 'inherit', overflow: 'hidden', transition: 'opacity 300ms ease', opacity: 0 }}
        />
      </div>
    </div>
  )
}

// Derive a CSS class from a card's type string for hover glow
function getTypeGlowClass(type: string | null | undefined): string {
  if (!type) return 'card-type-colorless'
  const key = type.toLowerCase().replace(/\s+/g, '')
  const known = ['grass','fire','water','lightning','psychic','fighting','darkness','metal','dragon','fairy','colorless','trainer']
  return known.includes(key) ? `card-type-${key}` : ''
}

export default function CardGrid({ cards, userCards: propsUserCards, filter = 'all', sortBy = 'number', userId: propsUserId, setTotal, setName, setComplete, initialCardId, collectionGoal = 'normal', cardPricesUSD, currency = 'USD', priceSource = 'tcgplayer', onVariantsLegendChange, disableGreyOut = false }: CardGridProps) {
  const { updateCardQuantity, userCards: storeUserCards, fetchUserCards } = useCollectionStore()
  const { user, isLoading, profile } = useAuthStore()
  // Prefer the client-side profile's preferred_currency (always reliable after login)
  // over the server-passed prop, which may have defaulted to 'USD' if the server-side
  // supabaseAdmin profile query failed silently.
  const effectiveCurrency = (profile?.preferred_currency as string | undefined) ?? currency
  // Admin: true when the logged-in user has role = 'admin'
  const isAdmin = profile?.role === 'admin'
  // disableGreyOut overrides the user's setting — used on pages like browse where
  // collection status should not affect card appearance (only set pages grey out).
  const greyOutUnowned: boolean = !disableGreyOut && (profile?.grey_out_unowned ?? false)

  // Use userId from props if provided, otherwise get from auth store
  const userId = propsUserId || user?.id

  
  // Use store userCards instead of props if available
  const userCards = storeUserCards.size > 0 ? storeUserCards : propsUserCards
  const [selectedCard, setSelectedCard] = useState<PokemonCard | null>(null)

  // Memoize fetchUserCards to prevent unnecessary re-renders
  const memoizedFetchUserCards = useCallback(() => {
    if (storeUserCards.size === 0) {
      fetchUserCards()
    }
  }, [storeUserCards.size, fetchUserCards])

  // Fetch user cards on mount
  useEffect(() => {
    memoizedFetchUserCards()
  }, [memoizedFetchUserCards])

  // Smart cache management: only clear cache if userId actually changed
  const [lastUserId, setLastUserId] = useState<string | undefined>(undefined)
  
  useEffect(() => {
    if (userId && userId !== lastUserId) {
      // Only clear cache when userId actually changes (not on every render)
      setCardQuickVariants(new Map())
      setCardVariants(new Map())
      setCardCustomVariantCounts(new Map())
      setLastUserId(userId)
    }
  }, [userId, lastUserId])
  const [cardVariants, setCardVariants] = useState<Map<string, VariantWithQuantity[]>>(new Map())
  const [cardQuickVariants, setCardQuickVariants] = useState<Map<string, QuickAddVariant[]>>(new Map())
  const [cardCustomVariantCounts, setCardCustomVariantCounts] = useState<Map<string, number>>(new Map())
  const [isLoadingVariants, setIsLoadingVariants] = useState<Set<string>>(new Set())
  const [showVariantSuggestionModal, setShowVariantSuggestionModal] = useState(false)
  const [relatedCards, setRelatedCards] = useState<RelatedCard[]>([])
  const [relatedCardsTotal, setRelatedCardsTotal] = useState(0)
  const [isFetchingRelated, setIsFetchingRelated] = useState(false)
  // Modal tab state (Card / Price / Trade / Friends)
  const [modalTab, setModalTab]             = useState<ModalTab>('card')
  const [cardPriceCache, setCardPriceCache] = useState<Map<string, CardPriceRow | null>>(new Map())
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)
  // Price history chart state
  const [priceChartRange, setPriceChartRange]           = useState<PriceChartRange>('30d')
  const [priceHistoryCache, setPriceHistoryCache]       = useState<Map<string, PriceHistoryPoint[]>>(new Map())
  const [isLoadingHistory, setIsLoadingHistory]         = useState(false)
  // Wanted list state
  const [wantedCardIds, setWantedCardIds]               = useState<Set<string>>(new Set())
  const [wantedLoading, setWantedLoading]               = useState(false)
  const [wantedInitialized, setWantedInitialized]       = useState(false)
  // Friends tab state
  const [friendsCache, setFriendsCache]                 = useState<Map<string, FriendCardOwner[]>>(new Map())
  const [isLoadingFriends, setIsLoadingFriends]         = useState(false)
  // Per-variant input text while the user is typing a quantity directly
  const [variantInputValues, setVariantInputValues]     = useState<Map<string, string>>(new Map())
  // Admin: floating popup edit state for variant editing
  const [editingVariantId, setEditingVariantId]   = useState<string | null>(null)
  const [editForm,         setEditForm]            = useState({ name: '', description: '', color: 'gray', sortOrder: 0 })
  const [variantEditError, setVariantEditError]    = useState<string | null>(null)
  const [confirmDeleteId,  setConfirmDeleteId]     = useState<string | null>(null)
  const [isSavingEdit,     setIsSavingEdit]        = useState(false)
  const editPopupRef = useRef<HTMLDivElement>(null)
  // Ensures we only auto-open the initialCardId modal once
  const autoOpenedRef = useRef(false)
  // Used to distinguish single-click (open modal) from double-click (add default variant)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Admin: close edit popup when clicking outside it
  useEffect(() => {
    if (!editingVariantId) return
    function handleClickAway(e: MouseEvent) {
      if (editPopupRef.current && !editPopupRef.current.contains(e.target as Node)) {
        setEditingVariantId(null)
        setVariantEditError(null)
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('mousedown', handleClickAway)
    return () => document.removeEventListener('mousedown', handleClickAway)
  }, [editingVariantId])

  // Admin: save variant field edits and patch local state
  async function handleVariantEditSave(variantId: string) {
    setIsSavingEdit(true)
    setVariantEditError(null)
    const result = await updateVariant(variantId, {
      name:        editForm.name,
      description: editForm.description || null,
      color:       editForm.color,
      sortOrder:   editForm.sortOrder,
    })
    setIsSavingEdit(false)
    if (!result.success) {
      setVariantEditError(result.error ?? 'Failed to save')
      return
    }
    if (selectedCard) {
      setCardVariants(prev => {
        const next = new Map(prev)
        const variants = next.get(selectedCard.id) ?? []
        next.set(
          selectedCard.id,
          variants.map(v =>
            v.id === variantId
              ? { ...v, name: editForm.name, description: editForm.description || null, color: editForm.color as any, sort_order: editForm.sortOrder }
              : v
          )
        )
        return next
      })
    }
    setEditingVariantId(null)
  }

  // Admin: delete variant and remove from local state
  async function handleVariantDelete(variantId: string) {
    setIsSavingEdit(true)
    const result = await deleteVariant(variantId)
    setIsSavingEdit(false)
    if (!result.success) {
      setVariantEditError(result.error ?? 'Failed to delete')
      return
    }
    if (selectedCard) {
      setCardVariants(prev => {
        const next = new Map(prev)
        const variants = next.get(selectedCard.id) ?? []
        next.set(selectedCard.id, variants.filter(v => v.id !== variantId))
        return next
      })
    }
    setEditingVariantId(null)
    setConfirmDeleteId(null)
  }

  const filteredCards = useMemo(() => {
    const filtered = cards.filter(card => {
      // ── Ownership & duplicate decisions always use storeUserCards ──────────
      // This keeps the filter consistent with the tab counts computed in
      // SetPageCards (which also read storeUserCards). The cardQuickVariants
      // data (API-fetched) is only used for the coloured quick-add buttons UI
      // and for Masterset/Grandmasterset goal completeness checks below.
      const userCard      = userCards.get(card.id)
      const quickVariants = cardQuickVariants.get(card.id)

      // Basic ownership: any variant quantity > 0
      const anyOwned = !!(userCard && userCard.quantity > 0)

      // isOwned for normal goal = anyOwned.
      // For Masterset/Grandmasterset: every quick-add variant must have qty > 0.
      // If cardQuickVariants haven't loaded yet, fall back to anyOwned.
      let isOwned: boolean
      if (collectionGoal === 'masterset' || collectionGoal === 'grandmasterset') {
        if (quickVariants && quickVariants.length > 0) {
          isOwned = quickVariants.every(v => v.quantity > 0)
        } else {
          isOwned = anyOwned
        }
      } else {
        isOwned = anyOwned
      }

      // Duplicate: at least one variant has 2+ copies.
      // userCard.quantity is the SUM across variants, so we use maxVariantQty
      // (highest single-variant qty) to avoid flagging Normal:1 + Reverse:1.
      const isDuplicate = (userCard?.maxVariantQty ?? 0) >= 2

      switch (filter) {
        case 'owned':      return isOwned
        case 'missing':    return !isOwned
        case 'duplicates': return isDuplicate
        default:           return true
      }
    })

    // Sort according to the active sortBy option
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name ?? '').localeCompare(b.name ?? '')
      }
      if (sortBy === 'price') {
        const priceA = cardPricesUSD?.[a.id] ?? 0
        const priceB = cardPricesUSD?.[b.id] ?? 0
        return priceB - priceA  // descending: highest price first
      }
      // default: 'number' — numeric sort with string fallback
      const getNum = (n: string | null): number => {
        const m = (n ?? '').match(/(\d+)/)
        return m ? parseInt(m[1], 10) : 0
      }
      const diff = getNum(a.number) - getNum(b.number)
      return diff !== 0 ? diff : (a.number ?? '').localeCompare(b.number ?? '')
    })
  }, [cards, userCards, filter, sortBy, collectionGoal, cardQuickVariants, cardPricesUSD])

  // Load variants for a specific card
  const loadCardVariants = async (cardId: string, quickAddOnly = false) => {
    if (isLoadingVariants.has(cardId)) {
      return
    }

    setIsLoadingVariants(prev => new Set(prev).add(cardId))

    try {
      const params = new URLSearchParams({
        cardId,
        quickAddOnly: quickAddOnly.toString(),
        ...(userId && { userId })
      })

      const response = await fetch(`/api/variants?${params}`)
      if (!response.ok) {
        throw new Error('Failed to load variants')
      }

      const variants: VariantWithQuantity[] = await response.json()

      if (quickAddOnly) {
        const quickVariants: QuickAddVariant[] = variants.map(v => ({
          id: v.id,
          name: v.name,
          color: v.color,
          short_label: null, // No longer using labels in UI
          quantity: v.quantity,
          sort_order: v.sort_order
        }))
        setCardQuickVariants(prev => new Map(prev).set(cardId, quickVariants))
      } else {
        setCardVariants(prev => new Map(prev).set(cardId, variants))
      }
    } catch (error) {
      console.error('Failed to load variants for card:', cardId, error)
    } finally {
      setIsLoadingVariants(prev => {
        const newSet = new Set(prev)
        newSet.delete(cardId)
        return newSet
      })
    }
  }

  // Fetch other versions of the same Pokémon from other sets
  const fetchRelatedCards = async (card: PokemonCard) => {
    if (!card.name) return
    setIsFetchingRelated(true)
    setRelatedCards([])
    setRelatedCardsTotal(0)
    try {
      const params = new URLSearchParams({
        name: card.name,
        excludeCardId: card.id,
        limit: '3',
      })
      const response = await fetch(`/api/cards/related?${params}`)
      if (!response.ok) return
      const data = await response.json()
      setRelatedCards(data.cards ?? [])
      setRelatedCardsTotal(data.total ?? 0)
    } catch (error) {
      console.error('Failed to fetch related cards:', error)
    } finally {
      setIsFetchingRelated(false)
    }
  }

  // BATCH LOADING: Load ALL variants in a single API call - like pkmn.gg
  // NOTE: depends on `cards` (stable prop), NOT `filteredCards` (derived from cardQuickVariants)
  // to prevent an infinite update loop.
  useEffect(() => {
    if (!userId || cards.length === 0) return
    
    const loadAllVariants = async () => {
      try {
        // POST instead of GET — card IDs travel in the body so large sets don't
        // hit the ~8 KB URL/header size limit (HTTP 431).
        const response = await fetch('/api/variants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardIds: cards.map(c => c.id), userId }),
        })
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}))
          throw new Error(
            `Failed to load batch variants (HTTP ${response.status}): ${errBody?.error ?? 'unknown'}`
          )
        }
        
        const batchResults: Record<string, VariantWithQuantity[]> = await response.json()
        
        const newQuickVariants    = new Map<string, QuickAddVariant[]>()
        const newCustomCounts     = new Map<string, number>()

        Object.entries(batchResults).forEach(([cardId, variants]) => {
          // All official variants become dots — is_quick_add only controls the double-click default
          const quickVariants: QuickAddVariant[] = variants
            .filter(v => v.is_official)
            .map((v: any) => ({
              id: v.id,
              name: v.name,
              color: v.color,
              short_label: null,
              quantity: v.quantity,
              sort_order: v.sort_order,
              card_id: v.card_id ?? null,
              is_quick_add: v.is_quick_add ?? false,
            }))
          newQuickVariants.set(cardId, quickVariants)

          // Track count of card-specific variants for the ★ indicator (multiple-variant case)
          const customCount = quickVariants.filter(v => v.card_id != null).length
          if (customCount > 0) newCustomCounts.set(cardId, customCount)
        })
        
        setCardQuickVariants(newQuickVariants)
        setCardCustomVariantCounts(newCustomCounts)

        // Compute deduplicated legend variants (one entry per unique color, sorted)
        if (onVariantsLegendChange) {
          const seen = new Set<string>()
          const legendVariants: QuickAddVariant[] = []
          for (const [, cvariants] of newQuickVariants) {
            for (const v of cvariants) {
              if (!seen.has(v.color)) {
                seen.add(v.color)
                legendVariants.push(v)
              }
            }
          }
          legendVariants.sort((a, b) => a.sort_order - b.sort_order)
          onVariantsLegendChange(legendVariants)
        }

      } catch (error) {
        console.error('Failed to batch load variants:', error)
      }
    }
    
    loadAllVariants()
  }, [cards, userId])

  // Update variant quantity
  const updateVariantQuantity = async (cardId: string, variantId: string, increment: number) => {
    if (!userId) {
      console.error('❌ No userId provided for variant update')
      return
    }

    try {
      const response = await fetch('/api/user-card-variants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          cardId,
          variantId,
          increment
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
          requestData: { userId, cardId, variantId, increment }
        })
        throw new Error(`Failed to update variant quantity: ${response.status} ${errorText}`)
      }

      const result = await response.json()

      // Update quick variants in state
      setCardQuickVariants(prev => {
        const newMap = new Map(prev)
        const variants = newMap.get(cardId)
        if (variants) {
          const updatedVariants = variants.map(v =>
            v.id === variantId ? { ...v, quantity: result.quantity } : v
          )
          newMap.set(cardId, updatedVariants)
        }
        return newMap
      })

      // Update full variants if loaded
      setCardVariants(prev => {
        const newMap = new Map(prev)
        const variants = newMap.get(cardId)
        if (variants) {
          const updatedVariants = variants.map(v =>
            v.id === variantId ? { ...v, quantity: result.quantity } : v
          )
          newMap.set(cardId, updatedVariants)
        }
        return newMap
      })

      // Update legacy system for backwards compatibility.
      // IMPORTANT: `quickVariants` is stale React state (value before this click),
      // so we must use `result.quantity` for the variant that was just updated,
      // otherwise maxVariantQty in the store will lag one click behind.
      const quickVariants = cardQuickVariants.get(cardId) || []
      const totalQuantity = quickVariants.reduce((sum, v) => {
        const qty = v.id === variantId ? result.quantity : v.quantity
        return sum + qty
      }, 0)

      // Per-variant breakdown — substitute result.quantity for the updated variant
      const getVariantQty = (name: string) => {
        const v = quickVariants.find(v => v.name === name)
        if (!v) return 0
        return v.id === variantId ? result.quantity : v.quantity
      }

      // Update the legacy user_cards table
      await updateCardQuantity(cardId, totalQuantity, {
        normal:  getVariantQty('Normal'),
        reverse: getVariantQty('Reverse Holo'),
        holo:    getVariantQty('Holo Rare'),
      })

    } catch (error) {
      console.error('Failed to update variant quantity:', error)
    }
  }

  // Set variant quantity directly (used when user types a value into the input)
  const setVariantQuantityDirect = async (cardId: string, variantId: string, newQuantity: number) => {
    if (!userId) return
    const clamped = Math.max(0, Math.floor(newQuantity))

    try {
      const response = await fetch('/api/user-card-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, cardId, variantId, quantity: clamped })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API Error (direct set):', { status: response.status, errorText })
        return
      }

      const result = await response.json()
      const resultQty: number = result.quantity ?? clamped

      // Update quick variants in state
      setCardQuickVariants(prev => {
        const newMap = new Map(prev)
        const variants = newMap.get(cardId)
        if (variants) {
          newMap.set(cardId, variants.map(v => v.id === variantId ? { ...v, quantity: resultQty } : v))
        }
        return newMap
      })

      // Update full variants if loaded
      setCardVariants(prev => {
        const newMap = new Map(prev)
        const variants = newMap.get(cardId)
        if (variants) {
          newMap.set(cardId, variants.map(v => v.id === variantId ? { ...v, quantity: resultQty } : v))
        }
        return newMap
      })

      // Update legacy system
      const quickVariants = cardQuickVariants.get(cardId) || []
      const totalQuantity = quickVariants.reduce((sum, v) => {
        const qty = v.id === variantId ? resultQty : v.quantity
        return sum + qty
      }, 0)
      const getVariantQty = (name: string) => {
        const v = quickVariants.find(v => v.name === name)
        if (!v) return 0
        return v.id === variantId ? resultQty : v.quantity
      }
      await updateCardQuantity(cardId, totalQuantity, {
        normal:  getVariantQty('Normal'),
        reverse: getVariantQty('Reverse Holo'),
        holo:    getVariantQty('Holo Rare'),
      })
    } catch (error) {
      console.error('Failed to set variant quantity directly:', error)
    }
  }

  // Handle variant color box click
  const handleVariantClick = (e: React.MouseEvent, cardId: string, variantId: string) => {
    e.stopPropagation()

    if (e.type === 'contextmenu') {
      // Always suppress the browser context menu on variant buttons
      e.preventDefault()
      // Right-click: decrement, but never below 0
      const variants = cardQuickVariants.get(cardId) || []
      const variant  = variants.find(v => v.id === variantId)
      if (variant && variant.quantity > 0) {
        updateVariantQuantity(cardId, variantId, -1)
      }
      return
    }

    if (e.altKey || e.button === 2) {
      // Alt-click: decrement, but never below 0
      const variants = cardQuickVariants.get(cardId) || []
      const variant  = variants.find(v => v.id === variantId)
      if (variant && variant.quantity > 0) {
        updateVariantQuantity(cardId, variantId, -1)
      }
    } else {
      // Normal click: increment
      updateVariantQuantity(cardId, variantId, 1)
    }
  }

  // Fetch full price row for a card (cached — one fetch per card per session)
  const fetchCardPrice = useCallback(async (cardId: string) => {
    if (cardPriceCache.has(cardId)) return // already fetched
    setIsLoadingPrice(true)
    try {
      const res = await fetch(`/api/prices/card/${cardId}`)
      if (res.ok) {
        const json = await res.json()
        setCardPriceCache(prev => new Map(prev).set(cardId, json.price ?? null))
      }
    } catch {
      setCardPriceCache(prev => new Map(prev).set(cardId, null))
    } finally {
      setIsLoadingPrice(false)
    }
  }, [cardPriceCache])

  // Fetch price history for a card (cached per session, re-fetched on range change)
  const fetchCardPriceHistory = useCallback(async (cardId: string, range: PriceChartRange) => {
    const cacheKey = `${cardId}:${range}`
    if (priceHistoryCache.has(cacheKey)) return
    setIsLoadingHistory(true)
    try {
      const res = await fetch(`/api/prices/history/${cardId}?range=${range}`)
      if (res.ok) {
        const json = await res.json()
        setPriceHistoryCache(prev => new Map(prev).set(cacheKey, json.history ?? []))
      }
    } catch {
      setPriceHistoryCache(prev => new Map(prev).set(cacheKey, []))
    } finally {
      setIsLoadingHistory(false)
    }
  }, [priceHistoryCache])

  // Load the user's wanted card IDs once on first modal open (if authenticated)
  const fetchWantedCards = useCallback(async () => {
    if (wantedInitialized) return
    try {
      const res = await fetch('/api/wanted-cards')
      if (res.ok) {
        const json = await res.json()
        setWantedCardIds(new Set(json.wantedCardIds ?? []))
        setWantedInitialized(true)
      }
    } catch { /* non-critical */ }
  }, [wantedInitialized])

  // Toggle wanted status for a card
  const toggleWanted = useCallback(async (cardId: string) => {
    if (wantedLoading) return
    const isCurrentlyWanted = wantedCardIds.has(cardId)
    // Optimistic update
    setWantedCardIds(prev => {
      const next = new Set(prev)
      if (isCurrentlyWanted) next.delete(cardId)
      else next.add(cardId)
      return next
    })
    setWantedLoading(true)
    try {
      const res = await fetch('/api/wanted-cards', {
        method: isCurrentlyWanted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId }),
      })
      if (!res.ok) throw new Error('Request failed')
    } catch {
      // Revert optimistic update on error
      setWantedCardIds(prev => {
        const next = new Set(prev)
        if (isCurrentlyWanted) next.add(cardId)
        else next.delete(cardId)
        return next
      })
    } finally {
      setWantedLoading(false)
    }
  }, [wantedCardIds, wantedLoading])

  // Fetch friends who own a card (cached per card per session)
  const fetchFriendsForCard = useCallback(async (cardId: string) => {
    if (friendsCache.has(cardId)) return
    setIsLoadingFriends(true)
    try {
      const res = await fetch(`/api/friends/card/${cardId}`)
      if (res.ok) {
        const json = await res.json()
        setFriendsCache(prev => new Map(prev).set(cardId, json.friends ?? []))
      }
    } catch {
      setFriendsCache(prev => new Map(prev).set(cardId, []))
    } finally {
      setIsLoadingFriends(false)
    }
  }, [friendsCache])

  // Open card modal when clicked (used by auto-open and right-click)
  const handleCardClick = (card: PokemonCard) => {
    setSelectedCard(card)
    setModalTab('card')      // always open on Card tab
    fetchRelatedCards(card)
    fetchCardPrice(card.id)  // eagerly load so Market Price column is populated on Card tab
    if (!cardVariants.has(card.id)) {
      setTimeout(() => loadCardVariants(card.id, false), 100)
    }
    // Pre-load wanted list on first modal open
    if (user) fetchWantedCards()
  }

  // Single click on card image — open modal after short delay so double-click can cancel it
  const handleCardImageClick = (card: PokemonCard) => {
    if (clickTimerRef.current) return // already waiting; second click = dblclick path
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      handleCardClick(card)
    }, 250)
  }

  // Double click on card image — add 1 of the default variant for this card.
  // Uses card.default_variant_id if set, otherwise falls back to the first
  // available quick-add variant (derived from card rarity).
  const handleCardImageDblClick = (e: React.MouseEvent, card: PokemonCard) => {
    e.preventDefault()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    if (!userId) return
    const quick = cardQuickVariants.get(card.id) || []
    // Prefer default_variant_id → is_quick_add variant → first in sort order
    const defaultVariant = card.default_variant_id
      ? (quick.find(v => v.id === card.default_variant_id) ?? quick.find(v => v.is_quick_add) ?? quick[0])
      : (quick.find(v => v.is_quick_add) ?? quick[0])
    if (defaultVariant) {
      updateVariantQuantity(card.id, defaultVariant.id, 1)
    }
  }

  // Open card modal
  const handleCardRightClick = (e: React.MouseEvent, card: PokemonCard) => {
    e.preventDefault()
    setSelectedCard(card)
    if (!cardVariants.has(card.id)) {
      loadCardVariants(card.id, false)
    }
  }

  // Auto-open the modal when navigated from an "Other versions" thumbnail (?card=<id>)
  useEffect(() => {
    if (autoOpenedRef.current || !initialCardId || cards.length === 0) return
    const target = cards.find(c => c.id === initialCardId)
    if (!target) return
    autoOpenedRef.current = true
    handleCardClick(target)
    // Scroll the highlighted card tile into view
    setTimeout(() => {
      document.getElementById(`card-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
  }, [cards]) // eslint-disable-line react-hooks/exhaustive-deps

  // Server pre-filters variants (by card_variant_availability overrides or rarity rules).
  // Trust the API response — no client-side rarity filtering needed.
  const filteredVariants = useMemo(
    () => (selectedCard ? cardVariants.get(selectedCard.id) ?? [] : []),
    [selectedCard, cardVariants]
  )

  // Color mapping function - memoized to prevent re-creation
  const getQuantityButtonColor = useCallback((variant: any, quantity: number) => {
    if (quantity === 0) return 'bg-gray-600'
    switch (variant.color) {
      case 'green': return 'bg-green-500'
      case 'blue': return 'bg-blue-500'
      case 'purple': return 'bg-purple-500'
      case 'red': return 'bg-red-500'
      case 'pink': return 'bg-pink-500'
      case 'yellow': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }, [])

  // Derived: variants already loaded for the selected card (used in inline modal)
  const modalAllVariants = selectedCard ? (cardVariants.get(selectedCard.id) || []) : []

  // Shared colour map used by both the card-grid dots and the modal variant rows
  const colorMap = {
    green: 'bg-green-500', blue: 'bg-blue-500', purple: 'bg-purple-500',
    red: 'bg-red-500', pink: 'bg-pink-500', yellow: 'bg-yellow-500', gray: 'bg-gray-500',
    orange: 'bg-orange-500', teal: 'bg-teal-500',
  } as const

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {filteredCards.map(card => {
          const userCard          = userCards.get(card.id)
          const quickVariants     = cardQuickVariants.get(card.id) || []
          // Use user_card_variants as source of truth once loaded; fall back to
          // legacy user_cards only while the batch fetch is still in-flight.
          // Always use the Zustand store's aggregate quantity for owned status.
          // quickVariants only covers global variants (card-specific variant IDs are
          // excluded from the batch fetch's .in('variant_id', variantIds) filter),
          // so for cards like promos with card-specific variants all quantities would
          // be 0 and the card would appear unowned even when it is owned.
          const isOwned = !!(userCard && userCard.quantity > 0)
          const customVariantCount = cardCustomVariantCounts.get(card.id) ?? 0
          const typeGlowClass     = getTypeGlowClass(card.type)
          const shouldGrey        = greyOutUnowned && !isOwned

          // Quick-add buttons: server already pre-filtered by override/rarity rules.
          const filteredQuick = quickVariants
          // Determine what to show in the button row:
          //  - 0 card-specific variants → show all buttons normally
          //  - 1 card-specific variant  → show it alongside global buttons normally (works like any button)
          //  - 2+ card-specific variants → show only global buttons + grey ★ (opens modal)
          const specificQuick = filteredQuick.filter(v => v.card_id != null)
          const buttonsToRender = specificQuick.length <= 1
            ? filteredQuick
            : filteredQuick.filter(v => v.card_id == null)
          const showStarButton = specificQuick.length > 1

          return (
            <div
              key={card.id}
              id={`card-${card.id}`}
              className="group cursor-pointer flex-shrink-0 flex flex-col"
              style={{ width: 220 }}
            >
              {/* ── Image area ── */}
              <div
                className={`relative w-[220px] h-[308px] rounded-lg overflow-hidden border transition-all duration-200 cursor-pointer ${typeGlowClass} ${
                  isOwned ? 'border-accent shadow-lg glow-accent-sm' : 'border-subtle'
                }`}
                onClick={() => handleCardImageClick(card)}
                onDoubleClick={(e) => handleCardImageDblClick(e, card)}
                onContextMenu={(e) => { e.preventDefault(); handleCardClick(card) }}
              >
                <img
                  src={card.image_url ?? '/pokemon_card_backside.png'}
                  alt={card.name ?? ''}
                  className={`w-full h-full object-cover transition-all duration-300 pointer-events-none ${
                    shouldGrey ? 'grayscale opacity-40' : ''
                  }`}
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    if (!target.src.endsWith('/pokemon_card_backside.png')) {
                      target.src = '/pokemon_card_backside.png'
                    }
                  }}
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 z-10" />
              </div>

              {/* ── Variant dots row — below image, normal flow ── */}
              {(buttonsToRender.length > 0 || showStarButton) && (
                <div
                  className="w-[220px] flex gap-1 flex-wrap justify-center px-2 pt-1.5"
                  onClick={e => e.stopPropagation()}
                >
                  {buttonsToRender.map(variant => (
                    <button
                      key={variant.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (variant.color === 'gray' || variant.card_id != null) {
                          handleCardClick(card)
                        } else {
                          handleVariantClick(e, card.id, variant.id)
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (variant.color === 'gray' || variant.card_id != null) {
                          handleCardClick(card)
                        } else {
                          handleVariantClick(e, card.id, variant.id)
                        }
                      }}
                      title={`${variant.name} (${variant.quantity})`}
                      className={`
                        w-6 h-6 rounded flex items-center justify-center
                        text-xs font-bold border border-black/30 shadow-sm
                        ${variant.card_id != null ? 'bg-gray-500' : (colorMap[variant.color] || 'bg-zinc-500')}
                        ${variant.quantity > 0 ? '!text-black' : 'text-transparent'}
                        hover:scale-110 transition-transform cursor-pointer
                      `}
                    >
                      {variant.quantity > 0 ? variant.quantity : ''}
                    </button>
                  ))}

                  {/* Grey ★ — only when 2+ card-specific variants; clicking opens the modal */}
                  {showStarButton && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCardClick(card) }}
                      title={`${specificQuick.length} card-specific variants — open card to manage`}
                      className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold border border-black/30 shadow-sm bg-gray-500 text-white hover:scale-110 transition-transform cursor-pointer"
                    >
                      ★
                    </button>
                  )}
                </div>
              )}

              {/* ── Card info below variant dots ── */}
              <div className="w-[220px] flex flex-col gap-0.5 px-1 pt-1 pb-1">
                {/* Row 1: Card name — prominent, full-width */}
                <p className="text-sm font-semibold text-primary truncate leading-tight">
                  {card.name}
                </p>
                {/* Row 2: Card number (muted/small, left) · Price (accent, right) */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-secondary tabular-nums">#{card.number}</span>
                  <span className="text-sm font-semibold text-price tabular-nums">
                    {cardPricesUSD?.[card.id] != null
                      ? formatPrice(cardPricesUSD[card.id], effectiveCurrency)
                      : ''}
                  </span>
                </div>
                {/* Row 3: Set name — only shown on browse/search where cards span multiple sets */}
                {card.set_name && (
                  <Link
                    href={`/set/${card.set_id}`}
                    className="flex items-center gap-1 mt-0.5 hover:text-accent transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {card.set_logo_url && (
                      <img
                        src={card.set_logo_url}
                        alt=""
                        className="h-3 w-auto object-contain shrink-0"
                      />
                    )}
                    <span className="text-xs text-muted truncate leading-tight">{card.set_name}</span>
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {filteredCards.length === 0 && (
        <div className="text-center py-16">
          <div className="text-muted text-lg">
            {filter === 'owned'      && 'No owned cards in this set yet'}
            {filter === 'missing'    && 'All cards in this set are owned! 🎉'}
            {filter === 'duplicates' && 'No duplicate cards in this set'}
            {filter === 'all'        && 'No cards found'}
          </div>
        </div>
      )}
      
      <Modal
        isOpen={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        maxWidth="5xl"
      >
        {selectedCard && (
          <div className="flex gap-6">
            {/* Left side - Card Image with holographic glare + artist */}
            <div className="flex-shrink-0 flex flex-col">
              <CardGlareImage
                src={selectedCard.image_url}
                alt={selectedCard.name ?? undefined}
              />
              {/* Artist credit — displayed below card image */}
              {selectedCard.artist && (
                <div className="px-5 pt-2 pb-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span className="font-medium text-secondary">{selectedCard.artist}</span>
                  </div>
                  <a
                    href={`/browse?artist=${encodeURIComponent(selectedCard.artist)}`}
                    className="text-xs text-accent hover:underline transition-colors"
                  >
                    See more cards from this artist →
                  </a>
                </div>
              )}
            </div>

            {/* Right side - Card Details */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-primary mb-1">{selectedCard.name}</h2>
                  {setName && <p className="text-sm text-muted">{setName}</p>}
                  <p className="text-muted text-sm mt-0.5">
                    #{(selectedCard.number || 'Unknown').split('/')[0]}/{setComplete ?? setTotal}
                  </p>
                </div>
                <div className="flex items-center">
                  {/* Wanted / Wishlist star — authenticated users only */}
                  {user && (
                    <button
                      onClick={() => toggleWanted(selectedCard.id)}
                      disabled={wantedLoading}
                      title={wantedCardIds.has(selectedCard.id) ? 'Remove from wanted list' : 'Add to wanted list'}
                      className="p-2 transition-colors disabled:opacity-40"
                    >
                      {wantedCardIds.has(selectedCard.id)
                        ? <span className="text-2xl leading-none text-yellow-400">★</span>
                        : <span className="text-2xl leading-none text-muted hover:text-yellow-400 transition-colors">☆</span>
                      }
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedCard(null)}
                    className="text-muted hover:text-primary text-2xl transition-colors p-2"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-subtle mb-4">
                <div className="flex gap-6">
                  <button
                    className={modalTab === 'card' ? 'tab-active pb-2 text-sm font-medium' : 'tab-inactive pb-2 text-sm'}
                    onClick={() => setModalTab('card')}
                  >
                    Card
                  </button>
                  <button
                    className={modalTab === 'price' ? 'tab-active pb-2 text-sm font-medium' : 'tab-inactive pb-2 text-sm'}
                    onClick={() => {
                      setModalTab('price')
                      fetchCardPrice(selectedCard.id)
                      fetchCardPriceHistory(selectedCard.id, priceChartRange)
                    }}
                  >
                    Price
                  </button>
                  <button
                    className={modalTab === 'trade' ? 'tab-active pb-2 text-sm font-medium' : 'tab-inactive pb-2 text-sm'}
                    onClick={() => setModalTab('trade')}
                  >
                    Trade
                  </button>
                  <button
                    className={modalTab === 'friends' ? 'tab-active pb-2 text-sm font-medium' : 'tab-inactive pb-2 text-sm'}
                    onClick={() => {
                      setModalTab('friends')
                      fetchFriendsForCard(selectedCard.id)
                    }}
                  >
                    Friends
                  </button>
                </div>
              </div>

              {/* ── Price Tab ─── */}
              {modalTab === 'price' && (
                <div className="flex-1 overflow-y-auto space-y-5">

                  {/* Price history line chart */}
                  <PriceChart
                    history={priceHistoryCache.get(`${selectedCard.id}:${priceChartRange}`) ?? []}
                    currency={effectiveCurrency}
                    isLoading={isLoadingHistory && !priceHistoryCache.has(`${selectedCard.id}:${priceChartRange}`)}
                    range={priceChartRange}
                    onRangeChange={(r) => {
                      setPriceChartRange(r)
                      fetchCardPriceHistory(selectedCard.id, r)
                    }}
                  />

                  {/* Current prices snapshot */}
                  {isLoadingPrice && !cardPriceCache.has(selectedCard.id) ? (
                    <div className="text-muted text-center py-4 animate-pulse text-sm">Loading prices…</div>
                  ) : (() => {
                    const row = cardPriceCache.get(selectedCard.id)
                    if (!row) {
                      return (
                        <div className="rounded-lg bg-elevated border border-subtle px-4 py-5 text-center">
                          <p className="text-muted text-sm">No price data synced for this card yet.</p>
                          <p className="text-muted/60 text-xs mt-0.5">An admin can sync prices from /admin/prices.</p>
                        </div>
                      )
                    }

                    const variantRows = [
                      { label: 'Normal',       price: row.tcgp_normal,       dot: '#10b981' },
                      { label: 'Reverse Holo', price: row.tcgp_reverse_holo, dot: '#3b82f6' },
                      { label: 'Holofoil',     price: row.tcgp_holo,         dot: '#8b5cf6' },
                      { label: '1st Edition',  price: row.tcgp_1st_edition,  dot: '#f59e0b' },
                    ].filter(r => r.price != null)

                    const gradeRows: { label: string; price: number }[] = [
                      { label: 'PSA 10',  price: row.tcgp_psa10  ?? 0 },
                      { label: 'BGS 9.5', price: row.tcgp_bgs95  ?? 0 },
                      { label: 'CGC 10',  price: row.tcgp_cgc10  ?? 0 },
                      { label: 'PSA 9',   price: row.tcgp_psa9   ?? 0 },
                      { label: 'BGS 9',   price: row.tcgp_bgs9   ?? 0 },
                    ].filter(g => g.price > 0)
                    const maxGraded = gradeRows.length > 0 ? Math.max(...gradeRows.map(g => g.price)) : 0

                    return (
                      <div className="space-y-5">

                        {/* TCGPlayer variant prices */}
                        <div>
                          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Current Prices · TCGPlayer</h3>
                          {variantRows.length === 0 ? (
                            <p className="text-muted text-xs">No variant prices available.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {variantRows.map(r => (
                                <div key={r.label} className="flex items-center justify-between text-sm bg-elevated rounded-lg px-3 py-2 border border-subtle">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.dot }} />
                                    <span className="text-secondary">{r.label}</span>
                                  </div>
                                  <span className="font-semibold tabular-nums text-success">{formatPrice(r.price!, effectiveCurrency)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* CardMarket prices */}
                        {(row.cm_avg_sell != null || row.cm_trend != null) && (
                          <div>
                            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">CardMarket</h3>
                            <div className="space-y-1.5">
                              {[
                                { label: 'Avg Sell',   val: row.cm_avg_sell != null ? formatPrice(row.cm_avg_sell * EUR_TO_USD, effectiveCurrency) : null },
                                { label: 'Trend',      val: row.cm_trend    != null ? formatPrice(row.cm_trend    * EUR_TO_USD, effectiveCurrency) : null },
                                { label: '30-day Avg', val: row.cm_avg_30d  != null ? formatPrice(row.cm_avg_30d  * EUR_TO_USD, effectiveCurrency) : null },
                              ].filter(r => r.val != null).map(r => (
                                <div key={r.label} className="flex items-center justify-between text-sm bg-elevated rounded-lg px-3 py-2 border border-subtle">
                                  <span className="text-secondary">{r.label}</span>
                                  <span className="font-semibold tabular-nums text-success">{r.val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Graded prices — bar chart style */}
                        {maxGraded > 0 && (
                          <div>
                            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">🏅 Graded Value</h3>
                            <div className="space-y-2">
                              {gradeRows.map(g => {
                                const pct = Math.round((g.price / maxGraded) * 100)
                                return (
                                  <div key={g.label} className="flex items-center gap-3">
                                    <span className="text-xs text-secondary w-14 shrink-0">{g.label}</span>
                                    <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${pct}%`, backgroundColor: '#7c3aed' }}
                                      />
                                    </div>
                                    <span className="text-xs font-semibold text-success tabular-nums w-16 text-right shrink-0">
                                      {formatPrice(g.price, effectiveCurrency)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        <p className="text-muted/50 text-xs border-t border-subtle pt-3">
                          Prices synced {new Date(row.fetched_at).toLocaleDateString()}
                        </p>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ── Card Tab (variants) ─── */}
              {modalTab === 'card' && <div className="flex-1">
                <div className="mb-4">
                  <div className="flex items-center text-xs font-medium text-muted mb-3 px-1 gap-2">
                    <div className="flex-1 min-w-0">Variant</div>
                    <div className="w-20 text-center shrink-0">Market Price</div>
                    <div className="w-28 text-center shrink-0">Quantity</div>
                  </div>

                  {modalAllVariants.length === 0 && (
                    <div className="text-muted text-center py-8">
                      Loading variants...
                    </div>
                  )}

                  {filteredVariants.length === 0 && modalAllVariants.length > 0 && (
                    <div className="text-muted text-center py-8">
                      No variants available for this card rarity.
                    </div>
                  )}

                  <div className="space-y-2">
                    {filteredVariants.map(variant => (
                      <div key={variant.id} className="relative bg-elevated rounded-lg p-3 hover:bg-card-item transition-colors border border-subtle">
                        <div className="flex items-center gap-2">
                          {/* Admin: pencil edit button */}
                          {isAdmin && (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                if (editingVariantId === variant.id) {
                                  setEditingVariantId(null)
                                } else {
                                  setEditingVariantId(variant.id)
                                  setEditForm({
                                    name:        variant.name,
                                    description: variant.description || '',
                                    color:       variant.color,
                                    sortOrder:   variant.sort_order,
                                  })
                                  setVariantEditError(null)
                                  setConfirmDeleteId(null)
                                }
                              }}
                              title="Edit variant (admin)"
                              className="shrink-0 w-5 h-5 flex items-center justify-center transition-opacity rounded opacity-50 hover:opacity-100"
                            >
                              ✏️
                            </button>
                          )}
                          {/* Variant colour dot */}
                          <div className={`w-3 h-3 rounded-full shrink-0 ${colorMap[variant.color] || 'bg-zinc-500'}`} />
                          {/* Variant Name */}
                          <div className="flex-1 min-w-0">
                            <div className="text-primary font-medium text-sm truncate">{variant.name}</div>
                            <div className="text-muted text-xs">
                              {variant.description || 'Found in Booster Packs'}
                            </div>
                          </div>

                          {/* Market Price — same source/value as shown under the card in the grid */}
                          <div className="w-20 text-center shrink-0">
                            <div className="text-price font-medium text-sm">
                              {(() => {
                                // Prefer the pre-computed grid price (tcgp_market or CM equivalent)
                                const gridPrice = cardPricesUSD?.[selectedCard.id]
                                if (gridPrice != null) return formatPrice(gridPrice, effectiveCurrency)
                                // Fallback: derive from the full price row if available
                                const priceRow = cardPriceCache.get(selectedCard.id)
                                if (!priceRow) return isLoadingPrice ? '…' : '—'
                                let price: number | null = null
                                if (priceSource === 'cardmarket') {
                                  const eur = priceRow.cm_avg_sell ?? priceRow.cm_trend ?? null
                                  price = eur != null ? Math.round(eur * EUR_TO_USD * 100) / 100 : null
                                } else {
                                  price = priceRow.tcgp_market ?? null
                                }
                                return price != null ? formatPrice(price, effectiveCurrency) : '—'
                              })()}
                            </div>
                          </div>

                          {/* Quantity Controls */}
                          <div className="w-28 flex items-center justify-center gap-1.5 shrink-0">
                            <button
                              onClick={() => updateVariantQuantity(selectedCard.id, variant.id, -1)}
                              disabled={variant.quantity === 0}
                              className="w-7 h-7 bg-elevated hover:bg-base disabled:opacity-30 disabled:cursor-not-allowed text-primary border border-subtle rounded flex items-center justify-center text-base font-bold transition-colors"
                            >
                              −
                            </button>

                            <input
                              type="number"
                              min={0}
                              value={variantInputValues.has(variant.id) ? variantInputValues.get(variant.id) : variant.quantity}
                              onFocus={() =>
                                setVariantInputValues(prev => {
                                  const m = new Map(prev)
                                  m.set(variant.id, String(variant.quantity))
                                  return m
                                })
                              }
                              onChange={e =>
                                setVariantInputValues(prev => {
                                  const m = new Map(prev)
                                  m.set(variant.id, e.target.value)
                                  return m
                                })
                              }
                              onBlur={() => {
                                const raw = variantInputValues.get(variant.id) ?? ''
                                setVariantInputValues(prev => {
                                  const m = new Map(prev)
                                  m.delete(variant.id)
                                  return m
                                })
                                if (raw === '') return
                                const parsed = parseInt(raw, 10)
                                if (isNaN(parsed)) return
                                const clamped = Math.max(0, parsed)
                                if (clamped !== variant.quantity) {
                                  setVariantQuantityDirect(selectedCard.id, variant.id, clamped)
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur()
                                }
                              }}
                              className={`${getQuantityButtonColor(variant, variant.quantity)} text-white font-bold rounded px-1 py-0.5 min-w-[2rem] w-12 text-center text-sm shadow-sm bg-no-repeat [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none cursor-text`}
                            />

                            <button
                              onClick={() => updateVariantQuantity(selectedCard.id, variant.id, 1)}
                              className={`w-7 h-7 ${getQuantityButtonColor(variant, 1)} hover:opacity-80 text-white rounded flex items-center justify-center text-base font-bold transition-all shadow-sm`}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Admin: floating variant edit popup */}
                        {isAdmin && editingVariantId === variant.id && (
                          <div
                            ref={editPopupRef}
                            className="absolute left-0 top-full mt-1 z-50 w-72 bg-base border border-subtle rounded-xl shadow-2xl p-3 space-y-2"
                            onClick={e => e.stopPropagation()}
                          >
                            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Edit Variant</p>
                            {/* Name */}
                            <div>
                              <label className="text-xs text-muted mb-1 block">Name</label>
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full bg-elevated border border-subtle rounded px-2 py-1 text-sm text-primary focus:outline-none focus:border-accent"
                              />
                            </div>
                            {/* Description */}
                            <div>
                              <label className="text-xs text-muted mb-1 block">Description</label>
                              <input
                                type="text"
                                value={editForm.description}
                                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                className="w-full bg-elevated border border-subtle rounded px-2 py-1 text-sm text-primary focus:outline-none focus:border-accent"
                              />
                            </div>
                            {/* Sort order */}
                            <div>
                              <label className="text-xs text-muted mb-1 block">Sort order</label>
                              <input
                                type="number"
                                value={editForm.sortOrder}
                                onChange={e => setEditForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                                className="w-20 bg-elevated border border-subtle rounded px-2 py-1 text-sm text-primary focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                            </div>
                            {/* Color swatches */}
                            <div>
                              <label className="text-xs text-muted mb-1 block">Color</label>
                              <div className="flex gap-1.5 flex-wrap">
                                {(['green','blue','purple','red','pink','yellow','gray','orange','teal'] as const).map(c => (
                                  <button
                                    key={c}
                                    onClick={() => setEditForm(f => ({ ...f, color: c }))}
                                    className={`w-5 h-5 rounded-full ${colorMap[c]} transition-all ${editForm.color === c ? 'ring-2 ring-offset-1 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                                    title={c}
                                  />
                                ))}
                              </div>
                            </div>
                            {/* Error message */}
                            {variantEditError && (
                              <p className="text-red-400 text-xs">{variantEditError}</p>
                            )}
                            {/* Action buttons */}
                            <div className="flex items-center gap-1.5 pt-1">
                              <button
                                onClick={() => handleVariantEditSave(variant.id)}
                                disabled={isSavingEdit}
                                className="flex-1 py-1 rounded bg-accent text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                              >
                                {isSavingEdit ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={() => { setEditingVariantId(null); setVariantEditError(null); setConfirmDeleteId(null) }}
                                disabled={isSavingEdit}
                                className="flex-1 py-1 rounded bg-elevated border border-subtle text-primary text-xs hover:bg-card-item disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              {confirmDeleteId === variant.id ? (
                                <button
                                  onClick={() => handleVariantDelete(variant.id)}
                                  disabled={isSavingEdit}
                                  className="py-1 px-2 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                                >
                                  {isSavingEdit ? '…' : 'Yes, delete'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(variant.id)}
                                  disabled={isSavingEdit}
                                  className="py-1 px-2 rounded bg-elevated border border-red-600/40 text-red-400 text-xs hover:bg-red-600/10 disabled:opacity-50"
                                  title="Delete variant"
                                >
                                  🗑
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Missing Variant Button */}
                <div className="border-t border-subtle pt-4 mt-6">
                  <button
                    onClick={() => setShowVariantSuggestionModal(true)}
                    className="w-full py-3 px-4 bg-accent hover:opacity-90 text-white rounded-lg transition-colors font-medium"
                  >
                    🔥 Missing a variant?
                  </button>
                </div>

                {/* Other versions from other sets */}
                {(isFetchingRelated || relatedCards.length > 0 || relatedCardsTotal > 0) && (
                  <div className="border-t border-subtle pt-4 mt-4">
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                      Other versions
                    </h3>

                    {isFetchingRelated ? (
                      /* Loading skeleton */
                      <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="bg-elevated rounded-lg overflow-hidden border border-subtle animate-pulse"
                          >
                            <div className="bg-surface" style={{ aspectRatio: '2.5/3.5' }} />
                            <div className="p-2 space-y-1">
                              <div className="h-2.5 bg-surface rounded w-3/4" />
                              <div className="h-2 bg-surface rounded w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {relatedCards.slice(0, 3).map((rc) => (
                            <a
                              key={rc.id}
                              href={rc.set_id ? `/set/${rc.set_id}?card=${rc.id}` : '#'}
                              className="group block bg-elevated rounded-lg overflow-hidden border border-subtle hover:border-accent/50 transition-all duration-150"
                              title={`${rc.setName ?? 'Unknown Set'} — #${rc.number ?? '?'}`}
                            >
                              {/* Card image */}
                              <div
                                className="relative bg-surface overflow-hidden"
                                style={{ aspectRatio: '2.5/3.5' }}
                              >
                                <img
                                  src={rc.image ?? '/pokemon_card_backside.png'}
                                  alt={rc.name ?? 'Card'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  loading="lazy"
                                  onError={(e) => {
                                    const t = e.target as HTMLImageElement
                                    if (!t.src.endsWith('/pokemon_card_backside.png')) {
                                      t.src = '/pokemon_card_backside.png'
                                    }
                                  }}
                                />
                              </div>
                              {/* Meta */}
                              <div className="p-1.5">
                                <div className="text-[10px] text-secondary font-medium truncate leading-tight">
                                  {rc.setName ?? 'Unknown Set'}
                                </div>
                                <div className="text-[10px] text-muted truncate leading-tight">
                                  {rc.number ? `#${rc.number.split('/')[0]}` : ''}
                                  {rc.number && rc.rarity ? ' · ' : ''}
                                  {rc.rarity ?? ''}
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>

                        {/* View all button */}
                        {relatedCardsTotal > 0 && selectedCard?.name && (
                          <a
                            href={`/browse?name=${encodeURIComponent(selectedCard.name)}`}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-elevated hover:bg-card-item border border-subtle rounded-lg text-sm text-secondary hover:text-primary transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <span>
                              View all {relatedCardsTotal} <span className="font-medium text-primary">{selectedCard.name}</span> cards
                            </span>
                            <svg className="w-3.5 h-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </a>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>}

              {/* ── Trade Tab ─── */}
              {modalTab === 'trade' && (
                <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
                  <span className="text-5xl mb-4">🔄</span>
                  <h3 className="text-lg font-semibold text-primary mb-2">Trading Coming Soon</h3>
                  <p className="text-secondary text-sm max-w-xs leading-relaxed">
                    Trade your duplicates with other Lumidex collectors.
                    We&rsquo;re building this feature — check back soon!
                  </p>
                </div>
              )}

              {/* ── Friends Tab ─── */}
              {modalTab === 'friends' && (
                <div className="flex-1 overflow-y-auto">
                  {!user ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <span className="text-4xl mb-3">👥</span>
                      <p className="text-secondary text-sm">Sign in to see which friends have this card.</p>
                    </div>
                  ) : isLoadingFriends && !friendsCache.has(selectedCard.id) ? (
                    <div className="space-y-3 py-4">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                          <div className="w-8 h-8 rounded-full bg-elevated" />
                          <div className="flex-1 h-4 bg-elevated rounded" />
                          <div className="w-20 h-4 bg-elevated rounded" />
                        </div>
                      ))}
                    </div>
                  ) : (() => {
                    const friends = friendsCache.get(selectedCard.id) ?? []
                    if (friends.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                          <span className="text-4xl mb-3">🤝</span>
                          <p className="text-secondary text-sm font-medium">None of your friends have this card yet.</p>
                          <p className="text-muted text-xs mt-1">Connect with more collectors to see who has it.</p>
                        </div>
                      )
                    }
                    return (
                      <div className="space-y-2">
                        {friends.map(friend => (
                          <div
                            key={friend.userId}
                            className="flex items-center gap-3 bg-elevated rounded-lg px-3 py-2.5 border border-subtle"
                          >
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center overflow-hidden flex-shrink-0 ring-1 ring-subtle">
                              {friend.avatarUrl ? (
                                <Image
                                  src={friend.avatarUrl}
                                  alt={friend.username ?? ''}
                                  width={32}
                                  height={32}
                                  className="object-cover"
                                />
                              ) : (
                                <span className="text-base">👤</span>
                              )}
                            </div>
                            {/* Username */}
                            <a
                              href={`/profile/${friend.userId}`}
                              className="text-sm font-medium text-primary hover:text-accent transition-colors truncate"
                            >
                              {friend.username ?? 'Unknown collector'}
                            </a>
                            {/* Variant badges */}
                            <div className="flex flex-wrap gap-1 ml-auto">
                              {friend.variants.map(v => (
                                <span
                                  key={v.variantName}
                                  className="text-xs bg-surface border border-subtle rounded px-1.5 py-0.5 text-secondary tabular-nums whitespace-nowrap"
                                >
                                  {v.variantName} ×{v.quantity}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      <VariantSuggestionModal
        isOpen={showVariantSuggestionModal}
        selectedCard={selectedCard}
        userId={userId || ''}
        onClose={() => setShowVariantSuggestionModal(false)}
      />
    </>
  )
}