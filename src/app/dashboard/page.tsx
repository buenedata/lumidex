'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useTabVisibility } from '@/hooks/useTabVisibility'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navigation from '@/components/navigation/Navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { optimizedCommunityStatsService as communityStatsService, CommunityStats } from '@/lib/community-stats-service-optimized'
import { collectionStatsService, CollectionStats } from '@/lib/collection-stats-service'
import { profileService } from '@/lib/profile-service'
import { WantedBoard } from '@/components/dashboard/WantedBoard'
import { EnhancedLeaderboards } from '@/components/dashboard/EnhancedLeaderboards'
import { DashboardSearch } from '@/components/dashboard/DashboardSearch'
import { PriceDisplay } from '@/components/PriceDisplay'
import { usePreferredPriceSource } from '@/contexts/UserPreferencesContext'
import { getCardPrice } from '@/lib/price-utils'
import { supabase } from '@/lib/supabase'
import { loadingStateManager } from '@/lib/loading-state-manager'
import { EnhancedErrorBoundary } from '@/components/ui/EnhancedErrorBoundary'
import LoadingDebugPanel from '@/components/dev/LoadingDebugPanel'
import {
  StatCardSkeleton,
  CommunityOverviewSkeleton,
  ActivityListSkeleton,
  TrendingCardsSkeleton,
  TopCollectorsSkeleton
} from '@/components/ui/SkeletonLoader'
import {
  Search,
  Users,
  Star,
  ArrowLeftRight,
  Trophy,
  BarChart3,
  Plus,
  TrendingUp,
  Calendar,
  Zap,
  Target,
  Gift,
  Globe,
  Activity,
  Crown,
  Flame,
  Eye,
  Heart,
  Award
} from 'lucide-react'

