'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import BrowseHero      from './BrowseHero'
import BrowseFilters   from './BrowseFilters'
import CardResults     from './CardResults'
import ArtistResults   from './ArtistResults'
import ProductResults  from './ProductResults'
import BrowseDiscovery from './BrowseDiscovery'
import type {
  SearchMode, CardSearchResult, ArtistResult,
  BrowseProduct, DiscoveryData, ActiveFilters,
} from './types'

// ── Props ─────────────────────────────────────────────────────────────────────
interface BrowseClientProps {
  /** Active search mode from URL at SSR time */
  initialMode:     SearchMode
  /** The ?q= param value */
  committedQuery:  string
  /** The ?artist= param value — when set, shows all cards by that artist */
  artistQuery:     string | null
  /** Server-fetched card results */
  initialCards:    CardSearchResult[]
  /** Server-fetched artist results */
  initialArtists:  ArtistResult[]
  /** Server-fetched products (only populated when mode=products) */
  initialProducts: BrowseProduct[]
  /** All products — passed through to BrowseHero → BrowseTypeahead for suggestions */
  allProducts:     BrowseProduct[]
  /** Discovery data shown on the landing/empty-query page */
  discoveryData:   DiscoveryData | null
  /** Active filter values from URL */
  initialFilters:  ActiveFilters
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
  initialFilters,
}: BrowseClientProps) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // Read live URL state — reflects optimistic URL changes from router.push
  // immediately, before the server re-render completes.
  const mode: SearchMode = (searchParams.get('mode') as SearchMode) ?? initialMode

  const filters: ActiveFilters = {
    type:      searchParams.get('type')      ?? initialFilters.type,
    rarity:    searchParams.get('rarity')    ?? initialFilters.rarity,
    supertype: searchParams.get('supertype') ?? initialFilters.supertype,
  }

  const hasQuery     = !!(committedQuery || artistQuery)
  const isArtistView = !!artistQuery

  // ── Navigation helpers ────────────────────────────────────────────────────

  /** Popular-search pills in BrowseDiscovery call this */
  const handleSearch = useCallback((query: string) => {
    router.push(`/browse?q=${encodeURIComponent(query)}&mode=cards`)
  }, [router])

  /** Clicking an artist card in BrowseDiscovery or ArtistResults */
  const handleArtistSelect = useCallback((artist: ArtistResult) => {
    router.push(`/browse?artist=${encodeURIComponent(artist.name)}`)
  }, [router])

  /** BrowseFilters chip changes */
  const handleFilterChange = useCallback((key: keyof ActiveFilters, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/browse?${params.toString()}`)
  }, [router, searchParams])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Hero (always rendered) ────────────────────────────────────────── */}
      <BrowseHero
        mode={mode}
        committedQuery={artistQuery ?? committedQuery}
        allProducts={allProducts}
      />

      {/* ── Content area ──────────────────────────────────────────────────── */}
      {!hasQuery ? (
        // Discovery landing — shown when there is no active query
        discoveryData && (
          <BrowseDiscovery
            data={discoveryData}
            onSearch={handleSearch}
            onArtistSelect={handleArtistSelect}
          />
        )

      ) : isArtistView ? (
        // Artist cards view — all cards by a specific artist
        <CardResults
          cards={initialCards}
          query={artistQuery!}
          artistName={artistQuery!}
        />

      ) : (
        <>
          {/* Cards mode */}
          {mode === 'cards' && (
            <>
              <BrowseFilters filters={filters} onChange={handleFilterChange} />
              <CardResults cards={initialCards} query={committedQuery} />
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
