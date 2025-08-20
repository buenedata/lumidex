'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/contexts/ProfileContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navigation from '@/components/navigation/Navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { CollectionStatsCard } from '@/components/profile/CollectionStatsCard'
import { AchievementsCard } from '@/components/profile/AchievementsCard'
import { SocialCard } from '@/components/profile/SocialCard'
import { CollectionComparison } from '@/components/profile/CollectionComparison'
import { ProfileShare } from '@/components/profile/ProfileShare'
import { AccountSettings } from '@/components/profile/AccountSettings'
import { WishlistCard } from '@/components/profile/WishlistCard'
import { CardDetailsModal } from '@/components/pokemon/CardDetailsModal'
import { profileService, ProfileData } from '@/lib/profile-service'
import { achievementService, AchievementProgress } from '@/lib/achievement-service'
import { friendsService } from '@/lib/friends-service'
import { useNotifications } from '@/hooks/useNotifications'
import { useToast } from '@/components/ui/ToastContainer'
import { useTabVisibility } from '@/hooks/useTabVisibility'
import {
  User,
  Camera,
  Upload,
  Save,
  Mail,
  Calendar,
  MapPin,
  Globe,
  Twitter,
  Instagram,
  Shield,
  Bell,
  Eye,
  Lock,
  Trash2,
  Image as ImageIcon,
  BarChart3,
  Trophy,
  Users,
  Activity,
  TrendingUp,
  Star
} from 'lucide-react'

