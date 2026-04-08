'use client'

import { useEffect } from 'react'
import { useAuthStore, useCollectionStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { SetProgress } from '@/types'

// ── Dashboard section components ────────────────────────────────────────────
import DashboardHero from '@/components/dashboard/DashboardHero'
import DashboardStats from '@/components/dashboard/DashboardStats'
import QuickActions from '@/components/dashboard/QuickActions'
import ComingSoonFeatures from '@/components/dashboard/ComingSoonFeatures'
import CollectionSpotlight from '@/components/dashboard/CollectionSpotlight'
import NewsStories from '@/components/dashboard/NewsStories'
import WantedBoard from '@/components/dashboard/WantedBoard'

export default function DashboardPage() {
  const { user, isLoading } = useAuthStore()
  const {
    userSets,
    userCards,
    pokemonSets,
    userCardCountBySet,
    fetchPokemonSets,
  } = useCollectionStore()

  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    fetchPokemonSets()
  }, [fetchPokemonSets])

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-base">
        <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
          {/* Hero skeleton */}
          <div className="skeleton h-32 rounded-2xl" />
          {/* Quick actions skeleton */}
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-28 rounded-xl shrink-0" />
            ))}
          </div>
          {/* Stats + Spotlight skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-20 rounded-xl" />
              ))}
            </div>
            <div className="skeleton h-64 rounded-2xl" />
          </div>
          {/* Wanted Board skeleton */}
          <div className="skeleton h-12 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-36 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  // ── Derived data ─────────────────────────────────────────────────────────
  const userSetIds      = new Set(userSets.map(us => us.set_id))
  const userPokemonSets = Array.from(pokemonSets.values()).filter(set =>
    userSetIds.has(set.id)
  )

  // Sum all variant quantities for "Cards Owned"
  const totalCards    = Array.from(userCards.values()).reduce((s, uc) => s + uc.quantity, 0)
  const setsTracked   = userPokemonSets.length
  const completedSets = userPokemonSets.filter(set => {
    const owned = userCardCountBySet.get(set.id) ?? 0
    const total = set.total ?? 0
    return total > 0 && owned >= total
  }).length

  const calculateSetProgress = (setId: string): SetProgress => {
    const setTotal   = pokemonSets.get(setId)?.total ?? 0
    const ownedCards = userCardCountBySet.get(setId) ?? 0
    const percentage = setTotal > 0 ? Math.round((ownedCards / setTotal) * 100) : 0
    return { owned_cards: ownedCards, total_cards: setTotal, percentage }
  }

  // Average completion % across all tracked sets
  const avgCompletion = setsTracked === 0
    ? 0
    : Math.round(
        userPokemonSets.reduce((sum, set) => {
          const { percentage } = calculateSetProgress(set.id)
          return sum + percentage
        }, 0) / setsTracked
      )

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base">
      <main className="max-w-screen-2xl mx-auto px-6 py-8">

        {/* ── Hero Banner ─────────────────────────────────────────────── */}
        <DashboardHero
          totalCards={totalCards}
          setsTracked={setsTracked}
          completedSets={completedSets}
        />

        {/* ── Quick Actions ────────────────────────────────────────────── */}
        <QuickActions userId={user.id} />

        {/* ── Stats + Spotlight ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start mb-6">
          <DashboardStats
            totalCards={totalCards}
            setsTracked={setsTracked}
            avgCompletion={avgCompletion}
            setsAvailable={pokemonSets.size}
          />
          <div className="lg:sticky lg:top-20">
            <CollectionSpotlight
              sets={userPokemonSets}
              getProgress={calculateSetProgress}
            />
          </div>
        </div>

        {/* ── Wanted Board ─────────────────────────────────────────────── */}
        <WantedBoard />

        {/* ── News Stories ─────────────────────────────────────────────── */}
        <NewsStories />

        {/* ── Coming Soon Features ─────────────────────────────────────── */}
        <ComingSoonFeatures />

      </main>
    </div>
  )
}
