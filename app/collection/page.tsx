'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import SetCard from '@/components/SetCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PokemonSet, SetProgress } from '@/types'
import { getSets } from '@/lib/db'
import { getUserSets, getUserCardVariantsBySet } from '@/lib/userCards'
import { cn } from '@/lib/utils'

export default function CollectionPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  // State management
  const [userSets, setUserSets] = useState<PokemonSet[]>([])
  const [setProgress, setSetProgress] = useState<Record<string, SetProgress>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    loadUserCollection()
  }, [user, router])

  const loadUserCollection = async () => {
    if (!user) return

    try {
      setIsLoading(true)
      setError(null)

      // 1. Fetch user's sets from database
      const userSetData = await getUserSets(user.id)

      if (userSetData.length === 0) {
        setUserSets([])
        setIsLoading(false)
        return
      }

      // 2. Get set details from database
      const allSets = await getSets() as PokemonSet[]
      const userSetIds = userSetData.map(us => us.set_id)
      const filteredSets = allSets.filter(set => userSetIds.includes(set.id))

      setUserSets(filteredSets)

      // 3. Calculate progress for each set
      const progressData: Record<string, SetProgress> = {}

      for (const set of filteredSets) {
        try {
          // Get user's owned cards for this set via set_id join.
          // This avoids passing Pokemon TCG API string IDs (e.g. "sv4-1")
          // into the uuid card_id column, which caused: invalid input syntax
          // for type uuid: "sv4-1"
          const userCardVariants = await getUserCardVariantsBySet(user.id, set.id)

          // quantity > 0 is already enforced in getUserCardVariantsBySet
          const ownedCardIds = new Set(userCardVariants.map(variant => variant.card_id))

          const ownedCards = ownedCardIds.size
          const totalCards = set.total ?? 0
          const percentage = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0

          progressData[set.id] = {
            owned_cards: ownedCards,
            total_cards: totalCards,
            percentage
          }
        } catch (err) {
          console.error(`Error calculating progress for set ${set.id}:`, err)
          // Set default progress on error
          progressData[set.id] = {
            owned_cards: 0,
            total_cards: set.total ?? 0,
            percentage: 0
          }
        }
      }

      setSetProgress(progressData)
    } catch (err) {
      console.error('Error loading user collection:', err)
      setError('Failed to load your collection. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBrowseSets = () => {
    router.push('/sets')
  }

  // Derived stats
  const totalOwnedCards = Object.values(setProgress).reduce((sum, p) => sum + p.owned_cards, 0)
  const avgCompletion =
    userSets.length > 0
      ? Math.round(
          Object.values(setProgress).reduce((sum, p) => sum + p.percentage, 0) /
            (Object.keys(setProgress).length || 1)
        )
      : 0

  // Filtered sets for search
  const filteredSets = userSets.filter(set =>
    set.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // ── Loading State ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-base">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          {/* Header skeleton */}
          <div className="mb-8">
            <div className="skeleton h-9 w-52 rounded-lg mb-2" />
            <div className="skeleton h-5 w-72 rounded-lg" />
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface border border-subtle rounded-xl p-4">
                <div className="skeleton h-3 w-24 rounded mb-2" />
                <div className="skeleton h-7 w-16 rounded" />
              </div>
            ))}
          </div>

          {/* Grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-surface border border-subtle rounded-xl overflow-hidden">
                <div className="skeleton h-32 w-full" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                  <div className="skeleton h-2 w-full rounded mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Error State ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-base">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <p className="text-lg text-primary font-semibold">{error}</p>
            <Button variant="primary" onClick={loadUserCollection}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="max-w-screen-2xl mx-auto px-6 py-8">

        {/* ── Page Header ────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold text-primary mb-1"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            My Collection
          </h1>
          <p className="text-secondary text-sm">
            {userSets.length > 0
              ? `Tracking ${userSets.length} set${userSets.length !== 1 ? 's' : ''} in your collection`
              : 'Start building your Pokémon card collection'}
          </p>
        </div>

        {userSets.length > 0 && (
          <>
            {/* ── Summary Stats ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Sets Tracked</span>
                <span className="text-2xl font-bold text-primary">{userSets.length}</span>
              </div>
              <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Cards Owned</span>
                <span className="text-2xl font-bold text-primary">{totalOwnedCards.toLocaleString()}</span>
              </div>
              <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1 col-span-2 md:col-span-1">
                <span className="text-xs text-muted uppercase tracking-wider">Avg. Completion</span>
                <span className="text-2xl font-bold text-accent font-bold">{avgCompletion}%</span>
              </div>
            </div>

            {/* ── Search / Filter ──────────────────────────────────────── */}
            <div className="mb-6">
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search your sets…"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                }
                className="max-w-sm"
              />
            </div>
          </>
        )}

        {/* ── Empty State ──────────────────────────────────────────────── */}
        {userSets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent-dim flex items-center justify-center text-3xl">
              📦
            </div>
            <div>
              <h2 className="text-xl font-semibold text-primary mb-1"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                No collection yet
              </h2>
              <p className="text-secondary text-sm max-w-xs mx-auto">
                Start collecting cards to build your collection. Browse all available Pokémon sets to get started.
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={handleBrowseSets}>
              Browse Sets
            </Button>
          </div>
        ) : filteredSets.length === 0 ? (
          /* No search results */
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="text-muted text-4xl">🔍</div>
            <p className="text-secondary text-sm">
              No sets match &ldquo;{searchTerm}&rdquo;
            </p>
            <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>
              Clear search
            </Button>
          </div>
        ) : (
          /* ── Collection Grid ───────────────────────────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {filteredSets.map(set => (
              <SetCard
                key={set.id}
                set={set}
                progress={setProgress[set.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