function ProfileContent() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { profileData, loading, error, refreshProfile, updateProfileData } = useProfile()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [achievementProgress, setAchievementProgress] = useState<AchievementProgress[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCheckingAchievements, setIsCheckingAchievements] = useState(false)
  const { refreshNotifications } = useNotifications()
  const { showSuccess, showError } = useToast()
  
  // Tab visibility hook
  const isTabVisible = useTabVisibility()
  const [hasInitialData, setHasInitialData] = useState(false)

  // Check for settings tab parameter
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'settings') {
      setIsSettingsOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (user && profileData) {
      // Load achievement progress
      loadAchievementProgress()
      setHasInitialData(true)
    }
  }, [user, profileData])

  // Handle tab visibility changes - refresh data when returning to tab
  useEffect(() => {
    if (user && hasInitialData && isTabVisible) {
      // Background refresh when tab becomes visible again
      refreshProfile()
    }
  }, [isTabVisible, user, hasInitialData, refreshProfile])

  const loadAchievementProgress = async () => {
    if (!user) return

    try {
      const progressResult = await achievementService.getAchievementProgress(user.id)
      if (progressResult.success && progressResult.data) {
        setAchievementProgress(progressResult.data)
      }
    } catch (err) {
      console.error('Error loading achievement progress:', err)
    }
  }


  const handleAvatarChange = async (file: File) => {
    if (!user) return

    try {
      const result = await profileService.updateAvatar(user.id, file)
      if (result.success) {
        await refreshProfile() // Reload to get updated avatar
      } else {
        console.error(result.error || 'Failed to update avatar')
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleBannerChange = async (file: File) => {
    if (!user) return

    try {
      const result = await profileService.updateBanner(user.id, file)
      if (result.success) {
        await refreshProfile() // Reload to get updated banner
      } else {
        console.error(result.error || 'Failed to update banner')
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleAcceptFriend = async (requestId: string) => {
    if (!user) return

    try {
      const result = await friendsService.acceptFriendRequest(requestId, user.id)
      if (result.success) {
        await refreshProfile() // Reload to update friends list
        await refreshNotifications() // Refresh notification count
      } else {
        console.error(result.error || 'Failed to accept friend request')
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleDeclineFriend = async (requestId: string) => {
    if (!user) return

    try {
      const result = await friendsService.declineFriendRequest(requestId, user.id)
      if (result.success) {
        await refreshProfile() // Reload to update requests list
        await refreshNotifications() // Refresh notification count
      } else {
        console.error(result.error || 'Failed to decline friend request')
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleRemoveFriend = async (friendshipId: string) => {
    if (!user) return

    try {
      const result = await friendsService.removeFriend(friendshipId, user.id)
      if (result.success) {
        await refreshProfile() // Reload to update friends list
      } else {
        console.error(result.error || 'Failed to remove friend')
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleViewDetails = (cardId: string) => {
    setSelectedCardId(cardId)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedCardId(null)
  }

  const handleCollectionChange = async (cardId: string, collectionData: any) => {
    // Handle collection changes - refresh achievement progress and profile data
    console.log('Collection changed for card:', cardId, collectionData)
    
    // Refresh achievement progress to reflect any changes
    await loadAchievementProgress()
    
    // Refresh profile data to update collection stats and achievement stats
    await refreshProfile()
  }

  const handleWishlistChange = async () => {
    // Handle wishlist changes - refresh profile data to update wishlist
    console.log('Wishlist changed, refreshing profile data')
    await refreshProfile()
  }

  const handleRemoveWishlistItem = async (itemId: string) => {
    // Handle wishlist item removal - refresh profile data to update wishlist
    console.log('Wishlist item removed:', itemId)
    await refreshProfile()
  }

  const handleManualAchievementCheck = async () => {
    if (!user) return

    setIsCheckingAchievements(true)
    try {
      console.log('🔧 Manually checking achievements for user:', user.id)
      
      const response = await fetch('/api/achievements/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      })

      if (!response.ok) {
        throw new Error('Failed to check achievements')
      }

      const result = await response.json()
      console.log('✅ Achievement check result:', result)

      // Log debug information
      if (result.debug) {
        console.log('🔍 Debug info:')
        console.log('  User stats:', result.debug.userStats)
        console.log('  Current achievements:', result.debug.currentAchievements)
        console.log('  Check result:', result.debug.checkResult)
      }

      if (result.newAchievements && result.newAchievements.length > 0) {
        showSuccess(
          'Achievements Unlocked!',
          `You unlocked ${result.newAchievements.length} new achievement${result.newAchievements.length > 1 ? 's' : ''}!`
        )
        
        // Refresh achievement progress and profile data
        await loadAchievementProgress()
        await refreshProfile()
      } else {
        // Show more detailed message with debug info
        const debugInfo = result.debug
        let message = 'All achievements are up to date!'
        
        if (debugInfo?.userStats?.data) {
          const stats = debugInfo.userStats.data
          message += `\n\nYour stats:\n- Completed trades: ${stats.completed_trades || 0}\n- Total cards: ${stats.total_cards || 0}\n- Friends: ${stats.friends || 0}`
        }
        
        showSuccess(
          'Achievements Checked',
          message
        )
      }
    } catch (error) {
      console.error('Error checking achievements:', error)
      showError(
        'Achievement Check Failed',
        'There was an error checking your achievements. Please try again.'
      )
    } finally {
      setIsCheckingAchievements(false)
    }
  }

  const handleTogglePublic = async (isPublic: boolean) => {
    if (!user) return

    try {
      const privacy_level = isPublic ? 'public' : 'private'
      
      // Optimistically update the UI first
      updateProfileData({ privacy_level })
      
      const result = await profileService.updateProfile(user.id, { privacy_level })
      
      if (result.success) {
        showSuccess(
          'Privacy Updated',
          `Your profile is now ${isPublic ? 'public' : 'private'}`
        )
      } else {
        // Revert the optimistic update on error
        updateProfileData({ privacy_level: isPublic ? 'private' : 'public' })
        showError(
          'Update Failed',
          result.error || 'Failed to update privacy settings'
        )
      }
    } catch (error) {
      // Revert the optimistic update on error
      updateProfileData({ privacy_level: isPublic ? 'private' : 'public' })
      console.error('Error updating privacy:', error)
      showError(
        'Update Failed',
        'There was an error updating your privacy settings. Please try again.'
      )
    }
  }

  if (loading && !hasInitialData) {
    return (
      <div className="min-h-screen bg-pkmn-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-64 bg-gray-700 rounded-xl"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-gray-700 rounded-xl"></div>
              <div className="h-96 bg-gray-700 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-pkmn-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Profile</h2>
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={refreshProfile}
              className="btn-gaming"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-pkmn-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-400">
            <p>Profile data not available</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Navigation>
      {/* Enhanced Profile Header with Integrated Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="overview" className="w-full" urlParam="tab">
          <ProfileHeader
            profile={profileData.profile}
            collectionStats={profileData.collectionStats}
            achievementStats={profileData.achievementStats}
            isOwnProfile={true}
            onAvatarChange={handleAvatarChange}
            onBannerChange={handleBannerChange}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          {/* Tab Content */}
          <div className="py-8">
              {/* Overview Tab - Main Dashboard */}
              <TabsContent value="overview" className="space-y-6 mt-0">
                {/* Collection Stats */}
                {profileData.collectionStats && (
                  <CollectionStatsCard
                    stats={profileData.collectionStats}
                    loading={false}
                    onViewDetails={handleViewDetails}
                  />
                )}

                {/* Achievements */}
                {profileData.achievementStats && (
                  <AchievementsCard
                    stats={profileData.achievementStats}
                    progress={achievementProgress}
                    loading={false}
                  />
                )}

                {/* Social Activity */}
                <SocialCard
                  friends={profileData.friends}
                  friendRequests={profileData.friendRequests}
                  recentActivity={profileData.recentActivity}
                  loading={false}
                  onAcceptFriend={handleAcceptFriend}
                  onDeclineFriend={handleDeclineFriend}
                  onRemoveFriend={handleRemoveFriend}
                />
              </TabsContent>

              {/* Collection Tab - Detailed Collection View */}
              <TabsContent value="collection" className="space-y-8 mt-0">
                {profileData.collectionStats ? (
                  <CollectionStatsCard
                    stats={profileData.collectionStats}
                    loading={false}
                    onViewDetails={handleViewDetails}
                  />
                ) : (
                  <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                    <h3 className="text-xl font-semibold text-gray-400 mb-2">No Collection Data</h3>
                    <p className="text-gray-500">Start adding cards to see your collection statistics.</p>
                  </div>
                )}
              </TabsContent>

              {/* Wishlist Tab */}
              <TabsContent value="wishlist" className="space-y-8 mt-0">
                {profileData.wishlistItems || profileData.wishlistStats ? (
                  <WishlistCard
                    wishlistItems={profileData.wishlistItems || []}
                    stats={profileData.wishlistStats}
                    loading={false}
                    onRemoveItem={handleRemoveWishlistItem}
                    onViewDetails={handleViewDetails}
                    userId={user?.id}
                  />
                ) : (
                  <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
                    <Star className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                    <h3 className="text-xl font-semibold text-gray-400 mb-2">No Wishlist Items</h3>
                    <p className="text-gray-500">Start adding cards you want to acquire.</p>
                  </div>
                )}
              </TabsContent>

              {/* Achievements Tab */}
              <TabsContent value="achievements" className="space-y-8 mt-0">
                {/* Manual Achievement Check Button */}
                <div className="bg-pkmn-card rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">Achievement Check</h3>
                      <p className="text-sm text-gray-400">Manually check for any missing achievements</p>
                    </div>
                    <button
                      onClick={handleManualAchievementCheck}
                      disabled={isCheckingAchievements}
                      className="px-4 py-2 bg-pokemon-gold hover:bg-pokemon-gold/90 disabled:bg-pokemon-gold/50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                      {isCheckingAchievements ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                          <span>Checking...</span>
                        </>
                      ) : (
                        <>
                          <Trophy className="w-4 h-4" />
                          <span>Check Achievements</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {profileData.achievementStats ? (
                  <AchievementsCard
                    stats={profileData.achievementStats}
                    progress={achievementProgress}
                    loading={false}
                  />
                ) : (
                  <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
                    <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                    <h3 className="text-xl font-semibold text-gray-400 mb-2">No Achievements Yet</h3>
                    <p className="text-gray-500">Complete actions to unlock achievements.</p>
                  </div>
                )}
              </TabsContent>

              {/* Social Tab */}
              <TabsContent value="social" className="space-y-8 mt-0">
                <SocialCard
                  friends={profileData.friends}
                  friendRequests={profileData.friendRequests}
                  recentActivity={profileData.recentActivity}
                  loading={false}
                  onAcceptFriend={handleAcceptFriend}
                  onDeclineFriend={handleDeclineFriend}
                  onRemoveFriend={handleRemoveFriend}
                />
              </TabsContent>

              {/* Compare Tab */}
              <TabsContent value="compare" className="space-y-8 mt-0">
                {profileData.collectionStats ? (
                  <CollectionComparison
                    userStats={profileData.collectionStats}
                    friends={profileData.friends}
                    onCompareFriend={(friendId) => {
                      // TODO: Implement detailed comparison view
                      console.log('Compare with friend:', friendId)
                    }}
                  />
                ) : (
                  <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
                    <Users className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
                    <h3 className="text-xl font-semibold text-gray-400 mb-2">No Collection to Compare</h3>
                    <p className="text-gray-500">Start building your collection to compare with friends.</p>
                  </div>
                )}
              </TabsContent>

              {/* Share Tab */}
              <TabsContent value="share" className="space-y-8 mt-0">
                <ProfileShare
                  profile={profileData.profile}
                  collectionStats={profileData.collectionStats}
                  achievementStats={profileData.achievementStats}
                  isPublic={profileData.profile.privacy_level === 'public'}
                  onTogglePublic={handleTogglePublic}
                />
              </TabsContent>

          </div>
        </Tabs>

        {/* Account Settings Modal */}
        {profileData && (
          <AccountSettings
            profileData={profileData}
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onProfileUpdate={refreshProfile}
          />
        )}

        {/* Card Details Modal */}
        <CardDetailsModal
          cardId={selectedCardId}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onCollectionChange={handleCollectionChange}
          onWishlistChange={handleWishlistChange}
        />
      </div>
    </Navigation>
  )
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  )
}