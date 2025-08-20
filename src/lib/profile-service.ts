import { supabase } from './supabase'
import { collectionStatsService, CollectionStats } from './collection-stats-service'
import { achievementService, AchievementStats } from './achievement-service'
import { friendsService, Friend, FriendRequest } from './friends-service'
import { wishlistService, WishlistItemWithCard, WishlistStats } from './wishlist-service'
import { wishlistListsService } from './wishlist-lists-service'
import { Profile } from '@/types'

export interface ProfileData {
  profile: Profile
  collectionStats: CollectionStats | null
  achievementStats: AchievementStats | null
  friends: Friend[]
  friendRequests: FriendRequest[]
  recentActivity: ActivityItem[]
  wishlistItems: WishlistItemWithCard[]
  wishlistStats: WishlistStats | null
}

export interface ActivityItem {
  id: string
  type: 'card_added' | 'achievement_unlocked' | 'friend_added' | 'trade_completed' | 'set_completed'
  title: string
  description: string
  timestamp: string
  metadata?: {
    cardId?: string
    cardName?: string
    cardImage?: string
    setId?: string
    setName?: string
    achievementType?: string
    friendId?: string
    friendName?: string
    tradeId?: string
  }
}

export interface ProfileInsights {
  collectionGrowthTrend: 'up' | 'down' | 'stable'
  topCollectionCategory: string
  nextAchievement: {
    type: string
    name: string
    progress: number
    required: number
  } | null
  socialRank: number
  collectionRank: number
  suggestions: string[]
}

