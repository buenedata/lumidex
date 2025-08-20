'use client'

import { useState, useEffect } from 'react'
import { CollectionStats } from '@/lib/collection-stats-service'
import { Friend } from '@/lib/friends-service'
import { PriceDisplay } from '@/components/PriceDisplay'
import { useProfile } from '@/contexts/ProfileContext'
import { optimizedCommunityStatsService } from '@/lib/community-stats-service-optimized'
import {
  Users,
  TrendingUp,
  BarChart3,
  Trophy,
  Star,
  ArrowRight,
  Search,
  Target
} from 'lucide-react'

interface CollectionComparisonProps {
  userStats: CollectionStats
  friends: Friend[]
  onCompareFriend?: (friendId: string) => void
}

export function CollectionComparison({ userStats, friends, onCompareFriend }: CollectionComparisonProps) {
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [userRank, setUserRank] = useState<number | null>(null)
  const { profile } = useProfile()

  const filteredFriends = friends.filter(friend =>
    friend.friend.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (friend.friend.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  )

  // Fetch user's ranking from leaderboards
  useEffect(() => {
    const fetchUserRank = async () => {
      if (!profile?.id) return
      
      try {
        const result = await optimizedCommunityStatsService.getAllLeaderboards()
        if (result.success && result.data) {
          // Check most valuable leaderboard for user's rank
          const userEntry = result.data.mostValuable.find(entry => entry.userId === profile.id)
          if (userEntry) {
            setUserRank(userEntry.rank)
          }
        }
      } catch (error) {
        console.error('Error fetching user rank:', error)
      }
    }

    fetchUserRank()
  }, [profile?.id])

  const ComparisonCard = ({ friend }: { friend: Friend }) => (
    <div className="bg-pkmn-surface/30 rounded-lg p-3 hover:bg-pkmn-surface/50 transition-colors">
      <div className="flex items-center space-x-3">
        <img
          src={friend.friend.avatar_url || '/default-avatar.png'}
          alt={friend.friend.display_name || friend.friend.username}
          className="w-8 h-8 rounded-full object-cover border border-gray-600"
        />
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium text-sm truncate">
            {friend.friend.display_name || friend.friend.username}
          </div>
          <div className="text-xs text-gray-400 truncate">
            @{friend.friend.username}
          </div>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <div className="text-center">
            <div className="font-bold text-pokemon-gold">
              {Math.floor(Math.random() * 500) + 100}
            </div>
            <div className="text-gray-400">Cards</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-green-400">
              <PriceDisplay
                amount={Math.random() * 1000 + 200}
                currency="EUR"
                className="text-xs font-bold"
                showOriginal={false}
              />
            </div>
            <div className="text-gray-400">Value</div>
          </div>
        </div>
        <button
          onClick={() => onCompareFriend?.(friend.friend_id)}
          className="btn-outline btn-xs flex items-center"
        >
          <BarChart3 className="w-3 h-3 mr-1" />
          Compare
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header with Icon */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-pokemon-gold/20 rounded-lg">
          <Users className="w-5 h-5 text-pokemon-gold" />
        </div>
        <h2 className="text-xl font-semibold text-white">Collection Comparison</h2>
      </div>

      {/* Compact Your Collection Stats */}
      <div className="bg-pkmn-card rounded-xl p-4 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-3">Your Collection</h3>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-xl font-bold text-pokemon-gold">
              {userStats.totalCards}
            </div>
            <div className="text-xs text-gray-400">Total Cards</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-400">
              <PriceDisplay
                amount={userStats.totalValueEur}
                currency="EUR"
                className="text-xl font-bold"
                showOriginal={false}
              />
            </div>
            <div className="text-xs text-gray-400">Value</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-purple-400">
              {userStats.setsWithCards}
            </div>
            <div className="text-xs text-gray-400">Sets Represented</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-blue-400">
              {userStats.uniqueCards}
            </div>
            <div className="text-xs text-gray-400">Unique Cards</div>
          </div>
        </div>
      </div>

      {/* Compact Friends Comparison */}
      <div className="bg-pkmn-card rounded-xl p-4 border border-gray-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Compare with Friends</h3>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-pokemon-gold" />
            <span className="text-sm text-gray-400">
              #{userRank || '?'} rank
            </span>
            <span className="text-sm text-green-400">
              +{Math.floor(Math.random() * 20) + 5}% growth
            </span>
          </div>
        </div>
        
        {/* Compact Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search friends to compare..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-pkmn-surface border border-gray-600 rounded-lg px-10 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-transparent"
          />
        </div>

        {/* Compact Friends List */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {filteredFriends.length > 0 ? (
            filteredFriends.map((friend) => (
              <ComparisonCard key={friend.id} friend={friend} />
            ))
          ) : (
            <div className="text-center py-4 text-gray-400">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{searchTerm ? 'No friends found' : 'No friends to compare with'}</p>
              {!searchTerm && (
                <p className="text-xs mt-1">Add friends to compare collections!</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}