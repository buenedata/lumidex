// Social domain types - friends, trading, and social interactions

import { BaseEntity, Currency, BaseFilter, PaginationParams } from '../core/common'
import { User } from './user'
import { PokemonCard, CardVariant, CardCondition } from './card'

/**
 * Friendship status types
 */
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked'

/**
 * Friendship entity
 */
export interface Friendship extends BaseEntity {
  requester_id: string
  addressee_id: string
  status: FriendshipStatus
  
  // Relations (populated when needed)
  requester?: User
  addressee?: User
}

/**
 * Friend representation for UI
 */
export interface Friend {
  userId: string
  username: string
  displayName?: string
  avatarUrl?: string
  lastActive?: string
  isOnline?: boolean
  friendshipId: string
  friendsSince: string
  
  // Quick stats for friend display
  stats?: {
    totalCards?: number
    uniqueCards?: number
    completedSets?: number
    mutualFriends?: number
  }
}

/**
 * Friend request for UI
 */
export interface FriendRequest {
  requestId: string
  fromUserId: string
  toUserId: string
  fromUser: {
    username: string
    displayName?: string
    avatarUrl?: string
  }
  toUser?: {
    username: string
    displayName?: string
    avatarUrl?: string
  }
  message?: string
  sentAt: string
  status: FriendshipStatus
}

/**
 * Trade status types
 */
export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled' | 'expired'

/**
 * Trade method types
 */
export type TradeMethod = 'mail' | 'meetup' | 'digital' | 'other'

/**
 * Trade entity
 */
export interface Trade extends BaseEntity {
  initiator_id: string
  recipient_id: string
  status: TradeStatus
  initiator_message?: string
  recipient_message?: string
  expires_at: string
  
  // Money offers
  initiator_money_offer?: number
  recipient_money_offer?: number
  
  // Trade details
  trade_method?: TradeMethod
  initiator_shipping_included?: boolean
  recipient_shipping_included?: boolean
  
  // Parent trade for counter-offers
  parent_trade_id?: string
  
  // Relations
  initiator?: User
  recipient?: User
  trade_items?: TradeItem[]
  parent_trade?: Trade
  counter_trades?: Trade[]
}

/**
 * Trade item entity
 */
export interface TradeItem extends BaseEntity {
  trade_id: string
  user_id: string
  card_id: string
  quantity: number
  condition: CardCondition
  variant: CardVariant
  is_foil?: boolean
  notes?: string
  estimated_value?: number
  
  // Relations
  card?: PokemonCard
  user?: User
}

/**
 * Trade offer for UI - combines trade with items
 */
export interface TradeOffer {
  trade: Trade
  initiatorItems: TradeOfferItem[]
  recipientItems: TradeOfferItem[]
  
  // Calculated values
  initiatorValue: number
  recipientValue: number
  fairnessRatio: number
  recommendation: 'accept' | 'decline' | 'counter' | 'review'
}

/**
 * Trade offer item for UI
 */
export interface TradeOfferItem {
  cardId: string
  cardName: string
  setName: string
  imageSmall: string
  quantity: number
  condition: CardCondition
  variant: CardVariant
  estimatedValue: number
  notes?: string
}

/**
 * Trade proposal creation data
 */
export interface TradeProposal {
  recipientId: string
  message?: string
  expiresInDays?: number
  
  // Items being offered by initiator
  offeredItems: TradeProposalItem[]
  
  // Items being requested from recipient
  requestedItems: TradeProposalItem[]
  
  // Money offers
  moneyOffer?: number
  requestedMoney?: number
  
  // Trade preferences
  method?: TradeMethod
  shippingIncluded?: boolean
  meetupLocation?: string
}

/**
 * Trade proposal item
 */
export interface TradeProposalItem {
  cardId: string
  quantity: number
  condition: CardCondition
  variant: CardVariant
  notes?: string
  maxValue?: number
}

/**
 * Trade history entry
 */
export interface TradeHistoryEntry {
  tradeId: string
  partnerId: string
  partnerUsername: string
  partnerDisplayName?: string
  partnerAvatarUrl?: string
  
  status: TradeStatus
  completedAt?: string
  initiatedAt: string
  
  // Summary
  itemsGiven: number
  itemsReceived: number
  valueGiven: number
  valueReceived: number
  
  // Preview items (top 3 most valuable)
  previewItems: {
    given: TradeHistoryPreviewItem[]
    received: TradeHistoryPreviewItem[]
  }
}

/**
 * Trade history preview item
 */
export interface TradeHistoryPreviewItem {
  cardName: string
  setName: string
  imageSmall: string
  quantity: number
  value: number
}

/**
 * Trade matching - find potential trades
 */
export interface TradeMatch {
  friendId: string
  friendUsername: string
  friendDisplayName?: string
  friendAvatarUrl?: string
  
  // Matching analysis
  mutualCards: TradeMutualCard[]
  tradeOpportunities: TradeOpportunity[]
  compatibilityScore: number
  