class ProfileService {
  /**
   * Ensure user profile exists, create if it doesn't
   */
  async ensureProfile(userId: string, userEmail?: string): Promise<{ success: boolean; error?: string; data?: Profile }> {
    try {
      // First try to get existing profile
      const { data: existingProfile, error: getError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (existingProfile) {
        return { success: true, data: existingProfile as Profile }
      }

      // If profile doesn't exist, create it
      if (getError?.code === 'PGRST116') { // No rows returned
        const username = userEmail?.split('@')[0] || `user_${userId.slice(0, 8)}`
        
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            username: username,
            display_name: username,
            privacy_level: 'public',
            show_collection_value: true,
            preferred_currency: 'EUR',
            preferred_language: 'en',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (createError) {
          return { success: false, error: createError.message }
        }

        return { success: true, data: newProfile as Profile }
      }

      return { success: false, error: getError?.message || 'Unknown error' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get comprehensive profile data for a user
   */
  async getProfileData(userId: string, userEmail?: string): Promise<{ success: boolean; error?: string; data?: ProfileData }> {
    try {
      // Ensure profile exists first
      const profileResult = await this.ensureProfile(userId, userEmail)
      if (!profileResult.success || !profileResult.data) {
        return { success: false, error: profileResult.error || 'Failed to create/get profile' }
      }

      const profile = profileResult.data

      // Get collection stats
      const collectionStatsResult = await collectionStatsService.getCollectionStats(userId)
      const collectionStats = collectionStatsResult.success ? collectionStatsResult.data || null : null

      // Get achievement stats
      const achievementStatsResult = await achievementService.getAchievementStats(userId)
      const achievementStats = achievementStatsResult.success ? achievementStatsResult.data || null : null

      // Get friends
      const friendsResult = await friendsService.getFriends(userId, { limit: 50 })
      const friends = friendsResult.success ? friendsResult.data || [] : []

      // Get friend requests
      const friendRequestsResult = await friendsService.getPendingRequests(userId)
      const friendRequests = friendRequestsResult.success ? friendRequestsResult.data || [] : []

      // Get wishlist data from all lists - gracefully handle missing table
      let wishlistItems: WishlistItemWithCard[] = []
      let wishlistStats: WishlistStats | null = null
      
      try {
        // Get all wishlist lists for the user
        const listsResult = await wishlistListsService.getUserWishlistLists(userId, false)
        
        if (listsResult.success && listsResult.data && listsResult.data.length > 0) {
          // Get items from all lists (limit to 12 total for profile display)
          const allItems: WishlistItemWithCard[] = []
          
          for (const list of listsResult.data) {
            const listItemsResult = await wishlistListsService.getWishlistItemsFromList(list.id, {
              limit: 50, // Load more items per list to ensure filtering works
              sortBy: 'created_at',
              sortOrder: 'desc'
            })
            
            if (listItemsResult.success && listItemsResult.data) {
              // Transform the data to match WishlistItemWithCard format
              const transformedItems = listItemsResult.data.map(item => ({
                id: item.id,
                user_id: userId,
                card_id: item.card_id,
                wishlist_list_id: list.id, // Include the list ID for filtering
                priority: item.priority,
                max_price_eur: item.max_price_eur,
                condition_preference: item.condition_preference,
                notes: item.notes,
                created_at: item.created_at,
                updated_at: item.updated_at,
                card: item.cards
              }))
              allItems.push(...transformedItems)
            }
          }
          
          // Sort by creation date but don't limit here - let the component handle display limits
          wishlistItems = allItems
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          
          // Get combined stats across all lists
          const statsResult = await wishlistService.getWishlistStats(userId)
          wishlistStats = statsResult.success ? statsResult.data || null : null
        }
      } catch (error) {
        console.error('Error loading wishlist data for profile (gracefully ignoring):', error)
        // Gracefully handle wishlist table issues - don't fail profile creation
        // New users may not have wishlists yet, and that's perfectly fine
        try {
          // Try fallback method only if it's a different error
          const fallbackResult = await wishlistService.getUserWishlist(userId, { limit: 12 })
          wishlistItems = fallbackResult.success ? fallbackResult.data || [] : []
          
          const fallbackStatsResult = await wishlistService.getWishlistStats(userId)
          wishlistStats = fallbackStatsResult.success ? fallbackStatsResult.data || null : null
        } catch (fallbackError) {
          console.warn('Fallback wishlist loading also failed (ignoring):', fallbackError)
          // Completely ignore wishlist errors during profile creation
          wishlistItems = []
          wishlistStats = null
        }
      }

      // Get recent activity
      const recentActivity = await this.getRecentActivity(userId)

      return {
        success: true,
        data: {
          profile: profile as Profile,
          collectionStats,
          achievementStats,
          friends,
          friendRequests,
          recentActivity,
          wishlistItems,
          wishlistStats
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get recent activity for a user
   */
  async getRecentActivity(userId: string, limit: number = 20): Promise<ActivityItem[]> {
    try {
      const activities: ActivityItem[] = []

      // Get recent collection additions
      const { data: recentCards } = await supabase
        .from('user_collections')
        .select(`
          id,
          created_at,
          quantity,
          cards!inner(
            id,
            name,
            image_small,
            set_id,
            sets!inner(id, name)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (recentCards) {
        recentCards.forEach(card => {
          activities.push({
            id: `card_${card.id}`,
            type: 'card_added',
            title: 'Added new card',
            description: `Added ${card.quantity}x ${card.cards.name} to collection`,
            timestamp: card.created_at,
            metadata: {
              cardId: card.cards.id,
              cardName: card.cards.name,
              cardImage: card.cards.image_small,
              setId: card.cards.set_id,
              setName: card.cards.sets.name
            }
          })
        })
      }

      // Get recent achievements
      const { data: recentAchievements } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false })
        .limit(5)

      if (recentAchievements) {
        recentAchievements.forEach(achievement => {
          const definition = achievementService.getAchievementDefinition(achievement.achievement_type)
          if (definition) {
            activities.push({
              id: `achievement_${achievement.id}`,
              type: 'achievement_unlocked',
              title: 'Achievement unlocked',
              description: `Unlocked "${definition.name}" achievement`,
              timestamp: achievement.unlocked_at,
              metadata: {
                achievementType: achievement.achievement_type
              }
            })
          }
        })
      }

      // Get recent friendships
      const { data: recentFriends } = await supabase
        .from('friendships')
        .select(`
          id,
          updated_at,
          requester_id,
          addressee_id,
          profiles!friendships_requester_id_fkey(username, display_name),
          profiles!friendships_addressee_id_fkey(username, display_name)
        `)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'accepted')
        .order('updated_at', { ascending: false })
        .limit(5)

      if (recentFriends) {
        recentFriends.forEach(friendship => {
          const friendProfile = friendship.requester_id === userId 
            ? friendship.profiles 
            : friendship.profiles

          if (friendProfile) {
            activities.push({
              id: `friend_${friendship.id}`,
              type: 'friend_added',
              title: 'New friend',
              description: `Connected with ${friendProfile.display_name || friendProfile.username}`,
              timestamp: friendship.updated_at,
              metadata: {
                friendId: friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id,
                friendName: friendProfile.display_name || friendProfile.username
              }
            })
          }
        })
      }

      // Sort all activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      return activities.slice(0, limit)
    } catch (error) {
      console.error('Error fetching recent activity:', error)
      return []
    }
  }

  /**
   * Get profile insights and recommendations
   */
  async getProfileInsights(userId: string): Promise<{ success: boolean; error?: string; data?: ProfileInsights }> {
    try {
      const profileDataResult = await this.getProfileData(userId)
      if (!profileDataResult.success || !profileDataResult.data) {
        return { success: false, error: 'Failed to get profile data' }
      }

      const { collectionStats, achievementStats } = profileDataResult.data

      // Analyze collection growth trend
      let collectionGrowthTrend: 'up' | 'down' | 'stable' = 'stable'
      if (collectionStats?.collectionGrowth && collectionStats.collectionGrowth.length >= 2) {
        const recent = collectionStats.collectionGrowth.slice(-2)
        if (recent[1].totalValue > recent[0].totalValue) {
          collectionGrowthTrend = 'up'
        } else if (recent[1].totalValue < recent[0].totalValue) {
          collectionGrowthTrend = 'down'
        }
      }

      // Find top collection category
      let topCollectionCategory = 'Unknown'
      if (collectionStats?.rarityBreakdown) {
        const topRarity = Object.entries(collectionStats.rarityBreakdown)
          .sort(([,a], [,b]) => b.count - a.count)[0]
        if (topRarity) {
          topCollectionCategory = topRarity[0]
        }
      }

      // Find next achievement
      let nextAchievement = null
      if (achievementStats) {
        const progressResult = await achievementService.getAchievementProgress(userId)
        if (progressResult.success && progressResult.data) {
          const nextUnlocked = progressResult.data
            .filter(p => !p.unlocked && p.percentage > 0)
            .sort((a, b) => b.percentage - a.percentage)[0]
          
          if (nextUnlocked) {
            nextAchievement = {
              type: nextUnlocked.achievement_type,
              name: nextUnlocked.definition.name,
              progress: nextUnlocked.current,
              required: nextUnlocked.required
            }
          }
        }
      }

      // Generate suggestions
      const suggestions: string[] = []
      if (collectionStats) {
        if (collectionStats.totalCards < 10) {
          suggestions.push('Add more cards to your collection to unlock achievements')
        }
        if (collectionStats.setsWithCards < 3) {
          suggestions.push('Try collecting cards from different sets')
        }
        if (collectionStats.totalValueEur < 50) {
          suggestions.push('Look for rare cards to increase your collection value')
        }
      }

      return {
        success: true,
        data: {
          collectionGrowthTrend,
          topCollectionCategory,
          nextAchievement,
          socialRank: 0, // Would need global ranking system
          collectionRank: 0, // Would need global ranking system
          suggestions
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update profile information
   */
  async updateProfile(
    userId: string,
    updates: Partial<Profile>
  ): Promise<{ success: boolean; error?: string; data?: Profile }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Profile }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update user preferences (language and currency)
   */
  async updatePreferences(
    userId: string,
    preferences: {
      preferred_language?: string
      preferred_currency?: string
    }
  ): Promise<{ success: boolean; error?: string; data?: Profile }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...preferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Profile }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Compress and resize image file
   */
  private async compressImage(file: File, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              })
              resolve(compressedFile)
            } else {
              reject(new Error('Failed to compress image'))
            }
          },
          'image/jpeg',
          quality
        )
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  /**
   * Validate file for upload
   */
  private validateFile(file: File, maxSizeMB: number = 5): { valid: boolean; error?: string } {
    // Check file type (aligned with Supabase bucket configuration)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif']
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Please upload a valid image file (JPEG, PNG, WebP, or AVIF)' }
    }

    // Check file size (before compression)
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `File size must be less than ${maxSizeMB}MB. Your file will be compressed automatically.` }
    }

    return { valid: true }
  }

  /**
   * Upload and update profile avatar
   */
  async updateAvatar(
    userId: string,
    file: File
  ): Promise<{ success: boolean; error?: string; avatarUrl?: string }> {
    try {
      // Validate file (aligned with Supabase 2MB bucket limit for profile pictures)
      const validation = this.validateFile(file, 5) // Allow up to 5MB, will be compressed to under 2MB
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      // Compress image for avatar (smaller size, ensures under 2MB limit)
      const compressedFile = await this.compressImage(file, 400, 400, 0.7)

      const fileExt = 'jpg' // Always use jpg after compression
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`

      // Upload file to Supabase Storage (using profile-pictures bucket with folder structure)
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, compressedFile, {
          upsert: true // Allow overwriting existing files
        })

      if (uploadError) {
        return { success: false, error: uploadError.message }
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName)

      // Update profile with new avatar URL with retry logic
      let updateResult = await this.updateProfile(userId, { avatar_url: publicUrl })
      
      // If the first update fails, try again after a short delay
      if (!updateResult.success) {
        console.warn('First avatar URL update failed, retrying...', updateResult.error)
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
        updateResult = await this.updateProfile(userId, { avatar_url: publicUrl })
      }
      
      if (!updateResult.success) {
        // If update still fails, log the error but don't fail the upload
        // The sync script can pick this up later
        console.error('Avatar URL update failed after retry:', updateResult.error)
        console.log('Avatar uploaded successfully but database update failed. File:', fileName)
        
        // Return success with a warning message
        return {
          success: true,
          avatarUrl: publicUrl,
          error: 'Avatar uploaded but may take a moment to appear. Please refresh if needed.'
        }
      }

      return { success: true, avatarUrl: publicUrl }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Upload and update profile banner
   */
  async updateBanner(
    userId: string,
    file: File
  ): Promise<{ success: boolean; error?: string; bannerUrl?: string }> {
    try {
      // Validate file (aligned with Supabase 5MB bucket limit for banner pictures)
      const validation = this.validateFile(file, 8) // Allow up to 8MB, will be compressed to under 5MB
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      // Compress image for banner (larger size, optimized to stay under 5MB)
      const compressedFile = await this.compressImage(file, 1200, 400, 0.8)

      const fileExt = 'jpg' // Always use jpg after compression
      const fileName = `${userId}/banner-${Date.now()}.${fileExt}`

      // Upload file to Supabase Storage (using banner-pictures bucket with folder structure)
      const { error: uploadError } = await supabase.storage
        .from('banner-pictures')
        .upload(fileName, compressedFile, {
          upsert: true // Allow overwriting existing files
        })

      if (uploadError) {
        return { success: false, error: uploadError.message }
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('banner-pictures')
        .getPublicUrl(fileName)

      // Update profile with new banner URL with retry logic
      let updateResult = await this.updateProfile(userId, { banner_url: publicUrl })
      
      // If the first update fails, try again after a short delay
      if (!updateResult.success) {
        console.warn('First banner URL update failed, retrying...', updateResult.error)
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
        updateResult = await this.updateProfile(userId, { banner_url: publicUrl })
      }
      
      if (!updateResult.success) {
        // If update still fails, log the error but don't fail the upload
        // The sync script can pick this up later
        console.error('Banner URL update failed after retry:', updateResult.error)
        console.log('Banner uploaded successfully but database update failed. File:', fileName)
        
        // Return success with a warning message
        return {
          success: true,
          bannerUrl: publicUrl,
          error: 'Banner uploaded but may take a moment to appear. Please refresh if needed.'
        }
      }

      return { success: true, bannerUrl: publicUrl }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Sync profile images from storage to database for a specific user
   * This can be called to fix any missing avatar/banner URLs
   */
  async syncUserImages(userId: string): Promise<{ success: boolean; error?: string; updates?: { avatar?: boolean; banner?: boolean } }> {
    try {
      const updates = { avatar: false, banner: false }

      // Get current profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, avatar_url, banner_url')
        .eq('id', userId)
        .single()

      if (profileError) {
        return { success: false, error: profileError.message }
      }

      // Type assertion to handle TypeScript inference issues
      const profileData = profile as any

      // Check for avatar images in storage if avatar_url is missing
      if (!profileData?.avatar_url) {
        const { data: avatarFiles, error: avatarError } = await supabase.storage
          .from('profile-pictures')
          .list(userId, {
            limit: 100,
            search: 'avatar'
          })

        if (!avatarError && avatarFiles && avatarFiles.length > 0) {
          // Get the most recent avatar file
          const latestAvatar = avatarFiles
            .filter(file => file.name.includes('avatar'))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

          if (latestAvatar) {
            const { data: { publicUrl } } = supabase.storage
              .from('profile-pictures')
              .getPublicUrl(`${userId}/${latestAvatar.name}`)

            // Update profile with avatar URL
            const updateResult = await this.updateProfile(userId, { avatar_url: publicUrl })
            if (updateResult.success) {
              updates.avatar = true
            }
          }
        }
      }

      // Check for banner images in storage if banner_url is missing
      if (!profileData?.banner_url) {
        const { data: bannerFiles, error: bannerError } = await supabase.storage
          .from('banner-pictures')
          .list(userId, {
            limit: 100,
            search: 'banner'
          })

        if (!bannerError && bannerFiles && bannerFiles.length > 0) {
          // Get the most recent banner file
          const latestBanner = bannerFiles
            .filter(file => file.name.includes('banner'))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

          if (latestBanner) {
            const { data: { publicUrl } } = supabase.storage
              .from('banner-pictures')
              .getPublicUrl(`${userId}/${latestBanner.name}`)

            // Update profile with banner URL
            const updateResult = await this.updateProfile(userId, { banner_url: publicUrl })
            if (updateResult.success) {
              updates.banner = true
            }
          }
        }
      }

      return { success: true, updates }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get public profile data (for sharing)
   */
  async getPublicProfile(userId: string): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, banner_url, bio, location, created_at, privacy_level')
        .eq('id', userId)
        .single()

      if (profileError) {
        return { success: false, error: profileError.message }
      }

      // Type assertion to handle TypeScript inference issues
      const profileData = profile as any

      // Check privacy settings
      if (profileData?.privacy_level === 'private') {
        return { success: false, error: 'Profile is private' }
      }

      // Get public collection stats if allowed
      let publicStats = null
      if (profileData?.privacy_level === 'public') {
        const statsResult = await collectionStatsService.getCollectionStats(userId)
        if (statsResult.success) {
          publicStats = {
            totalCards: statsResult.data?.totalCards || 0,
            uniqueCards: statsResult.data?.uniqueCards || 0,
            setsWithCards: statsResult.data?.setsWithCards || 0,
            topValueCards: statsResult.data?.topValueCards?.slice(0, 3) || []
          }
        }
      }

      return {
        success: true,
        data: {
          profile: profileData,
          stats: publicStats
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const profileService = new ProfileService()
export default profileService