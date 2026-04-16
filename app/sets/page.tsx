import { getSets } from '@/lib/db'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import SetsPageClient, { type EnrichedSet } from '@/components/SetsPageClient'

// Opt out of static pre-rendering: this route reads auth cookies at request time.
export const dynamic = 'force-dynamic'

// Server Component — fetches sets + user-specific data (favorites, card counts)
export default async function SetsPage() {
  let sets: EnrichedSet[] = []
  let favoritedSetIds: string[] = []
  let userId: string | null = null
  let error: string | null = null
  let seriesWithProducts: string[] = []

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      userId = user.id

      // Parallel fetch: sets, favorites, per-set card counts, and series w/ products.
      // The RPC pushes the GROUP BY into Postgres, returning ~1 row per set instead
      // of pulling every user_card_variants row into Node.js memory for JS aggregation.
      const [setsData, favoritesResult, cardCountsResult] = await Promise.all([
        getSets(),
        supabase
          .from('user_sets')
          .select('set_id')
          .eq('user_id', user.id),
        supabase.rpc('get_user_card_counts_by_set', { p_user_id: user.id }),
      ])

      favoritedSetIds = favoritesResult.data?.map(r => r.set_id) ?? []

      // RPC already returns one row per set with distinct card counts — no JS aggregation needed.
      const cardCounts: Record<string, number> = Object.fromEntries(
        (cardCountsResult.data ?? []).map(
          (row: { set_id: string; card_count: number }) => [row.set_id, row.card_count]
        )
      )

      // Enrich each set with the user's card count (0 if none)
      sets = setsData.map(s => ({
        ...s,
        user_card_count: cardCounts[s.id] ?? 0,
      }))
    } else {
      // Guest: fetch public set data (no auth required)
      sets = await getSets()
    }

  } catch (err) {
    console.error('Error fetching sets:', err)
    error = 'Failed to load sets. Please try again later.'
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-red-400">⚠️ {error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Card Sets
          </h1>
          <p className="text-secondary text-sm">Browse and collect Pokémon TCG sets</p>
        </div>

        {sets.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-muted mb-2">No sets found</p>
            <p className="text-xs text-muted/70">
              Run the import script to populate sets:{' '}
              <code className="bg-elevated px-2 py-0.5 rounded text-accent text-xs">
                npm run import:pokemon
              </code>
            </p>
          </div>
        ) : (
          <SetsPageClient
              sets={sets}
              favoritedSetIds={favoritedSetIds}
              userId={userId}
              seriesWithProducts={seriesWithProducts}
            />
        )}
      </div>
    </div>
  )
}
