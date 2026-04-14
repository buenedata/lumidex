'use client'

import { useCallback, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCollectionStore, useAuthStore } from '@/lib/store'
import BrowseHero      from './BrowseHero'
import ArtistResults   from './ArtistResults'
import ProductResults  from './ProductResults'
import BrowseDiscovery from './BrowseDiscovery'
import SetPageCards    from '@/components/SetPageCards'
import type { PokemonCard, PriceSource, QuickAddVariant } from '@/types'
import type {
  SearchMode, CardSearchResult, ArtistResult,
  BrowseProduct, DiscoveryData,
} from './types'

// ── Helper: convert CardSearchResult → PokemonCard (for SetPageCards / CardGrid) ──
function asPokemonCards(cards: CardSearchResult[]): PokemonCard[] {
  return cards.map(c => ({
    id:               c.id,
    set_id:           c.set.id,
    name:             c.name,
    number:           c.number,
    rarity:           c.rarity,
    type:             c.type,
    image:            c.image_url,
    image_url:        c.image_url,    // legacy field expected by CardGrid
    created_at:       '',
    set_name:         c.set.name,     // per-card set name used in the card modal
    set_logo_url:     c.set.logo_url,
    set_release_date: c.set.release_date, // used for date sort
  }))
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface BrowseClientProps {
  initialMode:     SearchMode
  committedQuery:  string
  artistQuery:     string | null
  initialCards:    CardSearchResult[]
  initialArtists:  ArtistResult[]
  initialProducts: BrowseProduct[]
  allProducts:     BrowseProduct[]
  discoveryData:        DiscoveryData | null
  // cardPricesUSD is no longer fetched server-side — loaded lazily on the client
  /**
   * Variant structure pre-fetched server-side (set page only).
   * On the browse page this is omitted and the client-side batch fetch handles it.
   */
  initialCardVariants?: Record<string, QuickAddVariant[]>
  currency:             string
  priceSource:          PriceSource
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BrowseClient({
  initialMode,
  committedQuery,
  artistQuery,
  initialCards,
  initialArtists,
  initialProducts,
  allProducts,
  discoveryData,
  initialCardVariants,
  currency,
  priceSource,
}: BrowseClientProps) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // ── Bug #2c: pre-warm user collection data ─────────────────────────────────
  // Trigger fetchUserCards here — before CardGrid mounts — so the progress bar
  // and variant dots appear as soon as possible for logged-in users.
  const { fetchUserCards, userCards: storeUserCards } = useCollectionStore()
  const { user } = useAuthStore()
  useEffect(() => {
    if (user?.id && storeUserCards.size === 0) {
      fetchUserCards()
    }
    // Only re-run when the user identity changes; fetchUserCards is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // ── Bug #2a: load card prices client-side after initial render ─────────────
  // Removing this from SSR halves server render time for card searches.
  // Prices load asynchronously after the card grid is already visible.
  const [cardPricesUSD, setCardPricesUSD] = useState<Record<string, number>>({})
  useEffect(() => {
    if (initialCards.length === 0) {
      setCardPricesUSD({})
      return
    }
    const ids = initialCards.map(c => c.id).join(',')
    fetch(`/api/prices/batch?ids=${encodeURIComponent(ids)}&source=${priceSource}`)
      .then(r => r.json())
      .then(data => setCardPricesUSD(data.prices ?? {}))
      .catch(() => setCardPricesUSD({}))
  }, [initialCards, priceSource])

  const mode: SearchMode = (searchParams.get('mode') as SearchMode) ?? initialMode

  const hasQuery     = !!(committedQuery || artistQuery)
  const isArtistView = !!artistQuery

  // ── Navigation helpers ────────────────────────────────────────────────────

  const handleSearch = useCallback((query: string) => {
    router.push(`/browse?q=${encodeURIComponent(query)}&mode=cards`)
  }, [router])

  const handleArtistSelect = useCallback((artist: ArtistResult) => {
    router.push(`/browse?artist=${encodeURIComponent(artist.name)}`)
  }, [router])

  // ── Shared SetPageCards data ───────────────────────────────────────────────
  const pokemonCards = asPokemonCards(initialCards)
  const hasPromos    = initialCards.some(c => c.rarity?.toLowerCase().includes('promo'))

  // Shared SetPageCards props used by both artist-view and cards-mode.
  // Bug #1 fix: setName is intentionally NOT passed here so that CardGrid
  // falls back to selectedCard.set_name (populated per-card in asPokemonCards),
  // displaying the actual set name (e.g. "Obsidian Flames") rather than the
  // search query (e.g. "togekiss 85") in the card modal header.
  const sharedSetPageCardsProps = {
    cards:               pokemonCards,
    setTotal:            pokemonCards.length,
    showSearch:          false as const,
    setId:               '',
    hasPromos,
    cardPricesUSD,
    initialCardVariants: initialCardVariants ?? {},
    currency,
    priceSource,
    disableGreyOut:      true as const,
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Hero — always shown */}
      <BrowseHero
        mode={mode}
        committedQuery={artistQuery ?? committedQuery}
        allProducts={allProducts}
      />

      {/* Content area */}
      {!hasQuery ? (
        // Discovery landing state
        discoveryData && (
          <BrowseDiscovery
            data={discoveryData}
            onSearch={handleSearch}
            onArtistSelect={handleArtistSelect}
          />
        )

      ) : isArtistView ? (
        // All cards by a specific artist — full CardGrid with modal
        <>
          <div className="max-w-screen-2xl mx-auto px-6 pt-6 pb-2">
            <h2
              className="text-xl font-bold text-primary"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Cards by <span className="text-accent">{artistQuery}</span>
            </h2>
            <p className="text-sm text-muted mt-1">
              {pokemonCards.length} card{pokemonCards.length !== 1 ? 's' : ''}
            </p>
          </div>
          <SetPageCards {...sharedSetPageCardsProps} />
        </>

      ) : (
        <>
          {/* Cards mode */}
          {mode === 'cards' && (
            <>
              {/* Results header */}
              <div className="max-w-screen-2xl mx-auto px-6 pt-6 pb-2">
                <h2
                  className="text-xl font-bold text-primary"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  Results for <span className="text-accent">&ldquo;{committedQuery}&rdquo;</span>
                </h2>
                <p className="text-sm text-muted mt-1">
                  {pokemonCards.length} card{pokemonCards.length !== 1 ? 's' : ''}
                  {pokemonCards.length === 0
                    ? ''
                    : ` across ${new Set(initialCards.map(c => c.set.id)).size} set${new Set(initialCards.map(c => c.set.id)).size !== 1 ? 's' : ''}`}
                </p>
              </div>

              {/* Full CardGrid with card modal — identical to set pages */}
              {pokemonCards.length > 0 ? (
                <SetPageCards {...sharedSetPageCardsProps} />
              ) : (
                <div className="max-w-screen-2xl mx-auto px-6 py-20 text-center">
                  <div className="text-5xl mb-4">🔍</div>
                  <p className="text-lg text-secondary mb-2">
                    No cards found for &ldquo;{committedQuery}&rdquo;
                  </p>
                  <p className="text-sm text-muted">Try a different name, or check the spelling</p>
                </div>
              )}
            </>
          )}

          {/* Artists mode */}
          {mode === 'artists' && (
            <ArtistResults
              artists={initialArtists}
              query={committedQuery}
              onArtistSelect={handleArtistSelect}
            />
          )}

          {/* Products mode */}
          {mode === 'products' && (
            <ProductResults products={initialProducts} query={committedQuery} />
          )}
        </>
      )}
    </>
  )
}
