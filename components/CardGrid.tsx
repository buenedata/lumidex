'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { CardTile } from '@/components/CardTile'
import Image from 'next/image'
import Link from 'next/link'
import { PokemonCard, UserCard, VariantWithQuantity, QuickAddVariant, VARIANT_COLOR_CLASSES, CollectionGoal, PriceHistoryPoint, FriendCardOwner, PriceSource, UserGradedCard } from '@/types'
import { useCollectionStore, useAuthStore } from '@/lib/store'
import Modal from '@/components/ui/Modal'
import VariantSuggestionModal from '@/components/VariantSuggestionModal'
import AddGradedCardModal from '@/components/AddGradedCardModal'
import { formatPrice, EUR_TO_USD } from '@/lib/pricing'
import type { PriceChartRange } from '@/components/PriceChart'
import { updateVariant, deleteVariant, removeVariantFromCard } from '@/app/admin/variants/actions'
import AddToListDropdown from '@/components/lists/AddToListDropdown'

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
  /** CardMarket avg sell price for the reverse holo variant (EUR) */
  cm_reverse_holo:   number | null
  /** CardMarket avg sell price for the Cosmos Holo variant (EUR) — manually set */
  cm_cosmos_holo:    number | null
  /** Direct URL to this card's CardMarket product page */
  cm_url:            string | null
  tcgp_updated_at:   string | null
  cm_updated_at:     string | null
  fetched_at:        string
  /**
   * Per-variant CardMarket URL overrides from card_cm_url_overrides table.
   * Keys are variant_key values (e.g. 'normal', 'cosmos_holo').
   * Reverse holo URL is auto-derived at render time: normal_url + ?isReverseHolo=Y
   */
  variant_cm_urls:   Record<string, string> | null
}

type ModalTab = 'card' | 'price' | 'friends'

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
  sortDirection?: 'asc' | 'desc'
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
   * Called after the batch variant fetch when any card in the set has card-specific
   * (non-global) variants. Used to show the Grandmaster Set option in the goal selector.
   */
  onHasExtraVariants?: (has: boolean) => void
  /**
   * The FULL (unsearch-filtered) card list for the current set.
   * CardGrid receives only the search-filtered subset via `cards`; passing the full
   * list here lets the goal-aware count computation cover all cards so the Have/Need
   * badge numbers always match the full set (not just the visible search subset).
   */
  allCards?: PokemonCard[]
  /** Called whenever the goal-aware Have/Need counts change after variant data loads. */
  onCountsChange?: (have: number, need: number) => void
  /**
   * When true, cards are never greyed out regardless of the user's grey_out_unowned setting.
   * Used on the browse/search page where collection status should not affect card appearance.
   */
  disableGreyOut?: boolean
  /**
   * Called immediately after the user toggles a card's wanted status (optimistic).
   * Allows parent pages (e.g. /wanted) to remove the card from their list without a refresh.
   */
  onWantedStatusChange?: (cardId: string, isWanted: boolean) => void
}

/** Badge classes per grading company — used in the "My Graded Copies" card-tab section. */
const GRADED_COMPANY_BADGE: Record<string, string> = {
  PSA:     'bg-blue-900/50 text-blue-300 border-blue-700',
  BECKETT: 'bg-red-900/50 text-red-300 border-red-700',
  CGC:     'bg-amber-900/50 text-amber-300 border-amber-700',
  TAG:     'bg-slate-700/50 text-slate-200 border-slate-500',
  ACE:     'bg-emerald-900/50 text-emerald-300 border-emerald-700',
}

// ── Standalone component — zero React state, RAF-gated DOM writes for buttery 3D tilt ──
//
// variantSrc – when truthy, cross-fades a variant image over the base image.
function CardGlareImage({
  src,
  variantSrc,
  alt,
}: {
  src: string | null | undefined
  variantSrc?: string | null
  alt?: string
}) {
  const cardRef  = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)
  const rafRef   = useRef<number | null>(null)

  // ── Variant image cross-fade ─────────────────────────────────────────────
  const [displayedVariantSrc, setDisplayedVariantSrc] = useState<string | null>(null)
  const [variantOpacity, setVariantOpacity]           = useState(0)
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current)

    if (variantSrc) {
      const img = new window.Image()
      img.src = variantSrc
      const reveal = () => {
        setDisplayedVariantSrc(variantSrc)
        requestAnimationFrame(() => setVariantOpacity(1))
      }
      if (img.complete) reveal()
      else { img.onload = reveal; img.onerror = reveal }
    } else {
      setVariantOpacity(0)
      fadeOutTimerRef.current = setTimeout(() => setDisplayedVariantSrc(null), 320)
    }
  }, [variantSrc])

  // Cancel pending RAF / timers on unmount
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current)
  }, [])

  // ── RAF mouse-move handler ───────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !glareRef.current) return
    const clientX = e.clientX
    const clientY = e.clientY
    const rect    = e.currentTarget.getBoundingClientRect()

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!cardRef.current || !glareRef.current) return
      const x = (clientX - rect.left) / rect.width   // 0 → 1
      const y = (clientY - rect.top)  / rect.height  // 0 → 1

      const rotateY =  (x - 0.5) * 20
      const rotateX = -(y - 0.5) * 15

      // 3D tilt
      cardRef.current.style.transition = 'none'
      cardRef.current.style.transform  =
        `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`

      // White glare spot
      glareRef.current.style.opacity    = '1'
      glareRef.current.style.background =
        `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0) 65%)`

    })
  }

  const handleMouseLeave = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (!cardRef.current || !glareRef.current) return
    cardRef.current.style.transition = 'transform 600ms cubic-bezier(0.16,1,0.3,1)'
    cardRef.current.style.transform  = 'perspective(800px) rotateX(0deg) rotateY(0deg)'
    glareRef.current.style.opacity   = '0'
  }

  return (
    <div
      style={{ padding: 20, flexShrink: 0 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        className="w-[389px] h-[543px] bg-elevated rounded-xl overflow-hidden relative cursor-crosshair"
        style={{ willChange: 'transform' }}
      >
        {/* Base image */}
        <img
          src={src || '/pokemon_card_backside.png'}
          alt={alt ?? 'Pokemon card'}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            const t = e.currentTarget
            if (!t.src.endsWith('/pokemon_card_backside.png')) t.src = '/pokemon_card_backside.png'
          }}
        />

        {/* Variant image — cross-fades for card-specific uploaded images */}
        {displayedVariantSrc && (
          <img
            src={displayedVariantSrc}
            alt={alt ?? 'Pokemon card variant'}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ opacity: variantOpacity, transition: 'opacity 300ms ease-in-out' }}
            onError={(e) => {
              const t = e.currentTarget
              if (!t.src.endsWith('/pokemon_card_backside.png')) t.src = '/pokemon_card_backside.png'
            }}
          />
        )}

        {/* White glare spot — sits above everything */}
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

