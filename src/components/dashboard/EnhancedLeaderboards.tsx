'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTabVisibility } from '@/hooks/useTabVisibility'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { CommunityStats } from '@/lib/community-stats-service-optimized'
import { PriceDisplay } from '@/components/PriceDisplay'
import { CardDetailsModal } from '@/components/pokemon/CardDetailsModal'
import {
  Crown,
  BarChart3,
  TrendingUp,
  Star,
  Trophy,
  Zap
} from 'lucide-react'

interface EnhancedLeaderboardsProps {
  communityStats: CommunityStats | null
  loading?: boolean
}

export function EnhancedLeaderboards({ communityStats, loading }: EnhancedLeaderboardsProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { isVisible } = useTabVisibility()

  // Modal state for card details
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [isCardModalOpen, setIsCardModalOpen] = useState(false)

  // Helper function to open card modal
  const handleCardClick = (cardId: string) => {
    setSelectedCardId(cardId)
    setIsCardModalOpen(true)
  }

  // Helper function to close card modal
  const handleCloseCardModal = () => {
    setIsCardModalOpen(false)
    setSelectedCardId(null)
  }

  // Helper function to get background class based on rank
  const getRankBackgroundClass = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400/20 to-amber-500/20 border-yellow-400/40 shadow-lg shadow-yellow-500/10'
      case 2:
        return 'bg-gradient-to-r from-gray-300/10 to-gray-400/10 border-gray-300/20'
      case 3:
        return 'bg-gradient-to-r from-amber-600/10 to-amber-700/10 border-amber-600/20'
      default:
        return 'bg-pkmn-surface/30'
    }
  }

  // Handle profile click navigation
  const handleProfileClick = (userId: string) => {
    if (!user) return
    
    // If it's the current user's profile, navigate to their own profile page
    if (userId === user.id) {
      router.push('/profile')
    } else {
      // Navigate to the other user's public profile
      router.push(`/profile/${userId}`)
    }
  }

  // Only show loading skeleton if loading is true AND we don't have community stats data yet
  const showLoadingSkeleton = loading && !communityStats

  if (showLoadingSkeleton) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="top-collectors" className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:grid-cols-6">
          <TabsTrigger value="top-collectors">Top Collectors</TabsTrigger>
          <TabsTrigger value="biggest">Biggest</TabsTrigger>
          <TabsTrigger value="valuable">Most Valuable</TabsTrigger>
          <TabsTrigger value="duplicate-collectors">Duplicate Collectors</TabsTrigger>
          <TabsTrigger value="completionists">Completionists</TabsTrigger>
          <TabsTrigger value="active">Recently Active</TabsTrigger>
        </TabsList>

        {/* Top Collectors Leaderboard */}
        <TabsContent value="top-collectors" className="space-y-4">
          <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Crown className="w-5 h-5 mr-2 text-cyan-400" />
              Top Collectors by Total Value
            </h3>
            {communityStats?.leaderboards?.topCollectors && communityStats.leaderboards.topCollectors.length > 0 ? (
              <div className="space-y-3">
                {communityStats.leaderboards.topCollectors.map((collector) => (
                  <div key={collector.userId} className={`flex items-center space-x-3 p-3 rounded-lg border ${getRankBackgroundClass(collector.rank)}`}>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20">
                      <span className="text-sm font-bold text-cyan-400">#{collector.rank}</span>
                    </div>
                    {collector.avatarUrl && (
                      <button
                        onClick={() => handleProfileClick(collector.userId)}
                        className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-cyan-400 transition-all duration-200 cursor-pointer"
                      >
                        <img
                          src={collector.avatarUrl}
                          alt={collector.displayName || collector.username}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => handleProfileClick(collector.userId)}
                        className="text-left w-full hover:text-cyan-400 transition-colors duration-200 cursor-pointer"
                      >
                        <div className="text-sm font-medium text-white truncate hover:text-cyan-400">
                          {collector.displayName || collector.username}
                        </div>
                      </button>
                      <div className="text-xs text-gray-400">
                        {collector.metadata?.totalCards} cards • {collector.metadata?.setsCompleted} sets represented
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-400">
                        <PriceDisplay
                          amount={collector.value}
                          currency="EUR"
                          className="text-sm font-bold text-green-400"
                          showOriginal={false}
                        />
                      </div>
                      <div className="text-xs text-gray-400">
                        {collector.metadata?.uniqueCards} unique
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4 opacity-50">👑</div>
                <h4 className="text-lg font-medium text-gray-400 mb-2">No collectors yet</h4>
                <p className="text-gray-500">Start collecting to claim your spot!</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Biggest Collections Leaderboard */}
        <TabsContent value="biggest" className="space-y-4">
          <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-400" />
              Biggest Collections by Card Count
            </h3>
            {communityStats?.leaderboards?.biggestCollections && communityStats.leaderboards.biggestCollections.length > 0 ? (
              <div className="space-y-3">
                {communityStats.leaderboards.biggestCollections.map((collector) => (
                  <div key={collector.userId} className={`flex items-center space-x-3 p-3 rounded-lg border ${getRankBackgroundClass(collector.rank)}`}>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20">
                      <span className="text-sm font-bold text-blue-400">#{collector.rank}</span>
                    </div>
                    {collector.avatarUrl && (
                      <button
                        onClick={() => handleProfileClick(collector.userId)}
                        className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-blue-400 transition-all duration-200 cursor-pointer"
                      >
                        <img
                          src={collector.avatarUrl}
                          alt={collector.displayName || collector.username}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => handleProfileClick(collector.userId)}
                        className="text-left w-full hover:text-blue-400 transition-colors duration-200 cursor-pointer"
                      >
                        <div className="text-sm font-medium text-white truncate hover:text-blue-400">
                          {collector.displayName || collector.username}
                        </div>
                      </button>
                      <div className="text-xs text-gray-400">
                        {collector.metadata?.totalCards} total • {collector.metadata?.setsCompleted} sets represented
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-blue-400">
                        {collector.value} cards
                      </div>
                      <div className="text-xs text-gray-400">
                        {collector.metadata?.uniqueCards} unique
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4 opacity-50">📚</div>
                <h4 className="text-lg font-medium text-gray-400 mb-2">No big collections yet</h4>
                <p className="text-gray-500">Start building your collection!</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Most Valuable Leaderboard */}
        <TabsContent value="valuable" className="space-y-4">
          <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
              Most Valuable Single Card
            </h3>
            {communityStats?.leaderboards?.mostValuable && communityStats.leaderboards.mostValuable.length > 0 ? (
              <div className="space-y-3">
                {communityStats.leaderboards.mostValuable.map((collector) => (
                  <div key={collector.userId} className={`flex items-center space-x-3 p-3 rounded-lg border ${getRankBackgroundClass(collector.rank)}`}>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20">
                      <span className="text-sm font-bold text-green-400">#{collector.rank}</span>
                    </div>
                    {collector.avatarUrl && (
                      <button
                        onClick={() => handleProfileClick(collector.userId)}
                        className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-green-400 transition-all duration-200 cursor-pointer"
                      >
                        <img
                          src={collector.avatarUrl}
                          alt={collector.displayName || collector.username}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => handleProfileClick(collector.userId)}
                        className="text-left w-full hover:text-green-400 transition-colors duration-200 cursor-pointer"
                      >
                        <div className="text-sm font-medium text-white truncate hover:text-green-400">
                          {(collector.displayName && collector.displayName.trim()) || collector.username}
                        </div>
                      </button>
                      <div className="text-xs text-gray-400">
                        {collector.metadata?.totalCards} cards • {collector.metadata?.uniqueCards} unique
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-400">
                        <PriceDisplay
                          amount={collector.value}
                          currency="EUR"
                          className="text-sm font-bold text-green-400"
                          showOriginal={false}
                        />
                      </div>
                      <div className="text-xs">
                        {collector.metadata?.mostValuableCardId && collector.metadata?.mostValuableSetId ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (collector.metadata?.mostValuableCardId) {
                                handleCardClick(collector.metadata.mostValuableCardId)
                              }
                            }}
                            className="group inline-flex flex-col hover:scale-105 transition-all duration-300 ease-out cursor-pointer"
                            title={`View ${collector.metadata.mostValuableCardName} from ${collector.metadata.mostValuableSetName}`}
                          >
                            <span className="font-semibold text-white group-hover:text-yellow-400 transition-colors duration-300 leading-tight">
                              {collector.metadata.mostValuableCardName}
                            </span>
                            {collector.metadata.mostValuableSetName && (
                              <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors duration-300 italic">
                                from {collector.metadata.mostValuableSetName}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-400 italic">
                            {collector.metadata?.mostValuableCardName || 'most valuable'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4 opacity-50">💎</div>
                <h4 className="text-lg font-medium text-gray-400 mb-2">No valuable collections yet</h4>
                <p className="text-gray-500">Collect valuable cards to rank up!</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Duplicate Collectors Leaderboard */}
        <TabsContent value="duplicate-collectors" className="space-y-4">
          <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Star className="w-5 h-5 mr-2 text-purple-400" />
              Duplicate Collectors
            </h3>
            {communityStats?.leaderboards?.duplicateCollectors && communityStats.leaderboards.duplicateCollectors.length > 0 ? (
              <div className="space-y-3">
                {communityStats.leaderboards.duplicateCollectors.map((collector) => (
                  <div key={collector.userId} className={`flex items-center space-x-3 p-3 rounded-lg border ${getRankBackgroundClass(collector.rank)}`}>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20">
                      <span className="text-sm font-bold text-purple-400">#{collector.rank}</span>
                    </div>
                    {collector.avatarUrl && (
                      <button
                        onClick={() => handleProfileClick(collector.userId)}
                        className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-purple-400 transition-all duration-200 cursor-pointer"
                      >
                        <img
                          src={collector.avatarUrl}
                          alt={collector.displayName || collector.username}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => handleProfileClick(collector.userId)}
                        className="text-left w-full hover:text-purple-400 transition-colors duration-200 cursor-pointer"
                      >
                        <div className="text-sm font-medium text-white truncate hover:text-purple-400">
                          {collector.displayName || collector.username}
                        </div>
                      </button>
                      <div className="text-xs text-gray-400">
                        {collector.metadata?.totalCards} total cards • {collector.metadata?.uniqueCards} unique
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-purple-400">
                        {collector.value} duplicate
                      </div>
                      <div className="text-xs text-gray-400">
                        cards
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4 opacity-50">🔄</div>
                <h4 className="text-lg font-medium text-gray-400 mb-2">No duplicate collectors yet</h4>
                <p className="text-gray-500">Collect duplicate cards to make the list!</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Set Completionists Leaderboard */}
        <TabsContent value="completionists" className="space-y-4">
          <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-orange-400" />
              Set Completionists
            </h3>
            {(() => {
              // Check if any user has 100% completion (completion_percentage = 100)
              const hasFullCompletions = communityStats?.leaderboards?.setCompletionists?.some(collector => {
                // Check if the collector has any metadata indicating 100% completion
                // This could be in completion_percentage or similar field
                const metadata = collector.metadata as any
                return metadata?.completion_percentage === 100
              }) || false

              return hasFullCompletions ? (
                <div className="space-y-3">
                  {communityStats?.leaderboards?.setCompletionists
                    ?.filter(collector => (collector.metadata as any)?.completion_percentage === 100)
                    ?.map((collector) => (
                    <div key={collector.userId} className={`flex items-center space-x-3 p-3 rounded-lg border ${getRankBackgroundClass(collector.rank)}`}>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20">
                        <span className="text-sm font-bold text-orange-400">#{collector.rank}</span>
                      </div>
                      {collector.avatarUrl && (
                        <button
                          onClick={() => handleProfileClick(collector.userId)}
                          className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-orange-400 transition-all duration-200 cursor-pointer"
                        >
                          <img
                            src={collector.avatarUrl}
                            alt={collector.displayName || collector.username}
                            className="w-full h-full rounded-full object-cover"
                          />
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => handleProfileClick(collector.userId)}
                          className="text-left w-full hover:text-orange-400 transition-colors duration-200 cursor-pointer"
                        >
                          <div className="text-sm font-medium text-white truncate hover:text-orange-400">
                            {collector.displayName || collector.username}
                          </div>
                        </button>
                        <div className="text-xs text-gray-400">
                          {collector.metadata?.totalCards} cards • <PriceDisplay
                            amount={collector.metadata?.totalValue || 0}
                            currency="EUR"
                            className="text-xs text-orange-300"
                            showOriginal={false}
                          /> value
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-orange-400">
                          {collector.value} sets
                        </div>
                        <div className="text-xs text-gray-400">
                          100% completed
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4 opacity-50">🏆</div>
                  <h4 className="text-lg font-medium text-gray-400 mb-2">No set completionists yet</h4>
                  <p className="text-gray-500 mb-2">Be the first to complete an entire set!</p>
                  <p className="text-xs text-gray-600">Complete every card in a set to appear on this leaderboard</p>
                </div>
              )
            })()}
          </div>
        </TabsContent>

        {/* Recently Active Leaderboard */}
        <TabsContent value="active" className="space-y-4">
          <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-yellow-400" />
              Recently Active (Last 30 Days)
            </h3>
            {communityStats?.leaderboards?.recentlyActive && communityStats.leaderboards.recentlyActive.length > 0 ? (
              <div className="space-y-3">
                {communityStats.leaderboards.recentlyActive.map((collector) => (
                  <div key={collector.userId} className={`flex items-center space-x-3 p-3 rounded-lg border ${getRankBackgroundClass(collector.rank)}`}>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20">
                      <span className="text-sm font-bold text-yellow-400">#{collector.rank}</span>
                    </div>
                    {collector.avatarUrl && (
                      <button
                        onClick={() => handleProfileClick(collector.userId)}
                        className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-yellow-400 transition-all duration-200 cursor-pointer"
                      >
                        <img
                          src={collector.avatarUrl}
                          alt={collector.displayName || collector.username}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => handleProfileClick(collector.userId)}
                        className="text-left w-full hover:text-yellow-400 transition-colors duration-200 cursor-pointer"
                      >
                        <div className="text-sm font-medium text-white truncate hover:text-yellow-400">
                          {collector.displayName || collector.username}
                        </div>
                      </button>
                      <div className="text-xs text-gray-400">
                        {collector.metadata?.totalCards} total cards • {collector.metadata?.setsCompleted} sets represented
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-yellow-400">
                        +{collector.value}
                      </div>
                      <div className="text-xs text-gray-400">
                        recent cards
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4 opacity-50">⚡</div>
                <h4 className="text-lg font-medium text-gray-400 mb-2">No recent activity</h4>
                <p className="text-gray-500">Add cards to show up here!</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>


      {/* Card Details Modal */}
      <CardDetailsModal
        cardId={selectedCardId}
        isOpen={isCardModalOpen}
        onClose={handleCloseCardModal}
      />
    </div>
  )
}