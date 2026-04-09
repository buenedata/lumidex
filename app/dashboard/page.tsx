'use client'

import { useEffect, useState } from 'react'
import { useAuthStore, useCollectionStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { SetProgress, UserCard } from '@/types'

// ── Dashboard section components ────────────────────────────────────────────
import DashboardHero from '@/components/dashboard/DashboardHero'
import DashboardStats from '@/components/dashboard/DashboardStats'
import QuickActions from '@/components/dashboard/QuickActions'
import ComingSoonFeatures from '@/components/dashboard/ComingSoonFeatures'
import CollectionSpotlight from '@/components/dashboard/CollectionSpotlight'
import NewsStories from '@/components/dashboard/NewsStories'
import WantedBoard from '@/components/dashboard/WantedBoard'

// ── Spotlight extra stats ────────────────────────────────────────────────────
interface SpotlightStats {
  mostOwnedCard: { name: string; image: string } | null
  mostExpensiveCard: { name: string; image: string; price: number } | null
}

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

  const [spotlightStats, setSpotlightStats] = useState<SpotlightStats>({
    mostOwnedCard: null,
    mostExpensiveCard: null,
  })
  const [spotlightLoading, setSpotlightLoading] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    fetchPokemonSets()
  }, [fetchPokemonSets])

  // ── Derived data ─────────────────────────────────────────────────────────
  const userSetIds      = new Set(userSets.map(us => us.set_id))
  const userPokemonSets = Array.from(pokemonSets.values()).filter(set =>
    userSetIds.has(set.id)
  )

  // Total copies owned (counts duplicates/variants)
  const totalCards  = Array.from(userCards.values()).reduce((s, uc) => s + uc.quantity, 0)
  // Distinct card entries owned (one entry per card+variant combo, ignoring quantity)
  const uniqueCards = userCards.size
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

  // Most-owned card — highest total quantity across all variants
  const mostOwnedEntry = Array.from(userCards.entries()).reduce<[string, UserCard] | null>(
    (best, entry) => (!best || entry[1].quantity > best[1].quantity ? entry : best),
    null
  )
  const mostOwnedCardId = mostOwnedEntry?.[0] ?? null
  const mostOwnedQty    = mostOwnedEntry?.[1].quantity ?? 0

  const calculateSetProgress = (setId: string): SetProgress => {
    const setTotal   = pokemonSets.get(setId)?.total ?? 0
    const ownedCards = userCardCountBySet.get(setId) ?? 0
    const percentage = setTotal > 0 ? Math.round((ownedCards / setTotal) * 100) : 0
    return { owned_cards: ownedCards, total_cards: setTotal, percentage }
  }

  // ── Fetch spotlight extra stats once we know the most-owned card ──────────
  useEffect(() => {
    if (!mostOwnedCardId) return

    let cancelled = false
    setSpotlightLoading(true)

    fetch(`/api/dashboard/spotlight-stats?mostOwnedCardId=${mostOwnedCardId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data) setSpotlightStats(data)
      })
      .catch(() => { /* silent — widget degrades gracefully */ })
      .finally(() => { if (!cancelled) setSpotlightLoading(false) })

    return () => { cancelled = true }
  }, [mostOwnedCardId])

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
            mostOwnedCard={spotlightStats.mostOwnedCard}
            mostOwnedQty={mostOwnedQty}
            mostExpensiveCard={spotlightStats.mostExpensiveCard}
            statsLoading={spotlightLoading}
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
