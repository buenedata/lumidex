'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Friend, FriendRequest } from '@/lib/friends-service'
import { ActivityItem } from '@/lib/profile-service'
import {
  Users,
  UserPlus,
  Calendar,
  Check,
  X,
  Search,
  Activity,
  Heart,
  Trophy,
  ArrowLeftRight,
  Star
} from 'lucide-react'

interface SocialCardProps {
  friends: Friend[]
  friendRequests: FriendRequest[]
  recentActivity: ActivityItem[]
  loading?: boolean
  onAcceptFriend?: (requestId: string) => void
  onDeclineFriend?: (requestId: string) => void
  onRemoveFriend?: (friendshipId: string) => void
}

export function SocialCard({
  friends,
  friendRequests,
  recentActivity,
  loading = false,
  onAcceptFriend,
  onDeclineFriend,
  onRemoveFriend
}: SocialCardProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'activity'>('friends')
  const [searchTerm, setSearchTerm] = useState('')

  if (loading) {
    return (
      <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4 w-1/3"></div>
          <div className="flex space-x-2 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-700 rounded w-20"></div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const filteredFriends = friends.filter(friend =>
    friend.friend.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (friend.friend.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  )

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'card_added': return Heart
      case 'achievement_unlocked': return Trophy
      case 'friend_added': return Users
      case 'trade_completed': return ArrowLeftRight
      case 'set_completed': return Star
      default: return Activity
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'card_added': return 'text-red-400 bg-red-500/20'
      case 'achievement_unlocked': return 'text-yellow-400 bg-yellow-500/20'
      case 'friend_added': return 'text-blue-400 bg-blue-500/20'
      case 'trade_completed': return 'text-green-400 bg-green-500/20'
      case 'set_completed': return 'text-purple-400 bg-purple-500/20'
      default: return 'text-gray-400 bg-gray-500/20'
    }
  }

  const handleCardClick = (activity: ActivityItem) => {
    if (activity.type === 'card_added' && activity.metadata?.setId && activity.metadata?.cardId) {
      // Navigate to set page with card ID as a URL parameter for scrolling
      router.push(`/sets/${activity.metadata.setId}?cardId=${activity.metadata.cardId}`)
    }
  }

  const TabSelector = () => (
    <div className="flex space-x-1 mb-4 bg-pkmn-surface rounded-lg p-1">
      {[
        { key: 'friends', label: 'Friends', count: friends.length, icon: Users },
        { key: 'requests', label: 'Requests', count: friendRequests.length, icon: UserPlus },
        { key: 'activity', label: 'Activity', count: recentActivity.length, icon: Activity }
      ].map(({ key, label, count, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setActiveTab(key as any)}
          className={`flex-1 flex items-center justify-center px-2 py-2 text-xs font-medium rounded-md transition-colors ${
            activeTab === key
              ? 'bg-pokemon-gold text-black'
              : 'text-gray-300 hover:text-white hover:bg-gray-600'
          }`}
        >
          <Icon className="w-3 h-3 mr-1" />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{label.slice(0, 1)}</span>
          {count > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-black/20 min-w-[16px] text-center">
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  const FriendsView = () => (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search friends..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-gaming w-full pl-10"
        />
      </div>

      {/* Friends List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {filteredFriends.length > 0 ? (
          filteredFriends.map((friend) => (
            <div key={friend.id} className="bg-pkmn-surface/30 rounded-lg p-3 hover:bg-pkmn-surface/50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <img
                    src={friend.friend.avatar_url || '/default-avatar.png'}
                    alt={friend.friend.display_name || friend.friend.username}
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-pkmn-surface"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-sm">
                    {friend.friend.display_name || friend.friend.username}
                  </div>
                  <div className="text-xs text-gray-400">
                    @{friend.friend.username}
                  </div>
                  <div className="text-xs text-gray-500">
                    Since {new Date(friend.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 hover:text-red-300 transition-colors"
                    onClick={() => onRemoveFriend?.(friend.friendship_id)}
                  >
                    Remove friend
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{searchTerm ? 'No friends found' : 'No friends yet'}</p>
            {!searchTerm && (
              <p className="text-xs mt-1">Connect with other collectors to start trading!</p>
            )}
          </div>
        )}
      </div>
    </div>
  )

  const RequestsView = () => (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {friendRequests.length > 0 ? (
        friendRequests.map((request) => (
          <div key={request.id} className="bg-pkmn-surface/30 rounded-lg p-3">
            <div className="flex items-center space-x-3">
              <img
                src={request.requester.avatar_url || '/default-avatar.png'}
                alt={request.requester.display_name || request.requester.username}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-600"
              />
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-sm">
                  {request.requester.display_name || request.requester.username}
                </div>
                <div className="text-xs text-gray-400">
                  @{request.requester.username}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onAcceptFriend?.(request.id)}
                  className="p-3 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded-lg transition-colors"
                  title="Accept"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onDeclineFriend?.(request.id)}
                  className="p-3 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                  title="Decline"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-6 text-gray-400">
          <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No pending friend requests</p>
        </div>
      )}
    </div>
  )

  const ActivityView = () => (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {recentActivity.length > 0 ? (
        recentActivity.map((activity) => {
          const Icon = getActivityIcon(activity.type)
          const colorClasses = getActivityColor(activity.type)
          const isCardActivity = activity.type === 'card_added' && activity.metadata?.setId && activity.metadata?.cardId
          const clickableClass = isCardActivity ? 'cursor-pointer hover:bg-pkmn-surface/70' : 'hover:bg-pkmn-surface/50'

          return (
            <div
              key={activity.id}
              className={`bg-pkmn-surface/30 rounded-lg p-3 transition-colors ${clickableClass}`}
              onClick={() => isCardActivity && handleCardClick(activity)}
            >
              <div className="flex items-start space-x-3">
                <div className={`p-1.5 rounded-lg ${colorClasses}`}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-sm">
                    {activity.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {activity.description}
                  </div>
                  {activity.metadata?.setName && (
                    <div className="text-xs text-pokemon-gold mt-0.5">
                      From {activity.metadata.setName}
                    </div>
                  )}
                  <div className="flex items-center space-x-3 mt-1">
                    <div className="text-xs text-gray-500 flex items-center">
                      <Calendar className="w-2 h-2 mr-1" />
                      {new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    {isCardActivity && (
                      <div className="text-xs text-blue-400">
                        Click to view
                      </div>
                    )}
                  </div>
                </div>
                {activity.metadata?.cardImage && (
                  <img
                    src={activity.metadata.cardImage}
                    alt={activity.metadata.cardName}
                    className="w-8 h-10 object-contain rounded border border-gray-600"
                  />
                )}
              </div>
            </div>
          )
        })
      ) : (
        <div className="text-center py-6 text-gray-400">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent activity</p>
          <p className="text-xs mt-1">Start collecting cards to see your activity here!</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="bg-pkmn-card rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Users className="w-4 h-4 mr-2 text-pokemon-gold" />
          Friends
        </h3>
        <button
          onClick={() => router.push('/friends')}
          className="bg-pokemon-gold hover:bg-pokemon-gold-hover text-black text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center"
        >
          <UserPlus className="w-3 h-3 mr-1" />
          Find Friends
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gradient-to-br from-pkmn-surface to-pkmn-dark rounded-lg p-3 border border-gray-700/30 text-center">
          <div className="flex items-center justify-center mb-1">
            <Users className="w-4 h-4 text-blue-400 mr-1" />
            <div className="text-lg font-bold text-blue-400">
              {friends.length}
            </div>
          </div>
          <div className="text-xs text-gray-400">Friends</div>
        </div>
        <div className="bg-gradient-to-br from-pkmn-surface to-pkmn-dark rounded-lg p-3 border border-gray-700/30 text-center">
          <div className="flex items-center justify-center mb-1">
            <UserPlus className="w-4 h-4 text-yellow-400 mr-1" />
            <div className="text-lg font-bold text-yellow-400">
              {friendRequests.length}
            </div>
          </div>
          <div className="text-xs text-gray-400">Requests</div>
        </div>
        <div className="bg-gradient-to-br from-pkmn-surface to-pkmn-dark rounded-lg p-3 border border-gray-700/30 text-center">
          <div className="flex items-center justify-center mb-1">
            <Activity className="w-4 h-4 text-green-400 mr-1" />
            <div className="text-lg font-bold text-green-400">
              {recentActivity.length}
            </div>
          </div>
          <div className="text-xs text-gray-400">Activities</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabSelector />

      {/* Tab Content */}
      {activeTab === 'friends' && <FriendsView />}
      {activeTab === 'requests' && <RequestsView />}
      {activeTab === 'activity' && <ActivityView />}
    </div>
  )
}