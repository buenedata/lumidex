import { supabase } from './supabase'
import { calculateCardVariantValue } from './variant-pricing'

export interface Achievement {
  id: string
  user_id: string
  achievement_type: string
  achievement_data: any
  unlocked_at: string
  created_at: string
}

export interface AchievementDefinition {
  type: string
  name: string
  description: string
  icon: string
  category: 'collection' | 'social' | 'trading' | 'special'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  points: number
  requirements: any
  hidden?: boolean
}

export interface AchievementProgress {
  achievement_type: string
  current: number
  required: number
  percentage: number
  unlocked: boolean
  definition: AchievementDefinition
}

export interface AchievementStats {
  totalAchievements: number
  unlockedAchievements: number
  totalPoints: number
  completionPercentage: number
  recentAchievements: Achievement[]
  categoryStats: {
    collection: { unlocked: number; total: number }
    social: { unlocked: number; total: number }
    trading: { unlocked: number; total: number }
    special: { unlocked: number; total: number }
  }
}

// Achievement definitions
const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Collection Achievements - Basic Milestones
  {
    type: 'first_card',
    name: 'First Steps',
    description: 'Add your first card to your collection',
    icon: '🎯',
    category: 'collection',
    rarity: 'common',
    points: 10,
    requirements: { cards: 1 }
  },
  {
    type: 'collector_10',
    name: 'Getting Started',
    description: 'Collect 10 different cards',
    icon: '📚',
    category: 'collection',
    rarity: 'common',
    points: 25,
    requirements: { unique_cards: 10 }
  },
  {
    type: 'collector_25',
    name: 'Card Enthusiast',
    description: 'Collect 25 different cards',
    icon: '🎴',
    category: 'collection',
    rarity: 'common',
    points: 50,
    requirements: { unique_cards: 25 }
  },
  {
    type: 'collector_50',
    name: 'Dedicated Collector',
    description: 'Collect 50 different cards',
    icon: '📖',
    category: 'collection',
    rarity: 'rare',
    points: 100,
    requirements: { unique_cards: 50 }
  },
  {
    type: 'collector_100',
    name: 'Serious Collector',
    description: 'Collect 100 different cards',
    icon: '📕',
    category: 'collection',
    rarity: 'epic',
    points: 250,
    requirements: { unique_cards: 100 }
  },
  {
    type: 'collector_250',
    name: 'Master Collector',
    description: 'Collect 250 different cards',
    icon: '📚',
    category: 'collection',
    rarity: 'epic',
    points: 500,
    requirements: { unique_cards: 250 }
  },
  {
    type: 'collector_500',
    name: 'Elite Collector',
    description: 'Collect 500 different cards',
    icon: '🏛️',
    category: 'collection',
    rarity: 'legendary',
    points: 1000,
    requirements: { unique_cards: 500 }
  },
  {
    type: 'collector_1000',
    name: 'Pokédex Master',
    description: 'Collect 1000 different cards',
    icon: '📱',
    category: 'collection',
    rarity: 'legendary',
    points: 2000,
    requirements: { unique_cards: 1000 }
  },
  {
    type: 'collector_2000',
    name: 'Legendary Archivist',
    description: 'Collect 2000 different cards',
    icon: '🏆',
    category: 'collection',
    rarity: 'legendary',
    points: 5000,
    requirements: { unique_cards: 2000 }
  },

  // Collection Achievements - Value Milestones
  {
    type: 'valuable_collection_100',
    name: 'Valuable Collection',
    description: 'Build a collection worth €100',
    icon: '💰',
    category: 'collection',
    rarity: 'rare',
    points: 150,
    requirements: { collection_value_eur: 100 }
  },
  {
    type: 'valuable_collection_250',
    name: 'Treasure Keeper',
    description: 'Build a collection worth €250',
    icon: '💎',
    category: 'collection',
    rarity: 'rare',
    points: 300,
    requirements: { collection_value_eur: 250 }
  },
  {
    type: 'valuable_collection_500',
    name: 'Investment Guru',
    description: 'Build a collection worth €500',
    icon: '💍',
    category: 'collection',
    rarity: 'epic',
    points: 600,
    requirements: { collection_value_eur: 500 }
  },
  {
    type: 'valuable_collection_1000',
    name: 'High Roller',
    description: 'Build a collection worth €1000',
    icon: '👑',
    category: 'collection',
    rarity: 'epic',
    points: 1200,
    requirements: { collection_value_eur: 1000 }
  },
  {
    type: 'valuable_collection_2500',
    name: 'Millionaire Mindset',
    description: 'Build a collection worth €2500',
    icon: '🏦',
    category: 'collection',
    rarity: 'legendary',
    points: 2500,
    requirements: { collection_value_eur: 2500 }
  },
  {
    type: 'valuable_collection_5000',
    name: 'Treasure Dragon',
    description: 'Build a collection worth €5000',
    icon: '🐉',
    category: 'collection',
    rarity: 'legendary',
    points: 5000,
    requirements: { collection_value_eur: 5000 }
  },

  // Collection Achievements - Rarity Focused
  {
    type: 'rare_collector',
    name: 'Rare Hunter',
    description: 'Collect 10 rare or higher rarity cards',
    icon: '⭐',
    category: 'collection',
    rarity: 'rare',
    points: 200,
    requirements: { rare_cards: 10 }
  },
  {
    type: 'rare_collector_25',
    name: 'Rarity Seeker',
    description: 'Collect 25 rare or higher rarity cards',
    icon: '🌟',
    category: 'collection',
    rarity: 'rare',
    points: 400,
    requirements: { rare_cards: 25 }
  },
  {
    type: 'rare_collector_50',
    name: 'Legendary Collector',
    description: 'Collect 50 rare or higher rarity cards',
    icon: '✨',
    category: 'collection',
    rarity: 'epic',
    points: 750,
    requirements: { rare_cards: 50 }
  },
  {
    type: 'rare_collector_100',
    name: 'Rainbow Master',
    description: 'Collect 100 rare or higher rarity cards',
    icon: '🌈',
    category: 'collection',
    rarity: 'legendary',
    points: 1500,
    requirements: { rare_cards: 100 }
  },

  // Collection Achievements - Volume
  {
    type: 'volume_collector_100',
    name: 'Card Hoarder',
    description: 'Own 100 total cards (including duplicates)',
    icon: '📦',
    category: 'collection',
    rarity: 'common',
    points: 75,
    requirements: { cards: 100 }
  },
  {
    type: 'volume_collector_500',
    name: 'Bulk Collector',
    description: 'Own 500 total cards (including duplicates)',
    icon: '📚',
    category: 'collection',
    rarity: 'rare',
    points: 300,
    requirements: { cards: 500 }
  },
  {
    type: 'volume_collector_1000',
    name: 'Card Warehouse',
    description: 'Own 1000 total cards (including duplicates)',
    icon: '🏭',
    category: 'collection',
    rarity: 'epic',
    points: 800,
    requirements: { cards: 1000 }
  },
  {
    type: 'volume_collector_5000',
    name: 'Card Empire',
    description: 'Own 5000 total cards (including duplicates)',
    icon: '🏰',
    category: 'collection',
    rarity: 'legendary',
    points: 3000,
    requirements: { cards: 5000 }
  },

  // Social Achievements
  {
    type: 'first_friend',
    name: 'Making Friends',
    description: 'Add your first friend',
    icon: '👋',
    category: 'social',
    rarity: 'common',
    points: 20,
    requirements: { friends: 1 }
  },
  {
    type: 'social_circle',
    name: 'Social Circle',
    description: 'Have 5 friends',
    icon: '👥',
    category: 'social',
    rarity: 'common',
    points: 50,
    requirements: { friends: 5 }
  },
  {
    type: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Have 10 friends',
    icon: '🦋',
    category: 'social',
    rarity: 'rare',
    points: 100,
    requirements: { friends: 10 }
  },
  {
    type: 'party_host',
    name: 'Party Host',
    description: 'Have 25 friends',
    icon: '🎉',
    category: 'social',
    rarity: 'rare',
    points: 250,
    requirements: { friends: 25 }
  },
  {
    type: 'social_influencer',
    name: 'Social Influencer',
    description: 'Have 50 friends',
    icon: '📢',
    category: 'social',
    rarity: 'epic',
    points: 500,
    requirements: { friends: 50 }
  },
  {
    type: 'community_leader',
    name: 'Community Leader',
    description: 'Have 100 friends',
    icon: '👨‍💼',
    category: 'social',
    rarity: 'legendary',
    points: 1000,
    requirements: { friends: 100 }
  },

  // Trading Achievements
  {
    type: 'first_trade',
    name: 'First Trade',
    description: 'Complete your first trade',
    icon: '🤝',
    category: 'trading',
    rarity: 'common',
    points: 50,
    requirements: { completed_trades: 1 }
  },
  {
    type: 'frequent_trader',
    name: 'Frequent Trader',
    description: 'Complete 5 trades',
    icon: '🔄',
    category: 'trading',
    rarity: 'common',
    points: 125,
    requirements: { completed_trades: 5 }
  },
  {
    type: 'active_trader',
    name: 'Active Trader',
    description: 'Complete 10 trades',
    icon: '📈',
    category: 'trading',
    rarity: 'rare',
    points: 200,
    requirements: { completed_trades: 10 }
  },
  {
    type: 'seasoned_trader',
    name: 'Seasoned Trader',
    description: 'Complete 25 trades',
    icon: '💼',
    category: 'trading',
    rarity: 'rare',
    points: 400,
    requirements: { completed_trades: 25 }
  },
  {
    type: 'trading_expert',
    name: 'Trading Expert',
    description: 'Complete 50 trades',
    icon: '🎯',
    category: 'trading',
    rarity: 'epic',
    points: 750,
    requirements: { completed_trades: 50 }
  },
  {
    type: 'trade_master',
    name: 'Trade Master',
    description: 'Complete 100 trades',
    icon: '🏅',
    category: 'trading',
    rarity: 'epic',
    points: 1500,
    requirements: { completed_trades: 100 }
  },
  {
    type: 'trading_mogul',
    name: 'Trading Mogul',
    description: 'Complete 250 trades',
    icon: '💎',
    category: 'trading',
    rarity: 'legendary',
    points: 3000,
    requirements: { completed_trades: 250 }
  },

  // Special Achievements - Themed
  {
    type: 'pikachu_lover',
    name: 'Pikachu Lover',
    description: 'Collect 10 different Pikachu cards',
    icon: '⚡',
    category: 'special',
    rarity: 'rare',
    points: 300,
    requirements: { pikachu_cards: 10 }
  },
  {
    type: 'charizard_hunter',
    name: 'Charizard Hunter',
    description: 'Collect 5 different Charizard cards',
    icon: '🔥',
    category: 'special',
    rarity: 'epic',
    points: 500,
    requirements: { charizard_cards: 5 }
  },
  {
    type: 'eeveelution_master',
    name: 'Eeveelution Master',
    description: 'Collect cards from all Eevee evolutions',
    icon: '🌙',
    category: 'special',
    rarity: 'epic',
    points: 400,
    requirements: { eeveelution_complete: true }
  },
  {
    type: 'starter_pokemon_fan',
    name: 'Starter Pokémon Fan',
    description: 'Collect starter Pokémon from 3 different generations',
    icon: '🌱',
    category: 'special',
    rarity: 'rare',
    points: 250,
    requirements: { starter_generations: 3 }
  },
  {
    type: 'legendary_collector',
    name: 'Legendary Pokémon Trainer',
    description: 'Collect 10 different legendary Pokémon cards',
    icon: '👑',
    category: 'special',
    rarity: 'epic',
    points: 600,
    requirements: { legendary_pokemon: 10 }
  },
  {
    type: 'shiny_hunter',
    name: 'Shiny Hunter',
    description: 'Collect 5 different shiny Pokémon cards',
    icon: '✨',
    category: 'special',
    rarity: 'epic',
    points: 750,
    requirements: { shiny_cards: 5 }
  },
  {
    type: 'type_master_fire',
    name: 'Fire Type Master',
    description: 'Collect 25 different Fire-type Pokémon cards',
    icon: '🔥',
    category: 'special',
    rarity: 'rare',
    points: 200,
    requirements: { fire_type_cards: 25 }
  },
  {
    type: 'type_master_water',
    name: 'Water Type Master',
    description: 'Collect 25 different Water-type Pokémon cards',
    icon: '💧',
    category: 'special',
    rarity: 'rare',
    points: 200,
    requirements: { water_type_cards: 25 }
  },
  {
    type: 'type_master_electric',
    name: 'Electric Type Master',
    description: 'Collect 25 different Electric-type Pokémon cards',
    icon: '⚡',
    category: 'special',
    rarity: 'rare',
    points: 200,
    requirements: { electric_type_cards: 25 }
  },
  {
    type: 'rainbow_collector',
    name: 'Rainbow Collector',
    description: 'Collect cards from all 18 Pokémon types',
    icon: '🌈',
    category: 'special',
    rarity: 'legendary',
    points: 1000,
    requirements: { all_types_collected: true }
  },
  {
    type: 'generation_1_master',
    name: 'Kanto Champion',
    description: 'Collect 50 different Generation 1 Pokémon cards',
    icon: '🎮',
    category: 'special',
    rarity: 'epic',
    points: 400,
    requirements: { gen1_cards: 50 }
  },
  {
    type: 'generation_2_master',
    name: 'Johto Champion',
    description: 'Collect 30 different Generation 2 Pokémon cards',
    icon: '🏆',
    category: 'special',
    rarity: 'epic',
    points: 350,
    requirements: { gen2_cards: 30 }
  },
  {
    type: 'retro_collector',
    name: 'Retro Collector',
    description: 'Collect cards from the Base Set, Jungle, and Fossil sets',
    icon: '🏛️',
    category: 'special',
    rarity: 'legendary',
    points: 800,
    requirements: { classic_sets_complete: true }
  },
  {
    type: 'modern_collector',
    name: 'Modern Collector',
    description: 'Collect cards from 10 different modern sets (2020+)',
    icon: '🚀',
    category: 'special',
    rarity: 'epic',
    points: 500,
    requirements: { modern_sets: 10 }
  },
  {
    type: 'holographic_enthusiast',
    name: 'Holographic Enthusiast',
    description: 'Collect 20 different holographic cards',
    icon: '💫',
    category: 'special',
    rarity: 'rare',
    points: 300,
    requirements: { holo_cards: 20 }
  },
  {
    type: 'first_edition_collector',
    name: 'First Edition Collector',
    description: 'Collect 10 different First Edition cards',
    icon: '1️⃣',
    category: 'special',
    rarity: 'epic',
    points: 600,
    requirements: { first_edition_cards: 10 }
  },
  {
    type: 'shadowless_hunter',
    name: 'Shadowless Hunter',
    description: 'Collect 5 different Shadowless cards',
    icon: '👻',
    category: 'special',
    rarity: 'legendary',
    points: 1000,
    requirements: { shadowless_cards: 5 }
  },
  {
    type: 'promo_collector',
    name: 'Promo Collector',
    description: 'Collect 15 different promotional cards',
    icon: '🎁',
    category: 'special',
    rarity: 'rare',
    points: 400,
    requirements: { promo_cards: 15 }
  },
  {
    type: 'full_art_fan',
    name: 'Full Art Fan',
    description: 'Collect 10 different Full Art cards',
    icon: '🖼️',
    category: 'special',
    rarity: 'epic',
    points: 500,
    requirements: { full_art_cards: 10 }
  },
  {
    type: 'secret_rare_hunter',
    name: 'Secret Rare Hunter',
    description: 'Collect 5 different Secret Rare cards',
    icon: '🔐',
    category: 'special',
    rarity: 'legendary',
    points: 1200,
    requirements: { secret_rare_cards: 5 }
  },
  {
    type: 'alt_art_collector',
    name: 'Alt Art Collector',
    description: 'Collect 8 different Alternate Art cards',
    icon: '🎨',
    category: 'special',
    rarity: 'epic',
    points: 700,
    requirements: { alt_art_cards: 8 }
  },
  {
    type: 'vintage_master',
    name: 'Vintage Master',
    description: 'Collect cards from 5 different vintage sets (pre-2010)',
    icon: '📜',
    category: 'special',
    rarity: 'legendary',
    points: 900,
    requirements: { vintage_sets: 5 }
  },
  {
    type: 'completionist',
    name: 'Set Completionist',
    description: 'Complete your first full set',
    icon: '💯',
    category: 'special',
    rarity: 'legendary',
    points: 1500,
    requirements: { completed_sets: 1 }
  },
  {
    type: 'super_completionist',
    name: 'Super Completionist',
    description: 'Complete 3 different full sets',
    icon: '🏆',
    category: 'special',
    rarity: 'legendary',
    points: 3000,
    requirements: { completed_sets: 3 }
  },
  {
    type: 'lucky_number_777',
    name: 'Lucky Number 777',
    description: 'Have exactly 777 total cards in your collection',
    icon: '🍀',
    category: 'special',
    rarity: 'rare',
    points: 777,
    requirements: { exact_cards: 777 }
  },
  {
    type: 'power_of_ten',
    name: 'Power of Ten',
    description: 'Have exactly 1000 unique cards in your collection',
    icon: '💪',
    category: 'special',
    rarity: 'epic',
    points: 1000,
    requirements: { exact_unique_cards: 1000 }
  },
  {
    type: 'holiday_collector',
    name: 'Holiday Collector',
    description: 'Collect special holiday-themed cards',
    icon: '🎄',
    category: 'special',
    rarity: 'rare',
    points: 300,
    requirements: { holiday_cards: 5 }
  },

  // Daily Login Streak Achievements
  {
    type: 'first_login',
    name: 'Welcome Back!',
    description: 'Log in to the platform',
    icon: '👋',
    category: 'special',
    rarity: 'common',
    points: 5,
    requirements: { login_streak: 1 }
  },
  {
    type: 'login_streak_3',
    name: 'Getting Into the Habit',
    description: 'Log in for 3 consecutive days',
    icon: '📅',
    category: 'special',
    rarity: 'common',
    points: 25,
    requirements: { login_streak: 3 }
  },
  {
    type: 'login_streak_7',
    name: 'Weekly Warrior',
    description: 'Log in for 7 consecutive days',
    icon: '🗓️',
    category: 'special',
    rarity: 'rare',
    points: 100,
    requirements: { login_streak: 7 }
  },
  {
    type: 'login_streak_30',
    name: 'Monthly Dedication',
    description: 'Log in for 30 consecutive days',
    icon: '📆',
    category: 'special',
    rarity: 'epic',
    points: 500,
    requirements: { login_streak: 30 }
  },
  {
    type: 'login_streak_100',
    name: 'Century Commitment',
    description: 'Log in for 100 consecutive days',
    icon: '💯',
    category: 'special',
    rarity: 'legendary',
    points: 2000,
    requirements: { login_streak: 100 }
  },

  // Collection Activity Streak Achievements
  {
    type: 'collection_streak_3',
    name: 'Collection Enthusiast',
    description: 'Add cards to your collection for 3 consecutive days',
    icon: '🎴',
    category: 'collection',
    rarity: 'common',
    points: 50,
    requirements: { collection_streak: 3 }
  },
  {
    type: 'collection_streak_7',
    name: 'Daily Collector',
    description: 'Add cards to your collection for 7 consecutive days',
    icon: '📚',
    category: 'collection',
    rarity: 'rare',
    points: 150,
    requirements: { collection_streak: 7 }
  },
  {
    type: 'collection_streak_14',
    name: 'Fortnight Finder',
    description: 'Add cards to your collection for 14 consecutive days',
    icon: '🔍',
    category: 'collection',
    rarity: 'epic',
    points: 300,
    requirements: { collection_streak: 14 }
  },

  // Trading Activity Streak Achievements
  {
    type: 'trade_streak_3',
    name: 'Trading Rookie',
    description: 'Complete trades for 3 consecutive days',
    icon: '🤝',
    category: 'trading',
    rarity: 'common',
    points: 75,
    requirements: { trade_streak: 3 }
  },
  {
    type: 'trade_streak_7',
    name: 'Weekly Trader',
    description: 'Complete trades for 7 consecutive days',
    icon: '📈',
    category: 'trading',
    rarity: 'rare',
    points: 200,
    requirements: { trade_streak: 7 }
  },

  // Daily Activity Volume Achievements
  {
    type: 'daily_active_7',
    name: 'Active Week',
    description: 'Be active for 7 days (not necessarily consecutive)',
    icon: '⚡',
    category: 'special',
    rarity: 'common',
    points: 50,
    requirements: { active_days_30: 7 }
  },
  {
    type: 'daily_active_15',
    name: 'Consistent Collector',
    description: 'Be active for 15 days in the last 30 days',
    icon: '🎯',
    category: 'special',
    rarity: 'rare',
    points: 150,
    requirements: { active_days_30: 15 }
  },
  {
    type: 'daily_active_25',
    name: 'Almost Perfect Month',
    description: 'Be active for 25 days in the last 30 days',
    icon: '⭐',
    category: 'special',
    rarity: 'epic',
    points: 400,
    requirements: { active_days_30: 25 }
  },

  // Speed Achievements
  {
    type: 'lightning_collector',
    name: 'Lightning Collector',
    description: 'Add 10+ cards to your collection in a single day',
    icon: '⚡',
    category: 'collection',
    rarity: 'rare',
    points: 100,
    requirements: { daily_cards_added: 10 }
  },
  {
    type: 'trading_frenzy',
    name: 'Trading Frenzy',
    description: 'Complete 5+ trades in a single day',
    icon: '🔥',
    category: 'trading',
    rarity: 'epic',
    points: 400,
    requirements: { daily_trades_completed: 5 }
  },

  // Special Achievement - Early Adopter
  {
    type: 'early_adopter',
    name: 'Early Adopter',
    description: 'Join the platform in its first month',
    icon: '🚀',
    category: 'special',
    rarity: 'legendary',
    points: 500,
    requirements: { early_adopter: true },
    hidden: true
  }
]

