// User domain types - consolidates profile, authentication, and user preferences

import { BaseEntity, PrivacyLevel, Currency, Language } from '../core/common'

/**
 * Core user profile entity
 */
export interface User extends BaseEntity {
  username: string
  display_name?: string
  avatar_url?: string
  banner_url?: string
  bio?: string
  location?: string
  favorite_set_id?: string
  privacy_level: PrivacyLevel
  show_collection_value: boolean
  preferred_currency: Currency
  preferred_language: Language
  preferred_price_source?: string
  setup_completed?: boolean
  setup_completed_at?: string
  last_active?: string
}

/**
 * User preferences that can be updated independently
 */
export interface UserPreferences {
  preferred_currency: Currency
  preferred_language: Language
  preferred_price_source?: string
  privacy_level: PrivacyLevel
  show_collection_value: boolean
}

/**
 * Form data for user profile updates
 */
export interface UserProfileForm {
  username: string
  display_name?: string
  bio?: string
  location?: string
  favorite_set_id?: string
}

/**
 * User registration form data
 */
export interface UserRegistrationForm {
  email: string
  password: string
  username: string
  display_name?: string
}

/**
 * User login form data
 */
export interface UserLoginForm {
  email: string
  password: string
}

/**
 * User statistics aggregated from various domains
 */
export interface UserStats {
  collectionStats: UserCollectionStats | null
  achievementStats: UserAchievementStats | null
  socialStats: UserSocialStats | null
  activityStats: UserActivityStats | null
}

/**
 * Collection-related user statistics
 */
export interface UserCollectionStats {
  totalCards: number
  uniqueCards: number
  totalValueEur: number
  totalValueUsd?: number
  setsWithCards: number
  rarityBreakdown: Record<string, { count: number; percentage: number }>
  recentAdditions: number
  collectionGrowth?: UserCollectionGrowthPoint[]
}

/**
 * Achievement-related user statistics
 */
export interface UserAchievementStats {
  totalAchievements: number
  unlockedAchievements: number
  achievementProgress: number
  recentUnlocks: number
  categoryBreakdown: Record<string, number>
}

/**
 * Social-related user statistics
 */
export interface UserSocialStats {
  friendsCount: number
  pendingRequestsCount: number
  tradesCount: number
  completedTradesCount: number
}

/**
 * Activity-related user statistics
 */
export interface UserActivityStats {
  dailyStreak: number
  weeklyActivity: number
  monthlyActivity: number
  lastActiveDate?: string
}

/**
 * User collection growth tracking point
 */
export interface UserCollectionGrowthPoint {
  date: string
  totalCards: number
  totalValue: number
  uniqueCards: number
}

/**
 * User activity item for activity feed
 */
export interface UserActivityItem extends BaseEntity {
  user_id: string
  type: UserActivityType
  title: string
  description: string
  metadata?: UserActivityMetadata
}

/**
 * Types of user activities
 */
export type UserActivityType = 
  | 'card_added' 
  | 'achievement_unlocked' 
  | 'friend_added' 
  | 'trade_completed' 
  | 'set_completed'
  | 'wishlist_updated'
  | 'profile_updated'

/**
 * Metadata for user activities
 */
export interface UserActivityMetadata {
  cardId?: string
  cardName?: string
  cardImage?: string
  setId?: string
  setName?: string
  achievementType?: string
  friendId?: string
  friendName?: string
  tradeId?: string
  quantity?: number
  value?: number
}

/**
 * User insights and recommendations
 */
export interface UserInsights {
  collectionGrowthTrend: 'up' | 'down' | 'stable'
  topCollectionCategory: string
  nextAchievement: NextAchievementHint | null
  socialRank: number
  collectionRank: number
  suggestions: string[]
  personalizedRecommendations: UserRecommendation[]
}

/**
 * Next achievement hint
 */
export interface NextAchievementHint {
  type: string
  name: string
  description: string
  progress: number
  required: number
  percentage: number
}

/**
 * Personalized user recommendation
 */
export interface UserRecommendation {
  type: 'collection' | 'social' | 'trading' | 'achievement'
  title: string
  description: string
  action?: string
  priority: 'low' | 'medium' | 'high'
  metadata?: Record<string, any>
}

/**
 * Comprehensive user profile data
 */
export interface UserProfileData {
  user: User
  stats: UserStats
  insights: UserInsights | null
  recentActivity: UserActivityItem[]
}

/**
 * Public user profile (for sharing/viewing other users)
 */
export interface PublicUserProfile {
  user: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url' | 'banner_url' | 'bio' | 'location' | 'created_at'>
  stats: Partial<UserStats> | null
  isPrivate: boolean
}