import { AbstractRepository, FindManyParams, RepositoryError } from '@/lib/core/repository'
import type {
  User,
  UserPreferences,
  UserStats,
  UserProfileData,
  UserActivityItem
} from '@/types/domains/user'
import type { ApiResponse, PaginatedResponse } from '@/types'
import { createClient } from '@supabase/supabase-js'

/**
 * Input type for creating new users
 */
export interface CreateUserInput {
  email: string
  username: string
  display_name?: string
  avatar_url?: string
  bio?: string
  location?: string
  website?: string
  preferred_currency?: string
  preferred_language?: string
  privacy_level?: string
  show_collection_value?: boolean
}

/**
 * Input type for updating users
 */
export interface UpdateUserInput {
  username?: string
  display_name?: string
  avatar_url?: string
  bio?: string
  location?: string
  website?: string
  preferred_currency?: string
  preferred_language?: string
  privacy_level?: string
  show_collection_value?: boolean
  last_active?: string
}

/**
 * User Repository - handles all user data access
 * 
 * Manages users table operations with proper error handling,
 * profile management, and preference updates.
 */
export class UserRepository extends AbstractRepository<User, CreateUserInput, UpdateUserInput> {
  constructor(supabase: ReturnType<typeof createClient>) {
    super('users', supabase)
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<ApiResponse<User>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw RepositoryError.notFound('User', id)
        }
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Find multiple users with filters and pagination
   */
  async findMany(params?: FindManyParams): Promise<ApiResponse<PaginatedResponse<User>>> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })

      query = this.buildQuery(query, params)

      const { data, error, count } = await query

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse({
        data: data || [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 50,
          totalCount: count || 0,
          totalPages: Math.ceil((count || 0) / (params?.pageSize || 50))
        }
      })
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Create new user
   */
  async create(data: CreateUserInput): Promise<ApiResponse<User>> {
    try {
      this.validateRequired(data, ['email', 'username'])

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert({
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(result)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Update user
   */
  async update(id: string, data: UpdateUserInput): Promise<ApiResponse<User>> {
    try {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw RepositoryError.notFound('User', id)
        }
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(result)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<ApiResponse<boolean>> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(true)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Find multiple users by IDs
   */
  async findByIds(ids: string[]): Promise<ApiResponse<User[]>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('id', ids)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Create multiple users (bulk operations)
   */
  async createMany(data: CreateUserInput[]): Promise<ApiResponse<User[]>> {
    try {
      data.forEach(item => {
        this.validateRequired(item, ['email', 'username'])
      })

      const now = new Date().toISOString()
      const usersWithTimestamps = data.map(item => ({
        ...item,
        created_at: now,
        updated_at: now
      }))

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(usersWithTimestamps)
        .select()

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(result || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Update multiple users
   */
  async updateMany(updates: Array<{ id: string; data: UpdateUserInput }>): Promise<ApiResponse<User[]>> {
    try {
      const results: User[] = []
      
      for (const update of updates) {
        const result = await this.update(update.id, update.data)
        if (result.success && result.data) {
          results.push(result.data)
        }
      }

      return this.createSuccessResponse(results)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Delete multiple users
   */
  async deleteMany(ids: string[]): Promise<ApiResponse<number>> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .in('id', ids)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(ids.length)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<ApiResponse<User | null>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('username', username)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data || null)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<ApiResponse<User | null>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('email', email)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data || null)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Search users by username or display name
   */
  async searchUsers(query: string, limit: number = 20): Promise<ApiResponse<User[]>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('id, username, display_name, avatar_url, last_active')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .order('username')
        .limit(limit)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get user profile with additional computed data
   */
  async getUserProfile(id: string): Promise<ApiResponse<UserProfileData>> {
    try {
      const userResult = await this.findById(id)
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: userResult.error || 'User not found'
        }
      }

      const user = userResult.data

      // Get additional profile data in parallel
      const [statsResult, activityResult] = await Promise.all([
        this.getUserStats(id),
        this.getRecentActivity(id, 10)
      ])

      const profile: UserProfileData = {
        user,
        stats: statsResult.success && statsResult.data ? statsResult.data : {
          collectionStats: null,
          achievementStats: null,
          socialStats: null,
          activityStats: null
        },
        insights: null, // Would be computed from various data sources
        recentActivity: activityResult.success && activityResult.data ? activityResult.data : []
      }

      return this.createSuccessResponse(profile)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(id: string): Promise<ApiResponse<UserStats>> {
    try {
      // Note: In a real implementation, this would query multiple tables
      // For now, returning basic structure
      const stats: UserStats = {
        collectionStats: {
          totalCards: 0,
          uniqueCards: 0,
          totalValueEur: 0,
          setsWithCards: 0,
          rarityBreakdown: {},
          recentAdditions: 0
        },
        achievementStats: {
          totalAchievements: 0,
          unlockedAchievements: 0,
          achievementProgress: 0,
          recentUnlocks: 0,
          categoryBreakdown: {}
        },
        socialStats: {
          friendsCount: 0,
          pendingRequestsCount: 0,
          tradesCount: 0,
          completedTradesCount: 0
        },
        activityStats: {
          dailyStreak: 0,
          weeklyActivity: 0,
          monthlyActivity: 0
        }
      }

      return this.createSuccessResponse(stats)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get user's recent activity
   */
  async getRecentActivity(id: string, limit: number = 10): Promise<ApiResponse<UserActivityItem[]>> {
    try {
      // Note: In a real implementation, this would query activity/audit tables
      // For now, returning empty array
      return this.createSuccessResponse([])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(id: string, preferences: Partial<UserPreferences>): Promise<ApiResponse<User>> {
    try {
      const updateData: UpdateUserInput = {}

      if (preferences.preferred_currency) {
        updateData.preferred_currency = preferences.preferred_currency
      }
      if (preferences.preferred_language) {
        updateData.preferred_language = preferences.preferred_language
      }
      if (preferences.privacy_level) {
        updateData.privacy_level = preferences.privacy_level
      }
      if (preferences.show_collection_value !== undefined) {
        updateData.show_collection_value = preferences.show_collection_value
      }

      return this.update(id, updateData)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(id: string): Promise<ApiResponse<boolean>> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .update({ 
          last_active: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(true)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<ApiResponse<boolean>> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('id')
        .eq('username', username)

      if (excludeUserId) {
        query = query.neq('id', excludeUserId)
      }

      const { data, error } = await query.single()

      if (error && error.code !== 'PGRST116') {
        throw RepositoryError.databaseError(error)
      }

      // Username is available if no user was found
      return this.createSuccessResponse(!data)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get users with public profiles for discovery
   */
  async getPublicUsers(limit: number = 50): Promise<ApiResponse<User[]>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('id, username, display_name, avatar_url, bio, location, last_active')
        .eq('privacy_level', 'public')
        .order('last_active', { ascending: false })
        .limit(limit)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get recently active users
   */
  async getRecentlyActiveUsers(limit: number = 20): Promise<ApiResponse<User[]>> {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('id, username, display_name, avatar_url, last_active')
        .gte('last_active', sevenDaysAgo.toISOString())
        .order('last_active', { ascending: false })
        .limit(limit)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Private helper to determine if user is online
   */
  private isUserOnline(lastActive?: string): boolean {
    if (!lastActive) return false
    
    const lastActiveDate = new Date(lastActive)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    
    return lastActiveDate > fiveMinutesAgo
  }
}