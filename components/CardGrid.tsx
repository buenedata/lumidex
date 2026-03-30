'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Image from 'next/image'
import { PokemonCard, UserCard, VariantWithQuantity, QuickAddVariant, VARIANT_COLOR_CLASSES, CollectionGoal } from '@/types'
import { useCollectionStore, useAuthStore } from '@/lib/store'
import Modal from '@/components/ui/Modal'
import VariantSuggestionModal from '@/components/VariantSuggestionModal'
import { formatPrice } from '@/lib/mockPricing'

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
  /** Called once the batch variant fetch completes with the deduplicated legend variants. */
  onVariantsLegendChange?: (variants: QuickAddVariant[]) => void
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
        {src ? (
          <Image src={src} alt={alt ?? ''} fill sizes="389px" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted">
            <span className="text-6xl">🎴</span>
          </div>
        )}
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
  const known = ['grass','fire','water','lightning','psychic','fighting','darkness','metal','dragon','fairy','colorless']
  return known.includes(key) ? `card-type-${key}` : ''
}

export default function CardGrid({ cards, userCards: propsUserCards, filter = 'all', sortBy = 'number', userId: propsUserId, setTotal, setName, setComplete, initialCardId, collectionGoal = 'normal', cardPricesUSD, currency = 'USD', onVariantsLegendChange }: CardGridProps) {
  const { updateCardQuantity, userCards: storeUserCards, fetchUserCards } = useCollectionStore()
  const { user, isLoading, profile } = useAuthStore()
  const greyOutUnowned: boolean = profile?.grey_out_unowned ?? false

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
  // Ensures we only auto-open the initialCardId modal once
  const autoOpenedRef = useRef(false)
  // Used to distinguish single-click (open modal) from double-click (add default variant)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Open card modal when clicked (used by auto-open and right-click)
  const handleCardClick = (card: PokemonCard) => {
    setSelectedCard(card)
    fetchRelatedCards(card)
    if (!cardVariants.has(card.id)) {
      setTimeout(() => loadCardVariants(card.id, false), 100)
    }
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


  return (
    <>
      <div className="flex flex-wrap gap-4">
        {filteredCards.map(card => {
          const userCard          = userCards.get(card.id)
          const quickVariants     = cardQuickVariants.get(card.id) || []
          // Use user_card_variants as source of truth once loaded; fall back to
          // legacy user_cards only while the batch fetch is still in-flight.
          const hasLoadedVariants = cardQuickVariants.has(card.id)
          const isOwned           = hasLoadedVariants
            ? quickVariants.some(v => v.quantity > 0)
            : !!(userCard && userCard.quantity > 0)
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
          const colorMap = {
            green: 'bg-green-500', blue: 'bg-blue-500', purple: 'bg-purple-500',
            red: 'bg-red-500', pink: 'bg-pink-500', yellow: 'bg-yellow-500', gray: 'bg-gray-500',
            orange: 'bg-orange-500', teal: 'bg-teal-500',
          } as const

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
                {card.image_url ? (
                  <Image
                    src={card.image_url}
                    alt={card.name ?? ''}
                    fill
                    sizes="220px"
                    className={`object-cover transition-all duration-300 pointer-events-none ${
                      shouldGrey ? 'grayscale opacity-40' : ''
                    }`}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent && !parent.querySelector('.fallback-icon')) {
                        const fallback = document.createElement('div')
                        fallback.className = 'fallback-icon flex items-center justify-center h-full bg-gray-700 text-gray-400'
                        fallback.innerHTML = '<span class="text-4xl">🎴</span>'
                        parent.appendChild(fallback)
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-700 text-gray-400">
                    🎴
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-opacity z-10" />
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
                        if (variant.color === 'gray') {
                          handleCardClick(card)
                        } else {
                          handleVariantClick(e, card.id, variant.id)
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (variant.color === 'gray') {
                          handleCardClick(card)
                        } else {
                          handleVariantClick(e, card.id, variant.id)
                        }
                      }}
                      title={`${variant.name} (${variant.quantity})`}
                      className={`
                        w-6 h-6 rounded flex items-center justify-center
                        text-xs font-bold border border-black/30 shadow-sm
                        ${colorMap[variant.color] || 'bg-zinc-500'}
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
                      ? formatPrice(cardPricesUSD[card.id], currency)
                      : ''}
                  </span>
                </div>
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
            {/* Left side - Card Image with holographic glare */}
            <div className="flex-shrink-0">
              <CardGlareImage
                src={selectedCard.image_url}
                alt={selectedCard.name ?? undefined}
              />
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
                <button
                  onClick={() => setSelectedCard(null)}
                  className="text-muted hover:text-primary text-2xl transition-colors p-2"
                >
                  ✕
                </button>
              </div>

              {/* Tabs - simplified */}
              <div className="border-b border-subtle mb-4">
                <div className="flex gap-6">
                  <button className="tab-active pb-2 text-sm font-medium">Card</button>
                  <button className="tab-inactive pb-2 text-sm">Price</button>
                  <button className="tab-inactive pb-2 text-sm">TCG</button>
                </div>
              </div>

              {/* Variants Table */}
              <div className="flex-1">
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
                      <div key={variant.id} className="bg-elevated rounded-lg p-3 hover:bg-card-item transition-colors border border-subtle">
                        <div className="flex items-center gap-2">
                          {/* Variant Name */}
                          <div className="flex-1 min-w-0">
                            <div className="text-primary font-medium text-sm truncate">{variant.name}</div>
                            <div className="text-muted text-xs">
                              {variant.description || 'Found in Booster Packs'}
                            </div>
                          </div>

                          {/* Market Price */}
                          <div className="w-20 text-center shrink-0">
                            <div className="text-price font-medium text-sm">
                              {(variant as any).market_price ? `kr${Number((variant as any).market_price).toFixed(2)}` : '—'}
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

                            <div
                              className={`${getQuantityButtonColor(variant, variant.quantity)} text-white font-bold rounded px-2 py-0.5 min-w-[2rem] text-center text-sm shadow-sm`}
                            >
                              {variant.quantity}
                            </div>

                            <button
                              onClick={() => updateVariantQuantity(selectedCard.id, variant.id, 1)}
                              className={`w-7 h-7 ${getQuantityButtonColor(variant, 1)} hover:opacity-80 text-white rounded flex items-center justify-center text-base font-bold transition-all shadow-sm`}
                            >
                              +
                            </button>
                          </div>
                        </div>
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
                                {rc.image ? (
                                 <Image
                                   src={rc.image}
                                   alt={rc.name ?? 'Card'}
                                   fill
                                   sizes="(max-width: 1280px) 33vw, 150px"
                                   className="object-cover group-hover:scale-105 transition-transform duration-200"
                                 />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-2xl text-muted">
                                    🎴
                                  </div>
                                )}
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
              </div>
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