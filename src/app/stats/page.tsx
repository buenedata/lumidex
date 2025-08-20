'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { collectionStatsService, CollectionStats, SetProgress } from '@/lib/collection-stats-service'
import Image from 'next/image'
import Link from 'next/link'

// Simple auth hook
function useUser() {
  const [user, setUser] = useState<any>(null)
  
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return user
}

export default function StatsPage() {
  const user = useUser()
  const [activeTab, setActiveTab] = useState<'overview' | 'sets' | 'value' | 'insights'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data states
  const [stats, setStats] = useState<CollectionStats | null>(null)
  const [insights, setInsights] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      // Load collection stats
      const statsResult = await collectionStatsService.getCollectionStats(user.id)
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data)
      }

      // Load insights
      const insightsResult = await collectionStatsService.getCollectionInsights(user.id)
      if (insightsResult.success && insightsResult.data) {
        setInsights(insightsResult.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getRarityColor = (rarity: string) => {
    const rarityLower = rarity.toLowerCase()
    if (rarityLower.includes('common')) return 'bg-gray-100 text-gray-800'
    if (rarityLower.includes('uncommon')) return 'bg-green-100 text-green-800'
    if (rarityLower.includes('rare')) return 'bg-blue-100 text-blue-800'
    if (rarityLower.includes('ultra') || rarityLower.includes('secret')) return 'bg-purple-100 text-purple-800'
    return 'bg-gray-100 text-gray-800'
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in</h1>
          <p className="text-gray-600">You need to be signed in to view collection statistics.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No collection data</h1>
          <p className="text-gray-600">Start adding cards to your collection to see statistics.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Collection Statistics</h1>
          <p className="mt-2 text-gray-600">
            Detailed insights into your Pokemon card collection
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: 'Overview' },
              { id: 'sets', name: 'Set Progress' },
              { id: 'value', name: 'Value Analysis' },
              { id: 'insights', name: 'Insights' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                      <span className="text-blue-600 text-lg">📚</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Cards</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.totalCards.toLocaleString()}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                      <span className="text-green-600 text-lg">🎯</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Unique Cards</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.uniqueCards.toLocaleString()}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                      <span className="text-purple-600 text-lg">💰</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Value</dt>
                      <dd className="text-lg font-medium text-gray-900">{formatCurrency(stats.totalValueEur)}</dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-md flex items-center justify-center">
                      <span className="text-yellow-600 text-lg">📊</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Sets Progress</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.setsWithCards}/{stats.totalSets}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Rarity Breakdown */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Rarity Breakdown</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(stats.rarityBreakdown).map(([rarity, data]) => (
                    <div key={rarity} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRarityColor(rarity)}`}>
                          {rarity}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{data.count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${data.percentage}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{data.percentage.toFixed(1)}%</span>
                        <span>{formatCurrency(data.totalValue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Additions */}
            {stats.recentAdditions.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Recent Additions</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {stats.recentAdditions.slice(0, 5).map((card) => (
                      <div key={card.cardId} className="text-center">
                        <Image
                          src={card.imageSmall}
                          alt={card.cardName}
                          width={150}
                          height={210}
                          className="rounded-lg mx-auto mb-2"
                        />
                        <h4 className="text-sm font-medium text-gray-900 truncate">{card.cardName}</h4>
                        <p className="text-xs text-gray-500">{card.setName}</p>
                        <p className="text-xs text-gray-500">{formatDate(card.addedAt)}</p>
                        {card.estimatedValue > 0 && (
                          <p className="text-xs font-medium text-green-600">
                            {formatCurrency(card.estimatedValue)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Set Progress Tab */}
        {activeTab === 'sets' && (
          <div className="space-y-4">
            {stats.setProgress.map((set) => (
              <div key={set.setId} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    {set.setSymbolUrl && (
                      <Image
                        src={set.setSymbolUrl}
                        alt={set.setName}
                        width={40}
                        height={40}
                        className="rounded"
                      />
                    )}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{set.setName}</h3>
                      <p className="text-sm text-gray-500">
                        Released {formatDate(set.releaseDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {set.completionPercentage.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">Complete</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{set.ownedCards}/{set.totalCards} cards</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full" 
                      style={{ width: `${set.completionPercentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Owned:</span>
                    <span className="ml-2 font-medium text-gray-900">{set.ownedCards} cards</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Missing:</span>
                    <span className="ml-2 font-medium text-gray-900">{set.missingCards} cards</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Value:</span>
                    <span className="ml-2 font-medium text-green-600">{formatCurrency(set.totalValue)}</span>
                  </div>
                </div>
              </div>
            ))}

            {stats.setProgress.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No sets found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Start collecting cards to see set progress.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Value Analysis Tab */}
        {activeTab === 'value' && (
          <div className="space-y-6">
            {/* Value Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {formatCurrency(stats.totalValueEur)}
                  </div>
                  <div className="text-sm text-gray-500">Total Collection Value</div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {formatCurrency(stats.averageCardValue)}
                  </div>
                  <div className="text-sm text-gray-500">Average Card Value</div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {stats.topValueCards.length > 0 ? formatCurrency(stats.topValueCards[0].totalValue) : '€0.00'}
                  </div>
                  <div className="text-sm text-gray-500">Most Valuable Card</div>
                </div>
              </div>
            </div>

            {/* Top Value Cards */}
            {stats.topValueCards.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Most Valuable Cards</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {stats.topValueCards.slice(0, 10).map((card, index) => (
                      <div key={card.cardId} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                        <div className="flex-shrink-0 text-lg font-bold text-gray-500 w-8">
                          #{index + 1}
                        </div>
                        <Image
                          src={card.imageSmall}
                          alt={card.cardName}
                          width={60}
                          height={84}
                          className="rounded"
                        />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">{card.cardName}</h4>
                          <p className="text-sm text-gray-500">{card.setName}</p>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRarityColor(card.rarity)}`}>
                            {card.rarity}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {formatCurrency(card.totalValue)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {card.quantity}x @ {formatCurrency(card.unitValue)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-6">
            {insights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {insights.map((insight, index) => (
                  <div key={index} className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-start space-x-4">
                      <div className="text-3xl">{insight.icon}</div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{insight.title}</h3>
                        <p className="text-gray-600">{insight.description}</p>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                          {insight.type}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No insights available</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Build your collection to unlock personalized insights and recommendations.
                </p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Link
                    href="/cards"
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                        <span className="text-blue-600 text-lg">🃏</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h4 className="text-sm font-medium text-gray-900">Browse Cards</h4>
                      <p className="text-sm text-gray-500">Add more cards to your collection</p>
                    </div>
                  </Link>

                  <Link
                    href="/matches"
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                        <span className="text-green-600 text-lg">🔄</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h4 className="text-sm font-medium text-gray-900">Find Matches</h4>
                      <p className="text-sm text-gray-500">Discover trading opportunities</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}