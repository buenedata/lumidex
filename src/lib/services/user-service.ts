// User service - business logic layer for user domain

import { UserRepository } from '../repositories/user-repository'
import { supabase } from '../supabase'
import { 
  User, 
  UserPreferences, 
  UserProfileForm,
  UserStats,
  UserProfileData,
  PublicUserProfile,
  ApiResponse 
} from '@/types'

/**
 * User service handles all user-related business logic
 */
export class UserService {
  constructor(private repository = new UserRepository(supabase as any)) {}

  /**
   * Get user profile with all related data
   */
  async getUserProfile(userId: string): Promise<ApiResponse<UserProfileData>> {
    try {
      // Get basic user data
      const userResult = await this.repository.findById(userId)
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: userResult.error || 'User not found'
        }
      }

      // Get user statistics (placeholder - would integrate with other services)
      const stats: UserStats = {
        collectionStats: null,
        achievementStats: null,
        socialStats: null,
        activityStats: null
      }

      // Get user insights (placeholder - would calculate based on data)
      const insights = null

      // Get recent activity (placeholder - would fetch from activity service)
      const recentActivity: any[] = []

      const profileData: UserProfileData = {
        user: userResult.data,
        stats,
        insights,
        recentActivity
      }

      return {
        success: true,
        data: profileData
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user profile'
      }
    }
  }

  /**
   * Update user profile with validation
   */
  async updateUserProfile(userId: string, profileData: UserProfileForm): Promise<ApiResponse<User>> {
    try {
      // Validate username if it's being changed
      if (profileData.username) {
        const usernameCheck = await this.repository.isUsernameAvailable(profileData.username, userId)
        if (!usernameCheck.success) {
          return {
            success: false,
            error: usernameCheck.error || 'Failed to check username availability'
          }
        }
        
        if (!usernameCheck.data) {
          return {
            success: false,
            error: 'Username is already taken'
          }
        }
      }

      // Validate display name length
      if (profileData.display_name && profileData.display_name.length > 50) {
        return {
          success: false,
          error: 'Display name must be 50 characters or less'
        }
      }

      // Validate bio length
      if (profileData.bio && profileData.bio.length > 500) {
        return {
          success: false,
          error: 'Bio must be 500 characters or less'
        }
      }

      // Update the profile
      const result = await this.repository.update(userId, profileData)
      
      if (result.success) {
        // Update last active timestamp
        await this.repository.updateLastActive(userId)
      }

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update profile'
      }
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: UserPreferences): Promise<ApiResponse<User>> {
    try {
      // Validate preferences
      const validCurrencies = ['EUR', 'USD', 'GBP', 'JPY']
      const validLanguages = ['en', 'de', 'fr', 'es', 'it', 'nl']
      const validPrivacyLevels = ['public', 'friends', 'private']

      if (!validCurrencies.includes(preferences.preferred_currency)) {
        return {
          success: false,
          error: 'Invalid currency'
        }
      }

      if (!validLanguages.includes(preferences.preferred_language)) {
        return {
          success: false,
          error: 'Invalid language'
        }
      }

      if (!validPrivacyLevels.includes(preferences.privacy_level)) {
        return {
          success: false,
          error: 'Invalid privacy level'
        }
      }

      return this.repository.updatePreferences(userId, preferences)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update preferences'
      }
    }
  }

  /**
   * Create new user profile
   */
  async createUserProfile(userData: Partial<User>): Promise<ApiResponse<User>> {
    try {
      // Validate required fields
      if (!userData.username) {
        return {
          success: false,
          error: 'Username is required'
        }
      }

      // Check username availability
      const usernameCheck = await this.repository.isUsernameAvailable(userData.username)
      if (!usernameCheck.success) {
        return {
          success: false,
          error: usernameCheck.error || 'Failed to check username availability'
        }
      }

      if (!usernameCheck.data) {
        return {
          success: false,
          error: 'Username is already taken'
        }
      }

      // Validate username format
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(userData.username)) {
        return {
          success: false,
          error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
        }
      }

      // Set default values and ensure email is included
      const userToCreate = {
        email: (userData as any).email || '', // Add email from userData
        username: userData.username,
        display_name: userData.display_name || userData.username,
        privacy_level: userData.privacy_level || 'public' as const,
        show_collection_value: userData.show_collection_value ?? true,
        preferred_currency: userData.preferred_currency || 'EUR' as const,
        preferred_language: userData.preferred_language || 'en' as const,
        ...userData
      }

      return this.repository.create(userToCreate)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user profile'
      }
    }
  }

  /**
   * Get public user profile (for viewing other users)
   */
  async getPublicUserProfile(userId: string): Promise<ApiResponse<PublicUserProfile>> {
    try {
      const userResult = await this.repository.findById(userId)
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: userResult.error || 'User not found'
        }
      }

      const user = userResult.data

      // Check if profile is private
      if (user.privacy_level === 'private') {
        return {
          success: false,
          error: 'Profile is private'
        }
      }

      // Create public profile with limited data
      const publicProfile: PublicUserProfile = {
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          banner_url: user.banner_url,
          bio: user.bio,
          location: user.location,
          created_at: user.created_at
        },
        stats: null, // Would be populated by other services if allowed
        isPrivate: false
      }

      return {
        success: true,
        data: publicProfile
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get public profile'
      }
    }
  }

  /**
   * Search for users
   */
  async searchUsers(query: string, limit = 20): Promise<ApiResponse<User[]>> {
    try {
      if (query.length < 3) {
        return {
          success: false,
          error: 'Search query must be at least 3 characters'
        }
      }

      return this.repository.searchUsers(query, limit)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search users'
      }
    }
  }

  /**
   * Complete user setup process
   */
  async completeUserSetup(userId: string): Promise<ApiResponse<User>> {
    try {
      // Verify user exists and setup is not already completed
      const userResult = await this.repository.findById(userId)
      if (!userResult.success || !userResult.data) {
        return userResult as ApiResponse<User>
      }

      if (userResult.data.setup_completed) {
        return {
          success: false,
          error: 'Setup is already completed'
        }
      }

      // Mark setup as completed by updating the user
      const result = await this.repository.update(userId, {
        setup_completed: true,
        updated_at: new Date().toISOString()
      } as any)
      
      if (result.success) {
        // Could trigger welcome email, achievement unlock, etc.
        console.log(`User ${userId} completed setup`)
      }

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete setup'
      }
    }
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(userId: string): Promise<ApiResponse<User>> {
    try {
      const result = await this.repository.updateLastActive(userId)
      if (result.success) {
        // Get the updated user to return
        return this.repository.findById(userId)
      }
      return {
        success: false,
        error: result.error || 'Failed to update last active'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update last active'
      }
    }
  }

  /**
   * Check if username is available
   */
  async checkUsernameAvailability(username: string, excludeUserId?: string): Promise<ApiResponse<boolean>> {
    try {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return {
          success: false,
          error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
        }
      }

      return this.repository.isUsernameAvailable(username, excludeUserId)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check username availability'
      }
    }
  }

  /**
   * Delete user account (soft delete - mark as inactive)
   */
  async deleteUserAccount(userId: string): Promise<ApiResponse<boolean>> {
    try {
      // In a real implementation, this would:
      // 1. Mark user as inactive instead of hard delete
      // 2. Clean up related data (collections, trades, etc.)
      // 3. Send confirmation email
      // 4. Schedule data purge after grace period

      // For now, just do a hard delete
      return this.repository.delete(userId)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete account'
      }
    }
  }
}

// Export singleton instance
export const userService = new UserService()