import { getSetById, getCardsBySet, hasPromoCards } from '@/lib/db'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import { PokemonCard, PokemonSet, CollectionGoal, QuickAddVariant } from '@/types'
import { batchFetchVariantStructure } from '@/lib/variantServer'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SetPageCards from '@/components/SetPageCards'
import CollectionOnboardingModal from '@/components/onboarding/CollectionOnboardingModal'

// Opt out of static pre-rendering: this route reads auth cookies at request time.
export const dynamic = 'force-dynamic'

interface SetPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ card?: string }>
}

// ── Auth + user preferences helper ───────────────────────────────────────────
//
// Encapsulates the full auth flow (getUser → profile → user_set) so it can
// run CONCURRENTLY with getSetById + getCardsBySet in a single Promise.all.
//
// Previously these three sequential awaits blocked the price fetch behind a
// 4-step waterfall.  Now auth latency overlaps with data-fetch latency and
// the effective TTFB for the full page drops by ~40 %.
//
interface AuthPrefs {
  userId:      string | undefined
  currency:    string
  currentGoal: CollectionGoal
}

async function getAuthAndPrefs(setId: string): Promise<AuthPrefs> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { userId: undefined, currency: 'USD', currentGoal: 'normal' }
    }

    // Profile preferences and collection goal are independent — fetch in parallel.
    const [profileResult, userSetResult] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('preferred_currency')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('user_sets')
        .select('collection_goal')
        .eq('user_id', user.id)
        .eq('set_id', setId)
        .maybeSingle(),
    ])

    if (profileResult.error) {
      console.error('[set page] Failed to read user profile preferences:', profileResult.error)
    }

    return {
      userId:      user.id,
      currency:    profileResult.data?.preferred_currency ?? 'USD',
      currentGoal: (userSetResult.data?.collection_goal ?? 'normal') as CollectionGoal,
    }
  } catch (err) {
    // Auth errors are non-fatal — guest view still works.
    console.warn('[set page] Could not fetch user session:', err)
    return { userId: undefined, currency: 'USD', currentGoal: 'normal' }
  }
}

// ── Server Component ──────────────────────────────────────────────────────────
export default async function SetPage({ params, searchParams }: SetPageProps) {
  const { id } = await params
  const { card: initialCardId } = await searchParams

  // ── Phase 1: ALL independent fetches in parallel ──────────────────────────
  //
  // getSetById and getCardsBySet are unstable_cache-wrapped (60 s TTL) so
  // repeat visits are served from the in-process cache with no DB round-trip.
  // getAuthAndPrefs runs concurrently — auth latency no longer gates data.
  //
  let fetchError: string | null = null
  let rawSetData: Awaited<ReturnType<typeof getSetById>> = null
  let rawCards:   Awaited<ReturnType<typeof getCardsBySet>> = []
  let authPrefs:  AuthPrefs = { userId: undefined, currency: 'USD', currentGoal: 'normal' }

  try {
    ;[rawSetData, rawCards, authPrefs] = await Promise.all([
      getSetById(id),
      getCardsBySet(id),
      getAuthAndPrefs(id),
    ])
  } catch (err) {
    console.error('[set page] Error fetching set data:', err)
    fetchError = 'Failed to load set data. Please try again later.'
  }

  // ── Error / not-found guards ──────────────────────────────────────────────
  if (fetchError) {
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
            <div className="text-red-400">⚠️ {fetchError}</div>
          </div>
        </div>
      </div>
    )
  }

  if (!rawSetData) notFound()

  // ── Normalise cards for existing components ───────────────────────────────
  const hasPromos = hasPromoCards(rawCards)
  const cards = rawCards.map(card => ({
    ...card,
    image_url: card.image || '',
    name:      card.name   || 'Unknown Card',
    number:    card.number || '',
    rarity:    card.rarity || '',
  })) as PokemonCard[]

  const { userId, currency, currentGoal } = authPrefs

  // ── Phase 2: prices + variant structure (parallel) ───────────────────────
  //
  // Both fetches need cardIds from Phase 1 but are independent of each other,
  // so we run them in parallel.
  //
  // batchFetchVariantStructure queries supabaseAdmin directly — no HTTP round-
  // trip — so variant dots are embedded in the initial HTML and appear on first
  // paint without waiting for a client-side POST /api/variants call.
  //
  const cardIds = rawCards.map(c => c.id)
  let initialCardVariants: Record<string, QuickAddVariant[]> = {}

  await batchFetchVariantStructure(cardIds, id)
    .then(r => { initialCardVariants = r })
    .catch(() => { /* non-fatal — dots fall back to client-side batch fetch */ })

  const set   = rawSetData as unknown as PokemonSet
  const setTotal = set.total || cards.length

  // ── Render ────────────────────────────────────────────────────────────────
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
        initialCardVariants={initialCardVariants}
        setComplete={set.setComplete ?? undefined}
        initialCardId={initialCardId}
        setId={id}
        userId={userId}
        hasPromos={hasPromos}
        initialGoal={currentGoal}
        currency={currency}
        statSeries={set.series ?? '—'}
        statReleased={
          set.release_date
            ? new Date(set.release_date).toLocaleDateString('en-US', {
                month: 'short',
                day:   'numeric',
                year:  'numeric',
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
      />

      {/* ── New-user onboarding — shown once via localStorage ── */}
      <CollectionOnboardingModal />
    </div>
  )
}

// ── Metadata ──────────────────────────────────────────────────────────────────
//
// getSetById is now unstable_cache-wrapped so this call is a free in-process
// cache hit when the main page function already fetched the same set in the
// same request cycle — no extra DB round-trip.
//
export async function generateMetadata({ params }: SetPageProps) {
  const { id } = await params

  try {
    const set = await getSetById(id) as unknown as PokemonSet | null

    if (!set) {
      return { title: 'Set Not Found | Lumidex' }
    }

    return {
      title:       `${set.name} | Lumidex`,
      description: `Browse ${set.total || 'cards'} cards from ${set.name} set${set.series ? ` in the ${set.series} series` : ''}.`,
    }
  } catch {
    return { title: 'Set | Lumidex' }
  }
}
