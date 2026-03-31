'use client'

import { useEffect, useState } from 'react'
import { useAuthStore, useCollectionStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import SetCard from '@/components/SetCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PokemonSet, SetProgress } from '@/types'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const { user, isLoading } = useAuthStore()
  const {
    userSets,
    pokemonSets,
    userCards,
    userCardCountBySet,
    fetchPokemonSets,
    fetchUserSets,
    addUserSet,
    removeUserSet
  } = useCollectionStore()

  const [showAddSet, setShowAddSet] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    fetchPokemonSets()
  }, [fetchPokemonSets])

  // ── Loading State ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-base">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <div className="mb-8">
            <div className="skeleton h-9 w-64 rounded-lg mb-2" />
            <div className="skeleton h-5 w-80 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-subtle rounded-xl p-4">
                <div className="skeleton h-3 w-20 rounded mb-2" />
                <div className="skeleton h-7 w-12 rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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

  if (!user) {
    return null
  }

  const userSetIds = new Set(userSets.map(us => us.set_id))
  const userPokemonSets = Array.from(pokemonSets.values()).filter(set =>
    userSetIds.has(set.id)
  )

  const availableSets = Array.from(pokemonSets.values()).filter(
    set =>
      !userSetIds.has(set.id) &&
      set.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const calculateSetProgress = (setId: string): SetProgress => {
    const totalCards = pokemonSets.get(setId)?.total ?? 0
    const ownedCards = userCardCountBySet.get(setId) ?? 0
    const percentage = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0

    return {
      owned_cards: ownedCards,
      total_cards: totalCards,
      percentage
    }
  }

  const handleAddSet = async (setId: string) => {
    await addUserSet(setId)
    setShowAddSet(false)
    setSearchTerm('')
  }

  const handleRemoveSet = async (setId: string) => {
    await removeUserSet(setId)
  }

  const username = (user as any).user_metadata?.username
    || (user as any).email?.split('@')[0]
    || 'Trainer'

  return (
    <div className="min-h-screen bg-base">
      <main className="max-w-screen-2xl mx-auto px-6 py-8">

        {/* ── Welcome Header ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-3xl font-bold text-primary"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Welcome back, {username}
            </h1>
            <p className="text-secondary text-sm mt-1">
              Track your Pokémon card collection across different sets
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button variant="secondary" onClick={() => router.push('/collection')}>
              My Collection
            </Button>
            <Button variant="primary" onClick={() => router.push('/sets')}>
              Browse Sets
            </Button>
          </div>
        </div>

        {/* ── Stats Row ───────────────────────────────────────────────── */}
        {userPokemonSets.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider">Sets Tracked</span>
              <span className="text-2xl font-bold text-primary">{userPokemonSets.length}</span>
            </div>
            <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider">Cards Owned</span>
              <span className="text-2xl font-bold text-primary">
                {Array.from(userCards?.values() ?? []).reduce((sum, uc) => sum + (uc.quantity ?? 0), 0)}
              </span>
            </div>
            <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider">Sets Available</span>
              <span className="text-2xl font-bold text-primary">{pokemonSets.size}</span>
            </div>
            <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
              <span className="text-xs text-muted uppercase tracking-wider">Completion</span>
              <span className="text-2xl font-bold text-accent">0%</span>
            </div>
          </div>
        )}

        {/* ── Empty State ─────────────────────────────────────────────── */}
        {userPokemonSets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent-dim flex items-center justify-center text-3xl">
              📦
            </div>
            <div>
              <h2
                className="text-xl font-semibold text-primary mb-1"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Start your collection
              </h2>
              <p className="text-secondary text-sm max-w-xs mx-auto">
                Browse all Pokémon sets and start tracking your cards
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="primary" size="lg" onClick={() => router.push('/sets')}>
                Browse Sets
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Section heading ──────────────────────────────────── */}
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-lg font-semibold text-primary"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Your Sets
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddSet(true)}
              >
                + Add Set
              </Button>
            </div>

            {/* ── Sets Grid ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {userPokemonSets.map(set => (
                <SetCard
                  key={set.id}
                  set={set}
                  progress={calculateSetProgress(set.id)}
                  onRemove={() => handleRemoveSet(set.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Add Set Modal ───────────────────────────────────────────── */}
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
