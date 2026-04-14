import { Suspense } from 'react'
import BrowseClient from '@/components/browse/BrowseClient'
import { getSealedProductsForAllSeries } from '@/lib/pricing'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import type { SeriesProductGroup } from '@/lib/pricing'
import type { PriceSource } from '@/types'
import type {
  SearchMode,
  CardSearchResult,
  ArtistResult,
  BrowseProduct,
  DiscoveryData,
  DiscoverySet,
  ActiveFilters,
} from '@/components/browse/types'

// Always SSR — results depend on search params
export const dynamic = 'force-dynamic'

// ── Page props ────────────────────────────────────────────────────────────────
interface BrowsePageProps {
  searchParams: Promise<{
    q?:         string
    /** Legacy param — kept for backward compat with old bookmark/share links */
    name?:      string
    mode?:      string
    artist?:    string
    type?:      string
    rarity?:    string
    supertype?: string
  }>
}

// ── Data-fetching helpers ─────────────────────────────────────────────────────

async function fetchCardResults(
  query: string,
  filters: ActiveFilters,
): Promise<CardSearchResult[]> {
  const parts    = query.trim().split(/\s+/)
  const last     = parts[parts.length - 1]
  const isNumber = /^\d/.test(last)

  let namePart:   string | null = null
  let numberPart: string | null = null

  if (isNumber && parts.length > 1) {
    namePart   = parts.slice(0, -1).join(' ')
    numberPart = last
  } else if (isNumber) {
    numberPart = last
  } else {
    namePart = query.trim()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabaseAdmin
    .from('cards')
    .select('id, name, number, rarity, type, supertype, image, set_id, sets!inner(name, series, release_date, logo_url)')

  if (namePart)          q = q.ilike('name',      `%${namePart}%`)
  if (numberPart)        q = q.ilike('number',    `%${numberPart}%`)
  if (filters.type)      q = q.ilike('type',      `%${filters.type}%`)
  if (filters.rarity)    q = q.ilike('rarity',    `%${filters.rarity}%`)
  if (filters.supertype) q = q.ilike('supertype', `%${filters.supertype}%`)

  const { data } = await q.order('name').limit(200)
  return toCardResults(data ?? [])
}

async function fetchArtistCardResults(artistQuery: string): Promise<CardSearchResult[]> {
  const { data } = await supabaseAdmin
    .from('cards')
    .select('id, name, number, rarity, type, supertype, image, set_id, sets!inner(name, series, release_date, logo_url)')
    .ilike('artist', `%${artistQuery}%`)
    .order('name')
    .limit(500)

  return toCardResults(data ?? [])
}

async function fetchArtistResults(query: string): Promise<ArtistResult[]> {
  const { data } = await supabaseAdmin
    .from('cards')
    .select('artist, image')
    .ilike('artist', `%${query}%`)
    .not('artist', 'is', null)
    .limit(1000)

  const map = new Map<string, { images: string[]; count: number }>()
  for (const card of data ?? []) {
    if (!card.artist) continue
    const entry = map.get(card.artist)
    if (entry) {
      entry.count++
      if (entry.images.length < 3 && card.image) entry.images.push(card.image)
    } else {
      map.set(card.artist, { images: card.image ? [card.image] : [], count: 1 })
    }
  }

  return Array.from(map.entries())
    .map(([name, { images, count }]) => ({ name, card_count: count, sample_images: images }))
    .sort((a, b) => b.card_count - a.card_count)
    .slice(0, 20)
}

async function fetchDiscoveryData(): Promise<DiscoveryData> {
  const [setsResult, artistCardsResult] = await Promise.all([
    supabaseAdmin
      .from('sets')
      .select('set_id, name, series, logo_url, release_date, "setTotal"')
      .not('release_date', 'is', null)
      .order('release_date', { ascending: false })
      .limit(4),
    supabaseAdmin
      .from('cards')
      .select('artist, image')
      .not('artist', 'is', null)
      .not('image', 'is', null)
      .limit(2000),
  ])

  const recentSets: DiscoverySet[] = (setsResult.data ?? []).map((s) => ({
    id:           s.set_id,
    name:         s.name,
    series:       s.series ?? null,
    logo_url:     s.logo_url ?? null,
    release_date: s.release_date ?? null,
    total:        (s as Record<string, unknown>)['setTotal'] as number | null ?? null,
  }))

  const map = new Map<string, { images: string[]; count: number }>()
  for (const card of (artistCardsResult.data ?? [])) {
    if (!card.artist || card.artist.trim().toUpperCase() === 'N/A') continue
    const entry = map.get(card.artist)
    if (entry) {
      entry.count++
      if (entry.images.length < 3 && card.image) entry.images.push(card.image)
    } else {
      map.set(card.artist, { images: card.image ? [card.image] : [], count: 1 })
    }
  }

  const featuredArtists = Array.from(map.entries())
    .map(([name, { images, count }]) => ({ name, card_count: count, sample_images: images }))
    .sort((a, b) => b.card_count - a.card_count)
    .slice(0, 4)

  return { featuredArtists, recentSets }
}

function flattenProducts(groups: SeriesProductGroup[]): BrowseProduct[] {
  const result: BrowseProduct[] = []
  for (const group of groups) {
    for (const setGroup of group.sets) {
      for (const product of setGroup.products) {
        result.push({
          id:           product.id,
          set_id:       setGroup.setId,
          set_name:     setGroup.setName,
          series:       group.series,
          name:         product.name,
          product_type: product.product_type,
          image_url:    product.image_url,
          tcgp_market:  product.tcgp_market,
        })
      }
    }
  }
  return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCardResults(data: any[]): CardSearchResult[] {
  return data.map((card) => {
    const set = Array.isArray(card.sets) ? card.sets[0] : card.sets
    return {
      id:                 card.id,
      name:               card.name        || '',
      image_url:          card.image       || '',
      number:             card.number      || '',
      rarity:             card.rarity      || '',
      type:               card.type        || '',
      supertype:          card.supertype   || '',
      default_variant_id: null,
      set: {
        id:           card.set_id              || '',
        name:         set?.name               || '',
        series:       set?.series             || '',
        release_date: set?.release_date       || '',
        logo_url:     set?.logo_url           || '',
      },
    } satisfies CardSearchResult
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams

  // Support legacy ?name= param that the old browse page / old Navbar used
  const rawQuery    = params.q?.trim() ?? params.name?.trim() ?? ''
  const artistQuery = params.artist?.trim()    ?? ''
  const mode        = (params.mode as SearchMode) || 'cards'

  const filters: ActiveFilters = {
    type:      params.type?.trim()      ?? '',
    rarity:    params.rarity?.trim()    ?? '',
    supertype: params.supertype?.trim() ?? '',
  }

  const hasQuery     = !!(rawQuery || artistQuery)
  const isArtistView = !!artistQuery

  // ── User preferences (non-fatal) ─────────────────────────────────────────
  let currency:    string      = 'USD'
  let priceSource: PriceSource = 'tcgplayer'

  try {
    const serverSupabase = await createSupabaseServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('preferred_currency, price_source')
        .eq('id', user.id)
        .maybeSingle() as any
      if (profile?.preferred_currency) currency    = profile.preferred_currency
      if (profile?.price_source)       priceSource = profile.price_source as PriceSource
    }
  } catch { /* non-fatal — guest view still works */ }

  // ── Parallel data fetching ────────────────────────────────────────────────
  let initialCards:    CardSearchResult[] = []
  let initialArtists:  ArtistResult[]     = []
  let initialProducts: BrowseProduct[]    = []
  let allProducts:     BrowseProduct[]    = []
  let discoveryData:   DiscoveryData | null = null

  await Promise.all([
    // Cards by a specific artist
    isArtistView
      ? fetchArtistCardResults(artistQuery).then(r  => { initialCards = r })
      : Promise.resolve(),

    // Card search results
    !isArtistView && rawQuery && mode === 'cards'
      ? fetchCardResults(rawQuery, filters).then(r => { initialCards = r })
      : Promise.resolve(),

    // Artist search results
    !isArtistView && rawQuery && mode === 'artists'
      ? fetchArtistResults(rawQuery).then(r => { initialArtists = r })
      : Promise.resolve(),

    // Products (needed for Products mode view + typeahead)
    mode === 'products' || !hasQuery
      ? getSealedProductsForAllSeries()
          .then(groups => {
            const flat = flattenProducts(groups)
            allProducts = flat
            if (mode === 'products') initialProducts = flat
          })
          .catch(() => { /* non-fatal — show empty products */ })
      : Promise.resolve(),

    // Discovery data (landing state — fetched only when there is no query)
    !hasQuery
      ? fetchDiscoveryData().then(r => { discoveryData = r })
      : Promise.resolve(),
  ])

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-40">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        }
      >
        <BrowseClient
          initialMode={mode}
          committedQuery={rawQuery}
          artistQuery={artistQuery || null}
          initialCards={initialCards}
          initialArtists={initialArtists}
          initialProducts={initialProducts}
          allProducts={allProducts}
          discoveryData={discoveryData}
          currency={currency}
          priceSource={priceSource}
        />
      </Suspense>
    </div>
  )
}
