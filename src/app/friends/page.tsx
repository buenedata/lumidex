'use client'

import { useState, useEffect, Fragment } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navigation from '@/components/navigation/Navigation'
import { Tab } from '@headlessui/react'
import { friendsService, Friend, FriendRequest } from '@/lib/friends-service'
import { Profile } from '@/types'
import { useNotifications } from '@/hooks/useNotifications'
import { useConfirmation } from '@/contexts/ConfirmationContext'
import { useToast } from '@/components/ui/ToastContainer'
import Image from 'next/image'
import Link from 'next/link'
import {
  Users,
  UserPlus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  UserX,
  Mail
} from 'lucide-react'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

function FriendsContent() {
  const { user } = useAuth()
  const { refreshNotifications } = useNotifications()
  const { confirm } = useConfirmation()
  const { showSuccess, showError, showInfo } = useToast()
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadFriendsData()
    }
  }, [user])

  const loadFriendsData = async () => {
    if (!user) return

    setLoading(true)
    try {
      const [friendsResult, pendingResult, sentResult] = await Promise.all([
        friendsService.getFriends(user.id),
        friendsService.getPendingRequests(user.id),
        friendsService.getSentRequests(user.id)
      ])

      if (friendsResult.success) {
        setFriends(friendsResult.data || [])
      }
      if (pendingResult.success) {
        setPendingRequests(pendingResult.data || [])
      }
      if (sentResult.success) {
        setSentRequests(sentResult.data || [])
      }
    } catch (error) {
      console.error('Error loading friends data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (term: string) => {
    if (!user || term.length < 2) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const result = await friendsService.searchUsers(user.id, term)
      if (result.success) {
        setSearchResults(result.data || [])
      }
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSendFriendRequest = async (addresseeId: string) => {
    if (!user) return

    // Find the user we're sending the request to for the notification
    const targetUser = searchResults.find(u => u.id === addresseeId)
    const userName = targetUser?.display_name || targetUser?.username || 'User'

    setActionLoading(addresseeId)
    try {
      const result = await friendsService.sendFriendRequest(user.id, addresseeId)
      if (result.success) {
        // Show success notification
        showSuccess(
          'Friend request sent!',
          `Your friend request has been sent to ${userName}`
        )
        
        // Remove from search results and refresh sent requests
        setSearchResults(prev => prev.filter(u => u.id !== addresseeId))
        const sentResult = await friendsService.getSentRequests(user.id)
        if (sentResult.success) {
          setSentRequests(sentResult.data || [])
        }
      } else {
        // Show error notification
        showError(
          'Failed to send friend request',
          result.error || 'An error occurred. Please try again.'
        )
      }
    } catch (error) {
      console.error('Error sending friend request:', error)
      // Show error notification
      showError(
        'Failed to send friend request',
        'An error occurred. Please try again.'
      )
    } finally {
      setActionLoading(null)
    }
  }

  const handleAcceptRequest = async (friendshipId: string) => {
    if (!user) return

    const request = pendingRequests.find(r => r.id === friendshipId)
    const userName = request?.requester.display_name || request?.requester.username || 'User'

    setActionLoading(friendshipId)
    try {
      const result = await friendsService.acceptFriendRequest(friendshipId, user.id)
      if (result.success) {
        // Show success notification
        showSuccess(
          'Friend request accepted!',
          `You are now friends with ${userName}`
        )
        
        // Refresh all data and notifications
        await loadFriendsData()
        await refreshNotifications()
      } else {
        // Show error notification
        showError(
          'Failed to accept friend request',
          result.error || 'An error occurred. Please try again.'
        )
      }
    } catch (error) {
      console.error('Error accepting friend request:', error)
      // Show error notification
      showError(
        'Failed to accept friend request',
        'An error occurred. Please try again.'
      )
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeclineRequest = async (friendshipId: string) => {
    if (!user) return

    const request = pendingRequests.find(r => r.id === friendshipId)
    const userName = request?.requester.display_name || request?.requester.username || 'User'

    setActionLoading(friendshipId)
    try {
      const result = await friendsService.declineFriendRequest(friendshipId, user.id)
      if (result.success) {
        // Show success notification
        showInfo(
          'Friend request declined',
          `Declined friend request from ${userName}`
        )
        
        // Remove from pending requests and refresh notifications
        setPendingRequests(prev => prev.filter(r => r.id !== friendshipId))
        await refreshNotifications()
      } else {
        // Show error notification
        showError(
          'Failed to decline friend request',
          result.error || 'An error occurred. Please try again.'
        )
      }
    } catch (error) {
      console.error('Error declining friend request:', error)
      // Show error notification
      showError(
        'Failed to decline friend request',
        'An error occurred. Please try again.'
      )
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemoveFriend = async (friendshipId: string) => {
    if (!user) return

    const confirmed = await confirm({
      title: 'Remove Friend',
      message: 'Are you sure you want to remove this friend?',
      type: 'warning',
      confirmText: 'Remove Friend'
    })

    if (!confirmed) return

    setActionLoading(friendshipId)
    try {
      const result = await friendsService.removeFriend(friendshipId, user.id)
      if (result.success) {
        // Remove from friends list
        setFriends(prev => prev.filter(f => f.friendship_id !== friendshipId))
        showSuccess('Friend Removed', 'The friend has been removed from your friends list.')
      } else {
        showError('Failed to remove friend', result.error || 'An error occurred. Please try again.')
      }
    } catch (error) {
      console.error('Error removing friend:', error)
      showError('Failed to remove friend', 'An error occurred. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchTerm)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  if (loading) {
    return (
      <div className="min-h-screen bg-pkmn-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-gray-700 rounded-xl"></div>
            <div className="h-12 bg-gray-700 rounded-xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-700 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    {
      name: 'Friends',
      icon: Users,
      count: friends.length
    },
    {
      name: 'Requests',
      icon: Mail,
      count: pendingRequests.length
    },
    {
      name: 'Find Friends',
      icon: Search,
      count: null
    }
  ]

  return (
    <Navigation>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-pokemon-gold/20 rounded-xl">
              <Users className="w-8 h-8 text-pokemon-gold" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Friends</h1>
              <p className="text-gray-400">Connect with other Pokemon card collectors</p>
            </div>
          </div>
        </div>

        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-xl bg-pkmn-surface p-1 border border-gray-700/50 mb-8">
            {tabs.map((tab) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  classNames(
                    'w-full rounded-lg py-3 px-4 text-sm font-medium leading-5 transition-all duration-200',
                    'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-pokemon-gold text-black shadow'
                      : 'text-gray-400 hover:bg-pkmn-card hover:text-white'
                  )
                }
              >
                <div className="flex items-center justify-center space-x-2">
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                  {tab.count !== null && tab.count > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {tab.count}
                    </span>
                  )}
                </div>
              </Tab>
            ))}
          </Tab.List>

          <Tab.Panels>
            {/* Friends Panel */}
            <Tab.Panel>
              {friends.length === 0 ? (
                <div className="bg-pkmn-card rounded-xl p-12 border border-gray-700/50 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                  <h3 className="text-xl font-semibold text-gray-400 mb-2">No friends yet</h3>
                  <p className="text-gray-500 mb-6">Start by searching for other collectors to connect with</p>
                  <button
                    onClick={() => {
                      // Switch to Find Friends tab (index 2)
                      const findFriendsTab = document.querySelector('[role="tablist"] button:nth-child(3)') as HTMLButtonElement
                      findFriendsTab?.click()
                    }}
                    className="btn-gaming"
                  >
                    Find Friends
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {friends.map((friend) => (
                    <div key={friend.id} className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50 hover:border-pokemon-gold/30 transition-all duration-200">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="flex-shrink-0">
                          {friend.friend.avatar_url ? (
                            <Image
                              src={friend.friend.avatar_url}
                              alt={friend.friend.username}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded-full border-2 border-gray-600"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-pokemon-gold to-pokemon-gold-hover rounded-full flex items-center justify-center border-2 border-gray-600">
                              <span className="text-lg font-bold text-black">
                                {friend.friend.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate">
                            {friend.friend.display_name || friend.friend.username}
                          </h3>
                          <p className="text-sm text-gray-400 truncate">@{friend.friend.username}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Link
                          href={`/profile/${friend.friend.id}`}
                          className="flex-1 btn-gaming-secondary text-center"
                        >
                          View Profile
                        </Link>
                        <button
                          onClick={() => handleRemoveFriend(friend.friendship_id)}
                          disabled={actionLoading === friend.friendship_id}
                          className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === friend.friendship_id ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <UserX className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Tab.Panel>

            {/* Requests Panel */}
            <Tab.Panel className="space-y-8">
              {/* Pending Requests */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
                  <Mail className="w-5 h-5 text-pokemon-gold" />
                  <span>Friend Requests</span>
                  {pendingRequests.length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                      {pendingRequests.length}
                    </span>
                  )}
                </h2>
                {pendingRequests.length === 0 ? (
                  <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
                    <Mail className="w-12 h-12 mx-auto mb-3 text-gray-400 opacity-50" />
                    <p className="text-gray-400">No pending friend requests</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map((request) => (
                      <div key={request.id} className="bg-pkmn-card rounded-xl p-4 border border-gray-700/50 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            {request.requester.avatar_url ? (
                              <Image
                                src={request.requester.avatar_url}
                                alt={request.requester.username}
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-full border-2 border-gray-600"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-pokemon-gold to-pokemon-gold-hover rounded-full flex items-center justify-center border-2 border-gray-600">
                                <span className="font-bold text-black text-sm">
                                  {request.requester.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium text-white">
                              {request.requester.display_name || request.requester.username}
                            </h3>
                            <p className="text-sm text-gray-400">@{request.requester.username}</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAcceptRequest(request.id)}
                            disabled={actionLoading === request.id}
                            className="btn-gaming-success"
                          >
                            {actionLoading === request.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 mr-1" />
                                Accept
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(request.id)}
                            disabled={actionLoading === request.id}
                            className="btn-gaming-secondary"
                          >
                            {actionLoading === request.id ? (
                              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <>
                                <UserX className="w-4 h-4 mr-1" />
                                Decline
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sent Requests */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-pokemon-gold" />
                  <span>Sent Requests</span>
                  {sentRequests.length > 0 && (
                    <span className="bg-yellow-500 text-black text-xs rounded-full px-2 py-1">
                      {sentRequests.length}
                    </span>
                  )}
                </h2>
                {sentRequests.length === 0 ? (
                  <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400 opacity-50" />
                    <p className="text-gray-400">No sent friend requests</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sentRequests.map((request) => (
                      <div key={request.id} className="bg-pkmn-card rounded-xl p-4 border border-gray-700/50 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            {request.requester.avatar_url ? (
                              <Image
                                src={request.requester.avatar_url}
                                alt={request.requester.username}
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-full border-2 border-gray-600"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-pokemon-gold to-pokemon-gold-hover rounded-full flex items-center justify-center border-2 border-gray-600">
                                <span className="font-bold text-black text-sm">
                                  {request.requester.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium text-white">
                              {request.requester.display_name || request.requester.username}
                            </h3>
                            <p className="text-sm text-gray-400">@{request.requester.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-yellow-400">
                          <Clock className="w-4 h-4" />
                          <span>Pending</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Tab.Panel>

            {/* Find Friends Panel */}
            <Tab.Panel>
              <div className="space-y-6">
                <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                  <div className="flex items-center space-x-3 mb-4">
                    <Search className="w-5 h-5 text-pokemon-gold" />
                    <h2 className="text-lg font-semibold text-white">Search for Friends</h2>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search for users by username or display name..."
                      value={searchTerm}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-3 bg-pkmn-surface border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-transparent"
                    />
                    <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                {searchLoading ? (
                  <div className="bg-pkmn-card rounded-xl p-12 border border-gray-700/50 text-center">
                    <div className="w-8 h-8 border-2 border-pokemon-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Searching...</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="bg-pkmn-card rounded-xl p-12 border border-gray-700/50 text-center">
                    <Search className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                    <p className="text-gray-400">
                      {searchTerm.length < 2 
                        ? 'Enter at least 2 characters to search for users'
                        : 'No users found matching your search'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {searchResults.map((user) => (
                      <div key={user.id} className="bg-pkmn-card rounded-xl p-4 border border-gray-700/50 flex items-center justify-between hover:border-pokemon-gold/30 transition-all duration-200">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            {user.avatar_url ? (
                              <Image
                                src={user.avatar_url}
                                alt={user.username}
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-full border-2 border-gray-600"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-pokemon-gold to-pokemon-gold-hover rounded-full flex items-center justify-center border-2 border-gray-600">
                                <span className="font-bold text-black text-sm">
                                  {user.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium text-white">
                              {user.display_name || user.username}
                            </h3>
                            <p className="text-sm text-gray-400">@{user.username}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSendFriendRequest(user.id)}
                          disabled={actionLoading === user.id}
                          className="btn-gaming flex items-center space-x-2"
                        >
                          {actionLoading === user.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              <span>Send Request</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </Navigation>
  )
}

export default function FriendsPage() {
  return (
    <ProtectedRoute>
      <FriendsContent />
    </ProtectedRoute>
  )
}