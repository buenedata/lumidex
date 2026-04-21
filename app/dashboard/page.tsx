'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useAuthStore, useCollectionStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { SetProgress } from '@/types'

// ── Above-the-fold components (loaded eagerly) ───────────────────────────────
import DashboardHero  from '@/components/dashboard/DashboardHero'
import DashboardStats from '@/components/dashboard/DashboardStats'
import QuickActions   from '@/components/dashboard/QuickActions'

// ── Below-the-fold components (lazy-loaded to reduce initial parse time) ─────
const CollectionSpotlight = dynamic(() => import('@/components/dashboard/CollectionSpotlight'))
const WantedBoard         = dynamic(() => import('@/components/dashboard/WantedBoard'))
const NewsStories         = dynamic(() => import('@/components/dashboard/NewsStories'))
const ComingSoonFeatures  = dynamic(() => import('@/components/dashboard/ComingSoonFeatures'))

export default function DashboardPage() {
  const { user, isLoading } = useAuthStore()
  const {
    userSets,
    userCards,
    pokemonSets,
    userCardCountBySet,
    totalCardVariantCount,
    fetchPokemonSets,
  } = useCollectionStore()

  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    // Only fetch if the store is empty — avoids a redundant network request
    // every time the user navigates back to the dashboard.
    if (pokemonSets.size === 0) fetchPokemonSets()
  }, [fetchPokemonSets, pokemonSets.size])

  // ── Derived data ─────────────────────────────────────────────────────────
  const userSetIds      = new Set(userSets.map(us => us.set_id))
  const userPokemonSets = Array.from(pokemonSets.values()).filter(set =>
    userSetIds.has(set.id)
  )

  // Total physical copies owned (each variant × each duplicate) — used for "Cards Owned" stat
  // and for the Hero card count pill.
  const totalCards  = Array.from(userCards.values()).reduce((s, uc) => s + uc.quantity, 0)
  // Distinct (card_id, variant_id) pairs with quantity > 0 — used for "Unique Cards" stat.
  // This equals totalCardVariantCount which is set to data.length in fetchUserCards.
  const uniqueCards = totalCardVariantCount
  const setsTracked = userPokemonSets.length
  const completedSets = userPokemonSets.filter(set => {
    const owned = userCardCountBySet.get(set.id) ?? 0
    const total = set.total ?? 0
    return total > 0 && owned >= total
  }).length

  // Total cards still needed to complete all tracked sets
  const totalCardsToComplete = userPokemonSets.reduce((sum, set) => {
    const owned = userCardCountBySet.get(set.id) ?? 0
    const total = set.total ?? 0
    return sum + Math.max(0, total - owned)
  }, 0)

  const calculateSetProgress = (setId: string): SetProgress => {
    const setTotal   = pokemonSets.get(setId)?.total ?? 0
    const ownedCards = userCardCountBySet.get(setId) ?? 0
    const percentage = setTotal > 0 ? Math.round((ownedCards / setTotal) * 100) : 0
    return { owned_cards: ownedCards, total_cards: setTotal, percentage }
  }

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
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
          {/* Spotlight skeleton */}
          <div className="skeleton h-52 rounded-2xl" />
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

        {/* ── Stats (full width) ───────────────────────────────────────── */}
        <div className="mb-4">
          <DashboardStats
            totalCards={totalCards}
            uniqueCards={uniqueCards}
            setsTracked={setsTracked}
            setsAvailable={pokemonSets.size}
          />
        </div>

        {/* ── Collection Spotlight (full width) ────────────────────────── */}
        <div className="mb-6">
          <CollectionSpotlight
            sets={userPokemonSets}
            getProgress={calculateSetProgress}
            completedSets={completedSets}
            totalCardsToComplete={totalCardsToComplete}
          />
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
