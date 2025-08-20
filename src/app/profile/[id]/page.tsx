'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Navigation from '@/components/navigation/Navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { CollectionStatsCard } from '@/components/profile/CollectionStatsCard'
import { AchievementsCard } from '@/components/profile/AchievementsCard'
import { profileService } from '@/lib/profile-service'
import { achievementService, AchievementProgress } from '@/lib/achievement-service'
import { friendsService } from '@/lib/friends-service'
import { CollectionStats } from '@/lib/collection-stats-service'
import { Profile } from '@/types'
import { useNotifications } from '@/hooks/useNotifications'
import { loadingStateManager } from '@/lib/loading-state-manager'
import { EnhancedErrorBoundary } from '@/components/ui/EnhancedErrorBoundary'
import {
  User,
  ArrowLeft,
  Lock,
  BarChart3,
  Trophy
} from 'lucide-react'

interface PublicProfileData {
  profile: Profile
  stats?: CollectionStats
}

function UserProfileContent() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { refreshNotifications } = useNotifications()
  const userId = params.id as string

  const [profileData, setProfileData] = useState<PublicProfileData | null>(null)
  const [achievementProgress, setAchievementProgress] = useState<AchievementProgress[]>([])
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'friends' | 'blocked'>('none')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Redirect if trying to view own profile
  useEffect(() => {
    if (user && userId === user.id) {
      router.push('/profile')
      return
    }
  }, [user, userId, router])

  useEffect(() => {
    if (userId && user) {
      loadProfileData()
      checkFriendshipStatus()
    }
  }, [userId, user])

  // Refresh friendship status when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && userId && user) {
        checkFriendshipStatus()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [userId, user])

  const loadProfileData = async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    const loadingKey = `profile-${userId}`
    
    const result = await loadingStateManager.executeWithTimeout(
      loadingKey,
      async () => {
        // Get public profile data
        const profileResult = await profileService.getPublicProfile(userId)
        
        let achievementProgress: AchievementProgress[] = []
        if (profileResult.success && profileResult.data &&
            profileResult.data.profile.privacy_level === 'public') {
          const progressResult = await achievementService.getAchievementProgress(userId)
          if (progressResult.success && progressResult.data) {
            achievementProgress = progressResult.data
          }
        }
        
        return { profileResult, achievementProgress }
      },
      {
        timeout: 3000, // 3 second timeout - fast UX
        maxRetries: 1
      }
    )

    try {
      if (result.success && result.data) {
        const { profileResult, achievementProgress } = result.data
        
        if (profileResult.success && profileResult.data) {
          // Transform the data to match the expected format
          const transformedProfile: Profile = {
            ...profileResult.data.profile,
            privacy_level: profileResult.data.profile.privacy_level as 'public' | 'friends' | 'private',
            show_collection_value: true,
            preferred_currency: 'EUR',
            preferred_language: 'en',
            updated_at: new Date().toISOString()
          }

          const transformedStats: CollectionStats | undefined = profileResult.data.stats ? {
            totalCards: profileResult.data.stats.totalCards,
            uniqueCards: profileResult.data.stats.uniqueCards,
            setsWithCards: profileResult.data.stats.setsWithCards,
            totalSets: 0, // Not available in public stats
            totalValueEur: 0, // Not available in public stats
            averageCardValue: 0,
            completionPercentage: 0,
            rarityBreakdown: {},
            setProgress: [],
            topValueCards: profileResult.data.stats.topValueCards || [],
            recentAdditions: [],
            collectionGrowth: []
          } : undefined
          
          const transformedData: PublicProfileData = {
            profile: transformedProfile,
            stats: transformedStats
          }
          
          setProfileData(transformedData)
          setAchievementProgress(achievementProgress)
        } else {
          setError(profileResult.error || 'Profile not found or is private')
        }
      } else {
        setError(result.error || 'Failed to load profile')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const checkFriendshipStatus = async () => {
    if (!user || !userId) return

    try {
      const result = await friendsService.getFriendshipStatus(user.id, userId)
      if (result.success && result.status) {
        // Map the friendship status to our local state
        if (result.status === 'pending_sent') {
          setFriendshipStatus('pending')
        } else if (result.status === 'pending_received') {
          setFriendshipStatus('pending')
        } else if (result.status === 'friends') {
          setFriendshipStatus('friends')
        } else if (result.status === 'blocked') {
          setFriendshipStatus('blocked')
        } else {
          setFriendshipStatus('none')
        }
      }
    } catch (err) {
      console.error('Error checking friendship status:', err)
    }
  }

  const handleSendFriendRequest = async () => {
    if (!user || !userId) return

    setActionLoading(true)
    try {
      const result = await friendsService.sendFriendRequest(user.id, userId)
      if (result.success) {
        setFriendshipStatus('pending')
        await refreshNotifications()
        setTimeout(() => checkFriendshipStatus(), 1000)
      } else {
        setError(result.error || 'Failed to send friend request')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveFriend = async () => {
    if (!user || !userId) return

    setActionLoading(true)
    try {
      // Get friends list to find the friendship ID
      const friendsResult = await friendsService.getFriends(user.id)
      if (friendsResult.success && friendsResult.data) {
        const friendship = friendsResult.data.find(friend => friend.friend_id === userId)
        if (friendship) {
          const result = await friendsService.removeFriend(friendship.friendship_id, user.id)
          if (result.success) {
            setFriendshipStatus('none')
            await refreshNotifications()
            setTimeout(() => checkFriendshipStatus(), 1000)
          } else {
            setError(result.error || 'Failed to remove friend')
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-pkmn-dark">
        <Navigation>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-64 bg-gray-700 rounded-xl"></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-96 bg-gray-700 rounded-xl"></div>
                <div className="h-96 bg-gray-700 rounded-xl"></div>
              </div>
            </div>
          </div>
        </Navigation>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-pkmn-dark">
        <Navigation>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
              <Lock className="w-16 h-16 mx-auto mb-4 text-red-400 opacity-50" />
              <h2 className="text-xl font-bold text-red-400 mb-2">Profile Not Available</h2>
              <p className="text-red-300 mb-4">{error}</p>
              <button
                onClick={loadProfileData}
                className="btn-gaming"
              >
                Try Again
              </button>
            </div>
          </div>
        </Navigation>
      </div>
    )
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-pkmn-dark">
        <Navigation>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-gray-400">
              <p>Profile not found</p>
            </div>
          </div>
        </Navigation>
      </div>
    )
  }

  const isPublicProfile = profileData.profile.privacy_level === 'public'

  return (
    <Navigation>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <Tabs defaultValue="overview" className="w-full">
          <ProfileHeader
            profile={profileData.profile}
            collectionStats={profileData.stats}
            achievementStats={null}
            isOwnProfile={false}
            onAvatarChange={() => {}}
            onBannerChange={() => {}}
            onOpenSettings={() => {}}
            friendshipStatus={friendshipStatus}
            onFriendAction={friendshipStatus === 'friends' ? handleRemoveFriend : handleSendFriendRequest}
            friendActionLoading={actionLoading}
          />

          {/* Privacy Notice */}
          {!isPublicProfile && (
            <div className="mb-8 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center gap-3">
              <Lock className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-yellow-400 font-medium">Private Profile</p>
                <p className="text-yellow-300 text-sm">This user has limited their profile visibility.</p>
              </div>
            </div>
          )}

          {/* Tab Content - Only show if public profile */}
          {isPublicProfile && (
            <div className="py-8">
              {/* Overview Tab - Main Dashboard */}
              <TabsContent value="overview" className="space-y-8 mt-0">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* Collection Stats */}
                  {profileData.stats && (
                    <CollectionStatsCard
                      stats={profileData.stats}
                      loading={false}
                    />
                  )}

                  {/* Achievements */}
                  {achievementProgress.length > 0 && (
                    <AchievementsCard
                      stats={{
                        totalAchievements: achievementProgress.length,
                        unlockedAchievements: achievementProgress.filter(a => a.unlocked).length,
                        totalPoints: 0,
                        completionPercentage: 0,
                        recentAchievements: [],
                        categoryStats: {
                          collection: { unlocked: 0, total: 0 },
                          social: { unlocked: 0, total: 0 },
                          trading: { unlocked: 0, total: 0 },
                          special: { unlocked: 0, total: 0 }
                        }
                      }}
                      progress={achievementProgress}
                      loading={false}
                    />
                  )}
                </div>
              </TabsContent>

              {/* Collection Tab - Detailed Collection View */}
              <TabsContent value="collection" className="space-y-8 mt-0">
                {profileData.stats ? (
                  <CollectionStatsCard
                    stats={profileData.stats}
                    loading={false}
                  />
                ) : (
                  <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                    <h3 className="text-xl font-semibold text-gray-400 mb-2">No Collection Data</h3>
                    <p className="text-gray-500">This user hasn't shared their collection details.</p>
                  </div>
                )}
              </TabsContent>

              {/* Achievements Tab */}
              <TabsContent value="achievements" className="space-y-8 mt-0">
                {achievementProgress.length > 0 ? (
                  <AchievementsCard
                    stats={{
                      totalAchievements: achievementProgress.length,
                      unlockedAchievements: achievementProgress.filter(a => a.unlocked).length,
                      totalPoints: 0,
                      completionPercentage: 0,
                      recentAchievements: [],
                      categoryStats: {
                        collection: { unlocked: 0, total: 0 },
                        social: { unlocked: 0, total: 0 },
                        trading: { unlocked: 0, total: 0 },
                        special: { unlocked: 0, total: 0 }
                      }
                    }}
                    progress={achievementProgress}
                    loading={false}
                  />
                ) : (
                  <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
                    <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                    <h3 className="text-xl font-semibold text-gray-400 mb-2">No Achievements Yet</h3>
                    <p className="text-gray-500">This user hasn't unlocked any achievements yet.</p>
                  </div>
                )}
              </TabsContent>
            </div>
          )}
        </Tabs>
      </div>
    </Navigation>
  )
}

export default function UserProfilePage() {
  return <UserProfileContent />
}