'use client'

import { useEffect, useState } from 'react'
import { useAuthStore, useCollectionStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import SetCard from '@/components/SetCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SetProgress } from '@/types'

// ── Dashboard section components ────────────────────────────────────────────
import DashboardHero from '@/components/dashboard/DashboardHero'
import DashboardStats from '@/components/dashboard/DashboardStats'
import QuickActions from '@/components/dashboard/QuickActions'
import ComingSoonFeatures from '@/components/dashboard/ComingSoonFeatures'
import CollectionSpotlight from '@/components/dashboard/CollectionSpotlight'

export default function DashboardPage() {
  const { user, isLoading } = useAuthStore()
  const {
    userSets,
    userCards,
    pokemonSets,
    userCardCountBySet,
    fetchPokemonSets,
    addUserSet,
    removeUserSet,
  } = useCollectionStore()

  const [showAddSet, setShowAddSet]   = useState(false)
  const [searchTerm, setSearchTerm]   = useState('')
  const [setsExpanded, setSetsExpanded] = useState(false)
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
          {/* Sets skeleton — full width */}
          <div className="skeleton h-12 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface border border-subtle rounded-xl overflow-hidden">
                <div className="skeleton h-32 w-full" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
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
  const availableSets   = Array.from(pokemonSets.values()).filter(
    set =>
      !userSetIds.has(set.id) &&
      set.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Sum all variant quantities for "Cards Owned" — matches the profile's "Cards Collected"
  const totalCards     = Array.from(userCards.values()).reduce((s, uc) => s + uc.quantity, 0)
  const setsTracked    = userPokemonSets.length
  const completedSets  = userPokemonSets.filter(set => {
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

  /** Returns true when a set was added to the user's collection within the last 7 days. */
  const isNewSet = (setId: string): boolean => {
    const userSet = userSets.find(us => us.set_id === setId)
    if (!userSet?.created_at) return false
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return new Date(userSet.created_at) > sevenDaysAgo
  }

  const handleAddSet = async (setId: string) => {
    await addUserSet(setId)
    setShowAddSet(false)
    setSearchTerm('')
  }

  const handleRemoveSet = async (setId: string) => {
    await removeUserSet(setId)
  }

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
        <QuickActions
          userId={user.id}
          onAddSet={() => setShowAddSet(true)}
        />

        {/* ── Stats + Sets content ─────────────────────────────────────── */}
        {userPokemonSets.length > 0 ? (
          <>
            {/* Stats + Spotlight sidebar — always visible, decoupled from Your Sets */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start mb-6">
              <DashboardStats
                totalCards={totalCards}
                setsTracked={setsTracked}
                completedSets={completedSets}
                setsAvailable={pokemonSets.size}
              />
              <div className="lg:sticky lg:top-20">
                <CollectionSpotlight
                  sets={userPokemonSets}
                  getProgress={calculateSetProgress}
                />
              </div>
            </div>

            {/* ── Your Sets (collapsible) — full width ─────────────────── */}
            <div className="mb-6">
              {/* Accordion header — styled card so it's unmistakably clickable */}
              <div className={`bg-surface border border-subtle rounded-xl overflow-hidden mb-4 transition-colors duration-150 ${setsExpanded ? 'border-accent/40' : 'hover:border-accent/30'}`}>
                <button
                  type="button"
                  onClick={() => setSetsExpanded(prev => !prev)}
                  className="w-full flex items-center justify-between px-4 py-3 group"
                >
                  {/* Left: title + pills */}
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Animated chevron */}
                    <span
                      className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center bg-elevated border border-subtle text-muted transition-transform duration-200 ${setsExpanded ? 'rotate-180' : ''}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                    <h2
                      className="text-lg font-semibold text-primary"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      Your Sets
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-elevated border border-subtle text-secondary font-medium">
                      {setsTracked} {setsTracked === 1 ? 'set' : 'sets'}
                    </span>
                    {completedSets > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-price/10 border border-price/30 text-price font-medium">
                        ✓ {completedSets} complete
                      </span>
                    )}
                  </div>

                  {/* Right: expand hint + add button */}
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-xs text-muted group-hover:text-secondary transition-colors duration-150 hidden sm:block">
                      {setsExpanded ? 'Hide sets' : 'Show sets'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={e => { e.stopPropagation(); setShowAddSet(true) }}
                    >
                      + Add Set
                    </Button>
                  </div>
                </button>
              </div>

              {/* Collapsible grid */}
              {setsExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {userPokemonSets.map(set => (
                    <div key={set.id} className="relative">
                      {/* "NEW" chip for recently added sets */}
                      {isNewSet(set.id) && (
                        <div className="absolute top-2 left-2 z-30">
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent text-white shadow-lg shadow-accent/30 tracking-wide">
                            NEW
                          </span>
                        </div>
                      )}
                      <SetCard
                        set={set}
                        progress={calculateSetProgress(set.id)}
                        onRemove={() => handleRemoveSet(set.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── Empty State ───────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
            <div className="w-20 h-20 rounded-2xl bg-accent-dim flex items-center justify-center text-4xl shadow-lg shadow-accent/10">
              📦
            </div>
            <div>
              <h2
                className="text-2xl font-semibold text-primary mb-2"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Your adventure begins here
              </h2>
              <p className="text-secondary text-sm max-w-sm mx-auto leading-relaxed">
                Add your first Pokémon set to start tracking your collection and level up your Trainer Rank.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="primary" size="lg" onClick={() => router.push('/sets')}>
                Browse Sets
              </Button>
              <Button variant="secondary" size="lg" onClick={() => setShowAddSet(true)}>
                + Add a Set
              </Button>
            </div>
          </div>
        )}

        {/* ── Coming Soon Features ─────────────────────────────────────── */}
        <ComingSoonFeatures />

        {/* ── Add Set Modal ─────────────────────────────────────────────── */}
        {showAddSet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowAddSet(false)}
            />

            {/* Panel */}
            <div className="relative z-10 bg-elevated border border-subtle rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-subtle shrink-0">
                <h2
                  className="text-lg font-semibold text-primary"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  Add a Set
                </h2>
                <button
                  onClick={() => setShowAddSet(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-surface transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="px-6 pt-4 pb-3 shrink-0">
                <Input
                  type="text"
                  placeholder="Search sets…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                />
              </div>

              {/* Results */}
              <div className="px-6 pb-6 overflow-y-auto">
                {availableSets.length === 0 && searchTerm ? (
                  <div className="flex flex-col items-center py-8 gap-2 text-center">
                    <span className="text-2xl">🔍</span>
                    <p className="text-secondary text-sm">No sets found matching &ldquo;{searchTerm}&rdquo;</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableSets.map(set => (
                      <div
                        key={set.id}
                        className="bg-surface border border-subtle rounded-xl overflow-hidden flex flex-col"
                      >
                        <SetCard set={set} />
                        <div className="px-3 pb-3">
                          <Button
                            onClick={() => handleAddSet(set.id)}
                            variant="primary"
                            className="w-full"
                            size="sm"
                          >
                            Add Set
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