class AchievementService {
  /**
   * Get all achievement definitions
   */
  getAchievementDefinitions(): AchievementDefinition[] {
    return ACHIEVEMENT_DEFINITIONS
  }

  /**
   * Get achievement definition by type
   */
  getAchievementDefinition(type: string): AchievementDefinition | undefined {
    return ACHIEVEMENT_DEFINITIONS.find(def => def.type === type)
  }

  /**
   * Get user's unlocked achievements
   */
  async getUserAchievements(userId: string): Promise<{ success: boolean; error?: string; data?: Achievement[] }> {
    try {
      const { data: achievements, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: achievements || [] }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Check and unlock/revoke achievements for a user
   */
  async checkAchievements(userId: string): Promise<{ success: boolean; error?: string; newAchievements?: Achievement[]; revokedAchievements?: string[] }> {
    try {
      // Get user's current achievements
      const achievementsResult = await this.getUserAchievements(userId)
      if (!achievementsResult.success) {
        return { success: false, error: achievementsResult.error }
      }

      const currentAchievements = achievementsResult.data || []
      const unlockedTypes = new Set(currentAchievements.map(a => a.achievement_type))
      const newAchievements: Achievement[] = []
      const revokedAchievements: string[] = []

      // Get user stats for checking requirements
      const stats = await this.getUserStats(userId)
      if (!stats.success || !stats.data) {
        return { success: false, error: 'Failed to get user stats' }
      }

      // Check each achievement definition
      for (const definition of ACHIEVEMENT_DEFINITIONS) {
        const isCurrentlyUnlocked = unlockedTypes.has(definition.type)
        const shouldBeUnlocked = this.checkAchievementRequirements(definition, stats.data)

        if (!isCurrentlyUnlocked && shouldBeUnlocked) {
          // Unlock new achievement using RPC to bypass RLS
          const { data: achievement, error: unlockError } = await (supabase as any)
            .rpc('unlock_user_achievement', {
              p_user_id: userId,
              p_achievement_type: definition.type,
              p_achievement_data: { points: definition.points }
            })

          if (unlockError) {
            console.error('Failed to unlock achievement via RPC:', unlockError)
            continue
          }

          if (achievement && achievement.length > 0) {
            // The RPC returns an array, get the first (and only) result
            newAchievements.push(achievement[0])
          }
        } else if (isCurrentlyUnlocked && !shouldBeUnlocked) {
          // Revoke achievement that is no longer valid
          // Don't revoke special achievements like early_adopter
          if (definition.category !== 'special') {
            console.log(`Attempting to revoke achievement: ${definition.type} for user: ${userId}`)
            
            // First, let's see what records exist
            const { data: existingRecords, error: findError } = await supabase
              .from('user_achievements')
              .select('*')
              .eq('user_id', userId)
              .eq('achievement_type', definition.type)
            
            console.log(`Found ${existingRecords?.length || 0} existing records for ${definition.type}:`, existingRecords)
            
            if (findError) {
              console.error('Error finding achievement records:', findError)
              continue
            }
            
            if (existingRecords && existingRecords.length > 0) {
              // Use service role to bypass RLS for deletion
              const { error: revokeError, data: deletedData } = await (supabase as any)
                .rpc('delete_user_achievement', {
                  p_user_id: userId,
                  p_achievement_type: definition.type
                })

              if (revokeError) {
                console.error('Failed to revoke achievement:', revokeError)
                // Fallback to direct deletion if RPC fails
                const { error: directError } = await supabase
                  .from('user_achievements')
                  .delete()
                  .eq('user_id', userId)
                  .eq('achievement_type', definition.type)
                
                if (directError) {
                  console.error('Direct deletion also failed:', directError)
                  continue
                }
              }

              console.log(`Successfully revoked achievement: ${definition.type}`)
              revokedAchievements.push(definition.type)
            } else {
              console.log(`No records found to delete for achievement: ${definition.type}`)
            }
          }
        }
      }

      return { success: true, newAchievements, revokedAchievements }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get user statistics for achievement checking
   */
  private async getUserStats(userId: string): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      // Get collection stats with available card information
      const { data: userCollections, error: collectionError } = await supabase
        .from('user_collections')
        .select(`
          quantity,
          variant,
          cards!inner(
            id,
            name,
            rarity,
            cardmarket_avg_sell_price,
            cardmarket_low_price,
            cardmarket_trend_price,
            cardmarket_reverse_holo_sell,
            cardmarket_reverse_holo_low,
            cardmarket_reverse_holo_trend
          )
        `)
        .eq('user_id', userId)

      if (collectionError) {
        return { success: false, error: collectionError.message }
      }

      // Group collection items by card to calculate variant-specific pricing
      const cardGroups = userCollections?.reduce((acc, item) => {
        const cardId = item.cards.id
        if (!acc[cardId]) {
          acc[cardId] = {
            card: item.cards,
            variants: {
              normal: 0,
              holo: 0,
              reverseHolo: 0,
              pokeballPattern: 0,
              masterballPattern: 0,
              firstEdition: 0,
            }
          }
        }
        
        // Add quantity to the appropriate variant
        const variant = (item as any).variant || 'normal'
        switch (variant) {
          case 'normal':
            acc[cardId].variants.normal += item.quantity
            break
          case 'holo':
            acc[cardId].variants.holo += item.quantity
            break
          case 'reverse_holo':
            acc[cardId].variants.reverseHolo += item.quantity
            break
          case 'pokeball_pattern':
            acc[cardId].variants.pokeballPattern += item.quantity
            break
          case 'masterball_pattern':
            acc[cardId].variants.masterballPattern += item.quantity
            break
          case '1st_edition':
            acc[cardId].variants.firstEdition += item.quantity
            break
        }
        
        return acc
      }, {} as Record<string, { card: any; variants: any }>) || {}

      const totalCards = userCollections?.reduce((sum, item) => sum + item.quantity, 0) || 0
      const uniqueCards = Object.keys(cardGroups).length
      const totalValueEur = Object.values(cardGroups).reduce((sum, { card, variants }) => {
        if (!card) return sum
        
        const cardValue = calculateCardVariantValue(
          {
            cardmarket_avg_sell_price: card.cardmarket_avg_sell_price,
            cardmarket_low_price: card.cardmarket_low_price,
            cardmarket_trend_price: card.cardmarket_trend_price,
            cardmarket_reverse_holo_sell: card.cardmarket_reverse_holo_sell,
            cardmarket_reverse_holo_low: card.cardmarket_reverse_holo_low,
            cardmarket_reverse_holo_trend: card.cardmarket_reverse_holo_trend,
          },
          variants
        )
        
        return sum + cardValue
      }, 0)

      // Get friends count - fix the query structure
      const { data: friendships, error: friendsError } = await supabase
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

      if (friendsError) {
        console.error('Error fetching friendships:', friendsError)
        return { success: false, error: friendsError.message }
      }

      const friendsCount = friendships?.length || 0
      console.log(`Friends query result: ${friendsCount} friends found for user ${userId}`)

      // Get trading stats - fix the query structure
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)

      if (tradesError) {
        console.error('Error fetching trades:', tradesError)
        return { success: false, error: tradesError.message }
      }

      const allTrades = trades || []
      const completedTrades = allTrades.filter(t => t.status === 'completed')
      console.log(`Trades query result: ${allTrades.length} total trades, ${completedTrades.length} completed for user ${userId}`)
      
      // Debug: Log all trade statuses
      if (allTrades.length > 0) {
        const statusCounts = allTrades.reduce((acc, trade) => {
          acc[trade.status] = (acc[trade.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        console.log('Trade status breakdown:', statusCounts)
      }

      // Calculate themed achievement stats based on available card data
      const cardDetails = userCollections?.map(item => ({
        name: item.cards.name || '',
        rarity: item.cards.rarity || '',
        variant: (item as any).variant || 'normal',
        quantity: item.quantity
      })) || []

      // Get rare cards count
      const rareCardCount = userCollections?.filter((item: any) =>
        ['rare', 'ultra rare', 'secret rare', 'rainbow rare'].includes(item.cards.rarity.toLowerCase())
      ).length || 0

      // Pokémon-specific counts (basic name matching)
      const pikachuCards = cardDetails.filter(card =>
        card.name.toLowerCase().includes('pikachu')
      ).length

      const charizardCards = cardDetails.filter(card =>
        card.name.toLowerCase().includes('charizard')
      ).length

      // Eeveelution check (simplified - just check for different eeveelution names)
      const eeveelutions = ['eevee', 'vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon']
      const eeveelutionCards = eeveelutions.filter(evo =>
        cardDetails.some(card => card.name.toLowerCase().includes(evo))
      )
      const eeveelutionComplete = eeveelutionCards.length >= 9

      // Rarity and variant counts
      const holoCards = cardDetails.filter(card =>
        card.variant === 'holo' || card.rarity.toLowerCase().includes('holo')
      ).length

      const firstEditionCards = cardDetails.filter(card =>
        card.variant === '1st_edition'
      ).length

      const secretRareCards = cardDetails.filter(card =>
        card.rarity.toLowerCase().includes('secret')
      ).length

      const promoCards = cardDetails.filter(card =>
        card.name.toLowerCase().includes('promo')
      ).length

      // Exact number checks
      const exactCards = totalCards
      const exactUniqueCards = uniqueCards

      // Get streak data (with error handling)
      let streakData: any = null
      try {
        const result = await (supabase as any).rpc('get_user_streak_stats', { p_user_id: userId })
        if (!result.error) {
          streakData = result.data
        } else {
          console.error('Error fetching streak data:', result.error)
        }
      } catch (error) {
        console.error('Error calling get_user_streak_stats:', error)
      }

      // Get daily activity data (with error handling)
      let activityData: any = null
      try {
        const result = await (supabase as any).rpc('get_user_daily_activity_stats', {
          p_user_id: userId,
          p_days_back: 30
        })
        if (!result.error) {
          activityData = result.data
        } else {
          console.error('Error fetching activity data:', result.error)
        }
      } catch (error) {
        console.error('Error calling get_user_daily_activity_stats:', error)
      }

      // Extract streak values (with safe access)
      const streaks = streakData || {}
      const loginStreak = (streaks as any)?.login?.current || 0
      const collectionStreak = (streaks as any)?.collection_add?.current || 0
      const tradeStreak = (streaks as any)?.trade?.current || 0

      // Extract activity values (with safe access)
      const activity = activityData || {}
      const activeDays30 = (activity as any)?.total_active_days || 0
      const activityTotals = (activity as any)?.activity_totals || {}
      const dailyCardsAdded = (activityTotals as any)?.cards_added || 0
      const dailyTradesCompleted = (activityTotals as any)?.trades_completed || 0

      // Get user profile for early adopter check
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', userId)
        .single()

      if (profileError) {
        return { success: false, error: profileError.message }
      }

      const isEarlyAdopter = profile && new Date(profile.created_at) < new Date('2024-02-01')

      const stats = {
        // Basic counts
        unique_cards: uniqueCards,
        total_cards: totalCards,
        collection_value_eur: totalValueEur,
        friends: friendsCount,
        completed_trades: completedTrades.length,
        rare_cards: rareCardCount,
        early_adopter: isEarlyAdopter,

        // Pokémon-specific
        pikachu_cards: pikachuCards,
        charizard_cards: charizardCards,
        eeveelution_complete: eeveelutionComplete,

        // Rarity and variants
        holo_cards: holoCards,
        first_edition_cards: firstEditionCards,
        secret_rare_cards: secretRareCards,

        // Special cards
        promo_cards: promoCards,

        // Exact number achievements
        exact_cards: exactCards,
        exact_unique_cards: exactUniqueCards,

        // Streak and daily activity data
        login_streak: loginStreak,
        collection_streak: collectionStreak,
        trade_streak: tradeStreak,
        active_days_30: activeDays30,
        daily_cards_added: dailyCardsAdded,
        daily_trades_completed: dailyTradesCompleted,

        // Placeholder for achievements that need more complex logic or database schema updates
        fire_type_cards: 0, // Would need type information
        water_type_cards: 0, // Would need type information
        electric_type_cards: 0, // Would need type information
        all_types_collected: false, // Would need type information
        gen1_cards: 0, // Would need generation information
        gen2_cards: 0, // Would need generation information
        modern_sets: 0, // Would need set information
        vintage_sets: 0, // Would need set information
        classic_sets_complete: false, // Would need set information
        legendary_pokemon: 0, // Would need legendary Pokémon identification
        shiny_cards: 0, // Would need shiny card identification
        starter_generations: 0, // Would need starter Pokémon identification
        full_art_cards: 0, // Would need full art identification
        alt_art_cards: 0, // Would need alternate art identification
        shadowless_cards: 0, // Would need shadowless identification
        holiday_cards: 0, // Would need holiday card identification
        completed_sets: 0 // Would need set completion logic
      }

      return { success: true, data: stats }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Check if achievement requirements are met
   */
  private checkAchievementRequirements(definition: AchievementDefinition, stats: any): boolean {
    const req = definition.requirements

    // Collection achievements
    if (req.unique_cards && stats.unique_cards < req.unique_cards) return false
    if (req.cards && stats.total_cards < req.cards) return false
    if (req.collection_value_eur && stats.collection_value_eur < req.collection_value_eur) return false
    if (req.rare_cards && stats.rare_cards < req.rare_cards) return false

    // Social achievements
    if (req.friends && stats.friends < req.friends) return false

    // Trading achievements
    if (req.completed_trades && stats.completed_trades < req.completed_trades) return false

    // Special achievements - Pokemon specific
    if (req.pikachu_cards && stats.pikachu_cards < req.pikachu_cards) return false
    if (req.charizard_cards && stats.charizard_cards < req.charizard_cards) return false
    if (req.eeveelution_complete && !stats.eeveelution_complete) return false
    if (req.legendary_pokemon && stats.legendary_pokemon < req.legendary_pokemon) return false
    if (req.shiny_cards && stats.shiny_cards < req.shiny_cards) return false
    if (req.starter_generations && stats.starter_generations < req.starter_generations) return false

    // Type-based achievements
    if (req.fire_type_cards && stats.fire_type_cards < req.fire_type_cards) return false
    if (req.water_type_cards && stats.water_type_cards < req.water_type_cards) return false
    if (req.electric_type_cards && stats.electric_type_cards < req.electric_type_cards) return false
    if (req.all_types_collected && !stats.all_types_collected) return false

    // Generation-based achievements
    if (req.gen1_cards && stats.gen1_cards < req.gen1_cards) return false
    if (req.gen2_cards && stats.gen2_cards < req.gen2_cards) return false

    // Rarity and variant achievements
    if (req.holo_cards && stats.holo_cards < req.holo_cards) return false
    if (req.first_edition_cards && stats.first_edition_cards < req.first_edition_cards) return false
    if (req.secret_rare_cards && stats.secret_rare_cards < req.secret_rare_cards) return false
    if (req.full_art_cards && stats.full_art_cards < req.full_art_cards) return false
    if (req.alt_art_cards && stats.alt_art_cards < req.alt_art_cards) return false
    if (req.shadowless_cards && stats.shadowless_cards < req.shadowless_cards) return false

    // Set-based achievements
    if (req.modern_sets && stats.modern_sets < req.modern_sets) return false
    if (req.vintage_sets && stats.vintage_sets < req.vintage_sets) return false
    if (req.classic_sets_complete && !stats.classic_sets_complete) return false
    if (req.completed_sets && stats.completed_sets < req.completed_sets) return false

    // Special card types
    if (req.promo_cards && stats.promo_cards < req.promo_cards) return false
    if (req.holiday_cards && stats.holiday_cards < req.holiday_cards) return false

    // Exact number achievements
    if (req.exact_cards && stats.exact_cards !== req.exact_cards) return false
    if (req.exact_unique_cards && stats.exact_unique_cards !== req.exact_unique_cards) return false

    // Streak achievements
    if (req.login_streak && stats.login_streak < req.login_streak) return false
    if (req.collection_streak && stats.collection_streak < req.collection_streak) return false
    if (req.trade_streak && stats.trade_streak < req.trade_streak) return false

    // Daily activity achievements
    if (req.active_days_30 && stats.active_days_30 < req.active_days_30) return false
    if (req.daily_cards_added && stats.daily_cards_added < req.daily_cards_added) return false
    if (req.daily_trades_completed && stats.daily_trades_completed < req.daily_trades_completed) return false

    // Early adopter
    if (req.early_adopter && !stats.early_adopter) return false

    return true
  }

  /**
   * Get achievement progress for a user
   */
  async getAchievementProgress(userId: string): Promise<{ success: boolean; error?: string; data?: AchievementProgress[] }> {
    try {
      const achievementsResult = await this.getUserAchievements(userId)
      if (!achievementsResult.success) {
        return { success: false, error: achievementsResult.error }
      }

      const unlockedTypes = new Set(achievementsResult.data?.map(a => a.achievement_type) || [])

      const statsResult = await this.getUserStats(userId)
      if (!statsResult.success || !statsResult.data) {
        return { success: false, error: 'Failed to get user stats' }
      }

      const stats = statsResult.data
      const progress: AchievementProgress[] = []

      for (const definition of ACHIEVEMENT_DEFINITIONS) {
        if (definition.hidden && !unlockedTypes.has(definition.type)) {
          continue // Skip hidden achievements that aren't unlocked
        }

        // Determine unlocked status - if it's in database, it should be unlocked
        // Only check requirements for display purposes (progress calculation)
        const unlocked = unlockedTypes.has(definition.type)

        const current = this.getCurrentProgress(definition, stats, unlocked)
        const required = this.getRequiredProgress(definition)
        const percentage = required > 0 ? Math.min((current / required) * 100, 100) : 100

        progress.push({
          achievement_type: definition.type,
          current,
          required,
          percentage,
          unlocked,
          definition
        })
      }

      return { success: true, data: progress }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get current progress value for an achievement
   */
  private getCurrentProgress(definition: AchievementDefinition, stats: any, isUnlocked: boolean = false): number {
    const req = definition.requirements
    let currentValue = 0

    // Collection achievements
    if (req.unique_cards) currentValue = stats.unique_cards
    else if (req.cards) currentValue = stats.total_cards
    else if (req.collection_value_eur) currentValue = stats.collection_value_eur
    else if (req.rare_cards) currentValue = stats.rare_cards
    
    // Social achievements
    else if (req.friends) currentValue = stats.friends
    
    // Trading achievements
    else if (req.completed_trades) currentValue = stats.completed_trades
    
    // Pokemon-specific achievements
    else if (req.pikachu_cards) currentValue = stats.pikachu_cards
    else if (req.charizard_cards) currentValue = stats.charizard_cards
    else if (req.legendary_pokemon) currentValue = stats.legendary_pokemon
    else if (req.shiny_cards) currentValue = stats.shiny_cards
    else if (req.starter_generations) currentValue = stats.starter_generations
    
    // Type-based achievements
    else if (req.fire_type_cards) currentValue = stats.fire_type_cards
    else if (req.water_type_cards) currentValue = stats.water_type_cards
    else if (req.electric_type_cards) currentValue = stats.electric_type_cards
    
    // Generation-based achievements
    else if (req.gen1_cards) currentValue = stats.gen1_cards
    else if (req.gen2_cards) currentValue = stats.gen2_cards
    
    // Rarity and variant achievements
    else if (req.holo_cards) currentValue = stats.holo_cards
    else if (req.first_edition_cards) currentValue = stats.first_edition_cards
    else if (req.secret_rare_cards) currentValue = stats.secret_rare_cards
    else if (req.full_art_cards) currentValue = stats.full_art_cards
    else if (req.alt_art_cards) currentValue = stats.alt_art_cards
    else if (req.shadowless_cards) currentValue = stats.shadowless_cards
    
    // Set-based achievements
    else if (req.modern_sets) currentValue = stats.modern_sets
    else if (req.vintage_sets) currentValue = stats.vintage_sets
    else if (req.completed_sets) currentValue = stats.completed_sets
    
    // Special card types
    else if (req.promo_cards) currentValue = stats.promo_cards
    else if (req.holiday_cards) currentValue = stats.holiday_cards
    
    // Exact number achievements
    else if (req.exact_cards) currentValue = stats.exact_cards
    else if (req.exact_unique_cards) currentValue = stats.exact_unique_cards
    
    // Streak achievements
    else if (req.login_streak) currentValue = stats.login_streak
    else if (req.collection_streak) currentValue = stats.collection_streak
    else if (req.trade_streak) currentValue = stats.trade_streak
    
    // Daily activity achievements
    else if (req.active_days_30) currentValue = stats.active_days_30
    else if (req.daily_cards_added) currentValue = stats.daily_cards_added
    else if (req.daily_trades_completed) currentValue = stats.daily_trades_completed
    
    // Boolean achievements (show as 0 or 1)
    else if (req.eeveelution_complete !== undefined) currentValue = stats.eeveelution_complete ? 1 : 0
    else if (req.all_types_collected !== undefined) currentValue = stats.all_types_collected ? 1 : 0
    else if (req.classic_sets_complete !== undefined) currentValue = stats.classic_sets_complete ? 1 : 0
    else if (req.early_adopter !== undefined) currentValue = stats.early_adopter ? 1 : 0

    // If achievement is unlocked, cap the display at the required value
    // This prevents showing values like "378.02/100" and shows "100/100" instead
    if (isUnlocked) {
      const requiredValue = this.getRequiredProgress(definition)
      return requiredValue // Show exactly the required amount for unlocked achievements
    }

    return Math.max(0, currentValue) // Ensure we don't show negative values
  }

  /**
   * Get required progress value for an achievement
   */
  private getRequiredProgress(definition: AchievementDefinition): number {
    const req = definition.requirements

    // Collection achievements
    if (req.unique_cards) return req.unique_cards
    if (req.cards) return req.cards
    if (req.collection_value_eur) return req.collection_value_eur
    if (req.rare_cards) return req.rare_cards
    
    // Social achievements
    if (req.friends) return req.friends
    
    // Trading achievements
    if (req.completed_trades) return req.completed_trades
    
    // Pokemon-specific achievements
    if (req.pikachu_cards) return req.pikachu_cards
    if (req.charizard_cards) return req.charizard_cards
    if (req.legendary_pokemon) return req.legendary_pokemon
    if (req.shiny_cards) return req.shiny_cards
    if (req.starter_generations) return req.starter_generations
    
    // Type-based achievements
    if (req.fire_type_cards) return req.fire_type_cards
    if (req.water_type_cards) return req.water_type_cards
    if (req.electric_type_cards) return req.electric_type_cards
    
    // Generation-based achievements
    if (req.gen1_cards) return req.gen1_cards
    if (req.gen2_cards) return req.gen2_cards
    
    // Rarity and variant achievements
    if (req.holo_cards) return req.holo_cards
    if (req.first_edition_cards) return req.first_edition_cards
    if (req.secret_rare_cards) return req.secret_rare_cards
    if (req.full_art_cards) return req.full_art_cards
    if (req.alt_art_cards) return req.alt_art_cards
    if (req.shadowless_cards) return req.shadowless_cards
    
    // Set-based achievements
    if (req.modern_sets) return req.modern_sets
    if (req.vintage_sets) return req.vintage_sets
    if (req.completed_sets) return req.completed_sets
    
    // Special card types
    if (req.promo_cards) return req.promo_cards
    if (req.holiday_cards) return req.holiday_cards
    
    // Exact number achievements
    if (req.exact_cards) return req.exact_cards
    if (req.exact_unique_cards) return req.exact_unique_cards
    
    // Streak achievements
    if (req.login_streak) return req.login_streak
    if (req.collection_streak) return req.collection_streak
    if (req.trade_streak) return req.trade_streak
    
    // Daily activity achievements
    if (req.active_days_30) return req.active_days_30
    if (req.daily_cards_added) return req.daily_cards_added
    if (req.daily_trades_completed) return req.daily_trades_completed

    // Boolean achievements always require 1
    return 1
  }

  /**
   * Get achievement statistics for a user
   */
  async getAchievementStats(userId: string): Promise<{ success: boolean; error?: string; data?: AchievementStats }> {
    try {
      const achievementsResult = await this.getUserAchievements(userId)
      if (!achievementsResult.success) {
        return { success: false, error: achievementsResult.error }
      }

      const achievements = achievementsResult.data || []
      const totalAchievements = ACHIEVEMENT_DEFINITIONS.filter(def => !def.hidden).length
      const unlockedAchievements = achievements.length
      const totalPoints = achievements.reduce((sum, ach) => sum + (ach.achievement_data?.points || 0), 0)
      const completionPercentage = totalAchievements > 0 ? (unlockedAchievements / totalAchievements) * 100 : 0

      // Category stats
      const unlockedTypes = new Set(achievements.map(a => a.achievement_type))
      const categoryStats = {
        collection: { unlocked: 0, total: 0 },
        social: { unlocked: 0, total: 0 },
        trading: { unlocked: 0, total: 0 },
        special: { unlocked: 0, total: 0 }
      }

      for (const def of ACHIEVEMENT_DEFINITIONS) {
        if (def.hidden) continue
        
        categoryStats[def.category].total++
        if (unlockedTypes.has(def.type)) {
          categoryStats[def.category].unlocked++
        }
      }

      return {
        success: true,
        data: {
          totalAchievements,
          unlockedAchievements,
          totalPoints,
          completionPercentage,
          recentAchievements: achievements.slice(0, 5),
          categoryStats
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

export const achievementService = new AchievementService()
export default achievementService