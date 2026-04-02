'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import BrowseHero      from './BrowseHero'
import ArtistResults   from './ArtistResults'
import ProductResults  from './ProductResults'
import BrowseDiscovery from './BrowseDiscovery'
import SetPageCards    from '@/components/SetPageCards'
import type { PokemonCard, PriceSource } from '@/types'
import type {
  SearchMode, CardSearchResult, ArtistResult,
  BrowseProduct, DiscoveryData,
} from './types'

// ── Helper: convert CardSearchResult → PokemonCard (for SetPageCards / CardGrid) ──
function asPokemonCards(cards: CardSearchResult[]): PokemonCard[] {
  return cards.map(c => ({
    id:           c.id,
    set_id:       c.set.id,
    name:         c.name,
    number:       c.number,
    rarity:       c.rarity,
    type:         c.type,
    image:        c.image_url,
    image_url:    c.image_url,   // legacy field expected by CardGrid
    created_at:   '',
    set_name:     c.set.name,
    set_logo_url: c.set.logo_url,
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
  discoveryData:   DiscoveryData | null
  /** Card UUID → best market price in USD (server-fetched) */
  cardPricesUSD:   Record<string, number>
  currency:        string
  priceSource:     PriceSource
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
  cardPricesUSD,
  currency,
  priceSource,
}: BrowseClientProps) {
  const router       = useRouter()
  const searchParams = useSearchParams()

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

  // ── Shared SetPageCards props for both cards-mode and artist-view ──────────
  const pokemonCards = asPokemonCards(initialCards)
  const hasPromos    = initialCards.some(c => c.rarity?.toLowerCase().includes('promo'))

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
          <SetPageCards
            cards={pokemonCards}
            setTotal={pokemonCards.length}
            setName={artistQuery!}
            showSearch={false}
            setId=""
            hasPromos={hasPromos}
            cardPricesUSD={cardPricesUSD}
            currency={currency}
            priceSource={priceSource}
            disableGreyOut={true}
          />
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
                  {pokemonCards.length === 0 ? '' : ` across ${new Set(initialCards.map(c => c.set.id)).size} set${new Set(initialCards.map(c => c.set.id)).size !== 1 ? 's' : ''}`}
                </p>
              </div>

              {/* Full CardGrid with card modal — identical to set pages */}
              {pokemonCards.length > 0 ? (
                <SetPageCards
                    cards={pokemonCards}
                    setTotal={pokemonCards.length}
                    setName={committedQuery}
                    showSearch={false}
                    setId=""
                    hasPromos={hasPromos}
                    cardPricesUSD={cardPricesUSD}
                    currency={currency}
                    priceSource={priceSource}
                    disableGreyOut={true}
                  />
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