export default function CardGrid({ cards, userCards: propsUserCards, filter = 'all', sortBy = 'number', sortDirection = 'asc', userId: propsUserId, setTotal, setName, setComplete, initialCardId, collectionGoal = 'normal', cardPricesUSD, currency = 'USD', priceSource = 'tcgplayer', onVariantsLegendChange, onHasExtraVariants, allCards, onCountsChange, disableGreyOut = false, onWantedStatusChange }: CardGridProps) {
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

  // ── Stable refs — allow useCallback handlers to read fresh state without
  // listing the state in deps (which would defeat React.memo on CardTile).
  const cardQuickVariantsRef = useRef(cardQuickVariants)
  const cardVariantsRef      = useRef(cardVariants)
  const isLoadingVariantsRef = useRef(isLoadingVariants)
  useEffect(() => { cardQuickVariantsRef.current  = cardQuickVariants  }, [cardQuickVariants])
  useEffect(() => { cardVariantsRef.current       = cardVariants       }, [cardVariants])
  useEffect(() => { isLoadingVariantsRef.current  = isLoadingVariants  }, [isLoadingVariants])
  // Stable ref for onCountsChange — lets the emit-effect depend only on the
  // computed value, not on the callback identity, preventing render cascades.
  const onCountsChangeRef = useRef(onCountsChange)
  useEffect(() => { onCountsChangeRef.current = onCountsChange }, [onCountsChange])
  // Tracks cards whose full variants (incl. variant_image_url) have been loaded via GET.
  const cardVariantsLoadedRef = useRef(new Set<string>())
  // Cache for related-card results — avoids re-fetching on every modal open for the same card.
  const relatedCardsCacheRef  = useRef(new Map<string, { cards: RelatedCard[], total: number }>())
  const [showVariantSuggestionModal, setShowVariantSuggestionModal] = useState(false)
  const [showGradedModal, setShowGradedModal] = useState(false)
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
  // eBay graded price state (PSA / CGC / ACE)
  type GradeData = { grade: number; avgPriceUsd: number; sampleSize: number; fetchedAt: string }
  type GradedByCompany = Record<string, GradeData[]>
  const [gradedPriceCache, setGradedPriceCache]         = useState<Map<string, GradedByCompany>>(new Map())
  const [isLoadingGraded, setIsLoadingGraded]           = useState(false)
  // User's own graded copies for the currently open card
  const [userGradedCards, setUserGradedCards]           = useState<UserGradedCard[]>([])
  const [isLoadingOwnGraded, setIsLoadingOwnGraded]     = useState(false)
  // Wanted list state
  const [wantedCardIds, setWantedCardIds]               = useState<Set<string>>(new Set())
  const [wantedLoading, setWantedLoading]               = useState(false)
  const [wantedInitialized, setWantedInitialized]       = useState(false)
  // Custom list membership state — tracks which cards appear in any user list
  // (used to fill the star if the card is in a list but not wanted)
  const [listCardIds, setListCardIds]                   = useState<Set<string>>(new Set())
  const [listCardsInitialized, setListCardsInitialized] = useState(false)
  // Friends tab state
  const [friendsCache, setFriendsCache]                 = useState<Map<string, FriendCardOwner[]>>(new Map())
  const [isLoadingFriends, setIsLoadingFriends]         = useState(false)
  // Per-variant input text while the user is typing a quantity directly
  const [variantInputValues, setVariantInputValues]     = useState<Map<string, string>>(new Map())
  // Which variant row the user is currently hovering in the modal (drives image swap)
  const [hoveredVariantId, setHoveredVariantId]         = useState<string | null>(null)
  // Admin: floating popup edit state for variant editing
  const [editingVariantId, setEditingVariantId]   = useState<string | null>(null)
  const [editForm,         setEditForm]            = useState({ name: '', description: '', color: 'gray', sortOrder: 0, isQuickAdd: false, shortLabel: '' })
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

  // Close the graded card modal whenever the user navigates to a different card
  // or closes the main card details modal, so it doesn't auto-open on the next card.
  useEffect(() => {
    setShowGradedModal(false)
  }, [selectedCard?.id])

  // Admin: save variant field edits and patch local state
  async function handleVariantEditSave(variantId: string) {
    setIsSavingEdit(true)
    setVariantEditError(null)
    const result = await updateVariant(variantId, {
      name:        editForm.name,
      description: editForm.description || null,
      color:       editForm.color,
      sortOrder:   editForm.sortOrder,
      isQuickAdd:  editForm.isQuickAdd,
      shortLabel:  editForm.shortLabel || null,
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
              ? { ...v, name: editForm.name, description: editForm.description || null, color: editForm.color as any, sort_order: editForm.sortOrder, is_quick_add: editForm.isQuickAdd, short_label: editForm.shortLabel || null }
              : v
          )
        )
        return next
      })
    }
    setEditingVariantId(null)
  }

  // Admin: remove variant from a card.
  // - Global variants (card_id IS NULL): only remove the card_variant_availability
  //   link for this card — never delete the global variant definition.
  // - Card-specific variants (card_id = this card): delete the variant entirely.
  async function handleVariantDelete(variantId: string) {
    if (!selectedCard) return
    setIsSavingEdit(true)

    // Determine if global or card-specific by checking the cached variant list
    const modalAllVariants = cardVariants.get(selectedCard.id) ?? []
    const variantObj = modalAllVariants.find(v => v.id === variantId)
    const isGlobal = !variantObj?.card_id

    const result = isGlobal
      ? await removeVariantFromCard(variantId, selectedCard.id)
      : await deleteVariant(variantId)

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
      const userCard      = userCards.get(card.id)
      const quickVariants = cardQuickVariants.get(card.id)

      // Basic ownership: prefer quickVariants (updated optimistically on every
      // variant click) when they are loaded and non-empty.  Fall back to the
      // Zustand store aggregate for promo/card-specific-variant-only cards
      // (quickVariants is [] even after loading) and before the batch fetch.
      const anyOwned = (quickVariants && quickVariants.length > 0)
        ? quickVariants.some(v => v.quantity > 0)
        : !!(userCard && userCard.quantity > 0)

      // isOwned for normal goal = anyOwned.
      // Masterset: only GLOBAL (non-card-specific) quick-add variants must all be qty > 0.
      //   Card-specific variants (card_id != null) are grandmasterset territory only.
      // Grandmasterset: ALL variants (including card-specific) must have qty > 0.
      let isOwned: boolean
      if (collectionGoal === 'masterset') {
        if (quickVariants && quickVariants.length > 0) {
          const globalVariants = quickVariants.filter(v => v.card_id == null)
          isOwned = globalVariants.length > 0
            ? globalVariants.every(v => v.quantity > 0)
            : anyOwned
        } else {
          isOwned = anyOwned
        }
      } else if (collectionGoal === 'grandmasterset') {
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

    // Sort according to the active sortBy option and direction
    const dir = sortDirection === 'desc' ? -1 : 1
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return dir * (a.name ?? '').localeCompare(b.name ?? '')
      }
      if (sortBy === 'price') {
        const priceA = cardPricesUSD?.[a.id] ?? 0
        const priceB = cardPricesUSD?.[b.id] ?? 0
        // base order: highest price first (desc = 1, asc = -1)
        return dir * (priceB - priceA)
      }
      // default: 'number' — numeric sort with string fallback
      const getNum = (n: string | null): number => {
        const m = (n ?? '').match(/(\d+)/)
        return m ? parseInt(m[1], 10) : 0
      }
      const diff = getNum(a.number) - getNum(b.number)
      return dir * (diff !== 0 ? diff : (a.number ?? '').localeCompare(b.number ?? ''))
    })
  }, [cards, userCards, filter, sortBy, sortDirection, collectionGoal, cardQuickVariants, cardPricesUSD])

  // ── Goal-aware Have / Need counts ────────────────────────────────────────────
  // Uses allCards (the full unsearch-filtered set) when provided, so the numbers
  // always reflect the whole set — matching the SetPageCards haveCount / needCount
  // behaviour even when the user has an active search filter.
  // Recomputes after every variant click (cardQuickVariants dep) and goal change.
  const goalAwareCounts = useMemo(() => {
    const source = allCards ?? cards
    let have = 0
    for (const card of source) {
      const userCard      = userCards.get(card.id)
      const quickVariants = cardQuickVariants.get(card.id)
      const anyOwned = quickVariants && quickVariants.length > 0
        ? quickVariants.some(v => v.quantity > 0)
        : !!(userCard && userCard.quantity > 0)

      let owned: boolean
      if (collectionGoal === 'masterset') {
        if (quickVariants && quickVariants.length > 0) {
          const globalVariants = quickVariants.filter(v => v.card_id == null)
          owned = globalVariants.length > 0 ? globalVariants.every(v => v.quantity > 0) : anyOwned
        } else {
          owned = anyOwned
        }
      } else if (collectionGoal === 'grandmasterset') {
        if (quickVariants && quickVariants.length > 0) {
          owned = quickVariants.every(v => v.quantity > 0)
        } else {
          owned = anyOwned
        }
      } else {
        owned = anyOwned
      }
      if (owned) have++
    }
    return { have, need: source.length - have }
  }, [allCards, cards, userCards, collectionGoal, cardQuickVariants])

  // Emit goal-aware counts whenever they change — uses the ref so the effect
  // deps list is just the counts object, preventing callback identity re-renders.
  useEffect(() => {
    onCountsChangeRef.current?.(goalAwareCounts.have, goalAwareCounts.need)
  }, [goalAwareCounts])

  // Load variants for a specific card — stable (useCallback + isLoadingVariantsRef)
  const loadCardVariants = useCallback(async (cardId: string, quickAddOnly = false) => {
    if (isLoadingVariantsRef.current.has(cardId)) return

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
          short_label: null,
          quantity: v.quantity,
          sort_order: v.sort_order
        }))
        setCardQuickVariants(prev => new Map(prev).set(cardId, quickVariants))
      } else {
        setCardVariants(prev => new Map(prev).set(cardId, variants))
        cardVariantsLoadedRef.current.add(cardId)  // mark fully loaded (has variant_image_url)
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
  }, [userId])

  // Fetch other versions of the same Pokémon — cached per card so repeat modal opens are instant
  const fetchRelatedCards = useCallback(async (card: PokemonCard) => {
    if (!card.name) return

    // Return cached result immediately — no spinner, no network round-trip
    const cached = relatedCardsCacheRef.current.get(card.id)
    if (cached) {
      setRelatedCards(cached.cards)
      setRelatedCardsTotal(cached.total)
      return
    }

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
      const relCards = data.cards ?? []
      const relTotal = data.total ?? 0
      relatedCardsCacheRef.current.set(card.id, { cards: relCards, total: relTotal })
      setRelatedCards(relCards)
      setRelatedCardsTotal(relTotal)
    } catch (error) {
      console.error('Failed to fetch related cards:', error)
    } finally {
      setIsFetchingRelated(false)
    }
  }, [])

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
        
        const newQuickVariants = new Map<string, QuickAddVariant[]>()
        const newCustomCounts  = new Map<string, number>()
        // Pre-populate full variants so the modal shows them instantly (no per-card GET needed).
        // variant_image_url is absent at this stage; loadCardVariants adds it silently on first open.
        const newCardVariants  = new Map<string, VariantWithQuantity[]>()

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
              variant_image_url: v.variant_image_url ?? null,
            }))
          newQuickVariants.set(cardId, quickVariants)
          newCardVariants.set(cardId, variants as VariantWithQuantity[])

          // Track count of card-specific variants for the ★ indicator (multiple-variant case)
          const customCount = quickVariants.filter(v => v.card_id != null).length
          if (customCount > 0) newCustomCounts.set(cardId, customCount)
        })
        
        setCardQuickVariants(newQuickVariants)
        setCardCustomVariantCounts(newCustomCounts)
        setCardVariants(newCardVariants)  // pre-populate so modal variants appear instantly

        // Compute deduplicated legend variants — global variants only (card_id == null).
        // Card-specific variants are excluded so they never appear in the Variant Key.
        if (onVariantsLegendChange) {
          const seen = new Set<string>()
          const legendVariants: QuickAddVariant[] = []
          for (const [, cvariants] of newQuickVariants) {
            for (const v of cvariants) {
              if (v.card_id == null && !seen.has(v.color)) {
                seen.add(v.color)
                legendVariants.push(v)
              }
            }
          }
          legendVariants.sort((a, b) => a.sort_order - b.sort_order)
          onVariantsLegendChange(legendVariants)
        }

        // Signal whether any card in this set has card-specific variants.
        // SetPageCards uses this to decide whether to show the Grandmaster Set option.
        onHasExtraVariants?.(newCustomCounts.size > 0)

      } catch (error) {
        console.error('Failed to batch load variants:', error)
      }
    }
    
    loadAllVariants()
  }, [cards, userId])

  // Update variant quantity — with optimistic UI update for instant button feedback.
  // The new quantity is reflected in the UI immediately; the API call runs in the
  // background and the state is reconciled when it resolves (or reverted on error).
  // useCallback + ref: stable identity so CardTile / React.memo skips re-renders.
  const updateVariantQuantity = useCallback(async (cardId: string, variantId: string, increment: number) => {
    if (!userId) return

    // ── Snapshot current quantity before the click (via ref — no stale closure) ─
    const preClickVariants = cardQuickVariantsRef.current.get(cardId) || []
    const preClickVariant  = preClickVariants.find(v => v.id === variantId)
    const currentQuantity  = preClickVariant?.quantity ?? 0
    const optimisticQty    = Math.max(0, currentQuantity + increment)

    // ── Optimistic update: reflect new qty instantly, no await ───────────────
    setCardQuickVariants(prev => {
      const m = new Map(prev)
      const vs = m.get(cardId)
      if (vs) m.set(cardId, vs.map(v => v.id === variantId ? { ...v, quantity: optimisticQty } : v))
      return m
    })

    try {
      // Pass currentQuantity so the server skips its own SELECT round-trip
      const response = await fetch('/api/user-card-variants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, cardId, variantId, increment, currentQuantity }),
      })

      if (!response.ok) {
        // ── Revert optimistic update on API failure ──────────────────────────
        setCardQuickVariants(prev => {
          const m = new Map(prev)
          const vs = m.get(cardId)
          if (vs) m.set(cardId, vs.map(v => v.id === variantId ? { ...v, quantity: currentQuantity } : v))
          return m
        })
        console.error('Failed to update variant quantity:', response.status)
        return
      }

      const result = await response.json()

      // ── Reconcile with server-confirmed quantity ─────────────────────────
      setCardQuickVariants(prev => {
        const m = new Map(prev)
        const vs = m.get(cardId)
        if (vs) m.set(cardId, vs.map(v => v.id === variantId ? { ...v, quantity: result.quantity } : v))
        return m
      })

      // Update full variants if loaded in the modal
      setCardVariants(prev => {
        const m = new Map(prev)
        const vs = m.get(cardId)
        if (vs) m.set(cardId, vs.map(v => v.id === variantId ? { ...v, quantity: result.quantity } : v))
        return m
      })

      // Legacy user_cards sync — fire-and-forget, must NOT block the UI.
      // Use preClickVariants as the base (state updates are async and may not
      // have flushed yet), substituting result.quantity for the updated variant.
      const totalQuantity = preClickVariants.reduce((sum, v) => {
        const qty = v.id === variantId ? result.quantity : v.quantity
        return sum + qty
      }, 0)
      const getVariantQty = (name: string) => {
        const v = preClickVariants.find(v => v.name === name)
        if (!v) return 0
        return v.id === variantId ? result.quantity : v.quantity
      }
      updateCardQuantity(cardId, totalQuantity, {
        normal:  getVariantQty('Normal'),
        reverse: getVariantQty('Reverse Holo'),
        holo:    getVariantQty('Holo Rare'),
      }).catch(console.error)   // explicitly fire-and-forget

    } catch (error) {
      // ── Revert optimistic update on network error ────────────────────────
      setCardQuickVariants(prev => {
        const m = new Map(prev)
        const vs = m.get(cardId)
        if (vs) m.set(cardId, vs.map(v => v.id === variantId ? { ...v, quantity: currentQuantity } : v))
        return m
      })
      console.error('Failed to update variant quantity:', error)
    }
  }, [userId, updateCardQuantity])

  // Set variant quantity directly (used when user types a value into the modal input)
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
        console.error('API Error (direct set):', response.status)
        return
      }

      const result = await response.json()
      const resultQty: number = result.quantity ?? clamped

      // Update quick variants in state
      setCardQuickVariants(prev => {
        const m = new Map(prev)
        const vs = m.get(cardId)
        if (vs) m.set(cardId, vs.map(v => v.id === variantId ? { ...v, quantity: resultQty } : v))
        return m
      })

      // Update full variants if loaded in modal
      setCardVariants(prev => {
        const m = new Map(prev)
        const vs = m.get(cardId)
        if (vs) m.set(cardId, vs.map(v => v.id === variantId ? { ...v, quantity: resultQty } : v))
        return m
      })

      // Legacy user_cards sync — fire-and-forget, must NOT block the UI
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
      updateCardQuantity(cardId, totalQuantity, {
        normal:  getVariantQty('Normal'),
        reverse: getVariantQty('Reverse Holo'),
        holo:    getVariantQty('Holo Rare'),
      }).catch(console.error)   // fire-and-forget
    } catch (error) {
      console.error('Failed to set variant quantity directly:', error)
    }
  }

  // Handle variant color box click — stable (useCallback + ref, no stale closure)
  const handleVariantClick = useCallback((e: React.MouseEvent, cardId: string, variantId: string) => {
    e.stopPropagation()

    if (e.type === 'contextmenu') {
      // Always suppress the browser context menu on variant buttons
      e.preventDefault()
      // Right-click: decrement, but never below 0
      const variants = cardQuickVariantsRef.current.get(cardId) || []
      const variant  = variants.find(v => v.id === variantId)
      if (variant && variant.quantity > 0) {
        updateVariantQuantity(cardId, variantId, -1)
      }
      return
    }

    if (e.altKey || e.button === 2) {
      // Alt-click: decrement, but never below 0
      const variants = cardQuickVariantsRef.current.get(cardId) || []
      const variant  = variants.find(v => v.id === variantId)
      if (variant && variant.quantity > 0) {
        updateVariantQuantity(cardId, variantId, -1)
      }
    } else {
      // Normal click: increment
      updateVariantQuantity(cardId, variantId, 1)
    }
  }, [updateVariantQuantity])

  // Fetch full price row for a card (cached — one fetch per card per session)
  const fetchCardPrice = useCallback(async (cardId: string) => {
    if (cardPriceCache.has(cardId)) return // already fetched
    setIsLoadingPrice(true)
    try {
      const res = await fetch(`/api/prices/card/${cardId}`)
      if (res.ok) {
        const json = await res.json()
        // Merge variant_cm_urls into the price row so the cache contains
        // everything needed to render per-variant prices and links.
        const priceRow: CardPriceRow | null = json.price
          ? { ...json.price, variant_cm_urls: json.variant_cm_urls ?? null }
          : null
        setCardPriceCache(prev => new Map(prev).set(cardId, priceRow))
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

  // Fetch eBay graded prices (PSA/CGC/ACE) for a card — cached per session
  const fetchGradedPrices = useCallback(async (cardId: string) => {
    if (gradedPriceCache.has(cardId)) return
    setIsLoadingGraded(true)
    try {
      const res = await fetch(`/api/prices/card/${cardId}/graded`)
      if (res.ok) {
        const json = await res.json()
        setGradedPriceCache(prev => new Map(prev).set(cardId, json.byCompany ?? {}))
      }
    } catch {
      setGradedPriceCache(prev => new Map(prev).set(cardId, {}))
    } finally {
      setIsLoadingGraded(false)
    }
  }, [gradedPriceCache])

  // Fetch the authenticated user's own graded copies for a given card — called on modal open
  // and after a successful graded-card add.
  const fetchUserGradedCards = useCallback(async (cardId: string) => {
    if (!userId) { setUserGradedCards([]); return }
    setIsLoadingOwnGraded(true)
    try {
      const res = await fetch(`/api/graded-cards?cardId=${encodeURIComponent(cardId)}`)
      if (res.ok) {
        const json = await res.json()
        setUserGradedCards(json.gradedCards ?? [])
      } else {
        setUserGradedCards([])
      }
    } catch {
      setUserGradedCards([])
    } finally {
      setIsLoadingOwnGraded(false)
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger a fresh fetch whenever the selected card changes (or user signs in/out)
  useEffect(() => {
    if (selectedCard && userId) {
      fetchUserGradedCards(selectedCard.id)
    } else {
      setUserGradedCards([])
    }
  }, [selectedCard?.id, userId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Load all card IDs that are in any custom list once on first modal open
  const fetchListCardIds = useCallback(async () => {
    if (listCardsInitialized) return
    try {
      const res = await fetch('/api/user-lists/all-card-ids')
      if (res.ok) {
        const json = await res.json()
        setListCardIds(new Set(json.cardIds ?? []))
        setListCardsInitialized(true)
      }
    } catch { /* non-critical */ }
  }, [listCardsInitialized])

  // Toggle wanted status for a card
  const toggleWanted = useCallback(async (cardId: string) => {
    if (wantedLoading) return
    const isCurrentlyWanted = wantedCardIds.has(cardId)
    const newWantedState = !isCurrentlyWanted
    // Optimistic update
    setWantedCardIds(prev => {
      const next = new Set(prev)
      if (isCurrentlyWanted) next.delete(cardId)
      else next.add(cardId)
      return next
    })
    // Notify parent immediately (optimistic) — lets /wanted page remove the card instantly
    onWantedStatusChange?.(cardId, newWantedState)
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
      // Revert parent notification
      onWantedStatusChange?.(cardId, isCurrentlyWanted)
    } finally {
      setWantedLoading(false)
    }
  }, [wantedCardIds, wantedLoading, onWantedStatusChange])

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

  // Open card modal when clicked — stable (useCallback + cardVariantsRef)
  const handleCardClick = useCallback((card: PokemonCard) => {
    setSelectedCard(card)
    setModalTab('card')      // always open on Card tab
    fetchRelatedCards(card)
    fetchCardPrice(card.id)  // eagerly load so Market Price column is populated on Card tab
    // Variants are pre-populated from the batch (instant modal display).
    // On first open, kick off a background GET to add missing variant_image_url data
    // (used by the hover image-swap feature), without any delay.
    if (!cardVariantsLoadedRef.current.has(card.id)) {
      loadCardVariants(card.id, false)
    }
    // Pre-load wanted + list card IDs on first modal open
    if (user) {
      fetchWantedCards()
      fetchListCardIds()
    }
  }, [fetchRelatedCards, fetchCardPrice, loadCardVariants, fetchWantedCards, fetchListCardIds, user])

  // Navigate to the previous / next card while the modal is open
  const navigateCard = (dir: 1 | -1) => {
    if (!selectedCard) return
    const idx = cards.findIndex(c => c.id === selectedCard.id)
    if (idx === -1) return
    const next = cards[idx + dir]
    if (!next) return
    handleCardClick(next)
  }

  // Keyboard left / right arrow navigation inside the modal
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!selectedCard) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  navigateCard(-1)
      if (e.key === 'ArrowRight') navigateCard(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCard, cards])

  // Single click on card image — stable (useCallback, deps on stable handleCardClick)
  const handleCardImageClick = useCallback((card: PokemonCard) => {
    if (clickTimerRef.current) return // already waiting; second click = dblclick path
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      handleCardClick(card)
    }, 250)
  }, [handleCardClick])

  // Double click on card image — stable (useCallback + ref)
  const handleCardImageDblClick = useCallback((e: React.MouseEvent, card: PokemonCard) => {
    e.preventDefault()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    if (!userId) return
    // Read via ref so this callback stays stable between variant-click renders
    const quick = cardQuickVariantsRef.current.get(card.id) || []
    // Prefer default_variant_id → is_quick_add variant → first in sort order
    const defaultVariant = card.default_variant_id
      ? (quick.find(v => v.id === card.default_variant_id) ?? quick.find(v => v.is_quick_add) ?? quick[0])
      : (quick.find(v => v.is_quick_add) ?? quick[0])
    if (defaultVariant) {
      updateVariantQuantity(card.id, defaultVariant.id, 1)
    }
  }, [userId, updateVariantQuantity])

  // Open card modal (right-click / context-menu on card image)
  const handleCardRightClick = useCallback((e: React.MouseEvent, card: PokemonCard) => {
    e.preventDefault()
    setSelectedCard(card)
    if (!cardVariantsRef.current.has(card.id)) {
      loadCardVariants(card.id, false)
    }
  }, [loadCardVariants])

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

  // Derive the variant image src for the modal card image hover swap.
  // Must be computed here (outside JSX) so the value is a stable ReactNode-safe string.
  // Falls back to null when:
  //   – no variant is hovered, or
  //   – the hovered variant has no stored image, or
  //   – the hovered variant IS the quick-add default (card already shows that image).
  const defaultVariantId =
    selectedCard?.default_variant_id ??
    filteredVariants.find(v => v.is_quick_add)?.id ??
    null
  const hoveredVariant = hoveredVariantId
    ? filteredVariants.find(v => v.id === hoveredVariantId) ?? null
    : null
  const variantImageSrc: string | null =
    hoveredVariant?.variant_image_url && hoveredVariant.id !== defaultVariantId
      ? hoveredVariant.variant_image_url
      : null

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {filteredCards.map(card => {
          const userCard      = userCards.get(card.id)
          // quickVariants: same array reference for unchanged cards → React.memo skips re-render
          const quickVariants = cardQuickVariants.get(card.id) || []

          // anyOwned: at least one variant owned (or userCard fallback before batch fetch)
          const anyOwned = quickVariants.length > 0
            ? quickVariants.some(v => v.quantity > 0)
            : !!(userCard && userCard.quantity > 0)

          // isOwned: mirrors filteredCards logic so the green border / grey-out
          // exactly matches the Have/Need tab counts.
          // Masterset: only global variants (card_id == null) must all be owned.
          // Grandmasterset: ALL variants including card-specific must all be owned.
          let isOwned: boolean
          if (collectionGoal === 'masterset') {
            const globalVariants = quickVariants.filter(v => v.card_id == null)
            isOwned = globalVariants.length > 0
              ? globalVariants.every(v => v.quantity > 0)
              : anyOwned
          } else if (collectionGoal === 'grandmasterset') {
            isOwned = quickVariants.length > 0
              ? quickVariants.every(v => v.quantity > 0)
              : anyOwned
          } else {
            isOwned = anyOwned
          }

          // Partial ownership: masterset/grandmasterset goal + at least one required
          // variant is owned but the goal isn't fully complete yet.
          // Triggers the diagonal half-grey overlay on the card image.
          const isPartiallyOwned =
            (collectionGoal === 'masterset' || collectionGoal === 'grandmasterset') &&
            anyOwned && !isOwned

          const customVariantCount = cardCustomVariantCounts.get(card.id) ?? 0
          return (
            <CardTile
              key={card.id}
              card={card}
              quickVariants={quickVariants}
              isOwned={isOwned}
              isPartiallyOwned={isPartiallyOwned}
              customVariantCount={customVariantCount}
              greyOutUnowned={greyOutUnowned}
              cardPricesUSD={cardPricesUSD}
              effectiveCurrency={effectiveCurrency}
              onCardBadgeClick={handleCardClick}
              onCardImageClick={handleCardImageClick}
              onCardImageDblClick={handleCardImageDblClick}
              onCardContextMenu={handleCardClick}
              onVariantClick={handleVariantClick}
              onVariantContextMenu={handleVariantClick}
              onVariantGrayClick={handleCardClick}
            />
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
        onClose={() => { setSelectedCard(null); setHoveredVariantId(null) }}
        maxWidth="5xl"
      >
        {selectedCard && (
          <div className="flex gap-6">
            {/* Left side - Card Image with holographic glare + artist */}
            <div className="flex-shrink-0 flex flex-col">
              <CardGlareImage
                src={selectedCard.image ?? selectedCard.image_url}
                variantSrc={variantImageSrc}
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
                  {(setName || selectedCard.set_name) && <p className="text-sm text-muted">{setName || selectedCard.set_name}</p>}
                  <p className="text-muted text-sm mt-0.5">
                    #{(selectedCard.number || 'Unknown').split('/')[0]}/{setComplete ?? (selectedCard.number?.includes('/') ? selectedCard.number.split('/')[1] : setTotal)}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  {/* Prev / Next card navigation */}
                  {(() => {
                    const navIdx = cards.findIndex(c => c.id === selectedCard.id)
                    return (
                      <>
                        <button
                          onClick={() => navigateCard(-1)}
                          disabled={navIdx <= 0}
                          title="Previous card (←)"
                          className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-[color:var(--color-bg-base)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <span className="text-xs text-muted tabular-nums min-w-[3rem] text-center select-none">
                          {navIdx + 1} / {cards.length}
                        </span>
                        <button
                          onClick={() => navigateCard(1)}
                          disabled={navIdx >= cards.length - 1}
                          title="Next card (→)"
                          className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-[color:var(--color-bg-base)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )
                  })()}
                  {/* Divider */}
                  <span className="w-px h-5 bg-subtle mx-1 shrink-0" />
                  {/* Star / list dropdown — authenticated users only */}
                  {user && (
                    <AddToListDropdown
                      cardId={selectedCard.id}
                      isWanted={wantedCardIds.has(selectedCard.id)}
                      wantedLoading={wantedLoading}
                      onToggleWanted={() => toggleWanted(selectedCard.id)}
                      onListMembershipChange={(cardId, isInAnyList) => {
                        setListCardIds(prev => {
                          const next = new Set(prev)
                          if (isInAnyList) { next.add(cardId) } else { next.delete(cardId) }
                          return next
                        })
                      }}
                    />
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
                      fetchGradedPrices(selectedCard.id)
                      fetchCardPriceHistory(selectedCard.id, priceChartRange)
                    }}
                  >
                    Price
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
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Current Prices · TCGPlayer</h3>
                            <a
                              href={`https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(selectedCard.name ?? '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1"
                            >
                              View on TCGPlayer
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zm-1 2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8h-2v8H5V7h8V5z"/>
                              </svg>
                            </a>
                          </div>
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
                        {(row.cm_avg_sell != null || row.cm_trend != null || row.cm_reverse_holo != null) && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">CardMarket</h3>
                              {row.cm_url && (
                                <a
                                  href={row.cm_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1"
                                >
                                  View on CardMarket
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zm-1 2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8h-2v8H5V7h8V5z"/>
                                  </svg>
                                </a>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              {[
                                { label: 'Normal · Avg Sell',  dot: '#10b981', val: row.cm_avg_sell      != null ? formatPrice(row.cm_avg_sell      * EUR_TO_USD, effectiveCurrency) : null },
                                { label: 'Reverse · Avg Sell', dot: '#3b82f6', val: row.cm_reverse_holo  != null ? formatPrice(row.cm_reverse_holo  * EUR_TO_USD, effectiveCurrency) : null },
                                { label: 'Trend',              dot: '#a855f7', val: row.cm_trend         != null ? formatPrice(row.cm_trend         * EUR_TO_USD, effectiveCurrency) : null },
                                { label: '30-day Avg',         dot: '#f59e0b', val: row.cm_avg_30d       != null ? formatPrice(row.cm_avg_30d       * EUR_TO_USD, effectiveCurrency) : null },
                              ].filter(r => r.val != null).map(r => (
                                <div key={r.label} className="flex items-center justify-between text-sm bg-elevated rounded-lg px-3 py-2 border border-subtle">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.dot }} />
                                    <span className="text-secondary">{r.label}</span>
                                  </div>
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

                        {/* ── eBay Last Sold · Graded ── */}
                        {(() => {
                          const gradedData = gradedPriceCache.get(selectedCard.id) ?? {}
                          const companies = Object.keys(gradedData).sort() // PSA, CGC, ACE alphabetically
                          if (companies.length === 0 && !isLoadingGraded) return null

                          const COMPANY_STYLE: Record<string, { badge: string; bar: string; label: string }> = {
                            PSA: { badge: 'bg-blue-900/50 text-blue-300 border-blue-700',   bar: '#3b82f6', label: 'PSA' },
                            CGC: { badge: 'bg-amber-900/50 text-amber-300 border-amber-700', bar: '#f59e0b', label: 'CGC' },
                            ACE: { badge: 'bg-emerald-900/50 text-emerald-300 border-emerald-700', bar: '#10b981', label: 'ACE' },
                          }
                          const defaultStyle = { badge: 'bg-gray-700/50 text-gray-300 border-gray-600', bar: '#6b7280', label: '' }

                          const cardName    = selectedCard.name
                          const cardNumber  = selectedCard.number

                          return (
                            <div>
                              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                                🏷️ eBay Last Sold · Graded
                              </h3>

                              {isLoadingGraded && companies.length === 0 && (
                                <p className="text-muted text-xs animate-pulse">Loading graded prices…</p>
                              )}

                              <div className="space-y-4">
                                {companies.map(company => {
                                  const grades    = gradedData[company] ?? []
                                  const style     = COMPANY_STYLE[company] ?? defaultStyle
                                  const maxPrice  = grades.length > 0 ? Math.max(...grades.map(g => g.avgPriceUsd)) : 0
                                  const ebayQuery = encodeURIComponent(`${cardName} ${cardNumber} pokemon ${company} graded`)
                                  const ebayUrl   = `https://www.ebay.com/sch/i.html?_nkw=${ebayQuery}&LH_Sold=1&LH_Complete=1`

                                  return (
                                    <div key={company}>
                                      {/* Company header */}
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${style.badge}`}>
                                          {style.label || company}
                                        </span>
                                        <a
                                          href={ebayUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-muted/60 hover:text-muted underline underline-offset-2 transition-colors"
                                        >
                                          See last sold ↗
                                        </a>
                                      </div>

                                      {/* Grade rows */}
                                      <div className="space-y-1.5">
                                        {grades.map(g => {
                                          const pct = maxPrice > 0 ? Math.round((g.avgPriceUsd / maxPrice) * 100) : 0
                                          return (
                                            <div key={g.grade} className="flex items-center gap-2">
                                              <span className="text-xs text-secondary w-12 shrink-0 tabular-nums">
                                                {company} {g.grade}
                                              </span>
                                              <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
                                                <div
                                                  className="h-full rounded-full transition-all"
                                                  style={{ width: `${pct}%`, backgroundColor: style.bar }}
                                                />
                                              </div>
                                              <span className="text-xs font-semibold text-success tabular-nums w-16 text-right shrink-0">
                                                {formatPrice(g.avgPriceUsd, effectiveCurrency)}
                                              </span>
                                              <span className="text-xs text-muted/50 w-12 text-right shrink-0 tabular-nums">
                                                {g.sampleSize}×
                                              </span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()}

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
                        <div
                          key={variant.id}
                          className="relative bg-elevated rounded-lg p-3 hover:bg-card-item transition-colors border border-subtle"
                          onMouseEnter={() => setHoveredVariantId(variant.id)}
                          onMouseLeave={() => setHoveredVariantId(null)}
                        >
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
                                    isQuickAdd:  variant.is_quick_add,
                                    shortLabel:  variant.short_label ?? '',
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

                          {/* Market Price — variant-specific (Normal / Reverse Holo / Holo) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="w-20 text-center">
                              <div className="text-price font-medium text-sm">
                                {(() => {
                                  // Always use the per-variant price from the full price row so that
                                  // Normal and Reverse Holo show different values.
                                  // cardPricesUSD is the set-grid "best price" (tcgp_market or CM
                                  // equivalent) — it is the same for every variant and must NOT be
                                  // used here.
                                  const priceRow = cardPriceCache.get(selectedCard.id)
                                  if (!priceRow) return isLoadingPrice ? '…' : '—'

                                  const vName        = variant.name.toLowerCase()
                                  const vKey         = variant.key ?? ''
                                  const isReverse    = vName.includes('reverse')
                                  const isCosmosHolo = vKey === 'cosmos_holo' ||
                                    (vName.includes('cosmos') && vName.includes('holo'))
                                  const isHolo       = vName.includes('holo') && !isReverse
                                  const is1stEdition = vName.includes('1st') || vName.includes('first edition')

                                  let price: number | null = null
                                  if (priceSource === 'cardmarket') {
                                    // CardMarket prices per variant:
                                    //   Cosmos Holo           → cm_cosmos_holo (manually set, EUR)
                                    //   Reverse Holo          → cm_reverse_holo (EUR, from pokemontcg.io reverseHoloSell)
                                    //   Reverse Holo (Cosmos) → no separate CM price available; show —
                                    //   Normal / other        → cm_avg_sell ?? cm_trend (EUR)
                                    let eur: number | null = null
                                    if (isCosmosHolo && isReverse) {
                                      eur = null // Reverse Cosmos Holo has no dedicated CM price
                                    } else if (isCosmosHolo) {
                                      eur = priceRow.cm_cosmos_holo ?? null
                                    } else if (isReverse) {
                                      eur = priceRow.cm_reverse_holo ?? null
                                    } else {
                                      eur = priceRow.cm_avg_sell ?? priceRow.cm_trend ?? null
                                    }
                                    price = eur != null ? Math.round(eur * EUR_TO_USD * 100) / 100 : null
                                  } else {
                                    // TCGPlayer per-variant columns — only show a price when we have a
                                    // dedicated column for the variant type. Do NOT fall back to
                                    // tcgp_market for unrecognised variants (e.g. Play! Pokémon Prize
                                    // Pack) — showing the wrong price is more misleading than showing —.
                                    price = isReverse    ? (priceRow.tcgp_reverse_holo ?? null)
                                          : isHolo       ? (priceRow.tcgp_holo         ?? null)
                                          : is1stEdition ? (priceRow.tcgp_1st_edition  ?? null)
                                          :                (priceRow.tcgp_normal        ?? null)
                                  }
                                  return price != null ? formatPrice(price, effectiveCurrency) : '—'
                                })()}
                              </div>
                            </div>

                            {/* CardMarket external link — per-variant URL resolution:
                                1. Check variant_cm_urls override for this variant key
                                2. For reverse holo: base_url + ?isReverseHolo=Y
                                3. Fall back to cm_url (API-provided, may be wrong version) */}
                            {(() => {
                              const priceRow = cardPriceCache.get(selectedCard.id)
                              if (!priceRow) return null

                              const vName     = variant.name.toLowerCase()
                              const vKey      = variant.key ?? ''
                              const isRev     = vName.includes('reverse')
                              const isCosmos  = vKey === 'cosmos_holo' ||
                                (vName.includes('cosmos') && vName.includes('holo'))
                              const overrides = priceRow.variant_cm_urls ?? {}

                              // Determine the correct base URL for this variant
                              let resolvedUrl: string | null = null
                              if (isCosmos) {
                                const cosmosBase = overrides['cosmos_holo'] ?? null
                                if (!cosmosBase) {
                                  // No cosmos override set yet — don't show a link rather
                                  // than linking to the wrong version
                                  resolvedUrl = null
                                } else {
                                  resolvedUrl = isRev ? `${cosmosBase}?isReverseHolo=Y` : cosmosBase
                                }
                              } else if (isRev) {
                                // Reverse holo: check a 'reverse_holo'-keyed override first,
                                // then derive from the normal URL + ?isReverseHolo=Y
                                const reverseSpecific = overrides['reverse_holo'] ?? null
                                const normalBase      = overrides['normal'] ?? priceRow.cm_url ?? null
                                resolvedUrl = reverseSpecific ?? (normalBase ? `${normalBase}?isReverseHolo=Y` : null)
                              } else {
                                // Normal / holo / other:
                                //   1. variant-specific override (e.g. 'holo', 'jumbo')
                                //   2. 'normal' override (generic fallback)
                                //   3. API-provided cm_url
                                resolvedUrl = (vKey ? overrides[vKey] : null) ?? overrides['normal'] ?? priceRow.cm_url ?? null
                              }

                              if (!resolvedUrl) return null

                              return (
                                <a
                                  href={resolvedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View on CardMarket"
                                  className="shrink-0 text-muted hover:text-primary transition-colors"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zm-1 2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8h-2v8H5V7h8V5z"/>
                                  </svg>
                                </a>
                              )
                            })()}
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
                                  {isSavingEdit ? '…' : variant.card_id ? 'Yes, delete' : 'Yes, remove'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(variant.id)}
                                  disabled={isSavingEdit}
                                  className="py-1 px-2 rounded bg-elevated border border-red-600/40 text-red-400 text-xs hover:bg-red-600/10 disabled:opacity-50"
                                  title={variant.card_id ? 'Delete this card-specific variant' : 'Remove from this card only'}
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

                {/* Add Graded Card Button */}
                {user && (
                  <div className="border-t border-subtle pt-3 mt-4">
                    <button
                      onClick={() => setShowGradedModal(true)}
                      className="w-full py-2.5 px-4 bg-elevated hover:bg-card-item border border-subtle text-primary rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                    >
                      🏅 Add Graded Card
                    </button>
                  </div>
                )}

                {/* My Graded Copies */}
                {user && (isLoadingOwnGraded || userGradedCards.length > 0) && (
                  <div className="mt-3">
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 px-1">
                      My Graded Copies
                    </h3>
                    {isLoadingOwnGraded ? (
                      <p className="text-xs text-muted animate-pulse px-1">Loading…</p>
                    ) : (
                      <div className="space-y-1.5">
                        {userGradedCards.map(gc => {
                          const variantName = (cardVariants.get(selectedCard!.id) ?? [])
                            .find(v => v.id === gc.variant_id)?.name ?? null
                          const badgeClass = GRADED_COMPANY_BADGE[gc.grading_company]
                            ?? 'bg-gray-700/50 text-gray-300 border-gray-600'
                          return (
                            <div
                              key={gc.id}
                              className="flex items-center gap-2 bg-elevated rounded-lg px-3 py-2 border border-subtle"
                            >
                              <span className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 ${badgeClass}`}>
                                {gc.grading_company}
                              </span>
                              <span className="text-sm text-secondary flex-1 min-w-0 truncate">
                                {gc.grade}{variantName ? ` · ${variantName}` : ''}
                              </span>
                              <span className="text-xs text-muted shrink-0">×{gc.quantity}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Missing Variant Button */}
                <div className="border-t border-subtle pt-4 mt-3">
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
                    const isWanted = selectedCard ? wantedCardIds.has(selectedCard.id) : false
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
                            <div className="flex flex-wrap gap-1 ml-auto items-center gap-x-2">
                              {friend.variants.map(v => (
                                <span
                                  key={v.variantName}
                                  className="text-xs bg-surface border border-subtle rounded px-1.5 py-0.5 text-secondary tabular-nums whitespace-nowrap"
                                >
                                  {v.variantName} ×{v.quantity}
                                </span>
                              ))}
                              {/* Propose trade button — only when card is on current user's wanted list */}
                              {isWanted && selectedCard && (
                                <a
                                  href={`/trade?with=${friend.userId}&request=${selectedCard.id}`}
                                  className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent-light border border-accent/40 hover:bg-accent/10 rounded-lg px-2 py-1 transition-colors whitespace-nowrap"
                                  title={`Propose a trade with ${friend.username ?? 'this collector'}`}
                                >
                                  🔄 Propose trade
                                </a>
                              )}
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
      {selectedCard && user && (
        <AddGradedCardModal
          isOpen={showGradedModal}
          onClose={() => setShowGradedModal(false)}
          card={selectedCard}
          setName={setName}
          setComplete={setComplete}
          setTotal={setTotal}
          setId={selectedCard.set_id ?? ''}
          variants={filteredVariants}
          userId={user.id}
          onSuccess={() => fetchUserGradedCards(selectedCard.id)}
        />
      )}
    </>
  )
}