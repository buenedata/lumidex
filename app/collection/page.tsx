'use client'

import { useState, useEffect } from 'react'
import LastActivitySection from '@/components/profile/LastActivitySection'
import { useAuthStore, useCollectionStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import SetCard from '@/components/SetCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SetProgress } from '@/types'
import { cn } from '@/lib/utils'

export default function CollectionPage() {
  const { user, isLoading: authLoading, profile } = useAuthStore()
  const {
    userSets,
    userCards,
    pokemonSets,
    userCardCountBySet,
    fetchUserSets,
    fetchUserCards,
    fetchPokemonSets,
  } = useCollectionStore()
  const router = useRouter()

  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Ensure store data is populated when navigating directly to /collection.
  // onAuthStateChange already calls these on login, but if the store is
  // empty (e.g. hard refresh) we request a fresh load here.
  useEffect(() => {
    if (!user) return
    if (pokemonSets.size === 0) fetchPokemonSets()
    if (userSets.length === 0) fetchUserSets()
    if (userCardCountBySet.size === 0) fetchUserCards()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derive set progress from the store ──────────────────────────────────
  const buildProgress = (setId: string): SetProgress => {
    const set = pokemonSets.get(setId)
    const totalCards = set?.total ?? 0
    const ownedCards = userCardCountBySet.get(setId) ?? 0
    const percentage = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0
    return { owned_cards: ownedCards, total_cards: totalCards, percentage }
  }

  // ── Derived stats ────────────────────────────────────────────────────────
  const userSetIds = new Set(userSets.map(us => us.set_id))
  const userPokemonSets = Array.from(pokemonSets.values()).filter(set =>
    userSetIds.has(set.id)
  )

  // Sum all variant quantities — matches dashboard and profile "Cards Owned" count
  const totalOwnedCards = Array.from(userCards.values()).reduce(
    (sum, uc) => sum + uc.quantity,
    0
  )

  const avgCompletion =
    userPokemonSets.length > 0
      ? Math.round(
          userPokemonSets.reduce((sum, set) => {
            const p = buildProgress(set.id)
            return sum + p.percentage
          }, 0) / userPokemonSets.length
        )
      : 0

  // ── Search filter ────────────────────────────────────────────────────────
  const filteredSets = userPokemonSets.filter(set =>
    set.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // ── Loading State ────────────────────────────────────────────────────────
  const isLoading = authLoading || (!!user && pokemonSets.size === 0 && userSets.length === 0)

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

  if (!user) return null

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
            {userPokemonSets.length > 0
              ? `Tracking ${userPokemonSets.length} set${userPokemonSets.length !== 1 ? 's' : ''} in your collection`
              : 'Start building your Pokémon card collection'}
          </p>
        </div>

        {userPokemonSets.length > 0 && (
          <>
            {/* ── Summary Stats ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Sets Tracked</span>
                <span className="text-2xl font-bold text-primary">{userPokemonSets.length}</span>
              </div>
              <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Cards Owned</span>
                <span className="text-2xl font-bold text-primary">{totalOwnedCards.toLocaleString()}</span>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center col-span-2 md:col-span-1">
                <p className="text-sm font-semibold text-white">Collection Value</p>
                <p className="text-xs text-gray-400 mt-1">Coming soon with the new pricing system</p>
              </div>
            </div>

            {/* ── Last Activity ────────────────────────────────────────── */}
            <LastActivitySection userId={user.id} isOwnProfile compact />

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
        {userPokemonSets.length === 0 ? (
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
            <Button variant="primary" size="lg" onClick={() => router.push('/sets')}>
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
                progress={buildProgress(set.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
