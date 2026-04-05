import { getSetById, getCardsBySet, hasPromoCards } from '@/lib/db'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import { PokemonCard, PokemonSet, CollectionGoal, PriceSource } from '@/types'
import { getCardPricesForSet, buildCardPriceMap } from '@/lib/pricing'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SetPageCards from '@/components/SetPageCards'

// Opt out of static pre-rendering: this route reads auth cookies at request time.
export const dynamic = 'force-dynamic'

interface SetPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ card?: string }>
}

// Server Component - no client-side API calls
export default async function SetPage({ params, searchParams }: SetPageProps) {
  const { id } = await params
  const { card: initialCardId } = await searchParams

  let set: PokemonSet | null = null
  let cards: PokemonCard[] = []
  let error: string | null = null
  let hasPromos = false
  let currentGoal: CollectionGoal = 'normal'
  let userId: string | undefined
  let currency = 'USD'
  let priceSource: PriceSource = 'tcgplayer'
  let cardPricesUSD: Record<string, number> = {}
  let setTotalValue = 0
  let mostExpensive: PokemonCard | null = null
  let pricesAreLive = false

  try {
    // Fetch set and cards in parallel
    const [setData, rawCards] = await Promise.all([
      getSetById(id),
      getCardsBySet(id)
    ])

    set = setData

    // Detect promos before mapping (DbCard has rarity field)
    hasPromos = hasPromoCards(rawCards)

    // Normalise fields for existing components
    cards = rawCards.map(card => ({
      ...card,
      image_url: card.image || '',
      name: card.name || 'Unknown Card',
      number: card.number || '',
      rarity: card.rarity || '',
    })) as PokemonCard[]

  } catch (err) {
    console.error('Error fetching set data:', err)
    error = 'Failed to load set data. Please try again later.'
  }

  // Fetch the authenticated user's collection goal for this set (server-side)
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      userId = user.id

      // Fetch preferred currency + price source from user profile
      const { data: profileRow, error: profileError } = await supabaseAdmin
        .from('users')
        .select('preferred_currency, price_source')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('[set page] Failed to read user profile preferences:', profileError)
      }
      if (profileRow?.preferred_currency) {
        currency = profileRow.preferred_currency
      }
      if (profileRow?.price_source) {
        priceSource = profileRow.price_source as PriceSource
      }

      const { data: userSetRow } = await supabaseAdmin
        .from('user_sets')
        .select('collection_goal')
        .eq('user_id', user.id)
        .eq('set_id', id)
        .maybeSingle()

      if (userSetRow?.collection_goal) {
        currentGoal = userSetRow.collection_goal as CollectionGoal
      }
    }
  } catch (err) {
    // Auth errors are non-fatal — guest view still works
    console.warn('Could not fetch user session:', err)
  }

  // ── Real price lookup ─────────────────────────────────────────────────────
  // Only real DB prices are used — cards without a price row show no price.
  try {
    const realPrices = await getCardPricesForSet(id, priceSource)
    cardPricesUSD = buildCardPriceMap(cards, realPrices)
    pricesAreLive = Object.keys(cardPricesUSD).length > 0
  } catch (err) {
    console.warn('[set page] Price lookup failed:', err)
  }

  // (Re-)compute set stats now that final prices are settled
  setTotalValue = Object.values(cardPricesUSD).reduce((s, p) => s + p, 0)
  mostExpensive = cards.reduce<PokemonCard | null>(
    (best, c) =>
      best === null || (cardPricesUSD[c.id] ?? 0) > (cardPricesUSD[best.id] ?? 0)
        ? c
        : best,
    null
  )

  // Handle not found set
  if (!set && !error) {
    notFound()
  }

  // Handle errors
  if (error) {
    return (
      <div style={{ backgroundColor: 'var(--color-bg-base)' }} className="min-h-screen">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <Link
            href="/sets"
            className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Sets
          </Link>
          <div className="text-center py-16">
            <div className="text-red-400">⚠️ {error}</div>
          </div>
        </div>
      </div>
    )
  }

  // Handle empty set (shouldn't happen but just in case)
  if (!set) {
    return (
      <div style={{ backgroundColor: 'var(--color-bg-base)' }} className="min-h-screen">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <Link
            href="/sets"
            className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Sets
          </Link>
          <div className="text-center py-16">
            <p className="text-muted">Set not found</p>
          </div>
        </div>
      </div>
    )
  }

  const setTotal = set.total || cards.length

  return (
    <div style={{ backgroundColor: 'var(--color-bg-base)' }} className="min-h-screen">

      {/* ── Hero — full-width banner with blurred set art ── */}
      <div className="relative w-full h-48 overflow-hidden">
        {/* Blurred background */}
        {set.logo_url && (
          <div className="absolute inset-0">
            <img
              src={set.logo_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-20"
            />
          </div>
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[rgba(10,10,15,0.6)] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />

        {/* Back link */}
        <div className="absolute top-4 left-6 z-20">
          <Link
            href="/sets"
            className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Sets
          </Link>
        </div>

        {/* Hero content */}
        <div className="relative z-10 h-full max-w-screen-2xl mx-auto px-6 flex items-end pb-6 gap-6">
          {/* Set logo */}
          {set.logo_url && (
            <img
              src={set.logo_url}
              alt={set.name}
              style={{ width: 'auto', height: 'auto', maxHeight: '5rem' }}
              className="object-contain drop-shadow-2xl shrink-0"
            />
          )}
          {/* Set name + series + symbol */}
          <div>
            <p className="text-xs text-muted uppercase tracking-widest mb-1">{set.series}</p>
            <div className="flex items-center gap-2.5">
              <h1
                className="text-2xl font-bold"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {set.name}
              </h1>
              {set.symbol_url && (
                <div className="relative w-8 h-8 rounded bg-black/40 backdrop-blur-sm p-0.5 flex items-center justify-center shrink-0">
                  <img
                    src={set.symbol_url}
                    alt={`${set.name} symbol`}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cards section (client component for filter/tabs/search + stats strip) ── */}
      <SetPageCards
        cards={cards}
        setTotal={setTotal}
        setName={set.name}
        setComplete={set.setComplete ?? undefined}
        initialCardId={initialCardId}
        setId={id}
        userId={userId}
        hasPromos={hasPromos}
        initialGoal={currentGoal}
        cardPricesUSD={cardPricesUSD}
        currency={currency}
        pricesAreLive={pricesAreLive}
        priceSource={priceSource}
        statSeries={set.series ?? '—'}
        statReleased={
          set.release_date
            ? new Date(set.release_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '—'
        }
        statCards={(() => {
          const total    = set.total
          const complete = set.setComplete
          if (total != null && complete != null && complete > total) {
            return `${total} + ${complete - total} Secrets`
          }
          return `${total ?? '?'}`
        })()}
        statMostExpensiveName={mostExpensive?.name ?? undefined}
        statMostExpensiveUSD={mostExpensive ? (cardPricesUSD[mostExpensive.id] ?? 0) : undefined}
        statSetValueUSD={setTotalValue}
      />
    </div>
  )
}

// Metadata for the page
export async function generateMetadata({ params }: SetPageProps) {
  const { id } = await params

  try {
    const set = await getSetById(id)

    if (!set) {
      return {
        title: 'Set Not Found | Lumidex',
      }
    }

    return {
      title: `${set.name} | Lumidex`,
      description: `Browse ${set.total || 'cards'} cards from ${set.name} set${set.series ? ` in the ${set.series} series` : ''}.`,
    }
  } catch {
    return {
      title: 'Set | Lumidex',
    }
  }
}