function DashboardContent() {
  const { user } = useAuth()
  const router = useRouter()
  const isTabVisible = useTabVisibility()
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null)
  const [userBasicStats, setUserBasicStats] = useState<CollectionStats | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [hasInitialData, setHasInitialData] = useState(false)
  const preferredPriceSource = usePreferredPriceSource()

  // Helper function to format numbers with K suffix
  const formatNumber = (num: number): string => {
    if (num < 1000) {
      return num.toString()
    } else {
      const thousands = num / 1000
      if (thousands % 1 === 0) {
        return `${thousands}K`
      } else {
        return `${thousands.toFixed(1)}K`
      }
    }
  }

  const fetchStats = useCallback(async (forceRefresh = false) => {
    if (!user) return
    
    const loadingKey = `dashboard-stats-${user.id}`
    
    // Only show loading skeleton if we don't have initial data yet or force refresh
    if (!hasInitialData || forceRefresh) {
      setStatsLoading(true)
    }
    
    const result = await loadingStateManager.executeWithTimeout(
      loadingKey,
      async () => {
        // EMERGENCY FAST PATH: Use simplified queries for immediate loading
        console.log('Using fast path for dashboard stats')
        
        // Try fast user collection count first
        const { data: userCollectionData, error: userError } = await supabase
          .from('user_collections')
          .select('quantity', { count: 'exact' })
          .eq('user_id', user.id)
          .limit(1)

        // Basic profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('id', user.id)
          .single()

        // Simple community count - just count profiles
        const { count: totalUsers, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })

        console.log('Fast path results:', {
          userCollectionData,
          profileData,
          totalUsers,
          errors: { userError, profileError, countError }
        })

        return {
          userCards: userCollectionData?.length || 0,
          profile: profileData,
          communityUsers: totalUsers || 0
        }
      },
      {
        timeout: 2000, // Very short timeout for fast loading
        maxRetries: 1
      }
    )

    try {
      if (result.success && result.data) {
        const { userCards, profile, communityUsers } = result.data

        // Set fast fallback data to show immediately
        setUserBasicStats({
          totalCards: userCards,
          uniqueCards: userCards,
          totalValueEur: userCards * 2.5, // Estimate
          averageCardValue: 2.5,
          setsWithCards: Math.ceil(userCards / 20),
          totalSets: 100,
          completionPercentage: (userCards / 2000) * 100,
          rarityBreakdown: {},
          setProgress: [],
          recentAdditions: [],
          topValueCards: [],
          collectionGrowth: []
        })

        setCommunityStats({
          totalUsers: communityUsers,
          totalCollections: communityUsers,
          totalCardsInCommunity: communityUsers * 50, // Estimate
          totalCommunityValue: communityUsers * 125, // Estimate
          averageCollectionSize: 50,
          mostPopularSets: [],
          trendingCards: [],
          recentCommunityActivity: [],
          topCollectors: [],
          globalAchievements: [
            {
              type: 'community_collectors',
              name: 'Growing Community',
              description: 'Reach 100 active collectors!',
              currentProgress: communityUsers,
              targetGoal: 100,
              percentage: Math.min((communityUsers / 100) * 100, 100),
              icon: '👥',
              encouragingMessage: communityUsers >= 100
                ? 'Incredible! Our community is thriving!'
                : `${100 - communityUsers} more collectors needed!`,
              isCompleted: communityUsers >= 100
            }
          ],
          leaderboards: {
            topCollectors: [],
            biggestCollections: [],
            mostValuable: [],
            duplicateCollectors: [],
            setCompletionists: [],
            recentlyActive: []
          }
        })

        if (profile) {
          setUserProfile(profile)
        }

        console.log('Fast dashboard data loaded successfully')
        setHasInitialData(true)
      } else {
        console.error('Fast dashboard stats failed:', result.error)
        // Set absolute minimal fallback to prevent infinite loading
        setUserBasicStats({
          totalCards: 0,
          uniqueCards: 0,
          totalValueEur: 0,
          averageCardValue: 0,
          setsWithCards: 0,
          totalSets: 0,
          completionPercentage: 0,
          rarityBreakdown: {},
          setProgress: [],
          recentAdditions: [],
          topValueCards: [],
          collectionGrowth: []
        })

        setCommunityStats({
          totalUsers: 1,
          totalCollections: 1,
          totalCardsInCommunity: 0,
          totalCommunityValue: 0,
          averageCollectionSize: 0,
          mostPopularSets: [],
          trendingCards: [],
          recentCommunityActivity: [],
          topCollectors: [],
          globalAchievements: [],
          leaderboards: {
            topCollectors: [],
            biggestCollections: [],
            mostValuable: [],
            duplicateCollectors: [],
            setCompletionists: [],
            recentlyActive: []
          }
        })

        setHasInitialData(true)
      }
    } catch (error) {
      console.error('Error processing fast dashboard stats:', error)
      setHasInitialData(true)
    } finally {
      setStatsLoading(false)
    }
  }, [user, hasInitialData])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Refresh data when tab becomes visible again, but don't show loading state
  useEffect(() => {
    if (isTabVisible && hasInitialData && user) {
      // Add debouncing to prevent race conditions and avoid excessive refreshes
      const refreshTimer = setTimeout(() => {
        fetchStats(false)
      }, 1000) // Longer delay for dashboard to prevent data corruption
      
      return () => clearTimeout(refreshTimer)
    }
  }, [isTabVisible, hasInitialData, user, fetchStats])

  const quickActions = useMemo(() => [
    {
      title: "Browse Cards",
      href: "/cards",
      icon: Search,
      description: "Discover new cards",
      color: "from-blue-500 to-blue-600"
    },
    {
      title: "Add to Collection",
      href: "/collection",
      icon: Plus,
      description: "Quick add cards",
      color: "from-green-500 to-green-600"
    },
    {
      title: "Find Friends",
      href: "/friends",
      icon: Users,
      description: "Connect with collectors",
      color: "from-purple-500 to-purple-600"
    },
    {
      title: "Start Trading",
      href: "/trades",
      icon: ArrowLeftRight,
      description: "Trade with others",
      color: "from-orange-500 to-orange-600"
    }
  ], [])

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">
          Welcome to the Community, {userProfile?.display_name || userProfile?.username || user?.email?.split('@')[0]}!
        </h2>
        <p className="text-gray-400">Discover what's happening in the Pokémon TCG collecting world</p>
      </div>

      {/* Dashboard Search */}
      <div className="mb-8">
        <DashboardSearch className="max-w-md mx-auto" />
      </div>

      {/* Tabbed Interface */}
      <Tabs defaultValue="community" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-5">
          <TabsTrigger value="community">Community</TabsTrigger>
          <TabsTrigger value="wanted">Wanted Board</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
          <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
        </TabsList>

        {/* Community Tab */}
        <TabsContent value="community" className="space-y-6">
          {/* Community Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {statsLoading && !hasInitialData ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-pokemon-gold">
                        {userBasicStats?.totalCards || 0}
                      </div>
                      <div className="text-sm text-gray-400">Your Cards</div>
                    </div>
                    <BarChart3 className="w-8 h-8 text-pokemon-gold/60" />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-green-400">
                        <PriceDisplay
                          cardData={{
                            cardmarket_avg_sell_price: userBasicStats?.totalValueEur || 0,
                            tcgplayer_price: (userBasicStats?.totalValueEur || 0) * 1.1
                          }}
                          className="text-2xl font-bold text-green-400"
                          showOriginal={false}
                        />
                      </div>
                      <div className="text-sm text-gray-400">Your Value</div>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-400/60" />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-blue-400">
                        {communityStats?.totalUsers || 0}
                      </div>
                      <div className="text-sm text-gray-400">Community members</div>
                    </div>
                    <Globe className="w-8 h-8 text-blue-400/60" />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-purple-400">
                        {formatNumber(communityStats?.totalCardsInCommunity || 0)}
                      </div>
                      <div className="text-sm text-gray-400">Total Cards</div>
                    </div>
                    <Activity className="w-8 h-8 text-purple-400/60" />
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Community Overview */}
          {statsLoading && !hasInitialData ? (
            <CommunityOverviewSkeleton />
          ) : (
            <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Globe className="w-5 h-5 mr-2 text-pokemon-gold" />
                Community Overview
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-pkmn-surface/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-400 mb-1">
                    {communityStats?.totalUsers || 0}
                  </div>
                  <div className="text-sm text-gray-400">Active Collectors</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Building amazing collections
                  </div>
                </div>
                <div className="bg-pkmn-surface/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-400 mb-1">
                    {(communityStats?.totalCommunityValue && communityStats.totalCommunityValue > 0) ? (
                      <PriceDisplay
                        cardData={{
                          cardmarket_avg_sell_price: communityStats.totalCommunityValue,
                          tcgplayer_price: communityStats.totalCommunityValue * 1.1
                        }}
                        className="text-2xl font-bold text-green-400"
                        showOriginal={false}
                      />
                    ) : (
                      <span className="text-2xl font-bold text-green-400">Growing</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">Community Value</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {(communityStats?.averageCollectionSize && communityStats.averageCollectionSize > 0) ? (
                      <span className="inline-flex items-center">
                        <PriceDisplay
                          cardData={{
                            cardmarket_avg_sell_price: Math.floor((communityStats?.averageCollectionSize || 0) * 0.5),
                            tcgplayer_price: Math.floor((communityStats?.averageCollectionSize || 0) * 0.5 * 1.1)
                          }}
                          className="text-xs text-gray-500"
                          showOriginal={false}
                        />
                        <span className="ml-1">avg per collector</span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Building collections</span>
                    )}
                  </div>
                </div>
                <div className="bg-pkmn-surface/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-400 mb-1">
                    {formatNumber(communityStats?.totalCardsInCommunity || 0)}
                  </div>
                  <div className="text-sm text-gray-400">Cards Collected</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {(communityStats?.averageCollectionSize && communityStats.averageCollectionSize > 0)
                      ? `${Math.floor(communityStats?.averageCollectionSize || 0)} avg per collector`
                      : "Building collections"
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Community Achievements */}
          {statsLoading && !hasInitialData ? (
            <ActivityListSkeleton />
          ) : (
            <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Award className="w-5 h-5 mr-2 text-pokemon-gold" />
                Community Achievements
              </h3>
              {communityStats?.globalAchievements && communityStats.globalAchievements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {communityStats.globalAchievements.map((achievement, index) => (
                    <div key={achievement.type} className={`p-4 rounded-lg ${achievement.isCompleted ? 'bg-green-500/20 border border-green-500/40' : 'bg-pkmn-surface/30'}`}>
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="text-2xl">{achievement.icon}</div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white flex items-center">
                            {achievement.name}
                            {achievement.isCompleted && <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">COMPLETED!</span>}
                          </div>
                          <div className="text-xs text-gray-400">
                            {achievement.description}
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-gray-300 mb-1">
                          <span className="text-xs">
                            {achievement.type === 'community_value' ? (
                              `${Math.round(achievement.currentProgress * 11.5).toLocaleString()} kr`
                            ) : (
                              achievement.currentProgress.toLocaleString()
                            )}
                          </span>
                          <span className="text-xs">
                            {achievement.type === 'community_value' ? (
                              `${Math.round(achievement.targetGoal * 11.5).toLocaleString()} kr`
                            ) : (
                              achievement.targetGoal.toLocaleString()
                            )}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${achievement.isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(achievement.percentage, 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-center mt-1">
                          <span className={achievement.isCompleted ? 'text-green-400 font-bold' : 'text-blue-400'}>
                            {achievement.percentage.toFixed(1)}% Complete
                          </span>
                        </div>
                      </div>
                      
                      {/* Encouraging Message */}
                      <div className={`text-xs text-center font-medium ${achievement.isCompleted ? 'text-green-300' : 'text-yellow-300'}`}>
                        {achievement.encouragingMessage}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4 opacity-50">🏆</div>
                  <h4 className="text-lg font-medium text-gray-400 mb-2">Community Goals Loading</h4>
                  <p className="text-gray-500">Community achievements will appear here</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Wanted Board Tab */}
        <TabsContent value="wanted" className="space-y-6">
          {/* Wanted Board Widget */}
          <WantedBoard />
        </TabsContent>

        {/* Trending Tab */}
        <TabsContent value="trending" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trending Cards */}
            <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Flame className="w-5 h-5 mr-2 text-pokemon-gold" />
                Trending Cards
              </h3>
              {communityStats?.trendingCards && communityStats.trendingCards.length > 0 ? (
                <div className="space-y-3">
                  {communityStats.trendingCards.slice(0, 5).map((card, index) => (
                    <div key={card.cardId} className="flex items-center space-x-3 p-3 rounded-lg bg-pkmn-surface/30">
                      <img
                        src={card.imageSmall}
                        alt={card.cardName}
                        className="w-12 h-16 object-contain rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {card.cardName}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {card.setName} • {card.rarity}
                        </div>
                        <div className="text-xs text-pokemon-gold">
                          +{card.recentAdds} this week
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-400">
                          <PriceDisplay
                            cardData={{
                              cardmarket_avg_sell_price: card.averageValue,
                              tcgplayer_price: card.averageValue * 1.1
                            }}
                            className="text-sm font-bold text-green-400"
                            showOriginal={false}
                          />
                        </div>
                        <div className="text-xs text-gray-400">
                          {card.ownersCount} owners
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4 opacity-50">🔥</div>
                  <h4 className="text-lg font-medium text-gray-400 mb-2">No trending data yet</h4>
                  <p className="text-gray-500">Start collecting to see what's hot!</p>
                </div>
              )}
            </div>

            {/* Popular Sets */}
            <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Star className="w-5 h-5 mr-2 text-pokemon-gold" />
                Popular Sets
              </h3>
              {communityStats?.mostPopularSets && communityStats.mostPopularSets.length > 0 ? (
                <div className="space-y-3">
                  {communityStats.mostPopularSets.slice(0, 5).map((set, index) => (
                    <div key={set.setId} className="flex items-center space-x-3 p-3 rounded-lg bg-pkmn-surface/30">
                      {set.setSymbolUrl && (
                        <img
                          src={set.setSymbolUrl}
                          alt={set.setName}
                          className="w-8 h-8 object-contain"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {set.setName}
                        </div>
                        <div className="text-xs text-gray-400">
                          {set.collectorsCount} collectors • {set.averageCompletion.toFixed(1)}% avg completion
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-purple-400">
                          #{index + 1}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4 opacity-50">⭐</div>
                  <h4 className="text-lg font-medium text-gray-400 mb-2">No set data yet</h4>
                  <p className="text-gray-500">Collections are being built!</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Leaderboards Tab */}
        <TabsContent value="leaderboards" className="space-y-6">
          <EnhancedLeaderboards communityStats={communityStats} loading={statsLoading} />
        </TabsContent>

        {/* Quick Start Tab */}
        <TabsContent value="quickstart" className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-pokemon-gold" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <Link
                  key={`${action.title}-${index}`}
                  href={action.href}
                  className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-pkmn-surface to-pkmn-dark p-4 border border-gray-700/50 hover:border-pokemon-gold/30 transition-all duration-200 hover:scale-105"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-pokemon-gold/10">
                      <action.icon className="w-5 h-5 text-pokemon-gold" />
                    </div>
                    <div>
                      <div className="font-medium text-white group-hover:text-pokemon-gold transition-colors">
                        {action.title}
                      </div>
                      <div className="text-sm text-gray-400">
                        {action.description}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Getting Started Guide */}
          <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-pokemon-gold" />
              Getting Started
            </h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-pokemon-gold text-black text-sm font-bold">1</div>
                <div>
                  <div className="text-white font-medium">Browse and Add Cards</div>
                  <div className="text-gray-400 text-sm">Start by exploring our card database and adding cards to your collection.</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-pokemon-gold text-black text-sm font-bold">2</div>
                <div>
                  <div className="text-white font-medium">Connect with Friends</div>
                  <div className="text-gray-400 text-sm">Find other collectors and build your network for trading and sharing.</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-pokemon-gold text-black text-sm font-bold">3</div>
                <div>
                  <div className="text-white font-medium">Start Trading</div>
                  <div className="text-gray-400 text-sm">Trade cards with other collectors to complete your sets and find rare cards.</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-pokemon-gold text-black text-sm font-bold">4</div>
                <div>
                  <div className="text-white font-medium">Track Your Progress</div>
                  <div className="text-gray-400 text-sm">Visit your profile to see detailed statistics and track your collection growth.</div>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-700/50">
              <Link href="/profile" className="btn-gaming">
                View Your Profile
              </Link>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Navigation>
        <DashboardContent />
      </Navigation>
    </ProtectedRoute>
  )
}