  // Quick stats
  friendHasWanted: number
  userHasFriendWants: number
  totalPotentialValue: number
}

/**
 * Mutual card for trade matching
 */
export interface TradeMutualCard {
  cardId: string
  cardName: string
  setName: string
  imageSmall: string
  
  userQuantity: number
  friendQuantity: number
  
  userCondition: CardCondition
  friendCondition: CardCondition
  
  estimatedValue: number
}

/**
 * Trade opportunity from matching
 */
export interface TradeOpportunity {
  type: 'direct_swap' | 'user_gives' | 'friend_gives' | 'value_trade'
  description: string
  
  cards: {
    cardId: string
    cardName: string
    direction: 'to_user' | 'to_friend'
    quantity: number
    value: number
  }[]
  
  totalValue: number
  fairnessScore: number
}

/**
 * Collection matching between friends
 */
export interface CollectionMatch {
  id: string
  user_id: string
  friend_id: string
  card_id: string
  match_type: 'friend_has_wanted' | 'user_has_friend_wants'
  
  // Relations
  card?: PokemonCard
  friend?: User
}

/**
 * Social activity feed item
 */
export interface SocialActivity extends BaseEntity {
  user_id: string
  activity_type: SocialActivityType
  title: string
  description: string
  metadata?: SocialActivityMetadata
  is_public: boolean
  
  // Relations
  user?: User
}

/**
 * Social activity types
 */
export type SocialActivityType = 
  | 'new_friend'
  | 'trade_completed'
  | 'achievement_unlocked'
  | 'set_completed'
  | 'rare_card_added'
  | 'milestone_reached'

/**
 * Social activity metadata
 */
export interface SocialActivityMetadata {
  friendId?: string
  friendName?: string
  tradeId?: string
  cardId?: string
  cardName?: string
  setId?: string
  setName?: string
  achievementType?: string
  value?: number
  quantity?: number
}

/**
 * Social filters for activity feeds
 */
export interface SocialFilters extends BaseFilter {
  activityTypes?: SocialActivityType[]
  friendsOnly?: boolean
  dateRange?: {
    start: string
    end: string
  }
}

/**
 * Friend search and discovery
 */
export interface FriendSearchResult {
  userId: string
  username: string
  displayName?: string
  avatarUrl?: string
  
  // Connection info
  mutualFriends: number
  relationshipStatus: 'none' | 'pending_out' | 'pending_in' | 'friends' | 'blocked'
  
  // Compatibility
  sharedInterests: string[]
  collectionSimilarity: number
  compatibilityScore: number
  
  // Quick stats
  stats?: {
    totalCards: number
    completedSets: number
    joinedDate: string
  }
}

/**
 * Social statistics for a user
 */
export interface SocialStats {
  userId: string
  
  // Friends
  totalFriends: number
  pendingRequestsOut: number
  pendingRequestsIn: number
  mutualConnections: number
  
  // Trading
  totalTrades: number
  completedTrades: number
  pendingTrades: number
  tradeSuccessRate: number
  averageTradeValue: number
  
  // Activity
  recentActivityCount: number
  socialScore: number
  communityRank?: number
  
  // Engagement
  profileViews: number
  tradesInitiated: number
  tradesReceived: number
  averageResponseTime: number
}

/**
 * Community leaderboard entry
 */
export interface CommunityLeaderboardEntry {
  rank: number
  userId: string
  username: string
  displayName?: string
  avatarUrl?: string
  
  // Metric being ranked by
  value: number
  metric: 'collection_value' | 'cards_count' | 'sets_completed' | 'trades_completed' | 'social_score'
  
  // Context
  change: number // Change in rank since last period
  badge?: string
}

/**
 * Social notification
 */
export interface SocialNotification extends BaseEntity {
  user_id: string
  type: SocialNotificationType
  title: string
  message: string
  is_read: boolean
  action_url?: string
  metadata?: Record<string, any>
  
  // Relations
  from_user?: User
}

/**
 * Social notification types
 */
export type SocialNotificationType = 
  | 'friend_request'
  | 'friend_accepted'
  | 'trade_offer'
  | 'trade_accepted'
  | 'trade_completed'
  | 'collection_match'
  | 'achievement_earned'
  | 'mention'
  | 'comment'

/**
 * Social settings for a user
 */
export interface SocialSettings {
  userId: string
  
  // Privacy
  profileVisibility: 'public' | 'friends' | 'private'
  collectionVisibility: 'public' | 'friends' | 'private'
  activityVisibility: 'public' | 'friends' | 'private'
  
  // Notifications
  emailNotifications: boolean
  pushNotifications: boolean
  notificationTypes: SocialNotificationType[]
  
  // Trading
  autoAcceptFriendTrades: boolean
  requireApprovalForTrades: boolean
  maxTradeValue: number
  preferredTradeMethod: TradeMethod[]
  
  // Discovery
  allowFriendSuggestions: boolean
  showInLeaderboards: boolean
  allowDirectMessages: boolean
}